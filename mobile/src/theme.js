export const C = {
  bg:       '#0A0A0A',
  surface:  '#141414',
  surface2: '#1E1E1E',
  border:   '#2A2A2A',
  purple:   '#8B00FF',
  purpleDim:'rgba(139,0,255,0.15)',
  yellow:   '#FFE500',
  yellowDim:'rgba(255,229,0,0.15)',
  white:    '#FFFFFF',
  sub:      'rgba(255,255,255,0.45)',
  live:     '#FF3B5C',
};

export const VOLTAGE_RANKS = [
  { title: 'Static',   min: 0,      color: '#888888' },
  { title: 'Spark',    min: 500,    color: '#4FC3F7' },
  { title: 'Buzz',     min: 1500,   color: '#00E5FF' },
  { title: 'Shock',    min: 3000,   color: '#69F0AE' },
  { title: 'Surge',    min: 6000,   color: '#FFD740' },
  { title: 'Bolt',     min: 12000,  color: '#FFAB40' },
  { title: 'Thunder',  min: 25000,  color: '#FF6D00' },
  { title: 'Storm',    min: 50000,  color: '#E040FB' },
  { title: 'Overload', min: 100000, color: '#FF1744' },
  { title: 'LOUD',     min: 250000, color: '#FFE500' },
];

export function getVoltageRank(voltage = 0) {
  let rank = VOLTAGE_RANKS[0];
  for (const r of VOLTAGE_RANKS) { if (voltage >= r.min) rank = r; }
  return rank;
}

export const SPLAT_GIFTS = [
  { id: 'purple_bomb',  name: 'Purple Bomb',  emoji: '💜', cost: 50   },
  { id: 'shock_wave',   name: 'Shock Wave',   emoji: '⚡', cost: 100  },
  { id: 'nova',         name: 'Nova',         emoji: '🌟', cost: 250  },
  { id: 'loud_crown',   name: 'Loud Crown',   emoji: '👑', cost: 500  },
  { id: 'chatsplat',    name: 'Chatsplat',    emoji: '💥', cost: 1000 },
];
