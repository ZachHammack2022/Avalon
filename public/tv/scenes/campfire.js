// Campfire: lobby / propose / vote backdrop, plus the night variant for the assassination.
// Everyone sits on an arc that opens toward the camera (+Z), so nobody has their back to the TV.
import * as THREE from 'three';
import { box, cyl, disc, flame, flicker, glowDisc, ground, mat, mesh, put, scatter, sky } from './kit.js';
import { seeded } from '/shared/rng.js';

export const SEAT_RADIUS = 4.7;
const ARC = 2.2; // radians either side of "directly behind the fire"

/** Seats around the fire for n players, facing the fire (yaw in degrees). Seat order runs left to right. */
export function seatSlots(n, radius = SEAT_RADIUS) {
  const step = n > 1 ? Math.min(0.8, (2 * ARC) / (n - 1)) : 0;
  const r = radius + Math.max(0, n - 7) * 0.25;
  return Array.from({ length: n }, (_, i) => {
    const a = (i - (n - 1) / 2) * step;
    const x = Math.sin(a) * r; const z = -Math.cos(a) * r;
    return { x, z, yaw: (Math.atan2(-x, -z) * 180) / Math.PI };
  });
}

export function campfireScene({ night = false } = {}) {
  let fire; let emberT = 0; const flies = []; let fireScale = 1;

  function tent(x, z, rot, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = (rot * Math.PI) / 180;
    const sh = new THREE.Shape(); sh.moveTo(-2.2, 0); sh.lineTo(0, 2.9); sh.lineTo(2.2, 0); sh.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 4.4, bevelEnabled: false }), mat(color)); body.position.z = -2.2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const door = new THREE.Shape(); door.moveTo(-0.7, 0); door.lineTo(0, 1.9); door.lineTo(0.7, 0); door.closePath();
    const dm = new THREE.Mesh(new THREE.ShapeGeometry(door), mat(0x2a1d14)); dm.position.z = 2.21; g.add(dm);
    g.add(cyl(0.05, 0.05, 1.5, 0x5a3b22, { pos: [0, 3.5, 2.2] }, 6)); g.add(box(0.8, 0.45, 0.03, 0xd8262c, { pos: [0.42, 3.95, 2.2] }));
    return g;
  }

  return {
    name: night ? 'night' : 'campfire', music: night ? 'night' : 'camp', center: [0, 0, 0.6], forward: 90,
    bg: night ? 0x070a18 : 0x1a2148, fog: { color: night ? 0x0a0e20 : 0x232a55, near: 30, far: 90 },
    hemi: night ? { sky: 0x5a6fae, ground: 0x1c1410, i: 1.25 } : { sky: 0x93a6e6, ground: 0x4a3626, i: 1.7 },
    sun: night ? { color: 0x8fa4ff, i: 1.0, pos: [-10, 18, 8] } : { color: 0xcdd6ff, i: 1.5, pos: [-10, 18, 10] },
    marks: { start: [-4, 0], mid: [0, 0], goal: [4, 0], spot: [0, 0], fire: [0, 0.8, 0], log: [6.4, 0.5, -3.2] },
    wideDist: 15.5, wideHeight: 7.2, wideAngle: 0,
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_B_medium', 'hex:trees_A_large', 'hex:rock_single_A', 'hex:rock_single_B', 'hex:mountain_A', 'hex:barrel', 'hex:crate_A_big', 'prop:arrow'],
    seats: seatSlots,
    build(stage) {
      const g = new THREE.Group(); const r = seeded(night ? 9 : 4);
      g.add(sky(night ? [[0, '#1b2a5c'], [0.3, '#0c1436'], [1, '#03050f']] : [[0, '#f0a36a'], [0.12, '#a05f8f'], [0.4, '#3a3f8a'], [1, '#141a44']]));
      g.add(disc(6, 0xf6f2d4, [30, 44, -120]));
      const sp = new Float32Array(260 * 3);
      for (let i = 0; i < 260; i++) { const a = r.next() * Math.PI * 2; const e = 0.2 + r.next() * 1.2; sp.set([Math.cos(a) * Math.cos(e) * 170, Math.sin(e) * 170, Math.sin(a) * Math.cos(e) * 170], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, fog: false, transparent: true, opacity: night ? 0.95 : 0.6 })); stars.userData.dim = true; g.add(stars);
      g.add(ground(night ? 0x1f3f29 : 0x356b3d, 100));
      const dirt = new THREE.Mesh(new THREE.CircleGeometry(8.6, 40), mat(night ? 0x4a3a2a : 0x6b543a)); dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.02; dirt.receiveShadow = true; g.add(dirt);
      const pool = glowDisc(9, 0xff9a3a, night ? 0.3 : 0.42); pool.position.y = 0.05; g.add(pool);
      // fire pit: stones, crossed logs, flame
      for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; g.add(mesh(new THREE.DodecahedronGeometry(0.36 + (i % 3) * 0.05, 0), 0x8a8a84, { pos: [Math.cos(a) * 1.45, 0.2, Math.sin(a) * 1.45], rot: [i * 40, i * 70, 0] })); }
      for (let i = 0; i < 4; i++) g.add(cyl(0.14, 0.16, 1.9, 0x5a3b22, { pos: [0, 0.35, 0], rot: [62, i * 90 + 20, 0] }, 7));
      fire = flame(); fire.scale.setScalar(1.25); fire.userData.light.distance = 34; g.add(fire);
      // log benches behind the seats, camp clutter, tents
      for (const a of [-1.75, -0.6, 0.6, 1.75]) { const l = cyl(0.42, 0.42, 3.6, 0x6a4628, { pos: [Math.sin(a) * 6.5, 0.42, -Math.cos(a) * 6.5], rot: [0, 0, 90] }, 9); l.rotation.y = -a; g.add(l); }
      g.add(tent(-10.5, -8.5, 40, 0xc9b28a)); g.add(tent(11, -8, -35, 0xb7a078)); g.add(tent(0.5, -13, 0, 0xd4bd94));
      for (const [n, x, z, rot, s] of [['hex:barrel', -7.8, -4.6, 0, 5], ['hex:crate_A_big', 8.2, -5.0, 25, 5], ['hex:barrel', 9.4, -3.6, 0, 4.4], ['hex:crate_A_big', -9.2, -3.2, -15, 4.4]]) { const m = put(stage, n, { pos: [x, 0, z], rot, scale: s }); if (m) g.add(m); }
      scatter(stage, g, ['hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_B_medium', 'hex:trees_A_large'], 120, { inner: 17, outer: 52, scale: [3.2, 5.4], seed: night ? 3 : 11, avoid: (x, z) => z > -4 });
      scatter(stage, g, ['hex:rock_single_A', 'hex:rock_single_B'], 16, { inner: 11, outer: 26, scale: [2, 4], seed: 5, avoid: (x, z) => z > 1 });
      for (const [x, z, s] of [[-40, -70, 22], [34, -80, 28], [0, -95, 30]]) { const m = put(stage, 'hex:mountain_A', { pos: [x, -2, z], scale: s }); if (m) g.add(m); }
      for (let i = 0; i < 22; i++) {
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.fx.tex, color: 0xd8ff8a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        f.scale.setScalar(0.2 + r.next() * 0.12); f.userData = { x: -18 + r.next() * 36, y: 0.6 + r.next() * 3, z: -14 + r.next() * 14, p: r.next() * 6 }; flies.push(f); g.add(f);
      }
      return g;
    },
    update(dt, stage) {
      const t = stage.time;
      if (fire) { flicker(fire, t, (night ? 46 : 60) * fireScale); emberT += dt; if (emberT > 0.22) { emberT = 0; stage.fx.burst('embers', new THREE.Vector3(0, 0.9, 0), 1, 1); } }
      for (const f of flies) { const u = f.userData; f.position.set(u.x + Math.sin(t * 0.5 + u.p) * 1.4, u.y + Math.sin(t * 0.9 + u.p * 2) * 0.5, u.z + Math.cos(t * 0.4 + u.p) * 1.2); f.material.opacity = 0.4 + 0.6 * Math.sin(t * 2.2 + u.p * 3) ** 2; }
    },
    rigs: {
      fire: {
        low(stage, { dur = 0.8 } = {}) { const a = fire.scale.x; stage.tween({ dur, owner: fire, key: 'fire', update: (k) => { fire.scale.setScalar(a + (0.55 - a) * k); fireScale = 1 - 0.55 * k; } }); },
        high(stage, { dur = 0.4 } = {}) { const a = fire.scale.x; stage.tween({ dur, ease: 'back', owner: fire, key: 'fire', update: (k) => { fire.scale.setScalar(a + (1.5 - a) * k); fireScale = 0.45 + 0.9 * k; } }); stage.fx.burst('embers', new THREE.Vector3(0, 1, 0), 30, 1.6); },
      },
    },
  };
}
