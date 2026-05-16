const router = require('express').Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  try {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
      [phone, code, expiresAt]
    );

    // In production: send via Twilio
    // const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilioClient.messages.create({ body: `Your LMK code: ${code}`, from: process.env.TWILIO_PHONE, to: phone });

    console.log(`OTP for ${phone}: ${code}`);
    res.json({ message: 'OTP sent', ...(process.env.NODE_ENV === 'development' && { code }) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  try {
    const result = await db.query(
      'SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [phone, code]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await db.query('UPDATE otp_codes SET used = true WHERE id = $1', [result.rows[0].id]);

    let user = (await db.query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
    const isNew = !user;

    if (isNew) {
      user = (await db.query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
        [phone]
      )).rows[0];
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, refreshToken]
    );

    res.json({ accessToken, refreshToken, user, isNew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const stored = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (stored.rows.length === 0) return res.status(401).json({ error: 'Invalid refresh token' });

    const { accessToken, refreshToken: newRefresh } = generateTokens(payload.userId);
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [payload.userId, newRefresh]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  res.json({ message: 'Logged out' });
});

module.exports = router;
