// The five quest environments. PLACEHOLDER-QUALITY: enough geometry, marks and a couple of example rigs
// for the cutscene pipeline to play end to end. The cutscene author builds these out (see docs/CUTSCENES.md).
// Marks (named positions [x,z]) every scene must define: start, mid, goal, spot. Team travels along +x.
import * as THREE from 'three';
import { box, cyl, flame, flicker, ground, mat, mesh, put, scatter } from './kit.js';

const common = { forward: 90, wideDist: 16, wideHeight: 7, wideAngle: 0 };

export function bridgeScene() {
  const planks = [];
  return {
    ...common, name: 'bridge', music: 'bridge', center: [0, 0, 0],
    bg: 0xf2a65a, fog: { color: 0xd98a6a, near: 25, far: 90 },
    hemi: { sky: 0xffc98a, ground: 0x5a3a46, i: 1.1 }, sun: { color: 0xffb066, i: 2.0, pos: [-14, 10, 12] },
    marks: { spawn: [-22, 0], start: [-12, 0], mid: [0, 0], goal: [12, 0], spot: [0, 0], river: [0, -9] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'hex:rock_single_A', 'hex:mountain_A', 'hex:trees_A_small'],
    build(stage) {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        g.add(box(22, 14, 40, 0x7a5a45, { pos: [s * 20, -7, 0] }));
        g.add(box(22, 0.4, 40, 0x4f7d3a, { pos: [s * 20, 0.2, 0] }));
      }
      const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), mat(0x2f8fd8, { roughness: 0.3, transparent: true, opacity: 0.9 }));
      river.rotation.x = -Math.PI / 2; river.position.y = -9; g.add(river);
      for (let i = 0; i < 12; i++) { const p = box(1.5, 0.18, 2.6, 0x8a5a2b, { pos: [-8.25 + i * 1.5, -0.05, 0] }); planks.push(p); g.add(p); }
      for (const z of [-1.3, 1.3]) g.add(box(18, 0.08, 0.08, 0xb59a6a, { pos: [0, 1.0, z], cast: false }));
      for (const x of [-9, 9]) for (const z of [-1.3, 1.3]) g.add(box(0.14, 1.1, 0.14, 0x6b4a2a, { pos: [x, 0.5, z] }));
      for (const [x, z, s] of [[-24, -10, 4], [26, 8, 5], [-28, 12, 3.5]]) { const m = put(stage, 'hex:mountain_A', { pos: [x, -1, z - 22], scale: s * 2 }); if (m) g.add(m); }
      scatter(stage, g, ['hex:trees_A_small', 'hex:rock_single_A'], 16, { inner: 16, outer: 34, scale: [2.2, 3.4], seed: 21, avoid: (x, z) => Math.abs(x) < 10 });
      return g;
    },
    rigs: {
      bridge: {
        collapse(stage, { dur }) { planks.forEach((p, i) => stage.tween({ dur: dur * 0.6, delay: i * 0.05, ease: 'in', update: (k) => { if (k === 0) return; p.position.y = -0.05 - k * 9; p.rotation.z = k * (i % 2 ? 1.4 : -1.2); }, owner: p, key: 'collapse' })); },
        // planks drop one by one from the far end toward the camera side, like a sweater coming apart
        unravel(stage, { dur }) {
          planks.slice().reverse().forEach((p, i) => stage.tween({ dur: 0.45, delay: (i * dur) / planks.length, ease: 'in', owner: p, key: 'unravel',
            update: (k) => { p.position.y = -0.05 - k * 9; p.rotation.x = k * 2.2; } }));
        },
      },
    },
  };
}

export function woodsScene() {
  return {
    ...common, name: 'woods', music: 'woods', center: [0, 0, 0],
    bg: 0x0d1424, fog: { color: 0x0d1424, near: 14, far: 55 },
    hemi: { sky: 0x4a5f99, ground: 0x1a2418, i: 1.0 }, sun: { color: 0x9db5ff, i: 1.3, pos: [-12, 20, 6] },
    marks: { spawn: [-18, 4], start: [-10, 3], mid: [0, 3], goal: [10, 3], spot: [0, 3], patrol: [4, -3] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_A_medium', 'hex:trees_B_medium', 'hex:rock_single_A'],
    build(stage) {
      const g = new THREE.Group();
      g.add(ground(0x1f3a26, 90));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4f1d0, fog: false }));
      moon.position.set(-20, 26, -50); g.add(moon);
      scatter(stage, g, ['hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_A_medium', 'hex:trees_B_medium'], 70, { inner: 4, outer: 38, scale: [2.8, 4.6], seed: 41, avoid: (x, z) => Math.abs(x) < 15 && z > -1 && z < 7 });
      return g;
    },
    rigs: {},
  };
}

