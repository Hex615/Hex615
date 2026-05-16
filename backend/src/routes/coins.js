const router = require('express').Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/packages', async (req, res) => {
  try {
    const packages = await db.query('SELECT * FROM coin_packages WHERE is_active = true ORDER BY amount');
    res.json(packages.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/purchase', auth, async (req, res) => {
  const { package_id, transaction_id } = req.body;
  if (!package_id || !transaction_id) return res.status(400).json({ error: 'package_id and transaction_id required' });

  try {
    const pkg = await db.query('SELECT * FROM coin_packages WHERE id = $1 AND is_active = true', [package_id]);
    if (!pkg.rows[0]) return res.status(404).json({ error: 'Package not found' });

    const existing = await db.query('SELECT id FROM purchases WHERE transaction_id = $1', [transaction_id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Transaction already processed' });

    await db.query(
      'INSERT INTO purchases (user_id, package_id, transaction_id, status) VALUES ($1, $2, $3, $4)',
      [req.user.userId, package_id, transaction_id, 'completed']
    );

    const totalCoins = pkg.rows[0].amount + pkg.rows[0].bonus_coins;
    const user = await db.query(
      'UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins',
      [totalCoins, req.user.userId]
    );

    res.json({ coins_added: totalCoins, total_coins: user.rows[0].coins });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await db.query('SELECT coins, balance FROM users WHERE id = $1', [req.user.userId]);
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
