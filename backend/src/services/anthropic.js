const fs = require('fs');
const path = require('path');
const axios = require('axios');

function readKeyFromEnvFile() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf8');
        const m = txt.match(/^ANTHROPIC_API_KEY=(.*)$/m);
        if (m && m[1]) return m[1].trim();
      }
    } catch (e) {}
  }
  return null;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || readKeyFromEnvFile();
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-2';

async function complete(prompt, opts = {}) {
  if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY in environment or .env file');

  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: opts.max_tokens || 300,
  };
  // include temperature only if explicitly provided (some Anthropic models deprecate it)
  if (typeof opts.temperature === 'number') {
    body.temperature = opts.temperature;
  }

  try {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: opts.timeout || 15000,
    });
    return resp.data;
  } catch (err) {
    const status = err.response ? err.response.status : 'NO_STATUS';
    let data = null;
    try { data = err.response && err.response.data ? JSON.stringify(err.response.data) : null; } catch(e) { data = String(err.response && err.response.data); }
    const msg = `Anthropic error ${status}: ${data || err.message}`;
    const e = new Error(msg);
    e.original = err;
    throw e;
  }
}

module.exports = { complete };
