const router = require('express').Router();
const { body } = require('express-validator');
const jwt  = require('jsonwebtoken');
const db   = require('../config/database');
const { validate }  = require('../middleware/validate');
const { hashToken, genToken } = require('../utils/crypto');
const { awardVoltage } = require('../utils/voltage');
const limits = require('../middleware/rateLimiter');

// ── helpers ──────────────────────────────────────────────────────────────────
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function issueTokens(userId) {
  const accessToken  = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = genToken(40);
  return { accessToken, refreshToken };
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+1${digits}`;
}

// ── POST /auth/send-otp ───────────────────────────────────────────────────────
router.post('/send-otp',
  limits.otp,
  body('phone').isMobilePhone().withMessage('Valid phone required'),
  validate,
  async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    try {
      // Invalidate any previous unused OTPs for this phone
      await db.query("UPDATE otp_codes SET used=true WHERE phone=$1 AND used=false", [phone]);

      const code      = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.query('INSERT INTO otp_codes (phone,code,expires_at) VALUES ($1,$2,$3)', [phone, code, expiresAt]);

      // In production: send via Twilio
      // const tw = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await tw.messages.create({ body: `Your Chatsplat code: ${code}`, from: process.env.TWILIO_PHONE, to: phone });

      console.log(`[OTP] ${phone} → ${code}`);
      res.json({ message: 'OTP sent', ...(process.env.NODE_ENV !== 'production' && { code }) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  }
);

// ── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp',
  limits.auth,
  body('phone').isMobilePhone(),
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit code required'),
  validate,
  async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const { code } = req.body;
    try {
      // Find valid OTP
      const otp = await db.query(
        "SELECT * FROM otp_codes WHERE phone=$1 AND used=false AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1",
        [phone]
      );
      if (!otp.rows[0]) return res.status(400).json({ error: 'No active OTP found' });

      // Increment attempts — lock after 5
      await db.query('UPDATE otp_codes SET attempts=attempts+1 WHERE id=$1', [otp.rows[0].id]);
      if (otp.rows[0].attempts >= 5) {
        await db.query('UPDATE otp_codes SET used=true WHERE id=$1', [otp.rows[0].id]);
        return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
      }

      if (otp.rows[0].code !== code) return res.status(400).json({ error: 'Invalid code' });
      await db.query('UPDATE otp_codes SET used=true WHERE id=$1', [otp.rows[0].id]);

      // Upsert user
      let user  = (await db.query('SELECT * FROM users WHERE phone=$1', [phone])).rows[0];
      const isNew = !user;
      if (isNew) {
        user = (await db.query('INSERT INTO users (phone) VALUES ($1) RETURNING *', [phone])).rows[0];
      } else {
        // Daily login voltage
        const today = new Date().toDateString();
        const lastSeen = user.last_seen ? new Date(user.last_seen).toDateString() : null;
        if (lastSeen !== today) await awardVoltage(user.id, 'daily_login', 10, 10);
        await db.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]);
      }

      const { accessToken, refreshToken } = issueTokens(user.id);
      const hash = hashToken(refreshToken);
      await db.query(
        "INSERT INTO refresh_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 days')",
        [user.id, hash]
      );

      const { phone: _p, ...safeUser } = user;
      res.json({ accessToken, refreshToken, user: safeUser, isNew });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh',
  limits.auth,
  body('refreshToken').isString().notEmpty(),
  validate,
  async (req, res) => {
    const { refreshToken } = req.body;
    const hash = hashToken(refreshToken);
    try {
      const stored = await db.query(
        'SELECT * FROM refresh_tokens WHERE token_hash=$1 AND expires_at>NOW()',
        [hash]
      );
      if (!stored.rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });

      const { accessToken, refreshToken: newRaw } = issueTokens(stored.rows[0].user_id);
      const newHash = hashToken(newRaw);

      // Rotate: delete old, insert new
      await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash]);
      await db.query(
        "INSERT INTO refresh_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,NOW()+INTERVAL '30 days')",
        [stored.rows[0].user_id, newHash]
      );

      res.json({ accessToken, refreshToken: newRaw });
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: 'Token refresh failed' });
    }
  }
);

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    await db.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash]).catch(() => {});
  }
  res.json({ message: 'Logged out' });
});

module.exports = router;
