// Tiny sprite particle system: fire puff, smoke, coin burst, dust, sparkle, splash.
import * as THREE from 'three';

function softTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const KINDS = {
  firePuff: { colors: [0xff7a18, 0xffc13b, 0xff3d00], size: [0.8, 1.6], grow: 1.8, life: [0.5, 0.9], speed: [1, 3.5], up: 2.5, gravity: 0, additive: true },
  smoke:    { colors: [0x555555, 0x777777, 0x3a3a3a], size: [0.7, 1.3], grow: 2.4, life: [1.1, 1.9], speed: [0.2, 0.9], up: 1.4, gravity: 0, additive: false },
  coinBurst:{ colors: [0xffd54a, 0xffc107, 0xfff176], size: [0.22, 0.34], grow: 1, life: [0.9, 1.4], speed: [2, 5], up: 5, gravity: -11, additive: false },
  dust:     { colors: [0xc9b79c, 0xb8a58a], size: [0.5, 0.9], grow: 2.1, life: [0.6, 1.0], speed: [0.8, 2.4], up: 0.7, gravity: 0, additive: false },
  sparkle:  { colors: [0xffffff, 0xfff3b0, 0xffe066], size: [0.18, 0.34], grow: 0.4, life: [0.7, 1.3], speed: [0.5, 2.2], up: 2.2, gravity: -1.5, additive: true },
  splash:   { colors: [0xbfe6ff, 0x7cc4ff, 0xffffff], size: [0.25, 0.5], grow: 1.2, life: [0.6, 1.0], speed: [1.5, 4], up: 5, gravity: -12, additive: false },
  stars:    { colors: [0xffe066, 0xffffff, 0xffb300], size: [0.28, 0.5], grow: 0.5, life: [0.5, 0.9], speed: [2.5, 5], up: 2.5, gravity: -3, additive: true },
  leaves:   { colors: [0x4f9d3a, 0x6fbf4a, 0x2f6f2a], size: [0.18, 0.34], grow: 1, life: [1.0, 1.8], speed: [1, 3], up: 2.4, gravity: -4, additive: false },
  embers:   { colors: [0xff9a2a, 0xffd36a, 0xff5a1a], size: [0.1, 0.22], grow: 0.6, life: [0.9, 1.8], speed: [0.4, 1.6], up: 3.2, gravity: 0.6, additive: true },
  soot:     { colors: [0x1c1a1a, 0x2a2626, 0x111111], size: [0.6, 1.2], grow: 2.2, life: [0.9, 1.6], speed: [0.5, 2], up: 1.6, gravity: 0, additive: false },
  bones:    { colors: [0xf2ead8, 0xe0d6bf, 0xffffff], size: [0.2, 0.36], grow: 1, life: [0.8, 1.3], speed: [2, 5], up: 4.5, gravity: -12, additive: false },
  confetti: { colors: [0xff5a5a, 0x5ab0ff, 0xffe066, 0x7ae07a, 0xd58aff], size: [0.16, 0.28], grow: 1, life: [1.4, 2.4], speed: [1.5, 4.5], up: 6, gravity: -6, additive: false },
};
export const FX_NAMES = Object.keys(KINDS);

export class Fx {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'fx'; scene.add(this.group);
    this.tex = softTexture(); this.live = []; this.pool = []; this.max = 500;
    this.rand = Math.random;
  }
  _sprite(additive) {
    let s = this.pool.pop();
    if (!s) s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.group.add(s); return s;
  }
  burst(kind, pos, count = 16, scale = 1) {
    const k = KINDS[kind]; if (!k) throw new Error(`unknown fx ${kind}`);
    const R = this.rand;
    for (let i = 0; i < count && this.live.length < this.max; i++) {
      const s = this._sprite(k.additive);
      const size = (k.size[0] + R() * (k.size[1] - k.size[0])) * scale;
      const a = R() * Math.PI * 2; const sp = k.speed[0] + R() * (k.speed[1] - k.speed[0]);
      s.position.set(pos.x + (R() - 0.5) * 0.4 * scale, pos.y + 0.2 + R() * 0.6, pos.z + (R() - 0.5) * 0.4 * scale);
      s.scale.setScalar(size);
      s.material.color.setHex(k.colors[Math.floor(R() * k.colors.length)]); s.material.opacity = 1;
      this.live.push({ s, size, grow: k.grow, life: k.life[0] + R() * (k.life[1] - k.life[0]), age: 0, g: k.gravity,
        v: new THREE.Vector3(Math.cos(a) * sp * 0.6, k.up * (0.5 + R() * 0.8), Math.sin(a) * sp * 0.6) });
    }
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.age += dt;
      if (p.age >= p.life) { this.group.remove(p.s); this.pool.push(p.s); this.live.splice(i, 1); continue; }
      const k = p.age / p.life;
      p.v.y += p.g * dt; p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - 1.2 * dt);
      p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * k)); p.s.material.opacity = 1 - k * k;
    }
  }
  clear() { for (const p of this.live) { this.group.remove(p.s); this.pool.push(p.s); } this.live.length = 0; }
}
