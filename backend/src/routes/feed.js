const router = require('express').Router();
const { body } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { validate, uuidParam } = require('../middleware/validate');
const { awardVoltage } = require('../utils/voltage');
const { moderateText } = require('../middleware/moderation');

router.get('/', auth, async (req, res) => {
  const { limit = 20, before } = req.query;
  const safeLimit = Math.min(parseInt(limit) || 20, 50);
  try {
    let q = `
      SELECT p.*, u.username, u.avatar_url, u.monthly_rank,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=$1) AS is_liked
      FROM posts p JOIN users u ON p.user_id=u.id
      WHERE (p.expires_at IS NULL OR p.expires_at > NOW())
        AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=$1)
        AND u.is_banned = false
    `;
    const params = [req.user.userId];
    if (before) { q += ` AND p.created_at < $${params.length+1}`; params.push(before); }
    q += ` ORDER BY p.created_at DESC LIMIT $${params.length+1}`; params.push(safeLimit);
    res.json((await db.query(q, params)).rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', auth,
  body('type').isIn(['text','image','poll','qa','hmu']),
  body('content').optional().trim().isLength({ max: 2000 }),
  body('is_anonymous').optional().isBoolean(),
  validate,
  async (req, res) => {
    const { type, content, media_url, poll_options, is_anonymous, expires_at } = req.body;
    try {
      const { filtered, flagged } = await moderateText(content);
      if (flagged) return res.status(422).json({ error: 'Content violates community guidelines' });
      const post = await db.query(
        'INSERT INTO posts (user_id,type,content,media_url,poll_options,is_anonymous,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [req.user.userId, type, filtered, media_url, poll_options ? JSON.stringify(poll_options) : null, is_anonymous||false, expires_at||null]
      );
      await awardVoltage(req.user.userId, 'post_feed', 15, 15);
      res.status(201).json(post.rows[0]);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

router.post('/:id/like', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const existing = await db.query('SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (existing.rows[0]) {
      await db.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
      await db.query('UPDATE posts SET like_count=GREATEST(like_count-1,0) WHERE id=$1', [req.params.id]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO post_likes (post_id,user_id) VALUES ($1,$2)', [req.params.id, req.user.userId]);
    await db.query('UPDATE posts SET like_count=like_count+1 WHERE id=$1', [req.params.id]);
    res.json({ liked: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/comment', auth, uuidParam('id'),
  body('content').trim().isLength({ min: 1, max: 500 }),
  validate,
  async (req, res) => {
    const { content } = req.body;
    try {
      const { filtered, flagged } = await moderateText(content);
      if (flagged) return res.status(422).json({ error: 'Content violates community guidelines' });
      const comment = await db.query(
        'INSERT INTO post_comments (post_id,user_id,content) VALUES ($1,$2,$3) RETURNING *',
        [req.params.id, req.user.userId, filtered]
      );
      await db.query('UPDATE posts SET comment_count=comment_count+1 WHERE id=$1', [req.params.id]);
      res.status(201).json(comment.rows[0]);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

router.get('/:id/comments', auth, uuidParam('id'), validate, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT c.*,u.username,u.avatar_url FROM post_comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=$1 ORDER BY c.created_at LIMIT 100',
      [req.params.id]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/vote', auth, uuidParam('id'),
  body('option_index').isInt({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      await db.query(
        'INSERT INTO post_votes (post_id,user_id,option_index) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [req.params.id, req.user.userId, req.body.option_index]
      );
      const votes = await db.query('SELECT option_index,COUNT(*)::int AS count FROM post_votes WHERE post_id=$1 GROUP BY option_index', [req.params.id]);
      res.json(votes.rows);
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

router.post('/:id/report', auth, uuidParam('id'),
  body('reason').trim().isLength({ min: 3, max: 100 }),
  validate,
  async (req, res) => {
    try {
      await db.query(
        'INSERT INTO reports (reporter_id,reported_user_id,reason,description) SELECT $1,p.user_id,$3,$4 FROM posts p WHERE p.id=$2',
        [req.user.userId, req.params.id, req.body.reason, req.body.description||null]
      );
      res.json({ reported: true });
    } catch { res.status(500).json({ error: 'Server error' }); }
  }
);

module.exports = router;
