const db = require('../config/database');

// Fire-and-forget security event log — never throws, never blocks response
async function logEvent(userId, ip, eventType, details = {}, severity = 'info') {
  try {
    await db.query(
      'INSERT INTO security_events (user_id,ip_address,event_type,details,severity) VALUES ($1,$2::inet,$3,$4,$5)',
      [userId || null, ip || '0.0.0.0', eventType, JSON.stringify(details), severity]
    );
  } catch {
    // Silent — audit log failure must never crash the request
  }
}

module.exports = { logEvent };
