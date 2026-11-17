// The game itself: state machine, waves, bullets, collisions, shards, score,
// level-ups, bosses, winning and losing. Drawing lives in render.js; sound
// is an injected SoundBank (or null); nothing here touches the DOM except
// the guarded best-score save.

import { ARENA, STEP, WIN_WAVE, waveComposition, waveEnemyCount, waveIsBoss, waveBossKind, xpForLevel } from './config.js';
import { makeRng } from './random.js';
import { makePlayer, movePlayer, playerFireTimer, hurtPlayer } from './player.js';
import { makeEnemy, makeBoss, updateEnemy } from './enemies.js';
import { rollUpgradeChoices, applyUpgrade } from './upgrades.js';
import { Particles } from './particles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

export const CARD_WIDTH = 300;
export const CARD_HEIGHT = 178;
export const CARD_Y = 296;
export const CARD_GAP = 28;

export function levelUpCardRects() {
  const total = CARD_WIDTH * 3 + CARD_GAP * 2;
  const startX = (ARENA.width - total) / 2;
  return [0, 1, 2].map((i) => ({
    x: startX + i * (CARD_WIDTH + CARD_GAP),
    y: CARD_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

export function loadBest() {
  try {
    if (typeof localStorage === 'undefined') return { score: 0, wave: 0 };
    const raw = localStorage.getItem('emberfall-best');
    if (!raw) return { score: 0, wave: 0 };
    const parsed = JSON.parse(raw);
    return { score: parsed.score | 0, wave: parsed.wave | 0 };
  } catch (error) {
    return { score: 0, wave: 0 };
  }
}

export function saveBest(best) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('emberfall-best', JSON.stringify(best));
  } catch (error) {
    /* best score is a nicety, never a failure */
  }
}

export function makeWorld(seed) {
  const world = {
    rng: makeRng(seed),
    seed,
    screen: SCREEN_TITLE,
    time: 0,
    runTime: 0,
    player: makePlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    shards: [],
    particles: new Particles(),
    wave: 0,
    waveState: 'idle',
    spawnQueue: [],
    spawnTimer: 0,
    breatherTimer: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevels: 0,
    taken: {},
    choices: [],
    boss: null,
    shake: 0,
    hurtFlash: 0,
    banner: null,
    ambientTimer: 0,
    best: loadBest(),
    newBest: false,
    muted: false,
    history: [],
  };
  return world;
}

export function resetWorld(world, seed) {
  const fresh = makeWorld(seed === undefined ? world.seed : seed);
  fresh.best = world.best;
  Object.keys(world).forEach((key) => delete world[key]);
  Object.assign(world, fresh);
}

export function beginRun(world) {
  resetWorld(world, world.seed);
  world.screen = SCREEN_PLAY;
  world.wave = 0;
  startWave(world, 1);
}

function showBanner(world, title, sub, seconds) {
  world.banner = { title, sub: sub || '', timer: seconds, max: seconds };
}

function startWave(world, wave) {
  world.wave = wave;
  world.history.push({ event: 'wave', wave, score: world.score, hp: Math.ceil(world.player.hp), level: world.level, kills: world.kills });
  world.waveState = 'spawning';
  world.spawnTimer = 0.5;
  const queue = [];
  // Boss waves are a boss fight with a few adds, not a swarm plus a boss.
  const count = waveIsBoss(wave) ? 8 : waveEnemyCount(wave);
  const table = waveComposition(wave);
  const kinds = Object.keys(table);
  const weights = kinds.map((k) => table[k]);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i += 1) {
    let roll = world.rng.next() * totalWeight;
    let kind = kinds[0];
    for (let j = 0; j < kinds.length; j += 1) {
      roll -= weights[j];
      if (roll <= 0) { kind = kinds[j]; break; }
    }
    queue.push(kind);
  }
  world.spawnQueue = queue;
  if (waveIsBoss(wave)) {
    world.boss = makeBoss(wave, world.rng);
    world.enemies.push(world.boss);
    showBanner(world, `WAVE ${wave}`, `${waveBossKind(wave) === 'cinder-maw' ? 'CINDER MAW' : 'THE HOLLOW STAR'} AWAKENS`, 2.6);
  } else {
    showBanner(world, `WAVE ${wave}`, wave === WIN_WAVE ? 'THE FINAL WAVE' : `${count} hostiles incoming`, 2.2);
  }
}

function spawnEdgePoint(world) {
  const margin = 40;
  const side = world.rng.int(0, 3);
  if (side === 0) return { x: world.rng.range(margin, ARENA.width - margin), y: margin };
  if (side === 1) return { x: world.rng.range(margin, ARENA.width - margin), y: ARENA.height - margin };
  if (side === 2) return { x: margin, y: world.rng.range(margin, ARENA.height - margin) };
  return { x: ARENA.width - margin, y: world.rng.range(margin, ARENA.height - margin) };
}

function firePlayerVolley(world) {
  const p = world.player;
  const spread = 0.14;
  for (let i = 0; i < p.projectiles; i += 1) {
    const offset = (i - (p.projectiles - 1) / 2) * spread;
    const angle = p.aimAngle + offset;
    world.bullets.push({
      x: p.x + Math.cos(angle) * (p.radius + 6),
      y: p.y + Math.sin(angle) * (p.radius + 6),
      vx: Math.cos(angle) * p.bulletSpeed,
      vy: Math.sin(angle) * p.bulletSpeed,
      radius: p.bulletRadius,
      damage: p.bulletDamage,
      pierce: p.pierce,
      life: 1.4,
    });
  }
  p.trailTimer = 0.05;
}

function fireNova(world) {
  const p = world.player;
  for (let i = 0; i < p.novaCount; i += 1) {
    const angle = (i / p.novaCount) * Math.PI * 2;
    world.bullets.push({
      x: p.x + Math.cos(angle) * (p.radius + 6),
      y: p.y + Math.sin(angle) * (p.radius + 6),
      vx: Math.cos(angle) * p.bulletSpeed * 0.8,
      vy: Math.sin(angle) * p.bulletSpeed * 0.8,
      radius: p.bulletRadius,
      damage: p.bulletDamage * 0.8,
      pierce: 0,
      life: 0.9,
    });
  }
  world.particles.ring(p.x, p.y, '#ffb347', 120);
}

function dropShards(world, enemy) {
  const total = enemy.xp;
  const pieces = enemy.kind === 'cinder-maw' || enemy.kind === 'hollow-star' ? 5 : Math.min(3, total);
  const valueEach = Math.max(1, Math.round(total / pieces));
  for (let i = 0; i < pieces; i += 1) {
    const angle = world.rng.range(0, Math.PI * 2);
    world.shards.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * world.rng.range(40, 130),
      vy: Math.sin(angle) * world.rng.range(40, 130),
      value: valueEach,
      life: 14,
    });
  }
}

