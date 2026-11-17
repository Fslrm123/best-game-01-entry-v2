// Enemy bodies and behaviours: what each kind is, how it moves, and how the
// two bosses attack. Drawing lives in render.js; this file is logic only.

import { ARENA, ENEMY_KINDS, waveBossKind } from './config.js';

export function makeEnemy(kind, x, y, wave, rng) {
  const base = ENEMY_KINDS[kind];
  const isBoss = kind === 'cinder-maw' || kind === 'hollow-star';
  const hpScale = isBoss ? 1 + 0.06 * (wave - 1) : 1 + 0.10 * (wave - 1);
  const speedScale = 1 + Math.min(0.35, 0.03 * (wave - 1));
  return {
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    radius: base.radius,
    speed: base.speed * speedScale * rng.range(0.92, 1.08),
    damage: base.damage,
    score: base.score,
    xp: base.xp,
    color: base.color,
    shape: base.shape,
    angle: rng.range(0, Math.PI * 2),
    lungeTimer: rng.range(1, 2.5),
    shootTimer: rng.range(1.2, 2.4),
    burstTimer: 2.2,
    summonTimer: 6,
    spiralAngle: 0,
    flash: 0,
    wobble: rng.range(0, Math.PI * 2),
  };
}

export function makeBoss(wave, rng) {
  const kind = waveBossKind(wave);
  const boss = makeEnemy(kind, ARENA.width / 2, -80, wave, rng);
  boss.entering = true;
  return boss;
}

function chase(enemy, targetX, targetY, dt, strength) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.vx = (dx / dist) * enemy.speed * strength;
  enemy.vy = (dy / dist) * enemy.speed * strength;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

// One behaviour step. `fire` hands enemy bullets back to the world.
export function updateEnemy(enemy, player, dt, time, fire) {
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx);

  if (enemy.kind === 'emberling') {
    chase(enemy, player.x, player.y, dt, 1);
  } else if (enemy.kind === 'darter') {
    enemy.lungeTimer -= dt;
    if (enemy.lungeTimer <= 0) {
      enemy.lungeTimer = 1.6;
      enemy.vx = (dx / dist) * enemy.speed * 3.2;
      enemy.vy = (dy / dist) * enemy.speed * 3.2;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    } else {
      // Drift toward the player at a third speed, damped, so the lunge
      // stays the threat. (chase() moves the body itself, so the drift is
      // steered here instead of calling it.)
      enemy.vx *= 0.92;
      enemy.vy *= 0.92;
      enemy.vx += (dx / dist) * enemy.speed * 0.9 * dt;
      enemy.vy += (dy / dist) * enemy.speed * 0.9 * dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  } else if (enemy.kind === 'spitter') {
    if (dist > 320) {
      chase(enemy, player.x, player.y, dt, 1);
    } else if (dist < 200) {
      chase(enemy, player.x + (enemy.x - player.x), player.y + (enemy.y - player.y), dt, 0.7);
    } else {
      enemy.wobble += dt * 2;
      enemy.x += Math.cos(enemy.wobble) * 30 * dt;
      enemy.y += Math.sin(enemy.wobble) * 30 * dt;
    }
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 520) {
      enemy.shootTimer = 2.4;
      fire(enemy.x, enemy.y, dx / dist, dy / dist, 190, enemy.damage, 7, '#c9a6ff');
    }
  } else if (enemy.kind === 'splitter') {
    enemy.wobble += dt * 3;
    chase(enemy, player.x, player.y, dt, 1);
    enemy.x += Math.cos(enemy.wobble) * 24 * dt;
  } else if (enemy.kind === 'bulwark') {
    chase(enemy, player.x, player.y, dt, 1);
  } else if (enemy.kind === 'cinder-maw') {
    updateCinderMaw(enemy, player, dt, time, fire);
  } else if (enemy.kind === 'hollow-star') {
    updateHollowStar(enemy, player, dt, time, fire);
  }

  enemy.x = Math.max(enemy.radius, Math.min(ARENA.width - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(ARENA.height - enemy.radius, enemy.y));
}

function updateCinderMaw(boss, player, dt, time, fire) {
  if (boss.entering) {
    boss.y += 60 * dt;
    if (boss.y >= 175) boss.entering = false;
    return;
  }
  boss.wobble += dt * 1.2;
  boss.x = ARENA.width / 2 + Math.sin(boss.wobble) * 260;
  boss.y = 175 + Math.sin(boss.wobble * 0.7) * 40;
  boss.burstTimer -= dt;
  if (boss.burstTimer <= 0) {
    boss.burstTimer = 2.3;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + boss.spiralAngle;
      fire(boss.x, boss.y, Math.cos(a), Math.sin(a), 165, 14, 8, '#ff7a3c');
    }
    boss.spiralAngle += 0.35;
  }
  boss.summonTimer -= dt;
  if (boss.summonTimer <= 0) {
    boss.summonTimer = 7;
    boss.summoned = true;
  }
}

function updateHollowStar(boss, player, dt, time, fire) {
  if (boss.entering) {
    boss.y += 70 * dt;
    if (boss.y >= 195) boss.entering = false;
    return;
  }
  const enraged = boss.hp < boss.maxHp * 0.3;
  const rate = enraged ? 0.55 : 1;
  boss.wobble += dt * 1.5;
  boss.x = ARENA.width / 2 + Math.sin(boss.wobble) * 330;
  boss.y = 195 + Math.sin(boss.wobble * 0.6) * 50;
  boss.burstTimer -= dt;
  if (boss.burstTimer <= 0) {
    boss.burstTimer = 1.7 * rate;
    for (let i = 0; i < 3; i += 1) {
      const a = boss.spiralAngle + i * 0.5;
      fire(boss.x, boss.y, Math.cos(a), Math.sin(a), 185, 16, 8, '#ff5da2');
    }
    boss.spiralAngle += 0.55;
  }
  boss.shootTimer -= dt;
  if (boss.shootTimer <= 0) {
    boss.shootTimer = 2.6 * rate;
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    for (let i = -1; i <= 1; i += 1) {
      const a = Math.atan2(dy, dx) + i * 0.16;
      fire(boss.x, boss.y, Math.cos(a), Math.sin(a), 240, 16, 8, '#ff2e88');
    }
  }
  boss.summonTimer -= dt;
  if (boss.summonTimer <= 0) {
    boss.summonTimer = 8;
    boss.summoned = true;
  }
}