export function vaultScene() {
  let torches = []; let door; let alarm;
  return {
    ...common, name: 'vault', music: 'vault', center: [0, 0, 0],
    bg: 0x120e0c, fog: { color: 0x120e0c, near: 18, far: 50 },
    hemi: { sky: 0x6a5a4a, ground: 0x1a120c, i: 0.9 }, sun: { color: 0xffd9a8, i: 0.8, pos: [0, 16, 10] },
    marks: { spawn: [-18, 3], start: [-9, 3], mid: [2, 3], goal: [8, 3], spot: [6, 3], door: [11, 0], lever: [5, -3] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'dungeon:floor_tile_large', 'dungeon:wall', 'dungeon:torch_lit', 'dungeon:pillar', 'dungeon:banner_red', 'dungeon:chest_gold', 'dungeon:key'],
    build(stage) {
      const g = new THREE.Group();
      for (let x = -5; x <= 5; x++) for (let z = -3; z <= 3; z++) { const t = put(stage, 'dungeon:floor_tile_large', { pos: [x * 4, 0, z * 4] }); if (t) g.add(t); else g.add(box(4, 0.1, 4, 0x4a4038, { pos: [x * 4, -0.05, z * 4] })); }
      for (let x = -4; x <= 3; x++) { const w = put(stage, 'dungeon:wall', { pos: [x * 4, 0, -6] }); if (w) g.add(w); }
      door = new THREE.Group(); door.position.set(11, 3.2, -0.6);
      const slab = cyl(3.4, 3.4, 0.7, 0x888a92, { rot: [90, 0, 0], m: mat(0x8a8d96, { metalness: 0.7, roughness: 0.4 }) }, 40); door.add(slab);
      door.add(cyl(0.9, 0.9, 0.9, 0xb08a2a, { rot: [90, 0, 0], m: mat(0xb08a2a, { metalness: 0.8, roughness: 0.3 }) }, 20));
      g.add(door);
      g.add(box(1.2, 8, 8, 0x2b2420, { pos: [12.2, 4, -0.6] }));
      for (const [x, z] of [[8.5, -5], [8.5, 4.5], [-4, -5.2]]) { const t = put(stage, 'dungeon:torch_lit', { pos: [x, 2.2, z], scale: 1.6 }); if (t) g.add(t); const f = flame(); f.scale.setScalar(0.6); f.position.set(x, 2.6, z); f.userData.light.intensity = 30; torches.push(f); g.add(f); }
      alarm = new THREE.PointLight(0xff2020, 0, 40); alarm.position.set(0, 7, 2); g.add(alarm);
      return g;
    },
    update(dt, stage) { torches.forEach((f, i) => flicker(f, stage.time + i, 30)); if (alarm && alarm.userData.on) alarm.intensity = 90 * (0.5 + 0.5 * Math.sin(stage.time * 14)); },
    rigs: {
      vault: {
        openDoor(stage, { dur }) { stage.tween({ dur, ease: 'inOut', update: (k) => { door.rotation.y = -k * 1.4; }, owner: door, key: 'door' }); },
        alarm(stage) { alarm.userData.on = true; },
      },
    },
  };
}

