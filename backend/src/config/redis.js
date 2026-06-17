const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
});
client.on('error', (err) => console.error('Redis error:', err.message));
client.connect().catch(console.error);

module.exports = client;
