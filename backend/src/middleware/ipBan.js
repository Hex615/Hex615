const db    = require('../config/database');
const redis = require('../config/redis');

const CACHE_TTL   = 300;       // 5 min Redis cache for ban list
const CACHE_KEY   = 'ip_bans'; // Redis set of banned IPs
const AUTO_BAN_THRESHOLD_OTP  = 20;  // failed OTP attempts in 1 hour → 24h ban
const AUTO_BAN_THRESHOLD_AUTH = 50;  // any auth failures in 15 min → 1h ban

// Populate Redis cache from DB (called on startup + after ban changes)
async function warmBanCache() {
  try {
    const bans = await db.query(
      "SELECT ip_address FROM ip_bans WHERE (expires_at IS NULL OR expires_at > NOW())"
    );
    if (bans.rows.length > 0) {
      const ips = bans.rows.map((r) => r.ip_address);
      await redis.del(CACHE_KEY);
      await redis.sAdd(CACHE_KEY, ips);
      await redis.expire(CACHE_KEY, CACHE_TTL);
    }
  } catch (err) {
    console.error('IP ban cache warm error:', err.message);
  }
}
warmBanCache();

// Get real client IP (handles proxies / load balancers)
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

// Main middleware — blocks banned IPs
async function ipBanMiddleware(req, res, next) {
  const ip = getClientIp(req);
  req.clientIp = ip; // attach for downstream use

  // Never block localhost in dev
  if (process.env.NODE_ENV !== 'production' && (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.'))) {
    return next();
  }

  try {
    // Check Redis cache first
    const cachedBanned = await redis.sIsMember(CACHE_KEY, ip).catch(() => false);
    if (cachedBanned) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fall back to DB (handles cache miss or Redis down)
    const banned = await db.query(
      "SELECT id FROM ip_bans WHERE ip_address=$1::inet AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
      [ip]
    );
    if (banned.rows[0]) {
      // Re-add to cache so next request is fast
      await redis.sAdd(CACHE_KEY, ip).catch(() => {});
      return res.status(403).json({ error: 'Access denied.' });
    }
  } catch (err) {
    // If both Redis and DB fail, fail open (don't block legit users)
    console.error('IP ban check error:', err.message);
  }

  next();
}

// Record a failed auth attempt, auto-ban if threshold exceeded
async function recordFailedAttempt(ip, type, db) {
  try {
    await db.query(
      'INSERT INTO failed_auth_attempts (ip_address, attempt_type) VALUES ($1::inet, $2)',
      [ip, type]
    );

    // OTP abuse: 20 failures in 1 hour → 24h ban
    if (type === 'otp_verify') {
      const count = await db.query(
        "SELECT COUNT(*) FROM failed_auth_attempts WHERE ip_address=$1::inet AND attempt_type='otp_verify' AND created_at > NOW() - INTERVAL '1 hour'",
        [ip]
      );
      if (parseInt(count.rows[0].count) >= AUTO_BAN_THRESHOLD_OTP) {
        await autoBanIp(ip, 'Auto-banned: excessive OTP failures', 24 * 60, db);
      }
    }

    // General auth abuse: 50 failures in 15 min → 1h ban
    const total = await db.query(
      "SELECT COUNT(*) FROM failed_auth_attempts WHERE ip_address=$1::inet AND created_at > NOW() - INTERVAL '15 minutes'",
      [ip]
    );
    if (parseInt(total.rows[0].count) >= AUTO_BAN_THRESHOLD_AUTH) {
      await autoBanIp(ip, 'Auto-banned: brute force detected', 60, db);
    }
  } catch (err) {
    console.error('recordFailedAttempt error:', err.message);
  }
}

// Programmatically ban an IP (used by auto-ban and admin routes)
async function autoBanIp(ip, reason, durationMinutes, dbClient) {
  const db_ = dbClient || db;
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;
  try {
    await db_.query(
      `INSERT INTO ip_bans (ip_address, reason, expires_at)
       VALUES ($1::inet, $2, $3)
       ON CONFLICT (ip_address) DO UPDATE SET reason=$2, expires_at=$3`,
      [ip, reason, expiresAt]
    );
    await redis.sAdd(CACHE_KEY, ip).catch(() => {});
    console.warn(`[SECURITY] IP banned: ${ip} — ${reason}`);
  } catch (err) {
    console.error('autoBanIp error:', err.message);
  }
}

// Unban an IP and remove from cache
async function unbanIp(ip) {
  try {
    await db.query('DELETE FROM ip_bans WHERE ip_address=$1::inet', [ip]);
    await redis.sRem(CACHE_KEY, ip).catch(() => {});
  } catch (err) {
    console.error('unbanIp error:', err.message);
  }
}

module.exports = { ipBanMiddleware, recordFailedAttempt, autoBanIp, unbanIp, getClientIp, warmBanCache };
