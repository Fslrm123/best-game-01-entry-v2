// Everything the player sees: the arena backdrop, every entity, the HUD and
// all menus. The world never draws; this file never simulates.

import { ARENA, COLORS } from './config.js';
import { makeRng } from './random.js';
import {
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_PAUSE, SCREEN_WIN, SCREEN_LOSE,
  levelUpCardRects,
} from './world.js';

const starRng = makeRng(20261117);
const STARS = [];
for (let i = 0; i < 140; i += 1) {
  STARS.push({
    x: starRng.range(0, ARENA.width),
    y: starRng.range(0, ARENA.height),
    r: starRng.range(0.6, 2.2),
    phase: starRng.range(0, Math.PI * 2),
    speed: starRng.range(0.6, 2.2),
  });
}
const NEBULAE = [
  { x: 260, y: 150, r: 260, color: 'rgba(122, 60, 220, 0.20)' },
  { x: 1040, y: 560, r: 300, color: 'rgba(255, 90, 60, 0.14)' },
  { x: 980, y: 120, r: 200, color: 'rgba(60, 160, 220, 0.12)' },
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
  gradient.addColorStop(0, COLORS.backgroundTop);
  gradient.addColorStop(1, COLORS.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  for (const nebula of NEBULAE) {
    const glow = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
    glow.addColorStop(0, nebula.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(nebula.x - nebula.r, nebula.y - nebula.r, nebula.r * 2, nebula.r * 2);
  }
  for (const star of STARS) {
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * star.speed + star.phase));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = '#e8e2ff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255, 154, 60, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, ARENA.width - 12, ARENA.height - 12);
}

function drawShard(ctx, shard, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 6 + shard.x);
  const size = (shard.value >= 5 ? 9 : 6) * pulse;
  ctx.save();
  ctx.translate(shard.x, shard.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.shard;
  ctx.shadowColor = COLORS.shard;
  ctx.shadowBlur = 10;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawEnemyShape(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.flash > 0) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = enemy.color;
  const r = enemy.radius;
  if (enemy.shape === 'diamond') {
    ctx.rotate(time * 1.5 + enemy.wobble);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.8, 0);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.shape === 'dart') {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(r + 6, 0);
    ctx.lineTo(-r, -r * 0.7);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r, r * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.shape === 'orb') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.shape === 'hex') {
    ctx.rotate(time * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.shape === 'square') {
    ctx.rotate(time * 0.5 + enemy.wobble);
    ctx.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-r * 0.5, -r * 0.5, r, r);
  } else if (enemy.shape === 'boss') {
    const spikes = 10;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + time * 0.4;
      const rad = i % 2 === 0 ? r + 14 : r * 0.72;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(20, 4, 20, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.12, 6, 0, Math.PI * 2);
    ctx.arc(r * 0.2, -r * 0.12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.shadowBlur = 0;
  // Hit flash: a translucent white core over the body, never a white-out.
  if (enemy.flash > 0) {
    ctx.globalAlpha = enemy.flash * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (enemy.hp < enemy.maxHp && enemy.shape !== 'boss') {
    const width = enemy.radius * 2;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 4);
    ctx.fillStyle = ratio > 0.5 ? '#7ef0c1' : ratio > 0.25 ? '#ffd166' : '#ff5d5d';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * ratio, 4);
  }
}

