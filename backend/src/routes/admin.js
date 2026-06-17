const router = require('express').Router();
const { body, param, query } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { autoBanIp, unbanIp, warmBanCache } = require('../middleware/ipBan');

// All admin routes require authentication + is_admin flag
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ── IP Ban Management ────────────────────────────────────────────────────────

// GET /admin/ip-bans — list active + recent expired bans
router.get('/ip-bans', auth, requireAdmin, async (req, res) => {
  try {
    const bans = await db.query(
      `SELECT ip_address, reason, banned_by, created_at, expires_at,
              expires_at IS NULL OR expires_at > NOW() AS is_active
       FROM ip_bans
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json(bans.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /admin/ip-bans — manually ban an IP
router.post('/ip-bans', auth, requireAdmin,
  body('ip').isIP().withMessage('Valid IP address required'),
  body('reason').trim().isLength({ min: 3, max: 200 }).withMessage('Reason required'),
  body('durationMinutes').optional().isInt({ min: 1 }).withMessage('Duration must be positive integer'),
  validate,
  async (req, res) => {
    const { ip, reason, durationMinutes } = req.body;
    try {
      await autoBanIp(ip, reason, durationMinutes || null);
      res.json({ banned: true, ip });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// DELETE /admin/ip-bans/:ip — unban an IP
router.delete('/ip-bans/:ip', auth, requireAdmin,
  param('ip').isIP().withMessage('Valid IP address required'),
  validate,
  async (req, res) => {
    try {
      await unbanIp(req.params.ip);
      res.json({ unbanned: true, ip: req.params.ip });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// POST /admin/ip-bans/warm-cache — refresh Redis cache from DB
router.post('/ip-bans/warm-cache', auth, requireAdmin, async (req, res) => {
  try {
    await warmBanCache();
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Security Events ───────────────────────────────────────────────────────────

// GET /admin/security-events — paginated event log
router.get('/security-events', auth, requireAdmin,
  query('severity').optional().isIn(['info', 'warn', 'critical']),
  query('type').optional().trim(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    const limit  = parseInt(req.query.limit)  || 100;
    const offset = parseInt(req.query.offset) || 0;
    const { severity, type } = req.query;

    const conditions = [];
    const values     = [];
    if (severity) { conditions.push(`severity=$${values.push(severity)}`); }
    if (type)     { conditions.push(`event_type=$${values.push(type)}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    try {
      const events = await db.query(
        `SELECT se.*, u.username FROM security_events se
         LEFT JOIN users u ON u.id=se.user_id
         ${where}
         ORDER BY se.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      res.json(events.rows);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── Failed Auth Attempts ──────────────────────────────────────────────────────

// GET /admin/failed-attempts — list recent brute-force activity
router.get('/failed-attempts', auth, requireAdmin,
  query('ip').optional().isIP(),
  query('type').optional().isIn(['otp_verify', 'token_refresh', 'login']),
  validate,
  async (req, res) => {
    const { ip, type } = req.query;
    const conditions = [];
    const values     = [];

    conditions.push("created_at > NOW() - INTERVAL '24 hours'");
    if (ip)   { conditions.push(`ip_address=$${values.push(ip + '::inet')}`); }
    if (type) { conditions.push(`attempt_type=$${values.push(type)}`); }

    try {
      const rows = await db.query(
        `SELECT ip_address, attempt_type, COUNT(*) AS count, MAX(created_at) AS last_at
         FROM failed_auth_attempts
         WHERE ${conditions.join(' AND ')}
         GROUP BY ip_address, attempt_type
         ORDER BY count DESC
         LIMIT 200`,
        values
      );
      res.json(rows.rows);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// ── User Management ───────────────────────────────────────────────────────────

// GET /admin/users/:id — full user profile inc. phone + ban status
router.get('/users/:id', auth, requireAdmin,
  param('id').isUUID(4),
  validate,
  async (req, res) => {
    try {
      const u = await db.query(
        `SELECT u.*,
                (SELECT COUNT(*) FROM user_sessions WHERE user_id=u.id AND expires_at>NOW()) AS active_sessions
         FROM users u WHERE u.id=$1`,
        [req.params.id]
      );
      if (!u.rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json(u.rows[0]);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// POST /admin/users/:id/ban — suspend a user account
router.post('/users/:id/ban', auth, requireAdmin,
  param('id').isUUID(4),
  body('reason').trim().isLength({ min: 3, max: 200 }),
  validate,
  async (req, res) => {
    try {
      await db.query('UPDATE users SET is_banned=true WHERE id=$1', [req.params.id]);
      // Revoke all active sessions
      await db.query('DELETE FROM refresh_tokens WHERE user_id=$1', [req.params.id]);
      await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
      res.json({ banned: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// POST /admin/users/:id/unban — reinstate a user account
router.post('/users/:id/unban', auth, requireAdmin,
  param('id').isUUID(4),
  validate,
  async (req, res) => {
    try {
      await db.query('UPDATE users SET is_banned=false WHERE id=$1', [req.params.id]);
      res.json({ unbanned: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// GET /admin/users/:id/sessions — list all active sessions for a user
router.get('/users/:id/sessions', auth, requireAdmin,
  param('id').isUUID(4),
  validate,
  async (req, res) => {
    try {
      const sessions = await db.query(
        `SELECT id, ip_address, device_info, last_active, created_at, expires_at
         FROM user_sessions WHERE user_id=$1 ORDER BY last_active DESC`,
        [req.params.id]
      );
      res.json(sessions.rows);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

// DELETE /admin/users/:id/sessions — revoke all sessions for a user
router.delete('/users/:id/sessions', auth, requireAdmin,
  param('id').isUUID(4),
  validate,
  async (req, res) => {
    try {
      await db.query('DELETE FROM user_sessions WHERE user_id=$1', [req.params.id]);
      await db.query('DELETE FROM refresh_tokens WHERE user_id=$1', [req.params.id]);
      res.json({ revoked: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

module.exports = router;
