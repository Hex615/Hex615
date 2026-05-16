const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me', auth, async (req, res) => {
  const { username, avatar_url, bio, age, interests } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        avatar_url = COALESCE($2, avatar_url),
        bio = COALESCE($3, bio),
        age = COALESCE($4, age),
        interests = COALESCE($5, interests),
        last_seen = NOW()
      WHERE id = $6 RETURNING *`,
      [username, avatar_url, bio, age, interests, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const user = await db.query(
      `SELECT u.*,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
      FROM users u WHERE u.id = $2`,
      [req.user.userId, req.params.id]
    );
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });
    const { phone, ...safeUser } = user.rows[0];
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/follow', auth, async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.userId, req.params.id]
    );
    res.json({ message: 'Following' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/follow', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.userId, req.params.id]
    );
    res.json({ message: 'Unfollowed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/block', auth, async (req, res) => {
  try {
    await db.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.userId, req.params.id]
    );
    res.json({ message: 'Blocked' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/report', auth, async (req, res) => {
  const { reason, description } = req.body;
  try {
    await db.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, description) VALUES ($1, $2, $3, $4)',
      [req.user.userId, req.params.id, reason, description]
    );
    res.json({ message: 'Report submitted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
