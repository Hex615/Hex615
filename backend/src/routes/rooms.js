const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

router.get('/', auth, async (req, res) => {
  const { category, tab } = req.query;
  try {
    let query = `
      SELECT r.*, u.username as host_username, u.avatar_url as host_avatar,
        COUNT(DISTINCT rp.id) as participant_count,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = r.host_id) as host_is_followed
      FROM rooms r
      JOIN users u ON r.host_id = u.id
      LEFT JOIN room_participants rp ON r.id = rp.room_id AND rp.left_at IS NULL
      WHERE r.is_live = true AND r.ended_at IS NULL
    `;
    const params = [req.user.userId];

    if (category) { query += ` AND r.category = $${params.length + 1}`; params.push(category); }
    if (tab === 'following') {
      query += ` AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $${params.length + 1} AND f.following_id = r.host_id)`;
      params.push(req.user.userId);
    }

    query += ' GROUP BY r.id, u.username, u.avatar_url ORDER BY participant_count DESC LIMIT 50';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scheduled', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.username as host_username, u.avatar_url as host_avatar,
        COUNT(DISTINCT rv.id) as rsvp_count,
        EXISTS(SELECT 1 FROM room_rsvps rv2 WHERE rv2.room_id = r.id AND rv2.user_id = $1) as has_rsvped
       FROM rooms r
       JOIN users u ON r.host_id = u.id
       LEFT JOIN room_rsvps rv ON r.id = rv.room_id
       WHERE r.is_scheduled = true AND r.is_live = false AND r.ended_at IS NULL AND r.scheduled_at > NOW()
       GROUP BY r.id, u.username, u.avatar_url
       ORDER BY r.scheduled_at ASC
       LIMIT 50`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, category, description, is_scheduled, scheduled_at } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const room = await db.query(
      'INSERT INTO rooms (title, category, host_id, description, is_scheduled, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, category, req.user.userId, description, is_scheduled, scheduled_at]
    );
    await db.query(
      'INSERT INTO room_participants (room_id, user_id, role, mic_slot) VALUES ($1, $2, $3, $4)',
      [room.rows[0].id, req.user.userId, 'host', 1]
    );
    res.status(201).json(room.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const room = await db.query(
      `SELECT r.*, u.username as host_username, u.avatar_url as host_avatar
       FROM rooms r JOIN users u ON r.host_id = u.id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!room.rows[0]) return res.status(404).json({ error: 'Room not found' });

    const participants = await db.query(
      `SELECT rp.*, u.username, u.avatar_url, u.is_premium
       FROM room_participants rp JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1 AND rp.left_at IS NULL`,
      [req.params.id]
    );
    res.json({ ...room.rows[0], participants: participants.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    await db.query(
      `INSERT INTO room_participants (room_id, user_id, role) VALUES ($1, $2, 'listener')
       ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL, joined_at = NOW()`,
      [req.params.id, req.user.userId]
    );
    await db.query('UPDATE rooms SET listener_count = listener_count + 1 WHERE id = $1', [req.params.id]);

    let agoraToken = null;
    if (process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE) {
      agoraToken = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        req.params.id,
        0,
        RtcRole.SUBSCRIBER,
        Math.floor(Date.now() / 1000) + 3600
      );
    }

    res.json({ message: 'Joined', agoraToken, appId: process.env.AGORA_APP_ID });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/leave', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE room_participants SET left_at = NOW(), mic_slot = NULL WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    res.json({ message: 'Left room' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/boost', auth, async (req, res) => {
  const { amount = 10 } = req.body;
  try {
    const user = await db.query('SELECT coins FROM users WHERE id = $1', [req.user.userId]);
    if (user.rows[0].coins < amount) return res.status(400).json({ error: 'Insufficient coins' });

    await db.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [amount, req.user.userId]);
    const room = await db.query(
      'UPDATE rooms SET boost_count = boost_count + $1 WHERE id = $2 RETURNING boost_count',
      [amount, req.params.id]
    );
    res.json({ boost_count: room.rows[0].boost_count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/end', auth, async (req, res) => {
  try {
    const room = await db.query('SELECT host_id FROM rooms WHERE id = $1', [req.params.id]);
    if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not host' });
    }
    await db.query('UPDATE rooms SET is_live = false, ended_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Room ended' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const room = await db.query(
      'SELECT id, is_scheduled, is_live FROM rooms WHERE id = $1',
      [req.params.id]
    );
    if (!room.rows[0]) return res.status(404).json({ error: 'Room not found' });
    if (!room.rows[0].is_scheduled || room.rows[0].is_live) {
      return res.status(400).json({ error: 'Room is not a scheduled room' });
    }
    await db.query(
      'INSERT INTO room_rsvps (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.userId]
    );
    res.json({ rsvped: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/rsvp', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM room_rsvps WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    res.json({ rsvped: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/go-live', auth, async (req, res) => {
  try {
    const room = await db.query(
      'SELECT host_id FROM rooms WHERE id = $1 AND is_scheduled = true AND is_live = false',
      [req.params.id]
    );
    if (!room.rows[0]) return res.status(404).json({ error: 'Scheduled room not found' });
    if (room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Not host' });

    await db.query(
      'UPDATE rooms SET is_live = true, is_scheduled = false WHERE id = $1',
      [req.params.id]
    );
    await db.query(
      'INSERT INTO room_participants (room_id, user_id, role, mic_slot) VALUES ($1, $2, $3, $4) ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL, role = $3',
      [req.params.id, req.user.userId, 'host', 1]
    );

    // Notify RSVPed users
    const rsvps = await db.query('SELECT user_id FROM room_rsvps WHERE room_id = $1', [req.params.id]);
    const roomData = await db.query('SELECT title FROM rooms WHERE id = $1', [req.params.id]);
    if (rsvps.rows.length > 0 && roomData.rows[0]) {
      const notifValues = rsvps.rows.map((r) => `('${r.user_id}', 'room_live', 'Room is live!', '${roomData.rows[0].title.replace(/'/g, "''")} just went live', '{"room_id":"${req.params.id}"}')`).join(',');
      await db.query(`INSERT INTO notifications (user_id, type, title, body, data) VALUES ${notifValues}`).catch(() => {});
    }

    res.json({ message: 'Room is now live' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/agora-token', auth, async (req, res) => {
  try {
    if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
      return res.json({ token: null, appId: process.env.AGORA_APP_ID || 'demo' });
    }
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      req.params.id,
      0,
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + 3600
    );
    res.json({ token, appId: process.env.AGORA_APP_ID });
  } catch (err) {
    res.status(500).json({ error: 'Token generation failed' });
  }
});

module.exports = router;
