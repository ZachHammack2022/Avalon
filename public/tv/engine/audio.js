// WebAudio synthesis: music loops per scene + one-shots (stinger, fanfare, wah-wah, record scratch...).
// No audio files needed. Browsers require a user gesture, so call unlock() from a click/keypress.
const SEMI = (root, n) => root * 2 ** (n / 12);

const TRACKS = {
  camp:    { bpm: 84,  root: 196, wave: 'triangle', vol: 0.05, steps: [0, 4, 7, 4, 9, 7, 4, 2], len: 0.5 },
  bridge:  { bpm: 92,  root: 175, wave: 'triangle', vol: 0.05, steps: [0, 3, 7, 3, 10, 7, 3, 0], len: 0.5 },
  woods:   { bpm: 76,  root: 147, wave: 'sine',     vol: 0.06, steps: [0, 3, 5, 3, 0, -2, 0, 3], len: 0.7 },
  vault:   { bpm: 100, root: 165, wave: 'square',   vol: 0.03, steps: [0, 0, 7, 0, 5, 0, 3, 0], len: 0.25 },
  dragon:  { bpm: 60,  root: 98,  wave: 'sawtooth', vol: 0.03, steps: [0, 0, 1, 0, 0, -2, 0, 0], len: 1.2 },
  throne:  { bpm: 88,  root: 220, wave: 'triangle', vol: 0.05, steps: [0, 4, 7, 12, 7, 4, 7, 4], len: 0.6 },
  night:   { bpm: 60,  root: 130, wave: 'sine',     vol: 0.05, steps: [0, 3, 7, 3, 0, 3, -2, 3], len: 1.0 },
  victory: { bpm: 112, root: 262, wave: 'triangle', vol: 0.06, steps: [0, 4, 7, 12, 7, 12, 16, 12], len: 0.4 },
};
export const TRACK_NAMES = Object.keys(TRACKS);

