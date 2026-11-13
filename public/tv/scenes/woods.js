// Quest 2: The Whispering Woods. Moonlit forest. The team sneaks along the near lane (z=3.2) from tree to tree;
// a skeleton patrol (sk1..sk3, created here) marches down the path behind the tree line (z=-3.5).
import * as THREE from 'three';
import { box, cyl, disc, glowDisc, ground, mat, mesh, put, scatter, sky } from './kit.js';
import { seeded } from '/shared/rng.js';

export const TREES = [[-10, 1.2], [-4, 1.2], [2, 1.2]]; // hiding trees (x, z)

export function woodsScene() {
  const flies = []; const foliage = []; let sapling;

  function bigTree(x, z, h = 6.5, r = 0.55) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(cyl(r * 0.8, r, h * 0.55, 0x4a3524, { pos: [0, h * 0.275, 0] }, 9));
    const leaves = new THREE.Group(); const lm = mat(0x2c6a45, { flatShading: true });
    for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(2.5 - i * 0.55, 2.6, 9), 0, { m: lm, pos: [0, h * 0.5 + i * 1.5, 0] }); leaves.add(c); }
    g.add(leaves); foliage.push(leaves);
    return g;
  }

  return {
    name: 'woods', music: 'woods', center: [0, 0, 0], forward: 90, wideDist: 18, wideHeight: 7, wideAngle: 0,
    bg: 0x0d1630, fog: { color: 0x13203f, near: 22, far: 75 },
    hemi: { sky: 0x8ea4ea, ground: 0x2c4636, i: 2.2 }, sun: { color: 0xc3d0ff, i: 2.4, pos: [-9, 18, 5] },
    marks: {
      spawn: [-21, 3.2], start: [-10, 3.2], tree2: [-4, 3.2], mid: [2, 3.2], goal: [22, 3.2], spot: [2, 3.2],
      thin: [7, 2.3], open: [4.6, -0.4], open2: [6.6, -1.0], path: [3, -3.5], away: [24, 3.2],
    },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'skeleton_minion', 'skeleton_rogue', 'skprop:Skeleton_Blade', 'skprop:Skeleton_Shield_Large_A', 'skprop:Skeleton_Axe',
      'hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_A_medium', 'hex:trees_B_medium', 'hex:trees_A_large', 'hex:rock_single_A', 'hex:rock_single_C'],
    build(stage) {
      const g = new THREE.Group();
      g.add(sky([[0, '#2a3f7a'], [0.25, '#16254f'], [1, '#060a1c']]));
      g.add(disc(7, 0xf6f2d4, [-34, 46, -120]));
      const r = seeded(77); const sp = new Float32Array(300 * 3);
      for (let i = 0; i < 300; i++) { const a = r.next() * Math.PI * 2; const e = 0.15 + r.next() * 1.2; sp.set([Math.cos(a) * Math.cos(e) * 170, Math.sin(e) * 170, Math.sin(a) * Math.cos(e) * 170], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 })); stars.userData.dim = true; g.add(stars);
      g.add(ground(0x2f5a3e, 110));
      // the patrol's road and the team's mossy lane
      g.add(box(120, 0.04, 2.8, 0x5a4a38, { pos: [0, 0.02, -3.5], cast: false }));
      g.add(box(120, 0.03, 0.5, 0x4a3d30, { pos: [0, 0.03, -3.5], cast: false }));
      const pool = glowDisc(9, 0x7f9cff, 0.22); pool.position.set(2, 0.06, 1); g.add(pool); // moonlit clearing
      for (const [x, z] of TREES) g.add(bigTree(x, z));
      for (const [x, z] of [[12, 1.0], [18, 0.6], [25, 1.4], [-17, 0.8]]) g.add(bigTree(x, z, 6 + (x % 3) * 0.6));
      // the famous thin tree
      sapling = new THREE.Group(); sapling.position.set(7, 0, 1.3);
      sapling.add(cyl(0.07, 0.1, 3.4, 0x5a422c, { pos: [0, 1.7, 0] }, 6));
      sapling.add(mesh(new THREE.ConeGeometry(0.42, 1.1, 7), 0, { m: mat(0x3a8a55, { flatShading: true }), pos: [0, 3.7, 0] }));
      g.add(sapling);
      scatter(stage, g, ['hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_A_medium', 'hex:trees_B_medium', 'hex:trees_A_large'], 300, { inner: 9, outer: 60, scale: [3.4, 5.6], seed: 41, avoid: (x, z) => z > -11 });
      scatter(stage, g, ['hex:rock_single_A', 'hex:rock_single_C'], 30, { inner: 3, outer: 40, scale: [1.2, 2.2], seed: 5, avoid: (x, z) => (z > -6 && z < -1.5) || (z > 2 && z < 5) || z > 7 });
      for (let i = 0; i < 26; i++) {
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.fx.tex, color: 0xd8ff8a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        f.scale.setScalar(0.22 + r.next() * 0.14); f.userData = { x: -20 + r.next() * 44, y: 0.6 + r.next() * 2.6, z: -6 + r.next() * 12, p: r.next() * 6 }; flies.push(f); g.add(f);
      }
      // the patrol
      [['sk1', 'skeleton_warrior', 'skprop:Skeleton_Blade'], ['sk2', 'skeleton_rogue', 'skprop:Skeleton_Axe'], ['sk3', 'skeleton_minion', null]].forEach(([id, kind, weapon], i) => {
        const a = stage.addActor({ id, kind, name: id, at: [-17 - i * 2.2, 0, -3.5], yaw: 90, banner: false, scale: i === 0 ? 1.12 : 1 });
        if (weapon) { const w = stage.assets.instance(weapon); const hand = stage.findBone(a, 'handslot.r'); if (w && hand) hand.add(w); }
      });
      return g;
    },
    update(dt, stage) {
      const t = stage.time;
      for (const f of flies) { const u = f.userData; f.position.set(u.x + Math.sin(t * 0.5 + u.p) * 1.4, u.y + Math.sin(t * 0.9 + u.p * 2) * 0.5, u.z + Math.cos(t * 0.4 + u.p) * 1.2); f.material.opacity = 0.45 + 0.55 * Math.sin(t * 2.2 + u.p * 3) ** 2; }
    },
    rigs: {
      woods: {
        /** The sneeze strips the tree the team is hiding behind. */
        bare(stage, { dur, tree = 2 }) {
          const l = foliage[tree]; const p = new THREE.Vector3(TREES[tree][0], 4.5, TREES[tree][1]);
          stage.fx.burst('leaves', p, 60, 2.4);
          stage.tween({ dur, ease: 'out', owner: l, key: 'bare', update: (k) => { l.scale.setScalar(Math.max(0.001, 1 - k)); l.position.x = k * 3; } });
        },
        /** The sapling bends away and springs back. */
        twang(stage, { dur }) { stage.tween({ dur, ease: 'linear', owner: sapling, key: 'twang', update: (k) => { sapling.rotation.z = Math.sin(k * Math.PI * 5) * 0.22 * (1 - k); } }); },
      },
    },
  };
}
