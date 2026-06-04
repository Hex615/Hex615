const OpenAI = require('openai');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Hardcoded keyword filter — runs on ALL text, applies to everyone including owner
const BAD_WORDS = [
  'nigger','nigga','faggot','fag','chink','spic','kike','tranny',
  'retard','cunt','fuck','shit','bitch','asshole','motherfucker',
];

function basicFilter(text) {
  if (!text) return text;
  let out = text;
  for (const word of BAD_WORDS) {
    out = out.replace(new RegExp(`\\b${word}\\b`, 'gi'), '*'.repeat(word.length));
  }
  return out;
}

// OpenAI moderation — hardcoded ON, cannot be disabled by owner or anyone
async function moderateText(text) {
  if (!text) return { flagged: false, filtered: text };
  const filtered = basicFilter(text);
  if (!openai) return { flagged: false, filtered };

  try {
    const res    = await openai.moderations.create({ input: filtered });
    const result = res.results[0];
    if (result.flagged) {
      return { flagged: true, filtered: '[message removed]', reason: Object.keys(result.categories).filter((k) => result.categories[k]).join(',') };
    }
  } catch (err) {
    // If OpenAI is unavailable, fall back to keyword filter only
    console.error('OpenAI moderation error:', err.message);
  }
  return { flagged: false, filtered };
}

module.exports = { moderateText, basicFilter };
