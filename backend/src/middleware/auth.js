const jwt = require('jsonwebtoken');
const db  = require('../config/database');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // Reject tokens for banned users
    const user = await db.query('SELECT is_banned FROM users WHERE id=$1', [req.user.userId]);
    if (!user.rows[0] || user.rows[0].is_banned) {
      return res.status(403).json({ error: 'Account suspended' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
