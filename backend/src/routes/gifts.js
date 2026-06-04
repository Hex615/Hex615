const router = require('express').Router();
const { body } = require('express-validator');
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const limits = require('../middleware/rateLimiter');
const { validate, uuidParam } = require('../middleware/validate');
const { awardVoltage } = require('../utils/voltage');

router.get('/catalog', auth, async (req, res) => {
  try { res.json((await db.query('SELECT * FROM gift_catalog WHERE is_active=true ORDER BY spota_cost')).rows); }
  catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/send', auth, limits.gift,
  body('receiver_id').isUUID(4),
  body('gift_id').isUUID(4),
  body('room_id').optional().isUUID(4),
  body('quantity').optional().isInt({ min: 1, max: 10 }),
  validate,
  async (req, res) => {
    const { receiver_id, room_id, gift_id, quantity = 1 } = req.body;
    if (receiver_id === req.user.userId) return res.status(400).json({ error: 'Cannot gift yourself' });
    try {
      const gift = await db.query('SELECT * FROM gift_catalog WHERE id=$1 AND is_active=true', [gift_id]);
      if (!gift.rows[0]) return res.status(404).json({ error: 'Gift not found' });

      const totalCost = gift.rows[0].spota_cost * quantity;
      // Atomic deduct — fails if balance is insufficient (CHECK constraint)
      const updated = await db.query(
        'UPDATE users SET spota_balance=spota_balance-$1 WHERE id=$2 AND spota_balance>=$1 RETURNING spota_balance',
        [totalCost, req.user.userId]
      );
      if (!updated.rows[0]) return res.status(400).json({ error: 'Insufficient Spota' });

      // Host earns 30%
      const hostCutDecimal = (totalCost * 0.30) / 100;
      await db.query('UPDATE users SET spota_earnings=spota_earnings+$1 WHERE id=$2', [hostCutDecimal, receiver_id]);

      const voltSender   = totalCost * 2;
      const voltReceiver = totalCost * 3;
      const tx = await db.query(
        'INSERT INTO gift_transactions (sender_id,receiver_id,room_id,gift_id,quantity,spota_amount,voltage_sender,voltage_receiver) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [req.user.userId, receiver_id, room_id||null, gift_id, quantity, totalCost, voltSender, voltReceiver]
      );

      await Promise.all([
        awardVoltage(req.user.userId, 'send_gift', voltSender, voltSender),
        awardVoltage(receiver_id, 'receive_gift', voltReceiver, voltReceiver),
      ]);

      if (room_id) {
        await db.query('INSERT INTO spota_earnings (user_id,room_id,amount,type) VALUES ($1,$2,$3,$4)', [receiver_id, room_id, hostCutDecimal, 'gift_cut']);
      }

      res.json({ transaction: tx.rows[0], gift: gift.rows[0] });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  }
);

router.get('/leaderboard/:roomId', auth, uuidParam('roomId'), validate, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT u.id,u.username,u.avatar_url,SUM(gt.spota_amount)::int AS total_sent
       FROM gift_transactions gt JOIN users u ON gt.sender_id=u.id
       WHERE gt.room_id=$1 GROUP BY u.id,u.username,u.avatar_url ORDER BY total_sent DESC LIMIT 10`,
      [req.params.roomId]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/spin', auth, async (req, res) => {
  const prizes = ['0','5','10','25','50','0','0'];
  const prize  = prizes[Math.floor(Math.random() * prizes.length)];
  const spota  = parseInt(prize) || 0;
  if (spota > 0) await db.query('UPDATE users SET spota_balance=spota_balance+$1 WHERE id=$2', [spota, req.user.userId]).catch(() => {});
  res.json({ prize: spota > 0 ? `${spota} Spota` : 'Better luck next time!' });
});

module.exports = router;
