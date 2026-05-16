const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { limit = 20, before } = req.query;
  try {
    let query = `
      SELECT p.*, u.username, u.avatar_url,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE (p.expires_at IS NULL OR p.expires_at > NOW())
        AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
    `;
    const params = [req.user.userId];

    if (before) { query += ` AND p.created_at < $${params.length + 1}`; params.push(before); }
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  const { type, content, media_url, poll_options, is_anonymous, expires_at } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });

  try {
    const post = await db.query(
      'INSERT INTO posts (user_id, type, content, media_url, poll_options, is_anonymous, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.userId, type, content, media_url, poll_options ? JSON.stringify(poll_options) : null, is_anonymous, expires_at]
    );
    res.status(201).json(post.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/like', auth, async (req, res) => {
  try {
    const existing = await db.query('SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
    if (existing.rows.length > 0) {
      await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
      await db.query('UPDATE posts SET like_count = like_count - 1 WHERE id = $1', [req.params.id]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.userId]);
    await db.query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/comments', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT c.*, u.username, u.avatar_url FROM post_comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/comment', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  try {
    const comment = await db.query(
      'INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, req.user.userId, content]
    );
    await db.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [req.params.id]);
    res.status(201).json(comment.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/vote', auth, async (req, res) => {
  const { option_index } = req.body;
  if (option_index === undefined) return res.status(400).json({ error: 'option_index required' });

  try {
    await db.query(
      'INSERT INTO post_votes (post_id, user_id, option_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.userId, option_index]
    );
    const votes = await db.query(
      'SELECT option_index, COUNT(*) as count FROM post_votes WHERE post_id = $1 GROUP BY option_index',
      [req.params.id]
    );
    res.json(votes.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stories', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.username, u.avatar_url FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.expires_at > NOW()
         AND s.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       ORDER BY s.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/stories', auth, async (req, res) => {
  const { media_url, media_type } = req.body;
  if (!media_url) return res.status(400).json({ error: 'media_url required' });

  try {
    const story = await db.query(
      'INSERT INTO stories (user_id, media_url, media_type) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, media_url, media_type]
    );
    res.status(201).json(story.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/hmu', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT h.*, u.username, u.avatar_url FROM hmu_posts h
       JOIN users u ON h.user_id = u.id
       WHERE h.expires_at > NOW()
       ORDER BY h.created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/hmu', auth, async (req, res) => {
  const { content, category } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  try {
    const post = await db.query(
      'INSERT INTO hmu_posts (user_id, content, category) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, content, category]
    );
    res.status(201).json(post.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
