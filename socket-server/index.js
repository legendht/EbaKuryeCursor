require('dotenv').config();
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3002'];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: io?.engine?.clientsCount || 0 }));
    return;
  }

  if (req.method === 'POST' && req.url === '/emit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { event, room, data } = JSON.parse(body);
        io.to(room).emit(event, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid body' }));
        }
      }
    });
    return;
  }

  // Socket.io handles its own /socket.io/* routes; ignore others
  if (!req.url?.startsWith('/socket.io')) {
    res.writeHead(404);
    res.end();
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Track courier positions in memory for fast lookups
const courierLocations = new Map(); // courierId -> { lat, lng, heading, speed, timestamp }
const courierSockets = new Map();   // courierId -> socketId
const orderRooms = new Map();       // orderId -> Set of socketIds tracking it

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Courier registers itself
  socket.on('courier:register', async ({ courierId, token }) => {
    try {
      // Verify courier via supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }
      socket.courierId = courierId;
      socket.userId = user.id;
      socket.role = 'courier';
      courierSockets.set(courierId, socket.id);
      socket.join(`courier:${courierId}`);
      socket.emit('courier:registered', { courierId });
      console.log(`[Socket] Courier registered: ${courierId}`);
    } catch (err) {
      console.error('[Socket] courier:register error:', err);
    }
  });

  // Courier sends location update
  socket.on('courier:location', async ({ courierId, lat, lng, heading, speed }) => {
    if (socket.courierId !== courierId) return;

    const locationData = { lat, lng, heading: heading || 0, speed: speed || 0, timestamp: Date.now() };
    courierLocations.set(courierId, locationData);

    // Broadcast to admin tracking room
    io.to('admin:tracking').emit('courier:location:update', { courierId, ...locationData });

    // Broadcast to any order tracking rooms this courier is associated with
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, tracking_code')
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'pickup', 'in_transit']);

    if (activeOrders) {
      for (const order of activeOrders) {
        io.to(`order:${order.tracking_code}`).emit('courier:location:update', {
          courierId,
          orderId: order.id,
          trackingCode: order.tracking_code,
          ...locationData,
        });
      }
    }

    // Update DB periodically (throttled via last_seen)
    supabase
      .from('couriers')
      .update({ current_lat: lat, current_lng: lng, last_seen: new Date().toISOString() })
      .eq('id', courierId)
      .then();
  });

  // Admin joins global tracking room
  socket.on('admin:join:tracking', async ({ token }) => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) { socket.emit('error', { message: 'Unauthorized' }); return; }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') { socket.emit('error', { message: 'Forbidden' }); return; }

      socket.join('admin:tracking');
      socket.role = 'admin';
      
      // Send current snapshot of all courier locations
      const snapshot = Object.fromEntries(courierLocations);
      socket.emit('admin:tracking:snapshot', snapshot);
      console.log(`[Socket] Admin joined tracking: ${socket.id}`);
    } catch (err) {
      console.error('[Socket] admin:join:tracking error:', err);
    }
  });

  // Customer/anyone tracks an order by tracking code
  socket.on('order:track', async ({ trackingCode }) => {
    socket.join(`order:${trackingCode}`);
    socket.emit('order:tracking:joined', { trackingCode });

    // Send current courier position if order is active
    const { data: order } = await supabase
      .from('orders')
      .select('*, courier:couriers(id, current_lat, current_lng)')
      .eq('tracking_code', trackingCode)
      .single();

    if (order?.courier) {
      const cached = courierLocations.get(order.courier.id);
      const loc = cached || { lat: order.courier.current_lat, lng: order.courier.current_lng };
      if (loc.lat) {
        socket.emit('courier:location:update', {
          courierId: order.courier.id,
          orderId: order.id,
          trackingCode,
          ...loc,
        });
      }
    }
  });

  // Order status change notification (called from Next.js API)
  socket.on('order:status:update', ({ trackingCode, status, orderId }) => {
    io.to(`order:${trackingCode}`).emit('order:status:changed', { trackingCode, status, orderId });
  });

  // Courier receives a new job notification
  socket.on('courier:job:notify', ({ courierId, orderId, trackingCode }) => {
    io.to(`courier:${courierId}`).emit('courier:new:job', { orderId, trackingCode });
  });

  socket.on('disconnect', () => {
    if (socket.courierId) {
      courierSockets.delete(socket.courierId);
      console.log(`[Socket] Courier disconnected: ${socket.courierId}`);
    }
  });
});


httpServer.listen(PORT, () => {
  console.log(`[EBA Kurye Socket Server] Running on port ${PORT}`);
});
