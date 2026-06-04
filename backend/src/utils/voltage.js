const db = require('../config/database');

const RANKS = [
  { title: 'Static',   min: 0 },
  { title: 'Spark',    min: 500 },
  { title: 'Buzz',     min: 1500 },
  { title: 'Shock',    min: 3000 },
  { title: 'Surge',    min: 6000 },
  { title: 'Bolt',     min: 12000 },
  { title: 'Thunder',  min: 25000 },
  { title: 'Storm',    min: 50000 },
  { title: 'Overload', min: 100000 },
  { title: 'LOUD',     min: 250000 },
];

function getRankTitle(voltage) {
  let rank = 'Static';
  for (const r of RANKS) {
    if (voltage >= r.min) rank = r.title;
  }
  return rank;
}

// Atomically award voltage, recalculate ranks, emit rank-up event if changed
async function awardVoltage(userId, action, monthlyAmt, lifetimeAmt, io) {
  const result = await db.query(
    `UPDATE users
       SET monthly_voltage  = monthly_voltage  + $1,
           lifetime_voltage = lifetime_voltage + $2
     WHERE id = $3
     RETURNING monthly_voltage, lifetime_voltage, monthly_rank, lifetime_rank`,
    [monthlyAmt, lifetimeAmt, userId]
  );
  if (!result.rows[0]) return;
  const u = result.rows[0];

  const newMonthly  = getRankTitle(u.monthly_voltage);
  const newLifetime = getRankTitle(u.lifetime_voltage);
  const rankChanged = newMonthly !== u.monthly_rank || newLifetime !== u.lifetime_rank;

  if (rankChanged) {
    await db.query(
      'UPDATE users SET monthly_rank=$1, lifetime_rank=$2 WHERE id=$3',
      [newMonthly, newLifetime, userId]
    );
    io?.to(`user:${userId}`).emit('voltage-rank-up', {
      monthlyRank:     newMonthly,
      lifetimeRank:    newLifetime,
      monthlyVoltage:  u.monthly_voltage,
      lifetimeVoltage: u.lifetime_voltage,
    });
  }

  await db.query(
    'INSERT INTO voltage_log (user_id,action,monthly_earned,lifetime_earned) VALUES ($1,$2,$3,$4)',
    [userId, action, monthlyAmt, lifetimeAmt]
  );

  const month = new Date().toISOString().slice(0, 7);
  await db.query(
    `INSERT INTO monthly_leaderboard (user_id, month, total_voltage)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, month)
     DO UPDATE SET total_voltage = monthly_leaderboard.total_voltage + $3`,
    [userId, month, monthlyAmt]
  );
}

module.exports = { awardVoltage, getRankTitle, RANKS };
