const router = require('express').Router();
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { RANKS } = require('../utils/voltage');

router.get('/me', auth, async (req, res) => {
  try {
    const u = await db.query(
      'SELECT monthly_voltage,lifetime_voltage,monthly_rank,lifetime_rank FROM users WHERE id=$1',
      [req.user.userId]
    );
    res.json({ ...u.rows[0], ranks: RANKS });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/leaderboard/monthly', auth, async (req, res) => {
  const month = new Date().toISOString().slice(0, 7);
  try {
    const r = await db.query(
      `SELECT ml.rank,ml.total_voltage,u.id,u.username,u.avatar_url,u.monthly_rank
       FROM monthly_leaderboard ml JOIN users u ON ml.user_id=u.id
       WHERE ml.month=$1 ORDER BY ml.total_voltage DESC LIMIT 100`,
      [month]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/leaderboard/lifetime', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT id,username,avatar_url,lifetime_voltage,lifetime_rank FROM users WHERE lifetime_voltage>0 ORDER BY lifetime_voltage DESC LIMIT 100'
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