function comboMultiplier(world) {
  return 1 + Math.min(world.combo, 20) * 0.05;
}

function killEnemy(world, enemy, index, sound) {
  world.enemies.splice(index, 1);
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = 2.5;
  const gained = Math.round(enemy.score * (1 + 0.1 * (world.wave - 1)) * comboMultiplier(world) * world.player.scoreFactor);
  world.score += gained;
  world.particles.burst(enemy.x, enemy.y, enemy.color, enemy.radius > 30 ? 26 : 12, 260);
  world.particles.ring(enemy.x, enemy.y, enemy.color, enemy.radius + 26);
  world.particles.floatText(enemy.x, enemy.y - enemy.radius - 6, `+${gained}`, '#ffd166', enemy.radius > 30);
  world.shake = Math.min(14, world.shake + (enemy.radius > 30 ? 9 : 2.5));
  if (sound) sound.explode(enemy.radius > 30);
  dropShards(world, enemy);
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const child = makeEnemy('emberling', enemy.x + (i === 0 ? -18 : 18), enemy.y, world.wave, world.rng);
      world.enemies.push(child);
    }
  }
  if (enemy === world.boss) {
    world.boss = null;
    world.particles.burst(enemy.x, enemy.y, '#ffffff', 60, 420);
    world.particles.ring(enemy.x, enemy.y, '#ff5d8f', 260);
    world.shake = 16;
    if (world.wave === WIN_WAVE) {
      finishRun(world, true, sound);
    }
  }
}

function finishRun(world, won, sound) {
  world.screen = won ? SCREEN_WIN : SCREEN_LOSE;
  world.history.push({ event: won ? 'win' : 'lose', wave: world.wave, score: world.score, hp: Math.ceil(world.player.hp), level: world.level, kills: world.kills });
  if (world.score > world.best.score) {
    world.best = { score: world.score, wave: world.wave };
    world.newBest = true;
    saveBest(world.best);
  } else if (world.wave > world.best.wave && world.best.score === 0) {
    world.best = { score: world.score, wave: world.wave };
    saveBest(world.best);
  }
  if (sound) {
    if (won) sound.win();
    else sound.lose();
  }
}

function grantXp(world, amount, sound) {
  world.xp += amount;
  while (world.xp >= world.xpNext) {
    world.xp -= world.xpNext;
    world.level += 1;
    world.xpNext = xpForLevel(world.level);
    world.pendingLevels += 1;
  }
  if (world.pendingLevels > 0 && world.screen === SCREEN_PLAY) {
    world.pendingLevels -= 1;
    world.choices = rollUpgradeChoices(world.rng, world.taken);
    world.screen = SCREEN_LEVELUP;
    if (sound) sound.levelUp();
  }
}