export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.master = null; this.timer = null; this.track = null; this.step = 0; this.nextTime = 0; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  get unlocked() { return !!this.ctx && this.ctx.state === 'running'; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9; }

  _env(g, t, a, d, vol) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone({ f, f2, type = 'sine', t = 0, a = 0.01, d = 0.3, vol = 0.2, filter }) {
    const c = this.ctx; const now = c.currentTime + t;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now); if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + a + d);
    this._env(g, now, a, d, vol);
    let out = o; if (filter) { const bf = c.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = filter; o.connect(bf); out = bf; }
    out.connect(g); g.connect(this.master); o.start(now); o.stop(now + a + d + 0.05);
  }
  noise({ t = 0, d = 0.3, vol = 0.2, type = 'bandpass', f = 1000, f2, q = 1 }) {
    const c = this.ctx; const now = c.currentTime + t;
    const n = Math.max(1, Math.floor(c.sampleRate * (d + 0.05)));
    const buf = c.createBuffer(1, n, c.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bf = c.createBiquadFilter(); bf.type = type; bf.Q.value = q; bf.frequency.setValueAtTime(f, now); if (f2) bf.frequency.exponentialRampToValueAtTime(f2, now + d);
    const g = c.createGain(); this._env(g, now, 0.01, d, vol);
    src.connect(bf); bf.connect(g); g.connect(this.master); src.start(now); src.stop(now + d + 0.05);
  }

  sfx(name, volume = 1) {
    if (!this.ctx || this.muted) return;
    const v = volume;
    switch (name) {
      case 'stinger': this.tone({ f: 110, type: 'sawtooth', d: 1.4, vol: 0.12 * v, filter: 700 }); this.tone({ f: 116.5, type: 'sawtooth', d: 1.4, vol: 0.1 * v, filter: 700 }); this.noise({ d: 0.5, vol: 0.12 * v, type: 'lowpass', f: 500 }); break;
      case 'fanfare': [262, 330, 392, 523, 392, 523].forEach((f, i) => this.tone({ f, type: 'square', t: i * 0.13, d: i === 5 ? 0.9 : 0.2, vol: 0.09 * v, filter: 2400 })); break;
      case 'wahwah': [[349, 0], [330, 0.4], [311, 0.8], [277, 1.2]].forEach(([f, t], i) => this.tone({ f, f2: i === 3 ? f * 0.82 : f * 0.97, type: 'sawtooth', t, d: i === 3 ? 1.0 : 0.38, vol: 0.1 * v, filter: 900 })); break;
      case 'scratch': this.noise({ d: 0.3, vol: 0.25 * v, f: 900, f2: 3500, q: 4 }); this.tone({ f: 300, f2: 1400, type: 'sawtooth', d: 0.16, vol: 0.12 * v, filter: 3000 }); this.tone({ f: 1400, f2: 250, type: 'sawtooth', t: 0.16, d: 0.16, vol: 0.12 * v, filter: 3000 }); break;
      case 'bonk': this.tone({ f: 320, f2: 90, d: 0.18, vol: 0.3 * v }); this.noise({ d: 0.05, vol: 0.2 * v, f: 2500 }); break;
      case 'creak': this.tone({ f: 85, f2: 130, type: 'sawtooth', a: 0.15, d: 0.7, vol: 0.12 * v, filter: 400 }); break;
      case 'clink': this.tone({ f: 2200, d: 0.5, vol: 0.12 * v }); this.tone({ f: 3300, d: 0.35, vol: 0.06 * v, t: 0.02 }); break;
      case 'alarm': for (let i = 0; i < 6; i++) this.tone({ f: i % 2 ? 880 : 660, type: 'square', t: i * 0.18, d: 0.15, vol: 0.07 * v, filter: 2500 }); break;
      case 'gasp': this.noise({ d: 0.35, vol: 0.18 * v, f: 700, f2: 2400, q: 2 }); break;
      case 'whoosh': this.noise({ d: 0.5, vol: 0.2 * v, f: 300, f2: 2500, q: 0.8 }); break;
      case 'thud': this.tone({ f: 100, f2: 40, d: 0.3, vol: 0.4 * v }); this.noise({ d: 0.12, vol: 0.15 * v, type: 'lowpass', f: 400 }); break;
      case 'poof': this.noise({ d: 0.35, vol: 0.2 * v, type: 'lowpass', f: 1200, f2: 300 }); break;
      case 'splash': this.noise({ d: 0.6, vol: 0.25 * v, f: 1200, f2: 3000, q: 0.7 }); break;
      case 'roar': this.tone({ f: 80, f2: 50, type: 'sawtooth', a: 0.1, d: 1.1, vol: 0.2 * v, filter: 500 }); this.noise({ d: 1.0, vol: 0.15 * v, type: 'lowpass', f: 600 }); break;
      case 'rumble': this.noise({ d: 1.4, vol: 0.25 * v, type: 'lowpass', f: 140, q: 0.5 }); break;
      case 'ding': this.tone({ f: 1320, d: 1.0, vol: 0.14 * v }); this.tone({ f: 1980, d: 0.7, vol: 0.05 * v }); break;
      case 'sneeze': this.noise({ d: 0.45, vol: 0.12 * v, f: 500, f2: 2200, q: 3 }); this.noise({ t: 0.45, d: 0.25, vol: 0.3 * v, f: 1800, q: 0.7 }); break;
      case 'snap': this.noise({ d: 0.06, vol: 0.35 * v, f: 3000, q: 0.6 }); this.tone({ f: 500, f2: 120, type: 'triangle', d: 0.12, vol: 0.25 * v }); break;
      case 'boing': this.tone({ f: 160, f2: 420, type: 'triangle', d: 0.32, vol: 0.25 * v }); this.tone({ f: 320, f2: 840, type: 'sine', d: 0.3, vol: 0.08 * v }); break;
      case 'pop': this.tone({ f: 500, f2: 1400, d: 0.07, vol: 0.3 * v }); break;
      case 'slide': this.tone({ f: 1500, f2: 180, type: 'sine', a: 0.02, d: 1.1, vol: 0.16 * v }); break; // falling slide-whistle
      case 'purr': for (let i = 0; i < 14; i++) this.tone({ f: 55 + (i % 2) * 6, type: 'sawtooth', t: i * 0.085, d: 0.07, vol: 0.14 * v, filter: 300 }); break;
      case 'snore': this.noise({ d: 0.9, vol: 0.14 * v, type: 'lowpass', f: 260, f2: 120, q: 3 }); this.tone({ f: 620, f2: 880, t: 1.0, a: 0.2, d: 0.5, vol: 0.03 * v }); break;
      case 'crowd': for (let i = 0; i < 5; i++) this.noise({ t: i * 0.05, d: 0.5, vol: 0.07 * v, f: 500 + i * 260, f2: 1600 + i * 300, q: 2.5 }); break;
      case 'tick': this.tone({ f: 1800, d: 0.04, vol: 0.14 * v }); this.tone({ f: 1200, t: 0.25, d: 0.04, vol: 0.12 * v }); break;
      case 'fwoosh': this.noise({ d: 0.9, vol: 0.3 * v, type: 'lowpass', f: 200, f2: 2400, q: 0.7 }); this.tone({ f: 70, f2: 140, type: 'sawtooth', d: 0.8, vol: 0.12 * v, filter: 400 }); break;
      case 'rattle': for (let i = 0; i < 9; i++) this.tone({ f: 700 + ((i * 371) % 900), type: 'square', t: i * 0.05, d: 0.035, vol: 0.09 * v, filter: 3000 }); break;
      case 'knock': [0, 0.16, 0.32].forEach((t) => { this.tone({ f: 190, f2: 120, t, d: 0.07, vol: 0.4 * v }); this.noise({ t, d: 0.03, vol: 0.12 * v, f: 1500 }); }); break;
      case 'tiptoe': [0, 0.14, 0.28, 0.42].forEach((t, i) => this.tone({ f: 660 + i * 110, type: 'triangle', t, d: 0.07, vol: 0.1 * v })); break; // pizzicato
      case 'cheer': for (let i = 0; i < 6; i++) this.noise({ t: i * 0.07, d: 1.0, vol: 0.06 * v, f: 900 + i * 320, q: 1.2 }); [523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.08, d: 0.5, vol: 0.05 * v })); break;
      case 'bell': [0, 0.5].forEach((t) => { this.tone({ f: 440, t, d: 1.2, vol: 0.14 * v }); this.tone({ f: 1108, t, d: 0.8, vol: 0.06 * v }); this.tone({ f: 1760, t, d: 0.5, vol: 0.03 * v }); }); break;
      default: console.warn(`[audio] unknown sfx ${name}`);
    }
  }

  music(name) {
    if (name === 'stop' || !name) { this.stopMusic(); return; }
    const tr = TRACKS[name]; if (!tr) { console.warn(`[audio] unknown track ${name}`); return; }
    if (this.track === tr && this.timer) return;
    this.stopMusic(); this.track = tr; this.step = 0;
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 120);
    this._schedule();
  }
  stopMusic() { clearInterval(this.timer); this.timer = null; this.track = null; }
  _schedule() {
    if (!this.ctx || !this.track || this.muted) { if (this.ctx && this.track) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime); return; }
    const tr = this.track; const beat = 60 / tr.bpm;
    while (this.nextTime < this.ctx.currentTime + 0.5) {
      const n = tr.steps[this.step % tr.steps.length];
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.type = tr.wave; o.frequency.value = SEMI(tr.root, n);
      const t = this.nextTime; const d = beat * tr.len * 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(tr.vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
      // a simple bed under the melody: root/fifth bass every half bar, and a soft tick on the quicker tracks
      const k = this.step % 8;
      if (k === 0 || k === 4) {
        const bo = this.ctx.createOscillator(); const bg = this.ctx.createGain(); const bd = beat * tr.len * 3.6;
        bo.type = 'triangle'; bo.frequency.value = SEMI(tr.root / 2, k === 0 ? 0 : 7);
        bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(tr.vol * 1.5, t + 0.03); bg.gain.exponentialRampToValueAtTime(0.0001, t + bd);
        bo.connect(bg); bg.connect(this.master); bo.start(t); bo.stop(t + bd + 0.05);
      }
      if (tr.bpm >= 88 && k % 2 === 1) this.noise({ t: Math.max(0, t - this.ctx.currentTime), d: 0.03, vol: tr.vol * 0.5, type: 'highpass', f: 6000 });
      this.nextTime += beat * tr.len; this.step++;
    }
  }
}
