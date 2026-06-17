const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function genToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { hashToken, genToken };
