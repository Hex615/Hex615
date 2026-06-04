const jwt = require('jsonwebtoken');
const db  = require('../config/database');
const { logEvent } = require('./securityLogger');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const user = await db.query(
      'SELECT id, is_banned, is_admin FROM users WHERE id=$1',
      [payload.userId]
    );
    if (!user.rows[0]) return res.status(401).json({ error: 'Account not found' });

    if (user.rows[0].is_banned) {
      await logEvent(payload.userId, req.clientIp, 'banned_user_request', { path: req.path }, 'warn');
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    req.user = { ...payload, is_admin: user.rows[0].is_admin };
    next();
  } catch (err) {
    console.error('Auth middleware DB error:', err.message);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};
