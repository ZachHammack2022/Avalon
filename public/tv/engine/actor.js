// An animated character: KayKit rig + AnimationMixer, tinted by player color, with a name banner.
import * as THREE from 'three';

const CLASS_HEIGHT = 2.0;

function textColorFor(hex) {
  const c = new THREE.Color(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.55 ? '#111' : '#fff';
}

export function makeBanner(text, color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 8;
  g.beginPath(); g.roundRect(8, 8, 496, 112, 56); g.fill(); g.stroke();
  g.fillStyle = textColorFor(color); g.font = '800 68px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 68; while (g.measureText(text).width > 440 && size > 28) { size -= 4; g.font = `800 ${size}px system-ui, sans-serif`; }
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  spr.scale.set(3.4, 0.85, 1); spr.renderOrder = 999;
  return spr;
}

export class Actor {
  constructor({ id, kind, model, name, color }) {
    this.id = id; this.kind = kind; this.name = name || id; this.color = color;
    this.root = new THREE.Group(); this.root.name = `actor:${id}`;
    this.model = model; this.root.add(model);
    this.height = CLASS_HEIGHT;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = new Map((model.userData.clips || []).map((c) => [c.name, c]));
    this.current = null; this.currentName = '';
    this.yaw = 0; this.hidden = false;
    this.banner = null; this.bannerUntil = 0;
    this.ring = null;
    this.warned = new Set();
    this.mixer.addEventListener('finished', (e) => { if (e.action === this.current && this.thenAnim) this.play(this.thenAnim, { loop: true }); });
  }

  tint(color, amount = 0.32) {
    const target = new THREE.Color(color);
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      for (const m of [].concat(o.material)) if (m.color) m.color.lerp(target, amount);
    });
  }

  addRing(color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.renderOrder = 2;
    this.root.add(ring); this.ring = ring;
  }

  addBanner(text = this.name, color = this.color) {
    this.banner = makeBanner(text, color);
    this.banner.position.y = this.height + 0.75;
    this.root.add(this.banner);
    this.banner.visible = false;
  }

  /** Show the banner for `seconds` (<=0 hides; Infinity keeps it). */
  showBanner(seconds = Infinity, text) {
    if (!this.banner) return;
    if (text) { this.root.remove(this.banner); this.addBanner(text); }
    this.banner.visible = seconds > 0; this.bannerUntil = seconds;
  }

  play(name, { loop = true, fade = 0.2, speed = 1, then = 'Idle' } = {}) {
    let clip = this.clips.get(name);
    if (!clip) {
      if (!this.warned.has(name)) { this.warned.add(name); console.warn(`[actor ${this.id}] no clip "${name}", using Idle`); }
      clip = this.clips.get('Idle'); if (!clip) return null;
    }
    const next = this.mixer.clipAction(clip);
    next.reset(); next.enabled = true; next.timeScale = speed;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next; this.currentName = name; this.thenAnim = loop ? null : then;
    return next;
  }

  setYaw(deg) { this.yaw = deg; this.root.rotation.y = (deg * Math.PI) / 180; }
  setHidden(h) { this.hidden = h; this.root.visible = !h; }

  update(dt) {
    this.mixer.update(dt);
    if (this.banner && this.banner.visible && Number.isFinite(this.bannerUntil)) {
      this.bannerUntil -= dt; if (this.bannerUntil <= 0) this.banner.visible = false;
    }
  }
}

/** Build an actor from a loaded asset kind ('knight', 'skeleton_warrior', ...). */
export function createActor(assets, { id, kind, name, color, withBanner = true, withRing = true }) {
  let model = assets.instance(kind);
  if (!model) { model = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff00ff })); b.position.y = 1; model.add(b); }
  const a = new Actor({ id, kind, model, name, color });
  if (color && !kind.startsWith('skeleton')) a.tint(color);
  if (color && withRing) a.addRing(color);
  if (withBanner) a.addBanner(name, color || '#ffffff');
  a.play('Idle');
  return a;
}
