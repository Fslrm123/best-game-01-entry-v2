// Screenshot scenes behind ?shot=start|play|boss|win. Each one plays the real
// rules forward from a fresh world for as long as the scene needs, steered by
// a simple autopilot (flee what is close, chase shards, orbit the boss, shoot
// the nearest foe, pick upgrades by priority), so every frame is what a real
// game looks like and the same seed always gives the same frame.

import { STEP, ARENA } from './config.js';
import {
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_WIN, SCREEN_LOSE,
  beginRun, chooseUpgrade, resetWorld, stepWorld,
} from './world.js';

const UPGRADE_PRIORITY = [
  'heavy-embers', 'rapid-ignition', 'twin-flame', 'piercing-embers',
  'heartwood', 'ember-nova', 'swift-boots', 'magnet-core',
  'thick-hide', 'kindling-regen', 'greedy-flame', 'phoenix-feather',
];

function autopilotInput(world) {
  const p = world.player;
  // Aim at the nearest foe when one is close (clear the swarm first), else
  // at the boss when one is up, else at the nearest foe at any range.
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of world.enemies) {
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  let target = nearest;
  if (world.boss && (!nearest || nearestDist > 280)) target = world.boss;
  let moveX = 0;
  let moveY = 0;
  // Dodge incoming enemy bolts: step sideways from the closest threat.
  for (const bullet of world.enemyBullets) {
    const dx = bullet.x - p.x;
    const dy = bullet.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120) {
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const approaching = (dx * bullet.vx + dy * bullet.vy) / (dist * speed);
      if (approaching > 0.3) {
        moveX += (-bullet.vy / speed) * 1.4;
        moveY += (bullet.vx / speed) * 1.4;
      }
    }
  }
  // Flee from the centroid of nearby foes, weighted by closeness; when hurt,
  // keep a wider berth. This is what keeps the pilot from being cornered.
  const fleeRadius = p.hp < 35 ? 300 : 230;
  let fleeX = 0;
  let fleeY = 0;
  let fleeWeight = 0;
  for (const enemy of world.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < fleeRadius) {
      const weight = (fleeRadius - dist) / fleeRadius;
      fleeX += (dx / dist) * weight;
      fleeY += (dy / dist) * weight;
      fleeWeight += weight;
    }
  }
  if (fleeWeight > 0.4) {
    const length = Math.hypot(fleeX, fleeY) || 1;
    moveX += (fleeX / length) * 1.6;
    moveY += (fleeY / length) * 1.6;
  } else if (world.boss) {
    const dx = p.x - world.boss.x;
    const dy = p.y - world.boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 250) {
      moveX = dx / dist;
      moveY = dy / dist;
    } else if (dist > 380) {
      moveX = -dx / dist;
      moveY = -dy / dist;
    } else {
      moveX = -dy / dist;
      moveY = dx / dist;
    }
  } else {
    let shard = null;
    let shardDist = Infinity;
    for (const s of world.shards) {
      const dist = Math.hypot(s.x - p.x, s.y - p.y);
      if (dist < shardDist) {
        shardDist = dist;
        shard = s;
      }
    }
    if (shard && shardDist < 340) {
      moveX = (shard.x - p.x) / shardDist;
      moveY = (shard.y - p.y) / shardDist;
    } else if (nearest) {
      const dx = nearest.x - p.x;
      const dy = nearest.y - p.y;
      if (nearestDist > 420) {
        moveX = dx / nearestDist;
        moveY = dy / nearestDist;
      } else {
        moveX = -dy / nearestDist;
        moveY = dx / nearestDist;
      }
    }
  }
  // Steer back inside the arena before the wall is reached.
  const margin = 90;
  if (p.x < margin) moveX += 1;
  if (p.x > ARENA.width - margin) moveX -= 1;
  if (p.y < margin) moveY += 1;
  if (p.y > ARENA.height - margin) moveY -= 1;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  const aim = target ? { x: target.x, y: target.y } : { x: p.x, y: p.y - 120 };
  return {
    moveX,
    moveY,
    aimX: aim.x,
    aimY: aim.y,
    firing: !!target && Math.hypot(target.x - p.x, target.y - p.y) < 640,
    pressed: new Set(),
    clicked: null,
  };
}

function pickBestUpgrade(world) {
  let bestIndex = 0;
  let bestRank = Infinity;
  world.choices.forEach((upgrade, i) => {
    const rank = UPGRADE_PRIORITY.indexOf(upgrade.id);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  });
  chooseUpgrade(world, bestIndex);
}

function simulate(world, sound, shouldStop, maxSeconds) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let step = 0; step < maxSteps; step += 1) {
    if (world.screen === SCREEN_LEVELUP) pickBestUpgrade(world);
    stepWorld(world, autopilotInput(world), STEP, sound);
    if (shouldStop(world)) return true;
    if (world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE) return true;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, boss or win; any other name
 * is start) and return the screen to draw and the best score to show.
 */
export function stageShot(name, world, sound) {
  resetWorld(world, world.seed);
  if (name === 'start') {
    const idle = { moveX: 0, moveY: 0, aimX: ARENA.width / 2, aimY: 200, firing: false, pressed: new Set(), clicked: null };
    for (let i = 0; i < 5 / STEP; i += 1) stepWorld(world, idle, STEP, sound);
    return { screen: SCREEN_TITLE, best: world.best.score };
  }
  beginRun(world);
  if (name === 'play') {
    simulate(world, sound, (w) => w.screen === SCREEN_LEVELUP && w.wave >= 2, 150);
    return { screen: world.screen, best: world.best.score };
  }
  if (name === 'boss') {
    // A good cover wants the boss near the middle of the arena with the
    // Warden in frame: try a few seeds for that composition. If none
    // composes, fall back to the plain damage condition, which always stops
    // mid-fight (boss HP crosses 72% before it can die in one step).
    const composed = (w) => !!w.boss && w.boss.hp < w.boss.maxHp * 0.75
      && w.enemies.length >= 3
      && w.boss.x > 350 && w.boss.x < 930 && w.boss.y > 140 && w.boss.y < 350
      && w.player.x > 150 && w.player.x < 1130 && w.player.y > 100 && w.player.y < 620
      && Math.hypot(w.player.x - 640, w.player.y - 360) < 460;
    const fightOver = (w) => w.screen === SCREEN_WIN || w.screen === SCREEN_LOSE || (w.wave >= 5 && !w.boss);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      resetWorld(world, world.seed + attempt);
      beginRun(world);
      simulate(world, sound, (w) => fightOver(w) || composed(w), 150);
      if (world.screen === SCREEN_PLAY && world.boss && composed(world)) {
        return { screen: world.screen, best: world.best.score };
      }
    }
    resetWorld(world, world.seed);
    beginRun(world);
    simulate(world, sound, (w) => fightOver(w) || (w.boss && w.boss.hp < w.boss.maxHp * 0.72), 150);
    return { screen: world.screen, best: world.best.score };
  }
  if (name === 'win') {
    simulate(world, sound, (w) => w.screen === SCREEN_WIN, 600);
    return { screen: world.screen, best: world.best.score };
  }
  return { screen: SCREEN_TITLE, best: world.best.score };
}
