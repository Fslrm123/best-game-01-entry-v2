// Every tuning number for Emberfall Arena in one place: arena size, palette,
// player and enemy stats, wave composition and the upgrade pool's shape.

export const STEP = 1 / 60;
export const ARENA = { width: 1280, height: 720 };

export const COLORS = {
  backgroundTop: '#150a2e',
  backgroundBottom: '#0b0716',
  arenaEdge: '#ff9a3c',
  player: '#ffb347',
  playerCore: '#fff3d6',
  bullet: '#ffd166',
  shard: '#7ef0c1',
  text: '#f5efe0',
  dimText: '#b9a8d9',
  danger: '#ff5d5d',
  bossBar: '#ff5d8f',
};

export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 120,
  fireInterval: 0.24,
  bulletSpeed: 560,
  bulletDamage: 13,
  bulletRadius: 5,
  pickupRadius: 26,
  magnetRadius: 95,
  invulnerableSeconds: 0.6,
};

// kind -> base stats. hp and speed scale a little with the wave.
export const ENEMY_KINDS = {
  emberling: { name: 'Emberling', hp: 18, speed: 105, radius: 13, damage: 8, score: 50, xp: 1, color: '#ff8a3c', shape: 'diamond' },
  darter: { name: 'Darter', hp: 14, speed: 150, radius: 11, damage: 10, score: 80, xp: 1, color: '#ff5da2', shape: 'dart' },
  spitter: { name: 'Spitter', hp: 26, speed: 70, radius: 15, damage: 8, score: 120, xp: 2, color: '#b78cff', shape: 'orb' },
  splitter: { name: 'Splitter', hp: 34, speed: 80, radius: 17, damage: 8, score: 140, xp: 2, color: '#7ef0c1', shape: 'hex' },
  bulwark: { name: 'Bulwark', hp: 120, speed: 48, radius: 24, damage: 15, score: 200, xp: 3, color: '#8fa3bf', shape: 'square' },
  'cinder-maw': { name: 'Cinder Maw', hp: 950, speed: 55, radius: 46, damage: 20, score: 2500, xp: 25, color: '#ff5d3c', shape: 'boss' },
  'hollow-star': { name: 'The Hollow Star', hp: 1900, speed: 62, radius: 56, damage: 25, score: 10000, xp: 60, color: '#ff2e88', shape: 'boss' },
};

// Which kinds may appear in each wave, as weights. Bosses arrive on waves 5 and 10.
export function waveComposition(wave) {
  const table = { emberling: 10 };
  if (wave >= 2) table.darter = 4 + wave;
  if (wave >= 3) table.spitter = 3 + wave;
  if (wave >= 4) table.splitter = 2 + wave;
  if (wave >= 6) table.bulwark = 1 + Math.floor(wave / 2);
  return table;
}

export function waveEnemyCount(wave) {
  return 5 + wave * 2;
}

export function waveIsBoss(wave) {
  return wave === 5 || wave === 10;
}

export function waveBossKind(wave) {
  return wave === 5 ? 'cinder-maw' : 'hollow-star';
}

export function xpForLevel(level) {
  return 6 + level * 5;
}

export const WIN_WAVE = 10;
