const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/catalog', async (req, res) => {
  try {
    const gifts = await db.query('SELECT * FROM gift_catalog WHERE is_active = true ORDER BY coin_cost');
    res.json(gifts.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/send', auth, async (req, res) => {
  const { receiver_id, room_id, gift_id, quantity = 1 } = req.body;
  if (!receiver_id || !gift_id) return res.status(400).json({ error: 'receiver_id and gift_id required' });

  try {
    const gift = await db.query('SELECT * FROM gift_catalog WHERE id = $1 AND is_active = true', [gift_id]);
    if (!gift.rows[0]) return res.status(404).json({ error: 'Gift not found' });

    const totalCost = gift.rows[0].coin_cost * quantity;
    const user = await db.query('SELECT coins FROM users WHERE id = $1', [req.user.userId]);
    if (user.rows[0].coins < totalCost) return res.status(400).json({ error: 'Insufficient coins' });

    await db.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [totalCost, req.user.userId]);

    const hostEarnings = totalCost * 0.5;
    await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [hostEarnings / 100, receiver_id]);

    const transaction = await db.query(
      'INSERT INTO gift_transactions (sender_id, receiver_id, room_id, gift_id, quantity, total_coins) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.userId, receiver_id, room_id, gift_id, quantity, totalCost]
    );

    res.json({ transaction: transaction.rows[0], gift: gift.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/leaderboard/:roomId', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.avatar_url, SUM(gt.total_coins) as total_given
       FROM gift_transactions gt
       JOIN users u ON gt.sender_id = u.id
       WHERE gt.room_id = $1
       GROUP BY u.id, u.username, u.avatar_url
       ORDER BY total_given DESC LIMIT 10`,
      [req.params.roomId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/spin', auth, async (req, res) => {
  const gifts = ['Rose', 'Heart', 'Star', '5 coins', '10 coins', '0 coins', 'Crown'];
  const result = gifts[Math.floor(Math.random() * gifts.length)];

  if (result.includes('coins')) {
    const amount = parseInt(result);
    if (amount > 0) {
      await db.query('UPDATE users SET coins = coins + $1 WHERE id = $2', [amount, req.user.userId]);
    }
  }
  res.json({ result });
});

module.exports = router;