function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const blink = player.invulnerableTimer > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.globalAlpha = blink ? 0.45 : 1;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, player.radius + 22);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.55)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.aimAngle);
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.moveTo(player.radius + 2, 0);
  ctx.lineTo(player.radius + 12, -5);
  ctx.lineTo(player.radius + 12, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (player.invulnerableTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHud(ctx, world) {
  const player = world.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Score block, top left.
  ctx.fillStyle = 'rgba(5, 2, 14, 0.55)';
  roundRect(ctx, 18, 16, 250, 74, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('SCORE', 32, 38);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(String(world.score), 32, 70);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(world.best.score, world.score)}`, 32, 86);
  if (world.combo > 1) {
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`COMBO x${world.combo}`, 32, 112);
  }
  // Wave block, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(5, 2, 14, 0.55)';
  roundRect(ctx, ARENA.width / 2 - 130, 16, 260, 52, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`WAVE ${world.wave} / 10`, ARENA.width / 2, 40);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '13px system-ui, sans-serif';
  const remaining = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(world.waveState === 'breather' ? 'Wave cleared — breathe' : `${remaining} hostiles left`, ARENA.width / 2, 60);
  // Boss bar.
  if (world.boss) {
    const boss = world.boss;
    const width = 460;
    const x = ARENA.width / 2 - width / 2;
    const y = 78;
    ctx.fillStyle = 'rgba(5, 2, 14, 0.65)';
    roundRect(ctx, x - 10, y - 6, width + 20, 34, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.bossBar;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(boss.kind === 'cinder-maw' ? 'CINDER MAW' : 'THE HOLLOW STAR', ARENA.width / 2, y + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y + 14, width, 8);
    ctx.fillStyle = COLORS.bossBar;
    ctx.fillRect(x, y + 14, width * Math.max(0, boss.hp / boss.maxHp), 8);
  }
  // Controls hint, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move · mouse aim · hold click to fire', ARENA.width - 20, 32);
  ctx.fillText(`P pause · M ${world.muted ? 'unmute' : 'mute'}`, ARENA.width - 20, 50);
  // HP bar, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(5, 2, 14, 0.55)';
  roundRect(ctx, 18, ARENA.height - 58, 250, 42, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HP', 32, ARENA.height - 40);
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(62, ARENA.height - 48, 180, 12);
  ctx.fillStyle = hpRatio > 0.5 ? '#7ef0c1' : hpRatio > 0.25 ? '#ffd166' : '#ff5d5d';
  ctx.fillRect(62, ARENA.height - 48, 180 * hpRatio, 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 62, ARENA.height - 22);
  // XP bar, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(5, 2, 14, 0.55)';
  roundRect(ctx, ARENA.width - 268, ARENA.height - 58, 250, 42, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.dimText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`LEVEL ${world.level}`, ARENA.width - 32, ARENA.height - 40);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(ARENA.width - 232, ARENA.height - 48, 180, 12);
  ctx.fillStyle = '#7ef0c1';
  ctx.fillRect(ARENA.width - 232, ARENA.height - 48, 180 * Math.min(1, world.xp / world.xpNext), 12);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${world.xp} / ${world.xpNext} XP`, ARENA.width - 32, ARENA.height - 22);
  // Wave banner.
  if (world.banner) {
    const alpha = Math.min(1, world.banner.timer / 0.5, (world.banner.max - world.banner.timer) / 0.25 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(world.banner.title, ARENA.width / 2, 250);
    if (world.banner.sub) {
      ctx.fillStyle = COLORS.dimText;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(world.banner.sub, ARENA.width / 2, 282);
    }
    ctx.globalAlpha = 1;
  }
}

function drawTitle(ctx, world, time) {
  ctx.fillStyle = 'rgba(8, 4, 20, 0.55)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.textAlign = 'center';
  const titleGradient = ctx.createLinearGradient(0, 150, 0, 260);
  titleGradient.addColorStop(0, '#ffd166');
  titleGradient.addColorStop(0.55, '#ff8a3c');
  titleGradient.addColorStop(1, '#ff2e88');
  ctx.fillStyle = titleGradient;
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.shadowColor = '#ff5d3c';
  ctx.shadowBlur = 34;
  ctx.fillText('EMBERFALL', ARENA.width / 2, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('—  A R E N A  —', ARENA.width / 2, 292);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('You are the last Ember Warden. Hold the arena, gather shards,', ARENA.width / 2, 340);
  ctx.fillText('choose your upgrades, and slay the Hollow Star on wave 10.', ARENA.width / 2, 368);
  ctx.fillStyle = 'rgba(5, 2, 14, 0.6)';
  roundRect(ctx, ARENA.width / 2 - 300, 400, 600, 92, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click — fire', ARENA.width / 2, 432);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P — pause      M — mute      1 / 2 / 3 — pick an upgrade', ARENA.width / 2, 462);
  if (world.best.score > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`BEST  ${world.best.score}  ·  reached wave ${world.best.wave}`, ARENA.width / 2, 528);
  }
  const pulse = 0.65 + 0.35 * Math.sin(time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', ARENA.width / 2, 600);
  ctx.globalAlpha = 1;
}

function drawLevelUp(ctx, world, input) {
  ctx.fillStyle = 'rgba(8, 4, 20, 0.72)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 22;
  ctx.fillText('LEVEL UP!', ARENA.width / 2, 210);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('The ember grows stronger — choose one upgrade.', ARENA.width / 2, 248);
  const rects = levelUpCardRects();
  world.choices.forEach((upgrade, i) => {
    const r = rects[i];
    const hovered = input.aimX >= r.x && input.aimX <= r.x + r.width && input.aimY >= r.y && input.aimY <= r.y + r.height;
    ctx.fillStyle = hovered ? 'rgba(255, 179, 71, 0.22)' : 'rgba(20, 10, 40, 0.9)';
    roundRect(ctx, r.x, r.y, r.width, r.height, 14);
    ctx.fill();
    ctx.strokeStyle = hovered ? '#ffb347' : 'rgba(255, 179, 71, 0.45)';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, r.x + r.width / 2, r.y + 30);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(upgrade.name, r.x + r.width / 2, r.y + 66);
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(upgrade.desc, r.x + r.width / 2, r.y + 98);
    const level = (world.taken[upgrade.id] || 0) + 1;
    ctx.fillStyle = '#7ef0c1';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`Level ${level} of ${upgrade.max}`, r.x + r.width / 2, r.y + 132);
    ctx.fillStyle = COLORS.dimText;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('click or press 1 / 2 / 3', r.x + r.width / 2, r.y + 158);
  });
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8, 4, 20, 0.7)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('PAUSED', ARENA.width / 2, 330);
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Press P or Enter to keep fighting — the swarm waits for no one.', ARENA.width / 2, 372);
}

