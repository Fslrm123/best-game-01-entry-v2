// Boot and game loop for Emberfall Arena. Live play runs a fixed-step loop;
// ?shot=start|play|boss|win stages one deterministic scene, draws it once
// and stops, so a screenshot is a real frame of the game.

import { ARENA, STEP } from './config.js';
import { makeWorld, stepWorld, SCREEN_TITLE, SCREEN_PLAY } from './world.js';
import { draw } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
canvas.width = ARENA.width;
canvas.height = ARENA.height;

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '7', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 7;
const shotName = params.get('shot');

const sound = new SoundBank();
const input = new Input(canvas, ARENA.width, ARENA.height);
const world = makeWorld(seed);

function fitCanvas() {
  const scale = Math.min(window.innerWidth / ARENA.width, window.innerHeight / ARENA.height);
  canvas.style.width = `${Math.floor(ARENA.width * scale)}px`;
  canvas.style.height = `${Math.floor(ARENA.height * scale)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - ARENA.width * scale) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - ARENA.height) / 2)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function armSound() {
  sound.ensure();
}
window.addEventListener('keydown', armSound);
canvas.addEventListener('mousedown', armSound);

function describeWorld() {
  return `Emberfall Arena — ${world.screen}, wave ${world.wave} of 10, score ${world.score}, best ${world.best.score}`;
}

if (shotName) {
  const staged = stageShot(shotName, world, sound);
  draw(ctx, world, { aimX: input.mouseX, aimY: input.mouseY, clicked: null, pressed: new Set() });
  statusEl.textContent = describeWorld();
  document.documentElement.setAttribute('data-shot-ready', '1');
  document.title = `Emberfall Arena — ${shotName}`;
  window.__emberfall = { world, staged };
} else {
  let last = performance.now();
  let accumulator = 0;
  let lastScreen = world.screen;
  window.addEventListener('blur', () => {
    if (world.screen === SCREEN_PLAY) world.screen = 'pause';
  });
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    accumulator += dt;
    const stepInput = input.read();
    if (stepInput.pressed.has('KeyM')) {
      world.muted = !world.muted;
      sound.setMuted(world.muted);
    }
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepWorld(world, stepInput, STEP, sound);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
    draw(ctx, world, stepInput);
    input.endFrame();
    if (world.screen !== lastScreen) {
      lastScreen = world.screen;
      statusEl.textContent = describeWorld();
    }
  }
  statusEl.textContent = describeWorld();
  requestAnimationFrame(frame);
}
