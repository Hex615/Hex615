const router = require('express').Router();
const { body, query } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { validate, uuidParam } = require('../middleware/validate');
const { awardVoltage } = require('../utils/voltage');
const { genToken } = require('../utils/crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// ── helpers ───────────────────────────────────────────────────────────────────
async function getRole(roomId, userId) {
  const r = await db.query(
    'SELECT role FROM room_participants WHERE room_id=$1 AND user_id=$2 AND left_at IS NULL',
    [roomId, userId]
  );
  return r.rows[0]?.role || null;
}

function isModRole(role) { return role === 'owner' || role === 'manager'; }

// ── GET /rooms — list live rooms ─────────────────────────────────────────────
router.get('/', auth,
  query('category').optional().trim().isLength({ max: 50 }),
  query('tab').optional().isIn(['following','all','interests','discussion','music']),
  validate,
  async (req, res) => {
    const { category, tab } = req.query;
    try {
      let q = `
        SELECT r.*, u.username AS host_username, u.avatar_url AS host_avatar,
          u.monthly_rank AS host_rank,
          t.primary_color AS theme_primary, t.bg_color AS theme_bg,
          COUNT(DISTINCT rp.id) FILTER (WHERE rp.left_at IS NULL)::int AS participant_count,
          EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=r.host_id) AS host_is_followed
        FROM rooms r
        JOIN users u ON r.host_id=u.id
        LEFT JOIN room_themes t ON r.theme_id=t.id
        LEFT JOIN room_participants rp ON r.id=rp.room_id
        WHERE r.is_live=true AND r.ended_at IS NULL AND r.is_scheduled=false
      `;
      const p = [req.user.userId];
      if (category) { q += ` AND lower(r.category)=lower($${p.length+1})`; p.push(category); }
      if (tab === 'following') { q += ` AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$${p.length+1} AND f.following_id=r.host_id)`; p.push(req.user.userId); }
      q += ' GROUP BY r.id,u.username,u.avatar_url,u.monthly_rank,t.primary_color,t.bg_color ORDER BY participant_count DESC LIMIT 50';
      res.json((await db.query(q, p)).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  }
);

// ── GET /rooms/meta/themes ────────────────────────────────────────────────────
router.get('/meta/themes', auth, async (req, res) => {
  try { res.json((await db.query('SELECT * FROM room_themes ORDER BY id')).rows); }
  catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms — create room ─────────────────────────────────────────────────
router.post('/', auth,
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 chars'),
  body('category').optional().trim().isIn(['Casual','Interests','Discussion','Music']),
  body('mode').optional().isIn(['audio','video','both']),
  body('theme_id').optional().isInt({ min: 1, max: 15 }),
  body('capacity').optional().isInt({ min: 150, max: 200 }),
  body('is_locked').optional().isBoolean(),
  body('pin').optional().matches(/^\d{4}$/).withMessage('PIN must be 4 digits'),
  validate,
  async (req, res) => {
    const { title, category='Casual', mode='audio', theme_id=1, capacity=200, is_locked=false, pin, description } = req.body;
    try {
      const invite_token = genToken(32);
      const room = await db.query(
        'INSERT INTO rooms (title,category,mode,host_id,theme_id,capacity,is_locked,pin,invite_token,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [title, category, mode, req.user.userId, theme_id, capacity, is_locked, pin||null, invite_token, description||null]
      );
      await db.query(
        "INSERT INTO room_participants (room_id,user_id,role,mic_slot,mic_on) VALUES ($1,$2,'owner',1,true)",
        [room.rows[0].id, req.user.userId]
      );
      await awardVoltage(req.user.userId, 'host_room', 50, 50);
      res.status(201).json(room.rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  }
);

// ── GET /rooms/:id ────────────────────────────────────────────────────────────
router.get('/:id', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const room = await db.query(
      `SELECT r.*, t.*, u.username AS host_username, u.avatar_url AS host_avatar, u.monthly_rank AS host_rank
       FROM rooms r JOIN users u ON r.host_id=u.id LEFT JOIN room_themes t ON r.theme_id=t.id WHERE r.id=$1`,
      [req.params.id]
    );
    if (!room.rows[0]) return res.status(404).json({ error: 'Room not found' });
    // Never expose PIN in response
    const { pin, ...safeRoom } = room.rows[0];
    const parts = await db.query(
      'SELECT rp.*,u.username,u.avatar_url,u.monthly_rank,u.is_verified FROM room_participants rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=$1 AND rp.left_at IS NULL',
      [req.params.id]
    );
    res.json({ ...safeRoom, participants: parts.rows });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/join ──────────────────────────────────────────────────────
router.post('/:id/join', auth, uuidParam('id'), validate, async (req, res) => {
  const { pin } = req.body;
  try {
    const room = await db.query('SELECT * FROM rooms WHERE id=$1 AND is_live=true AND ended_at IS NULL', [req.params.id]);
    if (!room.rows[0]) return res.status(404).json({ error: 'Room not found or ended' });
    const r = room.rows[0];

    if (r.is_locked && r.host_id !== req.user.userId) {
      if (!pin) return res.status(403).json({ error: 'Room is locked. Provide invite PIN.' });
      if (r.pin && r.pin !== String(pin)) return res.status(403).json({ error: 'Wrong PIN' });
    }

    // Capacity check
    const count = await db.query('SELECT COUNT(*) FROM room_participants WHERE room_id=$1 AND left_at IS NULL', [req.params.id]);
    if (parseInt(count.rows[0].count) >= r.capacity) return res.status(400).json({ error: 'Room is full' });

    await db.query(
      "INSERT INTO room_participants (room_id,user_id,role) VALUES ($1,$2,'viewer') ON CONFLICT (room_id,user_id) DO UPDATE SET left_at=NULL,joined_at=NOW()",
      [req.params.id, req.user.userId]
    );
    await db.query('UPDATE rooms SET viewer_count=viewer_count+1 WHERE id=$1', [req.params.id]);

    let agoraToken = null;
    if (process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE) {
      agoraToken = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID, process.env.AGORA_APP_CERTIFICATE,
        req.params.id, 0, RtcRole.SUBSCRIBER, Math.floor(Date.now()/1000)+3600
      );
    }
    res.json({ joined: true, agoraToken, appId: process.env.AGORA_APP_ID });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/leave ─────────────────────────────────────────────────────
router.post('/:id/leave', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    await db.query(
      'UPDATE room_participants SET left_at=NOW(),mic_on=false,cam_on=false,mic_slot=NULL WHERE room_id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    res.json({ left: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /rooms/:id/theme (owner only) ─────────────────────────────────────────
router.put('/:id/theme', auth, uuidParam('id'),
  body('theme_id').isInt({ min: 1, max: 15 }).withMessage('theme_id 1-15 required'),
  validate,
  async (req, res) => {
    try {
      const room = await db.query('SELECT host_id FROM rooms WHERE id=$1', [req.params.id]);
      if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
      await db.query('UPDATE rooms SET theme_id=$1 WHERE id=$2', [req.body.theme_id, req.params.id]);
      res.json({ updated: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── PUT /rooms/:id/lock (owner only) ─────────────────────────────────────────
router.put('/:id/lock', auth, uuidParam('id'),
  body('is_locked').isBoolean(),
  body('pin').optional().matches(/^\d{4}$/).withMessage('PIN must be 4 digits'),
  validate,
  async (req, res) => {
    try {
      const room = await db.query('SELECT host_id FROM rooms WHERE id=$1', [req.params.id]);
      if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
      await db.query('UPDATE rooms SET is_locked=$1,pin=$2 WHERE id=$3', [req.body.is_locked, req.body.pin||null, req.params.id]);
      req.app.get('io')?.to(`room:${req.params.id}`).emit('room-locked', { locked: req.body.is_locked });
      res.json({ updated: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── POST /rooms/:id/manager (owner only, max 2) ───────────────────────────────
router.post('/:id/manager', auth, uuidParam('id'),
  body('userId').isUUID(4).withMessage('Valid userId required'),
  validate,
  async (req, res) => {
    try {
      const room = await db.query('SELECT host_id FROM rooms WHERE id=$1', [req.params.id]);
      if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
      const mgrs = await db.query("SELECT COUNT(*) FROM room_participants WHERE room_id=$1 AND role='manager' AND left_at IS NULL", [req.params.id]);
      if (parseInt(mgrs.rows[0].count) >= 2) return res.status(400).json({ error: 'Max 2 managers per room' });
      // Can't promote another owner to manager
      if (req.body.userId === room.rows[0].host_id) return res.status(400).json({ error: 'Cannot change owner role' });
      await db.query("UPDATE room_participants SET role='manager' WHERE room_id=$1 AND user_id=$2", [req.params.id, req.body.userId]);
      res.json({ assigned: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── DELETE /rooms/:id/manager/:uid (owner only) ───────────────────────────────
router.delete('/:id/manager/:uid', auth, uuidParam('id'), uuidParam('uid'), validate, async (req, res) => {
  try {
    const room = await db.query('SELECT host_id FROM rooms WHERE id=$1', [req.params.id]);
    if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
    await db.query("UPDATE room_participants SET role='speaker' WHERE room_id=$1 AND user_id=$2 AND role='manager'", [req.params.id, req.params.uid]);
    res.json({ revoked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/mute/:uid (owner + manager, cannot cross-mute managers) ──
router.post('/:id/mute/:uid', auth, uuidParam('id'), uuidParam('uid'), validate, async (req, res) => {
  try {
    const actorRole  = await getRole(req.params.id, req.user.userId);
    if (!isModRole(actorRole)) return res.status(403).json({ error: 'Owner or manager only' });
    const targetRole = await getRole(req.params.id, req.params.uid);
    // Managers cannot mute each other; only owner can mute manager
    if (actorRole === 'manager' && (targetRole === 'manager' || targetRole === 'owner')) {
      return res.status(403).json({ error: 'Managers cannot mute each other' });
    }
    await db.query('UPDATE room_participants SET mic_on=false WHERE room_id=$1 AND user_id=$2', [req.params.id, req.params.uid]);
    // cam stays on per spec when muted by manager
    req.app.get('io')?.to(`room:${req.params.id}`).emit('mic-update', { userId: req.params.uid, mic_on: false });
    res.json({ muted: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/kick/:uid (owner + manager, cannot cross-kick managers) ──
router.post('/:id/kick/:uid', auth, uuidParam('id'), uuidParam('uid'), validate, async (req, res) => {
  try {
    const actorRole  = await getRole(req.params.id, req.user.userId);
    if (!isModRole(actorRole)) return res.status(403).json({ error: 'Owner or manager only' });
    const targetRole = await getRole(req.params.id, req.params.uid);
    if (targetRole === 'owner') return res.status(403).json({ error: 'Cannot kick owner' });
    if (actorRole === 'manager' && targetRole === 'manager') return res.status(403).json({ error: 'Managers cannot kick each other' });
    await db.query('UPDATE room_participants SET left_at=NOW(),mic_on=false,cam_on=false,mic_slot=NULL WHERE room_id=$1 AND user_id=$2', [req.params.id, req.params.uid]);
    req.app.get('io')?.to(`user:${req.params.uid}`).emit('kicked', { roomId: req.params.id });
    res.json({ kicked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/boost ─────────────────────────────────────────────────────
router.post('/:id/boost', auth, uuidParam('id'),
  body('amount').optional().isInt({ min: 1, max: 500 }),
  validate,
  async (req, res) => {
    const amount = req.body.amount || 10;
    try {
      const user = await db.query('SELECT spota_balance FROM users WHERE id=$1', [req.user.userId]);
      if (!user.rows[0] || user.rows[0].spota_balance < amount) return res.status(400).json({ error: 'Insufficient Spota' });
      await db.query('UPDATE users SET spota_balance=spota_balance-$1 WHERE id=$2', [amount, req.user.userId]);
      const room = await db.query('UPDATE rooms SET boost_count=boost_count+$1 WHERE id=$2 RETURNING boost_count', [amount, req.params.id]);
      res.json({ boost_count: room.rows[0].boost_count });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── POST /rooms/:id/end (owner only) ─────────────────────────────────────────
router.post('/:id/end', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const room = await db.query('SELECT host_id FROM rooms WHERE id=$1', [req.params.id]);
    if (!room.rows[0] || room.rows[0].host_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
    await db.query('UPDATE rooms SET is_live=false,ended_at=NOW() WHERE id=$1', [req.params.id]);
    req.app.get('io')?.to(`room:${req.params.id}`).emit('room-ended', {});
    res.json({ ended: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /rooms/:id/agora-token ───────────────────────────────────────────────
router.post('/:id/agora-token', auth, uuidParam('id'), validate, async (req, res) => {
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE)
    return res.json({ token: null, appId: process.env.AGORA_APP_ID || 'demo' });
  try {
    const role  = await getRole(req.params.id, req.user.userId);
    const aRole = isModRole(role) ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID, process.env.AGORA_APP_CERTIFICATE,
      req.params.id, 0, aRole, Math.floor(Date.now()/1000)+3600
    );
    res.json({ token, appId: process.env.AGORA_APP_ID });
  } catch { res.status(500).json({ error: 'Token generation failed' }); }
});

module.exports = router;
