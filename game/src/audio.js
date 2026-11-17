// All sound is synthesized with WebAudio: no audio files, no network.
// The context is created lazily on the first user gesture, so a page that is
// only being screenshotted never throws; every call is guarded.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.ctx.destination);
    } catch (error) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (error) {
      /* sound is decoration; a failure never breaks the game */
    }
  }

  noise(duration, volume, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
    } catch (error) {
      /* sound is decoration */
    }
  }

  shoot() { this.tone(740, 0.07, 'square', 0.12, 320); }
  enemyHit() { this.tone(220, 0.05, 'triangle', 0.14, 140); }
  explode(big) {
    this.noise(big ? 0.45 : 0.22, big ? 0.5 : 0.28, big ? 900 : 1400);
    this.tone(big ? 90 : 140, big ? 0.4 : 0.2, 'sine', 0.4, 40);
  }
  pickup() { this.tone(880, 0.09, 'sine', 0.16, 1320); }
  levelUp() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.16, 'sine', 0.2), i * 70);
    });
  }
  hurt() { this.tone(160, 0.18, 'sawtooth', 0.25, 60); this.noise(0.12, 0.2, 700); }
  bossRoar() { this.tone(70, 0.7, 'sawtooth', 0.4, 180); this.noise(0.6, 0.3, 500); }
  waveClear() { this.tone(660, 0.12, 'sine', 0.18, 990); }
  win() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.3, 'triangle', 0.22), i * 110);
    });
  }
  lose() { this.tone(220, 0.9, 'sawtooth', 0.3, 55); }
  click() { this.tone(980, 0.05, 'sine', 0.14); }
}
