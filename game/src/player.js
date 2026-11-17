// The Ember Warden: movement, firing and taking hits. Upgrades mutate these
// numbers through applyUpgrade in upgrades.js.

import { ARENA, PLAYER } from './config.js';

export function makePlayer() {
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2 + 60,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    fireTimer: 0,
    bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletRadius: PLAYER.bulletRadius,
    projectiles: 1,
    pierce: 0,
    magnetRadius: PLAYER.magnetRadius,
    pickupRadius: PLAYER.pickupRadius,
    damageTakenFactor: 1,
    regenPerSecond: 0,
    scoreFactor: 1,
    novaInterval: 0,
    novaTimer: 0,
    novaCount: 10,
    phoenix: false,
    phoenixUsed: false,
    invulnerableTimer: 0,
    aimAngle: -Math.PI / 2,
    trailTimer: 0,
  };
}

export function movePlayer(player, input, dt) {
  const targetVx = input.moveX * player.speed;
  const targetVy = input.moveY * player.speed;
  const blend = 1 - Math.pow(0.0001, dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vy += (targetVy - player.vy) * blend;
  player.x = Math.max(player.radius, Math.min(ARENA.width - player.radius, player.x + player.vx * dt));
  player.y = Math.max(player.radius, Math.min(ARENA.height - player.radius, player.y + player.vy * dt));
  const dx = input.aimX - player.x;
  const dy = input.aimY - player.y;
  if (Math.hypot(dx, dy) > 4) player.aimAngle = Math.atan2(dy, dx);
  player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
  if (player.regenPerSecond > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.regenPerSecond * dt);
  }
}

// Returns true when a volley was fired this step; the world spawns the bolts.
export function playerFireTimer(player, dt) {
  player.fireTimer -= dt;
  if (player.fireTimer <= 0) {
    player.fireTimer = player.fireInterval;
    return true;
  }
  return false;
}

export function hurtPlayer(player, damage) {
  if (player.invulnerableTimer > 0) return false;
  player.hp -= damage * player.damageTakenFactor;
  player.invulnerableTimer = PLAYER.invulnerableSeconds;
  if (player.hp <= 0 && player.phoenix && !player.phoenixUsed) {
    player.phoenixUsed = true;
    player.hp = Math.round(player.maxHp * 0.5);
    player.invulnerableTimer = 2;
    return 'phoenix';
  }
  return player.hp <= 0 ? 'dead' : 'hurt';
}
