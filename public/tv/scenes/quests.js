// The five quest environments. PLACEHOLDER-QUALITY: enough geometry, marks and a couple of example rigs
// for the cutscene pipeline to play end to end. The cutscene author builds these out (see docs/CUTSCENES.md).
// Marks (named positions [x,z]) every scene must define: start, mid, goal, spot. Team travels along +x.
import * as THREE from 'three';
import { box, cyl, flame, flicker, ground, mat, mesh, put, scatter } from './kit.js';

const common = { forward: 90, wideDist: 16, wideHeight: 7, wideAngle: 0 };

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
      // far side only: near-side pillars would block the camera
      for (let x = -6; x <= 3; x++) for (const z of [-8]) { const p = put(stage, 'dungeon:pillar', { pos: [x * 4, 0, z] }); if (p) g.add(p); const b = put(stage, 'dungeon:banner_red', { pos: [x * 4 + 2, 1.5, z * 0.98], rot: z > 0 ? 180 : 0, scale: 1.2 }); if (b) g.add(b); }
      for (let x = -6; x <= 4; x++) { const w = put(stage, 'dungeon:wall', { pos: [x * 4, 0, -12] }); if (w) g.add(w); }
      const th = new THREE.Group(); th.position.set(16, 0, 0);
      th.add(box(5, 0.8, 5, 0x6a5f58, { pos: [0, 0.4, 0] })); th.add(box(1.8, 2.4, 2.2, 0xa31f2f, { pos: [1.2, 1.9, 0] })); th.add(box(0.5, 4.2, 2.6, 0xd6a82b, { pos: [2.1, 3.1, 0] }));
      g.add(th);
      return g;
    },
    rigs: {},
  };
}
