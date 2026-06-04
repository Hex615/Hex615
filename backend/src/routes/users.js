const router = require('express').Router();
const { body, param } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { validate, uuidParam } = require('../middleware/validate');
const { awardVoltage } = require('../utils/voltage');
const { hashToken } = require('../utils/crypto');

router.get('/me', auth, async (req, res) => {
  try {
    const u = await db.query('SELECT * FROM users WHERE id=$1', [req.user.userId]);
    if (!u.rows[0]) return res.status(404).json({ error: 'Not found' });
    const { phone, ...safe } = u.rows[0];
    res.json(safe);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.put('/me', auth,
  body('username').optional().trim().isLength({ min: 3, max: 30 }).matches(/^[a-z0-9_.]+$/).withMessage('Username: 3-30 chars, lowercase letters/numbers/._'),
  body('bio').optional().trim().isLength({ max: 160 }),
  body('age').optional().isInt({ min: 18, max: 99 }).withMessage('Must be 18+'),
  body('interests').optional().isArray({ max: 8 }),
  validate,
  async (req, res) => {
    const { username, avatar_url, bio, age, interests, fcm_token } = req.body;
    try {
      const r = await db.query(
        `UPDATE users SET
           username   = COALESCE($1, username),
           avatar_url = COALESCE($2, avatar_url),
           bio        = COALESCE($3, bio),
           age        = COALESCE($4, age),
           interests  = COALESCE($5, interests),
           fcm_token  = COALESCE($6, fcm_token),
           last_seen  = NOW()
         WHERE id=$7 RETURNING *`,
        [username, avatar_url, bio, age, interests, fcm_token, req.user.userId]
      );
      const { phone, ...safe } = r.rows[0];
      res.json(safe);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

router.get('/:id', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const u = await db.query(
      `SELECT u.*,
         (SELECT COUNT(*) FROM follows WHERE following_id=u.id)::int  AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id=u.id)::int   AS following_count,
         EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.id) AS is_following,
         EXISTS(SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=u.id)    AS is_blocked
       FROM users u WHERE u.id=$2`,
      [req.user.userId, req.params.id]
    );
    if (!u.rows[0]) return res.status(404).json({ error: 'Not found' });
    const { phone, fcm_token, ...safe } = u.rows[0];
    res.json(safe);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/follow', auth, uuidParam('id'), validate, async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    const r = await db.query(
      'INSERT INTO follows (follower_id,following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id',
      [req.user.userId, req.params.id]
    );
    if (r.rows[0]) await awardVoltage(req.user.userId, 'new_follower', 5, 5);
    res.json({ following: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id/follow', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    await db.query('DELETE FROM follows WHERE follower_id=$1 AND following_id=$2', [req.user.userId, req.params.id]);
    res.json({ following: false });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/block', auth, uuidParam('id'), validate, async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot block yourself' });
  try {
    await db.query('INSERT INTO blocks (blocker_id,blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)', [req.user.userId, req.params.id]);
    res.json({ blocked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/report', auth, uuidParam('id'), validate,
  body('reason').trim().isLength({ min: 3, max: 100 }).withMessage('Reason required'),
  body('description').optional().trim().isLength({ max: 500 }),
  validate,
  async (req, res) => {
    const { reason, description } = req.body;
    try {
      await db.query('INSERT INTO reports (reporter_id,reported_user_id,reason,description) VALUES ($1,$2,$3,$4)', [req.user.userId, req.params.id, reason, description]);
      res.json({ reported: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── Session management ────────────────────────────────────────────────────────
router.get('/me/sessions', auth, async (req, res) => {
  try {
    const sessions = await db.query(
      `SELECT id, ip_address, device_info, last_active, created_at, expires_at
       FROM user_sessions
       WHERE user_id=$1 AND expires_at > NOW()
       ORDER BY last_active DESC`,
      [req.user.userId]
    );
    res.json(sessions.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/me/sessions/:id', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const session = await db.query(
      'SELECT refresh_token_hash FROM user_sessions WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!session.rows[0]) return res.status(404).json({ error: 'Session not found' });

    const hash = session.rows[0].refresh_token_hash;
    await db.query('DELETE FROM user_sessions WHERE id=$1', [req.params.id]);
    await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash]).catch(() => {});
    res.json({ revoked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/me/sessions', auth, async (req, res) => {
  const { keepCurrent } = req.query;
  const currentHash = req.body.refreshToken ? hashToken(req.body.refreshToken) : null;
  try {
    if (keepCurrent && currentHash) {
      await db.query(
        'DELETE FROM user_sessions WHERE user_id=$1 AND refresh_token_hash!=$2',
        [req.user.userId, currentHash]
      );
      await db.query(
        'DELETE FROM refresh_tokens WHERE user_id=$1 AND token_hash!=$2',
        [req.user.userId, currentHash]
      );
    } else {
      await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.user.userId]);
      await db.query('DELETE FROM refresh_tokens WHERE user_id=$1', [req.user.userId]);
    }
    res.json({ revoked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
