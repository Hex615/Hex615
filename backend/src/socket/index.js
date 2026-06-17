const jwt = require('jsonwebtoken');
const db  = require('../config/database');
const { basicFilter } = require('../middleware/moderation');

// Tracks pending mic/cam requests with 60s TTL
const pendingRequests = new Map(); // key: `${roomId}:${userId}`, value: timeout

module.exports = (io) => {
  // ── JWT auth on every socket connection ────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('AUTH_REQUIRED'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', async (socket) => {
    // Each user joins their private room for direct push events
    socket.join(`user:${socket.user.userId}`);

    // ── Join Splat Room ────────────────────────────────────────────────────
    socket.on('join-room', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(`room:${roomId}`);

      const part = await db.query(
        'SELECT role FROM room_participants WHERE room_id=$1 AND user_id=$2 AND left_at IS NULL',
        [roomId, socket.user.userId]
      ).catch(() => null);
      const role = part?.rows[0]?.role || 'viewer';

      // Owners and managers get mod channel for private mic-request events
      if (role === 'owner' || role === 'manager') socket.join(`room:${roomId}:mods`);

      const user = await db.query(
        'SELECT id,username,avatar_url,monthly_rank FROM users WHERE id=$1',
        [socket.user.userId]
      ).catch(() => null);
      socket.to(`room:${roomId}`).emit('user-joined', { user: user?.rows[0] });

      const slots = await db.query(
        'SELECT rp.*,u.username,u.avatar_url,u.monthly_rank,u.is_verified FROM room_participants rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=$1 AND rp.left_at IS NULL',
        [roomId]
      ).catch(() => ({ rows: [] }));
      socket.emit('room-state', { participants: slots.rows, role });
    });

    // ── Leave room ─────────────────────────────────────────────────────────
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.leave(`room:${roomId}:mods`);
      socket.to(`room:${roomId}`).emit('user-left', { userId: socket.user.userId });
    });

    // ── Room comment — moderation hardcoded, no bypass ────────────────────
    socket.on('room-comment', async ({ roomId, content }) => {
      if (!content || typeof content !== 'string' || content.length > 500) return;
      const filtered = basicFilter(content.trim());
      try {
        const user = await db.query('SELECT username,avatar_url FROM users WHERE id=$1', [socket.user.userId]);
        const msg  = await db.query(
          'INSERT INTO room_messages (room_id,user_id,content) VALUES ($1,$2,$3) RETURNING *',
          [roomId, socket.user.userId, filtered]
        );
        io.to(`room:${roomId}`).emit('new-comment', {
          ...msg.rows[0],
          username:   user.rows[0]?.username,
          avatar_url: user.rows[0]?.avatar_url,
        });
      } catch {}
    });

    // ── Mic toggle (HARDCODED: cam-on + mic-off = blocked) ────────────────
    socket.on('toggle-mic', async ({ roomId, mic_on }) => {
      try {
        const part = await db.query(
          'SELECT cam_on FROM room_participants WHERE room_id=$1 AND user_id=$2',
          [roomId, socket.user.userId]
        );
        if (!part.rows[0]) return;
        // If turning mic off while cam is on — cam stays on (manager-mute case)
        await db.query(
          'UPDATE room_participants SET mic_on=$1 WHERE room_id=$2 AND user_id=$3',
          [mic_on, roomId, socket.user.userId]
        );
        const slots = await db.query(
          'SELECT rp.*,u.username,u.avatar_url FROM room_participants rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=$1 AND rp.left_at IS NULL',
          [roomId]
        );
        io.to(`room:${roomId}`).emit('mic-update', { slots: slots.rows });
      } catch {}
    });

    // ── Camera toggle — BLOCKED if mic is off ─────────────────────────────
    socket.on('toggle-cam', async ({ roomId, cam_on }) => {
      try {
        const part = await db.query(
          'SELECT mic_on FROM room_participants WHERE room_id=$1 AND user_id=$2',
          [roomId, socket.user.userId]
        );
        if (!part.rows[0]) return;

        // HARDCODED — Camera ON + Mic OFF = BLOCKED, no exceptions
        if (cam_on && !part.rows[0].mic_on) {
          socket.emit('cam-blocked', { reason: 'Turn mic on before enabling camera.' });
          return;
        }

        await db.query(
          'UPDATE room_participants SET cam_on=$1 WHERE room_id=$2 AND user_id=$3',
          [cam_on, roomId, socket.user.userId]
        );
        const slots = await db.query(
          'SELECT rp.*,u.username,u.avatar_url FROM room_participants rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=$1 AND rp.left_at IS NULL',
          [roomId]
        );
        io.to(`room:${roomId}`).emit('cam-update', { slots: slots.rows });
      } catch {}
    });

    // ── Mic/cam request (60s TTL) ─────────────────────────────────────────
    socket.on('request-mic', async ({ roomId, type = 'mic' }) => {
      const key = `${roomId}:${socket.user.userId}`;
      if (pendingRequests.has(key)) return; // debounce duplicate requests

      const user = await db.query(
        'SELECT username,avatar_url FROM users WHERE id=$1',
        [socket.user.userId]
      ).catch(() => null);

      io.to(`room:${roomId}:mods`).emit('mic-request', {
        userId:     socket.user.userId,
        username:   user?.rows[0]?.username,
        avatar_url: user?.rows[0]?.avatar_url,
        type,
        expiresAt:  Date.now() + 60000,
      });

      const timer = setTimeout(() => pendingRequests.delete(key), 60000);
      pendingRequests.set(key, timer);
    });

    // ── Grant mic slot (owner + manager only) ─────────────────────────────
    socket.on('grant-mic', async ({ roomId, userId, slot }) => {
      try {
        const actor = await db.query(
          'SELECT role FROM room_participants WHERE room_id=$1 AND user_id=$2 AND left_at IS NULL',
          [roomId, socket.user.userId]
        );
        if (!['owner','manager'].includes(actor.rows[0]?.role)) return;
        if (slot < 1 || slot > 20) return;

        // Clear pending request
        const key = `${roomId}:${userId}`;
        clearTimeout(pendingRequests.get(key));
        pendingRequests.delete(key);

        await db.query(
          "UPDATE room_participants SET role='speaker',mic_slot=$1,mic_on=true WHERE room_id=$2 AND user_id=$3",
          [slot, roomId, userId]
        );
        const slots = await db.query(
          'SELECT rp.*,u.username,u.avatar_url FROM room_participants rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=$1 AND rp.left_at IS NULL',
          [roomId]
        );
        io.to(`room:${roomId}`).emit('mic-update', { slots: slots.rows });
        io.to(`user:${userId}`).emit('mic-granted', { slot });
      } catch {}
    });

    // ── Gift events: sender + receiver = full animation; rest = toast ─────
    socket.on('gift-sent', ({ roomId, gift, receiverId }) => {
      socket.emit('gift-received',             { gift, type: 'sender',   senderId: socket.user.userId });
      io.to(`user:${receiverId}`).emit('gift-received', { gift, type: 'receiver', senderId: socket.user.userId });
      socket.to(`room:${roomId}`).except(`user:${receiverId}`).emit('gift-toast', {
        gift,
        senderUserId: socket.user.userId,
      });
    });

    // ── Boost bar ─────────────────────────────────────────────────────────
    socket.on('boost', ({ roomId, count }) => {
      io.to(`room:${roomId}`).emit('boost-update', { count });
    });

    // ── Floating emoji reactions ──────────────────────────────────────────
    socket.on('react', ({ roomId, emoji }) => {
      if (typeof emoji !== 'string' || emoji.length > 4) return;
      socket.to(`room:${roomId}`).emit('reaction', { emoji, userId: socket.user.userId });
    });

    // ── DM chat ───────────────────────────────────────────────────────────
    socket.on('join-chat', ({ matchId }) => {
      if (matchId) socket.join(`chat:${matchId}`);
    });

    socket.on('send-message', async ({ matchId, content, type = 'text', media_url }) => {
      if (!content && !media_url) return;
      const filtered = type === 'text' ? basicFilter(String(content).trim()) : content;
      try {
        const match = await db.query(
          'SELECT id FROM matches WHERE id=$1 AND (user1_id=$2 OR user2_id=$2)',
          [matchId, socket.user.userId]
        );
        if (!match.rows[0]) return;

        const msg  = await db.query(
          'INSERT INTO messages (match_id,sender_id,content,type,media_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [matchId, socket.user.userId, filtered, type, media_url]
        );
        const user = await db.query('SELECT username,avatar_url FROM users WHERE id=$1', [socket.user.userId]);
        io.to(`chat:${matchId}`).emit('new-message', {
          ...msg.rows[0],
          username:   user.rows[0]?.username,
          avatar_url: user.rows[0]?.avatar_url,
        });
      } catch {}
    });

    socket.on('typing', ({ matchId }) => {
      if (matchId) socket.to(`chat:${matchId}`).emit('typing', { userId: socket.user.userId });
    });

    socket.on('disconnect', () => {
      // Clean up any pending mic requests from this user
      for (const [key, timer] of pendingRequests.entries()) {
        if (key.includes(socket.user.userId)) {
          clearTimeout(timer);
          pendingRequests.delete(key);
        }
      }
    });
  });
};
