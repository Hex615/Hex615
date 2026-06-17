const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000; // 15 min

// General API
exports.api = rateLimit({
  windowMs,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

// Auth endpoints — strict
exports.auth = rateLimit({
  windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

// OTP send — very strict to prevent SMS abuse
exports.otp = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'OTP request limit reached. Wait 60 seconds.' },
});

// Gift sending — prevent Spota draining spam
exports.gift = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Sending gifts too fast.' },
});
