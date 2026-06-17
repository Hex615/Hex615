require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/schema.sql'), 'utf8');
  console.log('Running migrations...');
  await pool.query(sql);
  console.log('Done.');
  await pool.end();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
