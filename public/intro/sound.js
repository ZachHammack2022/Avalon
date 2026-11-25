// Code-made soundtrack: everything is synthesized (oscillators, filtered noise, a generated reverb).
// schedule(ctx, out) works on a live AudioContext (starts "now") or an OfflineAudioContext (starts at 0).
export const SOUND_DURATION = 62;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function schedule(ctx, out, t0 = 0) {
  const R = rng(42), sr = ctx.sampleRate;
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
  master.connect(comp); comp.connect(out);
  master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(0.9, t0 + 1.5); master.gain.setValueAtTime(0.9, t0 + SOUND_DURATION - 2.5); master.gain.linearRampToValueAtTime(0, t0 + SOUND_DURATION - 0.1);
  // generated reverb tail (cave-like)
  const irLen = Math.floor(sr * 3.2), ir = ctx.createBuffer(2, irLen, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / irLen, 2.6); }
  const verb = ctx.createConvolver(); verb.buffer = ir; const verbIn = ctx.createGain(); verbIn.gain.value = 0.32; verbIn.connect(verb); verb.connect(master);
  const bus = (wet) => { const g = ctx.createGain(); g.connect(master); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); } return g; };
  const dry = bus(0.0), wet = bus(0.7);
  // noise source
  const nbuf = ctx.createBuffer(1, sr * 4, sr); { const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
  const noise = (st, dur, o) => {
    const src = ctx.createBufferSource(); src.buffer = nbuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.7; f.frequency.setValueAtTime(o.f0, t0 + st); f.frequency.exponentialRampToValueAtTime(o.f1 || o.f0, t0 + st + dur);
    const g = ctx.createGain(); const a = o.attack ?? 0.05, rel = o.release ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0 + st); g.gain.linearRampToValueAtTime(o.gain, t0 + st + a); g.gain.setValueAtTime(o.gain, t0 + Math.max(st + a, st + dur - rel)); g.gain.linearRampToValueAtTime(0.0001, t0 + st + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || dry); src.start(t0 + st, R() * 3); src.stop(t0 + st + dur + 0.05);
  };
  const tone = (st, dur, o) => {
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f0, t0 + st); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + st + dur); if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain(); const a = o.attack ?? 0.02, rel = o.release ?? dur * 0.8;
    g.gain.setValueAtTime(0.0001, t0 + st); g.gain.linearRampToValueAtTime(o.gain, t0 + st + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + Math.max(a + 0.02, Math.min(dur, a + rel)));
    let last = osc; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); last = f; }
    last.connect(g); g.connect(o.dest || dry); osc.start(t0 + st); osc.stop(t0 + st + dur + 0.05);
  };
  const pad = (st, dur, freqs, gain, lp, dest) => freqs.forEach((fq, i) => { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = fq; osc.detune.value = (i % 2 ? 7 : -7);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0 + st); g.gain.linearRampToValueAtTime(gain, t0 + st + 4); g.gain.setValueAtTime(gain, t0 + st + dur - 4); g.gain.linearRampToValueAtTime(0.0001, t0 + st + dur);
    osc.connect(f); f.connect(g); g.connect(dest || wet); osc.start(t0 + st); osc.stop(t0 + st + dur + 0.1); });

  // 0-47: wind and a dark pad; the key drops when the village burns
  noise(0, 20, { type: 'bandpass', f0: 380, f1: 520, q: 0.6, gain: 0.05, attack: 3, release: 3, dest: wet });
  noise(18, 30, { type: 'bandpass', f0: 500, f1: 260, q: 0.5, gain: 0.07, attack: 3, release: 4, dest: wet });
  pad(0, 30, [55, 82.4, 110], 0.035, 260);
  pad(28, 22, [49, 73.4, 98], 0.04, 240);
  pad(46, 16, [55, 82.4, 110, 164.8], 0.04, 420);
  // wing beats: soft low thumps, louder while the dragon is over the village
  for (let t = 3; t < 56; t += 1.45) { const near = t > 9.5 && t < 31 ? 1 : 0.45; noise(t, 0.45, { type: 'lowpass', f0: 220, f1: 70, q: 1, gain: 0.16 * near, attack: 0.04, release: 0.35, dest: wet }); }
  // church bell, alarmed and uneven, 14.5 to 30
  for (let t = 14.5; t < 30; t += 0.9 + R() * 0.5) { const f = R() < 0.5 ? 392 : 466; tone(t, 2.6, { f0: f, gain: 0.05, attack: 0.005, release: 2.4, dest: wet }); tone(t, 1.8, { f0: f * 2.76, gain: 0.02, attack: 0.005, release: 1.6, dest: wet }); }
  // war drums while the dragon attacks
  for (let t = 18; t < 31; t += 1) { tone(t, 0.7, { f0: 95, f1: 42, gain: 0.34, attack: 0.004, release: 0.6, dest: wet }); if (t > 21) tone(t + 0.5, 0.5, { f0: 120, f1: 55, gain: 0.2, attack: 0.004, release: 0.4, dest: wet }); }
  // roar as the dragon turns onto the street
  const roar = (st, dur, g) => { tone(st, dur, { type: 'sawtooth', f0: 120, f1: 55, gain: g, attack: 0.25, release: dur * 0.8, lp: 700, dest: wet }); tone(st, dur, { type: 'sawtooth', f0: 83, f1: 41, gain: g * 0.8, attack: 0.3, release: dur * 0.8, lp: 420, dest: wet, detune: 12 }); noise(st, dur, { type: 'bandpass', f0: 500, f1: 1400, q: 1.6, gain: g * 0.6, attack: 0.3, release: dur * 0.7, dest: wet }); };
  roar(19.4, 2.8, 0.18); roar(21.4, 1.8, 0.14);
  // fire breath and the burning village
  noise(21.6, 7.4, { type: 'lowpass', f0: 900, f1: 3200, q: 0.8, gain: 0.34, attack: 0.5, release: 1.2, dest: wet });
  noise(21.6, 20, { type: 'bandpass', f0: 1400, f1: 700, q: 0.4, gain: 0.1, attack: 2, release: 6, dest: dry });
  for (let t = 22; t < 40; t += 0.04 + R() * 0.18) { const loud = Math.max(0.15, 1 - (t - 22) / 18); noise(t, 0.05 + R() * 0.05, { type: 'highpass', f0: 1500 + R() * 2500, f1: 1500 + R() * 2500, q: 0.7, gain: 0.05 * loud, attack: 0.002, release: 0.04, dest: dry }); }
  // building collapses
  [26, 28.4, 31.5, 34.5].forEach((t) => noise(t, 1.6, { type: 'lowpass', f0: 380, f1: 60, q: 1, gain: 0.3, attack: 0.02, release: 1.4, dest: wet }));
  // the dragon flies off: a long whoosh then the distant roar into the cave
  noise(37, 6, { type: 'bandpass', f0: 300, f1: 1100, q: 0.8, gain: 0.08, attack: 2, release: 3, dest: wet }); roar(44.5, 3.0, 0.15);
  // 47+: the cave. Dripping, coin chimes, a settling sigh and a low resolved chord
  for (let t = 47; t < 61; t += 0.8 + R() * 2.2) tone(t, 0.9, { f0: 1700 + R() * 700, gain: 0.025, attack: 0.002, release: 0.8, dest: wet });
  for (let t = 49; t < 61; t += 0.15 + R() * 0.55) tone(t, 0.35, { f0: 2800 + R() * 2400, gain: 0.011 + R() * 0.012, attack: 0.001, release: 0.3, dest: wet });
  noise(55.5, 5.5, { type: 'lowpass', f0: 500, f1: 150, q: 0.8, gain: 0.12, attack: 2, release: 3, dest: wet });
  [[55, 164.8], [55, 220], [55, 261.6]].forEach(([t, f]) => tone(t, 7, { type: 'sine', f0: f, gain: 0.05, attack: 3, release: 4, dest: wet }));
  tone(59.5, 2.5, { type: 'sine', f0: 110, f1: 82.4, gain: 0.1, attack: 0.6, release: 2.2, dest: wet });
}

export function floatTo16(buf) {
  const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  let o = 44; const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return out.buffer;
}

export async function renderWavBase64(rate = 44100) {
  const ctx = new OfflineAudioContext(2, rate * SOUND_DURATION, rate); schedule(ctx, ctx.destination, 0);
  const buf = await ctx.startRendering(); const bytes = new Uint8Array(floatTo16(buf)); let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
