const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/cards', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.avatar_url, u.bio, u.age, u.interests,
        (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id AND f.follower_id IN (
          SELECT following_id FROM follows WHERE follower_id = $1
        )) as mutual_count
       FROM users u
       WHERE u.id != $1
         AND u.username IS NOT NULL
         AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
         AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
         AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)
       ORDER BY RANDOM() LIMIT 20`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  const { swiped_id, direction } = req.body;
  if (!swiped_id || !direction) return res.status(400).json({ error: 'swiped_id and direction required' });

  try {
    await db.query(
      'INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.user.userId, swiped_id, direction]
    );

    let match = null;
    if (direction === 'right') {
      const mutual = await db.query(
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'right'`,
        [swiped_id, req.user.userId]
      );

      if (mutual.rows.length > 0) {
        const [u1, u2] = [req.user.userId, swiped_id].sort();
        const existing = await db.query(
          'SELECT id FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
          [u1, u2]
        );
        if (existing.rows.length === 0) {
          const newMatch = await db.query(
            'INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) RETURNING *',
            [u1, u2]
          );
          match = newMatch.rows[0];
        }
      }
    }

    res.json({ match });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/matches', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*,
        CASE WHEN m.user1_id = $1 THEN u2.id ELSE u1.id END as other_user_id,
        CASE WHEN m.user1_id = $1 THEN u2.username ELSE u1.username END as other_username,
        CASE WHEN m.user1_id = $1 THEN u2.avatar_url ELSE u1.avatar_url END as other_avatar,
        (SELECT content FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE match_id = m.id AND sender_id != $1 AND read_at IS NULL) as unread_count
       FROM matches m
       JOIN users u1 ON m.user1_id = u1.id
       JOIN users u2 ON m.user2_id = u2.id
       WHERE m.user1_id = $1 OR m.user2_id = $1
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/matches/:id/messages', auth, async (req, res) => {
  const { limit = 50, before } = req.query;
  try {
    let query = `SELECT msg.*, u.username, u.avatar_url FROM messages msg
                 JOIN users u ON msg.sender_id = u.id
                 WHERE msg.match_id = $1`;
    const params = [req.params.id];

    if (before) { query += ` AND msg.created_at < $${params.length + 1}`; params.push(before); }
    query += ` ORDER BY msg.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    await db.query(
      'UPDATE messages SET read_at = NOW() WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL',
      [req.params.id, req.user.userId]
    );

    const result = await db.query(query, params);
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/messages', auth, async (req, res) => {
  const { content, type = 'text', media_url } = req.body;
  if (!content && !media_url) return res.status(400).json({ error: 'content required' });

  try {
    const msg = await db.query(
      'INSERT INTO messages (match_id, sender_id, content, type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, req.user.userId, content, type, media_url]
    );
    res.status(201).json(msg.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
