const router = require('express').Router();
const { body } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.get('/packages', auth, async (req, res) => {
  try { res.json((await db.query('SELECT id,name,amount,price_usd FROM spota_packages WHERE is_active=true ORDER BY amount')).rows); }
  catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/purchase', auth,
  body('package_id').isUUID(4),
  body('transaction_id').isString().trim().isLength({ min: 1, max: 200 }),
  validate,
  async (req, res) => {
    const { package_id, transaction_id } = req.body;
    try {
      const pkg = await db.query('SELECT * FROM spota_packages WHERE id=$1 AND is_active=true', [package_id]);
      if (!pkg.rows[0]) return res.status(404).json({ error: 'Package not found' });

      // Idempotency — reject duplicate transaction IDs
      const dup = await db.query('SELECT id FROM spota_purchases WHERE transaction_id=$1', [transaction_id]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Transaction already processed' });

      await db.query(
        "INSERT INTO spota_purchases (user_id,package_id,transaction_id,status) VALUES ($1,$2,$3,'completed')",
        [req.user.userId, package_id, transaction_id]
      );
      const u = await db.query(
        'UPDATE users SET spota_balance=spota_balance+$1 WHERE id=$2 RETURNING spota_balance',
        [pkg.rows[0].amount, req.user.userId]
      );
      res.json({ spota_added: pkg.rows[0].amount, spota_balance: u.rows[0].spota_balance });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Transaction already processed' });
      res.status(500).json({ error: 'Purchase failed' });
    }
  }
);

router.get('/balance', auth, async (req, res) => {
  try {
    const u = await db.query('SELECT spota_balance,spota_earnings FROM users WHERE id=$1', [req.user.userId]);
    res.json(u.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