export function dragonScene() {
  const parts = {};
  function buildDragon(stage) {
    const d = new THREE.Group();
    const green = mat(0x3f9d5a); const belly = mat(0xd9c46a);
    const body = mesh(new THREE.SphereGeometry(3.2, 20, 14), 0, { m: green, pos: [0, 2.6, 0] }); body.scale.set(1.5, 0.95, 1);
    const head = new THREE.Group(); head.position.set(-5, 3.2, 0);
    head.add(mesh(new THREE.BoxGeometry(2.8, 1.8, 2.2), 0, { m: green }));
    const jaw = mesh(new THREE.BoxGeometry(2.4, 0.5, 2), 0, { m: belly, pos: [-0.1, -1.0, 0] }); head.add(jaw);
    for (const z of [-0.8, 0.8]) head.add(mesh(new THREE.ConeGeometry(0.22, 0.8, 8), 0, { m: mat(0xf2ead0), pos: [-1.4, 0.9, z * 0.9] }));
    const eyeLid = mesh(new THREE.SphereGeometry(0.42, 14, 10), 0, { m: mat(0x2a6e40), pos: [-1.1, 0.55, 1.05] });
    const eye = mesh(new THREE.SphereGeometry(0.34, 14, 10), 0, { m: new THREE.MeshBasicMaterial({ color: 0xffd21f }), pos: [-1.1, 0.55, 1.08] });
    eye.scale.y = 0.08; head.add(eye, eyeLid);
    const tail = mesh(new THREE.ConeGeometry(1.3, 7, 10), 0, { m: green, pos: [6.5, 1.1, 0], rot: [0, 0, 90] });
    const wings = [-1, 1].map((s) => { const w = mesh(new THREE.BoxGeometry(5, 0.15, 3), 0, { m: mat(0x2f7d49), pos: [0.5, 5.2, s * 3.2], rot: [s * 20, 0, 0] }); return w; });
    d.add(body, head, tail, ...wings);
    Object.assign(parts, { dragon: d, eye, eyeLid, head, jaw, tail, wings });
    return d;
  }
  return {
    ...common, name: 'dragon', music: 'dragon', center: [0, 0, 0],
    bg: 0x0b0806, fog: { color: 0x0b0806, near: 16, far: 60 },
    hemi: { sky: 0x7a5a3a, ground: 0x1c1208, i: 0.8 }, sun: { color: 0xffc680, i: 1.0, pos: [-6, 16, 10] },
    marks: { spawn: [-20, 4], start: [-11, 4], mid: [-2, 4], goal: [6, 4], spot: [3, 4], dragon: [8, 0], crown: [8, 7.5] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'dungeon:coin_stack_large', 'dungeon:coin_stack_medium', 'dungeon:chest_gold'],
    build(stage) {
      const g = new THREE.Group();
      g.add(ground(0x3b2c20, 90));
      const gold = mat(0xf0b92b, { metalness: 0.7, roughness: 0.35 });
      const heap = mesh(new THREE.ConeGeometry(8.5, 5, 24), 0, { m: gold, pos: [9, 2.5, 0] }); g.add(heap);
      for (let i = 0; i < 14; i++) { const c = put(stage, 'dungeon:coin_stack_large', { pos: [-4 + (i % 7) * 1.6, 0, -6 + Math.floor(i / 7) * 9], rot: i * 40, scale: 1.1 }); if (c) g.add(c); }
      g.add(buildDragon(stage)); parts.dragon.position.set(9, 4.2, -2);
      const crown = mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 16), 0, { m: new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.2, emissive: 0x553300 }), pos: [3.3, 4.6, 2.6], rot: [90, 0, 0] }); g.add(crown);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(2 + (i % 3), 9 + (i % 4) * 3, 7), 0x453629, { pos: [Math.cos(a) * 34, 3, Math.sin(a) * 34] })); }
      return g;
    },
    update(dt, stage) { if (parts.dragon && !parts.awake) parts.dragon.scale.y = 1 + Math.sin(stage.time * 1.6) * 0.012; },
    rigs: {
      dragon: {
        openEye(stage, { dur }) { stage.tween({ dur, update: (k) => { parts.eye.scale.y = 0.08 + k * 0.92; } }); },
        sneeze(stage, { dur }) { stage.tween({ dur, ease: 'in', update: (k) => { parts.head.rotation.z = Math.sin(k * 20) * 0.05 * k; parts.head.position.y = 3.2 + k * 0.6; }, done: () => { stage.fx.burst('firePuff', parts.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-2, 0, 0)), 40, 1.8); } }); },
        wake(stage) { parts.awake = true; parts.eye.scale.y = 1; },
      },
    },
  };
}

export function throneScene() {
  return {
    ...common, name: 'throne', music: 'throne', center: [0, 0, 0],
    bg: 0x241a22, fog: { color: 0x241a22, near: 30, far: 80 },
    hemi: { sky: 0xe8d9c0, ground: 0x4a3a30, i: 1.1 }, sun: { color: 0xfff0d0, i: 1.3, pos: [0, 20, 12] },
    marks: { spawn: [-24, 0], start: [-14, 0], mid: [-3, 0], goal: [8, 0], spot: [6, 0], throne: [16, 0], heir: [10, 1.5] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'dungeon:floor_tile_large', 'dungeon:pillar', 'dungeon:banner_red', 'dungeon:wall', 'prop:mug_full'],
    wideDist: 20, wideHeight: 8,
    build(stage) {
      const g = new THREE.Group();
      for (let x = -7; x <= 5; x++) for (let z = -3; z <= 3; z++) { const t = put(stage, 'dungeon:floor_tile_large', { pos: [x * 4, 0, z * 4] }); if (t) g.add(t); else g.add(box(4, 0.1, 4, 0x6a5f58, { pos: [x * 4, -0.05, z * 4] })); }
      g.add(box(36, 0.06, 3.2, 0xa31f2f, { pos: [-2, 0.05, 0], cast: false }));
      for (let x = -6; x <= 3; x++) for (const z of [-8, 8]) { const p = put(stage, 'dungeon:pillar', { pos: [x * 4, 0, z] }); if (p) g.add(p); const b = put(stage, 'dungeon:banner_red', { pos: [x * 4 + 2, 1.5, z * 0.98], rot: z > 0 ? 180 : 0, scale: 1.2 }); if (b) g.add(b); }
      for (let x = -6; x <= 4; x++) { const w = put(stage, 'dungeon:wall', { pos: [x * 4, 0, -12] }); if (w) g.add(w); }
      const th = new THREE.Group(); th.position.set(16, 0, 0);
      th.add(box(5, 0.8, 5, 0x6a5f58, { pos: [0, 0.4, 0] })); th.add(box(1.8, 2.4, 2.2, 0xa31f2f, { pos: [1.2, 1.9, 0] })); th.add(box(0.5, 4.2, 2.6, 0xd6a82b, { pos: [2.1, 3.1, 0] }));
      g.add(th);
      return g;
    },
    rigs: {},
  };
}
