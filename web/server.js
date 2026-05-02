/**
 * EBA Kurye – Next.js + Socket.io Combined Custom Server
 * Runs both on the same port (3000) so no extra firewall rules needed.
 */
require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// In-memory courier state
const courierLocations        = new Map(); // courierId -> { lat, lng, heading, speed, timestamp }
const courierSockets          = new Map(); // courierId -> socketId
const courierStatuses         = new Map(); // courierId -> status string
const courierDisconnectTimers = new Map(); // courierId -> timeout handle (grace period)

// Break couriers stay on map for 4 hours; online/busy couriers get 3 minutes
const GRACE_MS = { break: 4 * 60 * 60 * 1000, default: 3 * 60 * 1000 };

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/emit') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { room, event, data } = JSON.parse(body || '{}');
          if (!room || !event) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'room and event required' }));
            return;
          }
          io.to(room).emit(event, data || {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid json' }));
        }
      });
      return;
    }
    // Socket.io polling requests are handled by the Socket.io engine, not Next.js
    if (req.url && req.url.startsWith('/socket.io/')) return;
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Courier registers ──────────────────────────────────────────────
    socket.on('courier:register', async ({ courierId, token }) => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) { socket.emit('error', { message: 'Unauthorized' }); return; }
        socket.courierId = courierId;
        socket.userId    = user.id;
        socket.role      = 'courier';
        courierSockets.set(courierId, socket.id);
        socket.join(`courier:${courierId}`);
        socket.emit('courier:registered', { courierId });

        // Cancel any pending grace-period removal on reconnect
        if (courierDisconnectTimers.has(courierId)) {
          clearTimeout(courierDisconnectTimers.get(courierId));
          courierDisconnectTimers.delete(courierId);
          console.log(`[Socket] Courier reconnected, grace period cancelled: ${courierId}`);
        }

        console.log(`[Socket] Courier registered: ${courierId}`);
      } catch (err) {
        console.error('[Socket] courier:register error:', err);
      }
    });

    // ── Courier location update ────────────────────────────────────────
    socket.on('courier:location', async ({ courierId, lat, lng, heading, speed }) => {
      if (socket.courierId !== courierId) return;

      const loc = { lat, lng, heading: heading || 0, speed: speed || 0, timestamp: Date.now() };
      courierLocations.set(courierId, loc);

      // Broadcast to admin room
      io.to('admin:tracking').emit('courier:location:update', { courierId, ...loc });

      // Broadcast to active order rooms
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, tracking_code')
        .eq('courier_id', courierId)
        .in('status', ['assigned', 'pickup', 'in_transit']);

      if (activeOrders) {
        for (const order of activeOrders) {
          io.to(`order:${order.tracking_code}`).emit('courier:location:update', {
            courierId, orderId: order.id, trackingCode: order.tracking_code, ...loc,
          });
        }
      }

      // Persist to DB (throttled by 5s)
      supabase.from('couriers')
        .update({ current_lat: lat, current_lng: lng, last_seen: new Date().toISOString() })
        .eq('id', courierId)
        .then();
    });

    // ── Admin joins tracking room ──────────────────────────────────────
    socket.on('admin:join:tracking', async ({ token }) => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) { socket.emit('error', { message: 'Unauthorized' }); return; }

        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') { socket.emit('error', { message: 'Forbidden' }); return; }

        socket.join('admin:tracking');
        socket.role = 'admin';

        // Snapshot'a status bilgisini de ekle
        const snapshot = {};
        for (const [cid, loc] of courierLocations) {
          snapshot[cid] = { ...loc, status: courierStatuses.get(cid) || 'online' };
        }
        socket.emit('admin:tracking:snapshot', snapshot);
        console.log(`[Socket] Admin joined tracking: ${socket.id}`);
      } catch (err) {
        console.error('[Socket] admin:join:tracking error:', err);
      }
    });

    // ── Order tracking ─────────────────────────────────────────────────
    socket.on('order:track', async ({ trackingCode }) => {
      socket.join(`order:${trackingCode}`);
      socket.emit('order:tracking:joined', { trackingCode });

      const { data: order } = await supabase
        .from('orders')
        .select('*, courier:couriers(id, current_lat, current_lng)')
        .eq('tracking_code', trackingCode)
        .single();

      if (order?.courier) {
        const cached = courierLocations.get(order.courier.id);
        const loc = cached || { lat: order.courier.current_lat, lng: order.courier.current_lng };
        if (loc?.lat) {
          socket.emit('courier:location:update', {
            courierId: order.courier.id, orderId: order.id, trackingCode, ...loc,
          });
        }
      }
    });

    // ── Courier status change (online/offline/break/busy) ─────────────
    socket.on('courier:status:change', async ({ courierId: cid, status }) => {
      if (socket.courierId !== cid) return;
      courierStatuses.set(cid, status);
      // Offline olunca konumu bellekten SILME – admin haritası son konumu göstermeye devam etsin
      io.to('admin:tracking').emit('courier:status:update', { courierId: cid, status });
      supabase.from('couriers')
        .update({ status, last_seen: new Date().toISOString() })
        .eq('id', cid)
        .then();
    });

    // ── New job notify ─────────────────────────────────────────────────
    socket.on('courier:job:notify', ({ courierId: cid, orderId, trackingCode }) => {
      io.to(`courier:${cid}`).emit('courier:new:job', { orderId, trackingCode });
    });

    socket.on('disconnect', () => {
      if (socket.courierId) {
        const cid = socket.courierId;
        courierSockets.delete(cid);

        // Break couriers stay on map for 4 h (phone may sleep during break).
        // Online/busy couriers get a 3-minute window to reconnect.
        const status = courierStatuses.get(cid) || 'online';
        const delay = status === 'break' ? GRACE_MS.break : GRACE_MS.default;

        const timer = setTimeout(() => {
          courierLocations.delete(cid);
          courierStatuses.delete(cid);
          courierDisconnectTimers.delete(cid);
          io.to('admin:tracking').emit('courier:status:update', { courierId: cid, status: 'offline' });
          console.log(`[Socket] Courier removed after ${delay / 60000} min grace: ${cid}`);
        }, delay);

        courierDisconnectTimers.set(cid, timer);
        console.log(`[Socket] Courier disconnected (${status}, grace ${delay / 60000} min): ${cid}`);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`[EBA Kurye] Server ready on http://localhost:${port}`);
  });
});