export function chooseUpgrade(world, index) {
  const upgrade = world.choices[index];
  if (!upgrade) return;
  applyUpgrade(world.player, upgrade, world.taken);
  world.choices = [];
  if (world.pendingLevels > 0) {
    world.pendingLevels -= 1;
    world.choices = rollUpgradeChoices(world.rng, world.taken);
  } else {
    world.screen = SCREEN_PLAY;
  }
}

function damagePlayer(world, damage, fromX, fromY, sound) {
  const result = hurtPlayer(world.player, damage);
  if (result === false) return;
  world.hurtFlash = 0.55;
  world.shake = Math.min(14, world.shake + 6);
  const dx = world.player.x - fromX;
  const dy = world.player.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  world.player.x += (dx / dist) * 26;
  world.player.y += (dy / dist) * 26;
  world.particles.burst(world.player.x, world.player.y, '#ff5d5d', 10, 220);
  if (sound) sound.hurt();
  if (result === 'phoenix') {
    showBanner(world, 'PHOENIX FEATHER', 'The ember refuses to die — revived at 50% HP', 2.4);
    world.particles.ring(world.player.x, world.player.y, '#ffb347', 200);
  } else if (result === 'dead') {
    world.combo = 0;
    finishRun(world, false, sound);
  }
}

function stepPlay(world, input, dt, sound) {
  world.runTime += dt;
  world.comboTimer -= dt;
  if (world.comboTimer <= 0) world.combo = 0;
  world.shake = Math.max(0, world.shake - dt * 26);
  world.hurtFlash = Math.max(0, world.hurtFlash - dt);
  if (world.banner) {
    world.banner.timer -= dt;
    if (world.banner.timer <= 0) world.banner = null;
  }

  const player = world.player;
  movePlayer(player, input, dt);
  if (input.firing && playerFireTimer(player, dt)) {
    firePlayerVolley(world);
    if (sound) sound.shoot();
  }
  if (player.novaInterval > 0) {
    player.novaTimer -= dt;
    if (player.novaTimer <= 0) {
      player.novaTimer = player.novaInterval;
      fireNova(world);
      if (sound) sound.levelUp();
    }
  }

  // Spawn the wave's queue from the edges.
  if (world.waveState === 'spawning' && world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = 0.32;
      const kind = world.spawnQueue.shift();
      const point = spawnEdgePoint(world);
      const minDist = 230;
      let tries = 0;
      while (Math.hypot(point.x - player.x, point.y - player.y) < minDist && tries < 6) {
        const next = spawnEdgePoint(world);
        point.x = next.x;
        point.y = next.y;
        tries += 1;
      }
      world.enemies.push(makeEnemy(kind, point.x, point.y, world.wave, world.rng));
      if (world.spawnQueue.length === 0) world.waveState = 'fighting';
    }
  }

  // Enemies move and attack; bosses may call for summoned minions.
  const fireEnemyBullet = (x, y, dx, dy, speed, damage, radius, color) => {
    world.enemyBullets.push({ x, y, vx: dx * speed, vy: dy * speed, radius, damage, life: 5, color });
  };
  for (const enemy of world.enemies) {
    updateEnemy(enemy, player, dt, world.time, fireEnemyBullet);
    if (enemy.summoned) {
      enemy.summoned = false;
      const kind = enemy.kind === 'cinder-maw' ? 'emberling' : 'spitter';
      for (let i = 0; i < 3; i += 1) {
        const angle = world.rng.range(0, Math.PI * 2);
        world.enemies.push(makeEnemy(kind, enemy.x + Math.cos(angle) * 70, enemy.y + Math.sin(angle) * 70, world.wave, world.rng));
      }
      world.particles.ring(enemy.x, enemy.y, enemy.color, 140);
      if (sound) sound.bossRoar();
    }
  }

  // Separate overlapping enemies so the swarm does not stack into one dot.
  for (let i = 0; i < world.enemies.length; i += 1) {
    for (let j = i + 1; j < world.enemies.length; j += 1) {
      const a = world.enemies[i];
      const b = world.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Player bolts vs enemies.
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > ARENA.width + 20 || bullet.y < -20 || bullet.y > ARENA.height + 20;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = world.enemies[j];
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        if (Math.hypot(dx, dy) < enemy.radius + bullet.radius) {
          enemy.hp -= bullet.damage;
          enemy.flash = 1;
          world.particles.burst(bullet.x, bullet.y, '#ffd166', 3, 120);
          if (sound) sound.enemyHit();
          if (enemy.hp <= 0) {
            killEnemy(world, enemy, j, sound);
            if (world.screen !== SCREEN_PLAY) return;
          }
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // Enemy bolts vs the player.
  for (let i = world.enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > ARENA.width + 20 || bullet.y < -20 || bullet.y > ARENA.height + 20;
    if (!dead) {
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      if (Math.hypot(dx, dy) < player.radius + bullet.radius) {
        damagePlayer(world, bullet.damage, bullet.x, bullet.y, sound);
        dead = true;
        if (world.screen !== SCREEN_PLAY) return;
      }
    }
    if (dead) world.enemyBullets.splice(i, 1);
  }

  // Contact damage.
  for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
    const enemy = world.enemies[j];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.radius + enemy.radius) {
      damagePlayer(world, enemy.damage, enemy.x, enemy.y, sound);
      enemy.x -= (dx / (dist || 1)) * 12;
      enemy.y -= (dy / (dist || 1)) * 12;
      if (world.screen !== SCREEN_PLAY) return;
    }
  }

  // Shards drift, magnetise, and feed XP.
  for (let i = world.shards.length - 1; i >= 0; i -= 1) {
    const shard = world.shards[i];
    shard.life -= dt;
    shard.vx *= 0.96;
    shard.vy *= 0.96;
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.magnetRadius) {
      shard.vx += (dx / (dist || 1)) * 900 * dt;
      shard.vy += (dy / (dist || 1)) * 900 * dt;
    }
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    if (dist < player.pickupRadius) {
      world.shards.splice(i, 1);
      world.particles.burst(shard.x, shard.y, '#7ef0c1', 4, 110);
      if (sound) sound.pickup();
      grantXp(world, shard.value, sound);
      if (world.screen !== SCREEN_PLAY) return;
    } else if (shard.life <= 0) {
      world.shards.splice(i, 1);
    }
  }

  world.particles.update(dt);

  // Wave cleared: bonus, a little healing, and the next wave.
  if (world.waveState === 'fighting' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    const bonus = 100 * world.wave;
    world.score += bonus;
    player.hp = Math.min(player.maxHp, player.hp + 15);
    showBanner(world, `WAVE ${world.wave} CLEARED`, `+${bonus} bonus  ·  +15 HP`, 2.2);
    if (sound) sound.waveClear();
    world.waveState = 'breather';
    world.breatherTimer = 2.4;
  }
  if (world.waveState === 'breather') {
    world.breatherTimer -= dt;
    if (world.breatherTimer <= 0) {
      if (world.wave >= WIN_WAVE) {
        finishRun(world, true, sound);
      } else {
        startWave(world, world.wave + 1);
      }
    }
  }
}