function drawEndScreen(ctx, world, won) {
  ctx.fillStyle = won ? 'rgba(20, 12, 2, 0.72)' : 'rgba(12, 2, 8, 0.75)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#ffd166' : '#ff5d5d';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.shadowColor = won ? '#ffb347' : '#ff2e55';
  ctx.shadowBlur = 30;
  ctx.fillText(won ? 'VICTORY!' : 'THE EMBER FADES', ARENA.width / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.dimText;
  ctx.font = '21px system-ui, sans-serif';
  ctx.fillText(
    won ? 'The Hollow Star is slain — the arena is yours, Warden.' : `Fell on wave ${world.wave} — the swarm keeps the arena. For now.`,
    ARENA.width / 2,
    296,
  );
  const minutes = Math.floor(world.runTime / 60);
  const seconds = Math.floor(world.runTime % 60);
  const rows = [
    ['SCORE', String(world.score)],
    ['WAVE REACHED', `${world.wave} / 10`],
    ['FOES SLAIN', String(world.kills)],
    ['TIME', `${minutes}:${String(seconds).padStart(2, '0')}`],
  ];
  ctx.font = 'bold 24px system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 360 + i * 40;
    ctx.fillStyle = COLORS.dimText;
    ctx.textAlign = 'right';
    ctx.fillText(label, ARENA.width / 2 - 16, y);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(value, ARENA.width / 2 + 16, y);
  });
  if (world.newBest) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST SCORE ★', ARENA.width / 2, 540);
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', ARENA.width / 2, 600);
  ctx.globalAlpha = 1;
}

export function draw(ctx, world, input) {
  ctx.save();
  if (world.shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(ctx, world.time);
  for (const shard of world.shards) drawShard(ctx, shard, world.time);
  for (const bullet of world.enemyBullets) {
    ctx.fillStyle = bullet.color;
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const enemy of world.enemies) drawEnemyShape(ctx, enemy, world.time);
  for (const bullet of world.bullets) {
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world.screen !== SCREEN_TITLE) drawPlayer(ctx, world.player, world.time);
  world.particles.draw(ctx);
  ctx.restore();

  if (world.screen === SCREEN_TITLE) {
    drawTitle(ctx, world, world.time);
  } else if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE) {
    drawHud(ctx, world);
    if (world.screen === SCREEN_PAUSE) drawPause(ctx);
  } else if (world.screen === SCREEN_LEVELUP) {
    drawHud(ctx, world);
    drawLevelUp(ctx, world, input);
  } else if (world.screen === SCREEN_WIN) {
    drawHud(ctx, world);
    drawEndScreen(ctx, world, true);
  } else if (world.screen === SCREEN_LOSE) {
    drawHud(ctx, world);
    drawEndScreen(ctx, world, false);
  }

  if (world.hurtFlash > 0) {
    const vignette = ctx.createRadialGradient(
      ARENA.width / 2, ARENA.height / 2, ARENA.height * 0.35,
      ARENA.width / 2, ARENA.height / 2, ARENA.height * 0.75,
    );
    vignette.addColorStop(0, 'rgba(255, 40, 40, 0)');
    vignette.addColorStop(1, `rgba(255, 40, 40, ${Math.min(0.55, world.hurtFlash)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }
  const player = world.player;
  if (world.screen === SCREEN_PLAY && player.hp > 0 && player.hp < player.maxHp * 0.3) {
    const pulse = 0.1 + 0.08 * Math.sin(world.time * 5);
    const vignette = ctx.createRadialGradient(
      ARENA.width / 2, ARENA.height / 2, ARENA.height * 0.4,
      ARENA.width / 2, ARENA.height / 2, ARENA.height * 0.8,
    );
    vignette.addColorStop(0, 'rgba(255, 40, 40, 0)');
    vignette.addColorStop(1, `rgba(255, 40, 40, ${pulse})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }
}
