// Canvas-textured sprites that make gags readable with the sound off: speech bubbles, emotes (! ? …) and signs.
import * as THREE from 'three';

const FONT = '"Trebuchet MS", system-ui, sans-serif';
function sprite(cv, w, h) {
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  spr.scale.set(w, h, 1); spr.center.set(0.5, 0); spr.renderOrder = 1000;
  return spr;
}
function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (g.measureText(tryLine).width > maxW && line) { lines.push(line); line = word; } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

/** Speech bubble. style: 'shout' (spiky yellow), 'whisper' (grey, small), 'think' , default white. */
export function makeBubble(text, style = '') {
  const size = style === 'whisper' ? 46 : style === 'shout' ? 72 : 58;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `800 ${size}px ${FONT}`;
  const lines = wrap(probe, text, 560);
  const tw = Math.max(...lines.map((l) => probe.measureText(l).width));
  const pad = 34; const lh = size * 1.15; const tail = 34;
  const W = Math.ceil(tw + pad * 2 + 12); const H = Math.ceil(lines.length * lh + pad * 1.5 + tail + 12);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bw = W - 12; const bh = H - tail - 12;
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#1b1410';
  g.fillStyle = style === 'shout' ? '#ffe066' : style === 'whisper' ? '#d8d8e0' : '#ffffff';
  g.beginPath(); g.roundRect(6, 6, bw, bh, style === 'shout' ? 14 : 38);
  g.moveTo(W / 2 - 22, bh + 4); g.lineTo(W / 2 - 4, bh + tail + 4); g.lineTo(W / 2 + 26, bh + 4);
  g.stroke(); g.fill();
  g.fillStyle = '#1b1410'; g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, W / 2, 6 + pad * 0.75 + lh * (i + 0.5)));
  const k = 0.0052; // world units per pixel at the reference distance
  return sprite(cv, W * k, H * k);
}

/** Big punchy glyph over a head: ! ? … ♥ ★ Zzz ♪ */
export function makeEmote(text, color = '#ffdd33') {
  const cv = document.createElement('canvas'); const g0 = cv.getContext('2d');
  g0.font = `900 150px ${FONT}`; const W = Math.ceil(g0.measureText(text).width + 60); cv.width = W; cv.height = 190;
  const g = cv.getContext('2d'); g.font = `900 150px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 26; g.strokeStyle = '#1b1410'; g.strokeText(text, W / 2, 100);
  g.fillStyle = color; g.fillText(text, W / 2, 100);
  const k = 0.0046;
  return sprite(cv, W * k, 190 * k);
}

/** Flat text plane for signs and notes (parented to a prop). */
export function makeSign(text, { w = 1.4, h = 0.7, paper = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round((512 * h) / w);
  const g = cv.getContext('2d');
  g.fillStyle = paper ? '#f7efd6' : '#e2c48a'; g.fillRect(0, 0, cv.width, cv.height);
  let size = paper ? 54 : 92; g.fillStyle = paper ? '#3a2a1a' : '#5a1a10'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (s) => `${paper ? 'italic 700' : '900'} ${s}px ${paper ? 'Georgia, serif' : FONT}`;
  let lines;
  for (;;) { g.font = font(size); lines = text.split('\n').flatMap((t) => wrap(g, t, cv.width - 50)); if (lines.length * size * 1.15 < cv.height - 30 || size < 22) break; size -= 6; }
  lines.forEach((l, i) => g.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