function stepTitle(world, input, dt) {
  world.time += dt;
  world.ambientTimer -= dt;
  if (world.ambientTimer <= 0) {
    world.ambientTimer = 0.12;
    world.particles.burst(
      world.rng.range(80, ARENA.width - 80),
      ARENA.height + 10,
      world.rng.pick(['#ff8a3c', '#ffb347', '#ff5da2']),
      1,
      30,
    );
    for (const spark of world.particles.sparks) spark.vy = -Math.abs(spark.vy) - 24;
  }
  world.particles.update(dt);
  if (input.pressed.has('Enter') || input.pressed.has('Space') || input.clicked) {
    beginRun(world);
  }
}

export function stepWorld(world, input, dt, sound) {
  world.time += dt;
  if (world.screen === SCREEN_TITLE) {
    stepTitle(world, input, dt);
    return;
  }
  if (world.screen === SCREEN_PLAY) {
    if (input.pressed.has('KeyP') || input.pressed.has('Escape')) {
      world.screen = SCREEN_PAUSE;
      return;
    }
    stepPlay(world, input, dt, sound);
    return;
  }
  if (world.screen === SCREEN_LEVELUP) {
    world.particles.update(dt);
    if (input.pressed.has('Digit1')) chooseUpgrade(world, 0);
    else if (input.pressed.has('Digit2')) chooseUpgrade(world, 1);
    else if (input.pressed.has('Digit3')) chooseUpgrade(world, 2);
    else if (input.clicked) {
      const rects = levelUpCardRects();
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        if (input.clicked.x >= r.x && input.clicked.x <= r.x + r.width && input.clicked.y >= r.y && input.clicked.y <= r.y + r.height) {
          chooseUpgrade(world, i);
          break;
        }
      }
    }
    return;
  }
  if (world.screen === SCREEN_PAUSE) {
    if (input.pressed.has('KeyP') || input.pressed.has('Escape') || input.pressed.has('Enter')) {
      world.screen = SCREEN_PLAY;
    }
    return;
  }
  if (world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE) {
    world.particles.update(dt);
    if (input.pressed.has('KeyR') || input.pressed.has('Enter') || input.clicked) {
      beginRun(world);
    }
    return;
  }
}
