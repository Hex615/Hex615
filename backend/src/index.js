require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const limits  = require('./middleware/rateLimiter');

// ── Boot check ─────────────────────────────────────────────────────────────
const required = ['DATABASE_URL','JWT_SECRET','JWT_REFRESH_SECRET'];
for (const k of required) {
  if (!process.env[k]) { console.error(`FATAL: missing env var ${k}`); process.exit(1); }
}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET','POST','PUT','DELETE'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // handled by mobile client
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','Content-Type'],
}));

app.use(express.json({ limit: '1mb' })); // prevent large payload attacks
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Global rate limit
app.use(limits.api);

// Attach io so routes can emit
app.set('io', io);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',          require('./routes/auth'));
app.use('/users',         require('./routes/users'));
app.use('/rooms',         require('./routes/rooms'));
app.use('/gifts',         require('./routes/gifts'));
app.use('/spota',         require('./routes/spota'));
app.use('/swipe',         require('./routes/swipe'));
app.use('/feed',          require('./routes/feed'));
app.use('/voltage',       require('./routes/voltage'));
app.use('/notifications', require('./routes/notifications'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', app: 'Chatsplat', ts: new Date() }));

// ── 404 catch-all ─────────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
require('./socket')(io);

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚡ Chatsplat API on :${PORT}`));

module.exports = app;
