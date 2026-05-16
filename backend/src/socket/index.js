const jwt = require('jsonwebtoken');
const db = require('../config/database');

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.userId}`);

    socket.on('join-room', async ({ roomId }) => {
      socket.join(`room:${roomId}`);

      try {
        const user = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1', [socket.user.userId]);
        if (user.rows[0]) {
          socket.to(`room:${roomId}`).emit('user-joined', { user: user.rows[0] });
        }

        const participants = await db.query(
          `SELECT rp.*, u.username, u.avatar_url FROM room_participants rp
           JOIN users u ON rp.user_id = u.id
           WHERE rp.room_id = $1 AND rp.left_at IS NULL`,
          [roomId]
        );
        socket.emit('room-state', { participants: participants.rows });
      } catch (err) {
        console.error('join-room error:', err);
      }
    });

    socket.on('leave-room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('user-left', { userId: socket.user.userId });
    });

    socket.on('room-comment', async ({ roomId, content }) => {
      if (!content || content.length > 500) return;
      try {
        const user = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [socket.user.userId]);
        const msg = await db.query(
          'INSERT INTO room_messages (room_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
          [roomId, socket.user.userId, content]
        );
        io.to(`room:${roomId}`).emit('new-comment', {
          ...msg.rows[0],
          username: user.rows[0].username,
          avatar_url: user.rows[0].avatar_url,
        });
      } catch (err) {
        console.error('room-comment error:', err);
      }
    });

    socket.on('request-mic', async ({ roomId, slot }) => {
      try {
        const room = await db.query('SELECT host_id FROM rooms WHERE id = $1', [roomId]);
        if (!room.rows[0]) return;
        io.to(`room:${roomId}`).emit('mic-request', { userId: socket.user.userId, slot });
      } catch (err) {
        console.error('request-mic error:', err);
      }
    });

    socket.on('grant-mic', async ({ roomId, userId, slot }) => {
      try {
        const room = await db.query('SELECT host_id FROM rooms WHERE id = $1', [roomId]);
        if (!room.rows[0] || room.rows[0].host_id !== socket.user.userId) return;

        await db.query(
          'UPDATE room_participants SET role = $1, mic_slot = $2 WHERE room_id = $3 AND user_id = $4',
          ['speaker', slot, roomId, userId]
        );

        const participants = await db.query(
          `SELECT rp.*, u.username, u.avatar_url FROM room_participants rp
           JOIN users u ON rp.user_id = u.id
           WHERE rp.room_id = $1 AND rp.left_at IS NULL`,
          [roomId]
        );
        io.to(`room:${roomId}`).emit('mic-update', { slots: participants.rows });
      } catch (err) {
        console.error('grant-mic error:', err);
      }
    });

    socket.on('revoke-mic', async ({ roomId, userId }) => {
      try {
        const room = await db.query('SELECT host_id FROM rooms WHERE id = $1', [roomId]);
        if (!room.rows[0] || room.rows[0].host_id !== socket.user.userId) return;

        await db.query(
          'UPDATE room_participants SET role = $1, mic_slot = NULL WHERE room_id = $2 AND user_id = $3',
          ['listener', roomId, userId]
        );

        const participants = await db.query(
          `SELECT rp.*, u.username, u.avatar_url FROM room_participants rp
           JOIN users u ON rp.user_id = u.id WHERE rp.room_id = $1 AND rp.left_at IS NULL`,
          [roomId]
        );
        io.to(`room:${roomId}`).emit('mic-update', { slots: participants.rows });
      } catch (err) {
        console.error('revoke-mic error:', err);
      }
    });

    socket.on('gift-sent', ({ roomId, gift, receiver }) => {
      io.to(`room:${roomId}`).emit('gift-received', {
        gift,
        sender: socket.user.userId,
        receiver,
      });
    });

    socket.on('boost', ({ roomId, count }) => {
      io.to(`room:${roomId}`).emit('boost-update', { count });
    });

    socket.on('join-chat', ({ matchId }) => {
      socket.join(`chat:${matchId}`);
    });

    socket.on('send-message', async ({ matchId, content, type = 'text', media_url }) => {
      if (!content && !media_url) return;
      try {
        const msg = await db.query(
          'INSERT INTO messages (match_id, sender_id, content, type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [matchId, socket.user.userId, content, type, media_url]
        );
        const user = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [socket.user.userId]);
        io.to(`chat:${matchId}`).emit('new-message', {
          ...msg.rows[0],
          username: user.rows[0].username,
          avatar_url: user.rows[0].avatar_url,
        });
      } catch (err) {
        console.error('send-message error:', err);
      }
    });

    socket.on('typing', ({ matchId }) => {
      socket.to(`chat:${matchId}`).emit('typing', { userId: socket.user.userId });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.userId}`);
    });
  });
};
