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

const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory courier state
const courierLocations = new Map(); // courierId -> { lat, lng, heading, speed, timestamp }
const courierSockets   = new Map(); // courierId -> socketId

app.prepare().then(() => {
  /**
   * Dinleyici sırası kritik:
   * 1) createServer() — callback YOK (aksi halde Next ilk çalışır, Engine.io sonra gelir → çift yanıt / kopuk sayfa)
   * 2) new Server(httpServer) — Engine.io ilk request listener'ı ekler
   * 3) httpServer.on('request', …) — Next.js; /socket.io için dokunmaz (Engine zaten yanıtladı)
   */
  const httpServer = createServer();

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

        const snapshot = Object.fromEntries(courierLocations);
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

    // ── Courier status change (online/offline/break) ───────────────────
    socket.on('courier:status:change', async ({ courierId: cid, status }) => {
      if (socket.courierId !== cid) return;
      // Broadcast to admin room so dashboard updates instantly
      io.to('admin:tracking').emit('courier:status:update', { courierId: cid, status });
      // If going offline, remove from in-memory location cache
      if (status === 'offline') {
        courierLocations.delete(cid);
      }
      // Persist status to DB
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
        courierSockets.delete(socket.courierId);
        courierLocations.delete(socket.courierId);
        console.log(`[Socket] Courier disconnected: ${socket.courierId}`);
      }
    });
  });

  httpServer.on('request', (req, res) => {
    if (req.url && req.url.startsWith('/socket.io/')) return;
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[EBA Kurye] Server ready on port ${port}`);
  });
});
