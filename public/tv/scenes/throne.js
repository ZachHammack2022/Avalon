// Quest 5: The Throne Room. A grand hall along +X: red carpet, a dais and throne at the far end, tall windows.
// Cast created here: `usurper` (on the dais), `heir` (at its foot), guards `tg1`/`tg2`, and the crowd `c1`..`c8`
// along the back of the hall. Also used by the two victory endings (engine/endings.js).
import * as THREE from 'three';
import { box, cyl, glowDisc, mat, mesh, put } from './kit.js';

export const CROWD = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const DAIS_Y = 0.7;

export function throneScene() {
  const candles = []; const flames = [];

  function candelabra(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); const brass = mat(0xc79a2e, { metalness: 0.7, roughness: 0.35 });
    g.add(cyl(0.34, 0.42, 0.14, 0, { m: brass, pos: [0, 0.07, 0] }, 10)); g.add(cyl(0.07, 0.07, 1.7, 0, { m: brass, pos: [0, 0.9, 0] }, 8)); g.add(box(1.3, 0.08, 0.12, 0, { m: brass, pos: [0, 1.72, 0] }));
    for (const dx of [-0.6, 0, 0.6]) {
      const c = new THREE.Group(); c.position.set(dx, 1.78, 0);
      c.add(cyl(0.09, 0.09, 0.8, 0xf3ead2, { pos: [0, 0.4, 0] }, 8));
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 8), new THREE.MeshBasicMaterial({ color: 0xffc04a })); f.position.set(dx, 2.72, 0); g.add(f); flames.push({ f, c });
      g.add(c); candles.push(c);
    }
    const l = new THREE.PointLight(0xffb060, 26, 14, 1.6); l.position.set(0, 2.9, 0.4); g.add(l);
    return g;
  }

  return {
    name: 'throne', music: 'throne', center: [4, 0, 0], forward: 90, wideDist: 21, wideHeight: 8, wideAngle: -10,
    bg: 0x1d1620, fog: { color: 0x1d1620, near: 40, far: 110 },
    hemi: { sky: 0xf0e0c8, ground: 0x4a3a34, i: 1.45 }, sun: { color: 0xfff1d6, i: 1.7, pos: [-6, 20, 14] },
    marks: {
      spawn: [-25, 0], start: [-14, 0], mid: [4.4, 0], goal: [8, 0], spot: [8.9, 0.5], heir: [10.5, 0.5], throne: [17, 0], dais: [14.3, DAIS_Y, -0.3],
      exit: [-1.5, 0], far: [-21, 0.45, 0], crownUp: [10.5, 2.95, 0.5], selfSpot: [9.1, 1.9], speech: [7.6, 2.4], steal: [11.2, -0.7],
    },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'skeleton_mage', 'skprop:Skeleton_Staff', 'skprop:Skeleton_Blade', 'prop:mug_full',
      'dungeon:floor_tile_large', 'dungeon:pillar_decorated', 'dungeon:banner_red', 'dungeon:banner_blue', 'dungeon:banner_yellow', 'dungeon:wall', 'dungeon:wall_archedwindow_open', 'dungeon:torch_mounted', 'dungeon:chest_gold', 'dungeon:sword_shield_gold'],
    build(stage) {
      const g = new THREE.Group();
      const add = (name, o) => { const m = put(stage, name, o); if (m) g.add(m); return m; };
      for (let x = -8; x <= 5; x++) for (let z = -2; z <= 2; z++) add('dungeon:floor_tile_large', { pos: [x * 4, 0, z * 4] });
      g.add(box(70, 0.3, 30, 0x3a3038, { pos: [-4, -0.2, 0], cast: false }));
      g.add(box(40, 0.05, 3.4, 0xc79a2e, { pos: [-7, 0.03, 0], cast: false })); g.add(box(40, 0.06, 2.9, 0xa31f2f, { pos: [-7, 0.04, 0], cast: false }));
      // back wall: stone, tall glowing windows, banners, pillars
      for (let x = -8; x <= 5; x++) { add('dungeon:wall', { pos: [x * 4, 0, -9] }); add('dungeon:wall', { pos: [x * 4, 4, -9] }); add('dungeon:wall', { pos: [x * 4, 8, -9] }); }
      for (let i = 0; i < 6; i++) {
        const x = -22 + i * 7;
        const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6.2), new THREE.MeshBasicMaterial({ color: 0xbfe1ff })); w.position.set(x, 5.6, -8.4); w.userData.dim = true; g.add(w);
        g.add(box(2.9, 0.3, 0.4, 0x5a4a44, { pos: [x, 2.3, -8.5] })); g.add(box(0.14, 6.2, 0.1, 0x3a3038, { pos: [x, 5.6, -8.35], cast: false })); g.add(box(2.4, 0.14, 0.1, 0x3a3038, { pos: [x, 6.4, -8.35], cast: false }));
        const pool = glowDisc(3.4, 0xcfe6ff, 0.16); pool.scale.set(1, 2.2, 1); pool.position.set(x + 1, 0.07, -3.6); g.add(pool);
        add('dungeon:pillar_decorated', { pos: [x + 3.5, 0, -7.6], scale: 1.5 });
        add(`dungeon:banner_${['red', 'yellow', 'blue'][i % 3]}`, { pos: [x + 3.5, 5.2, -7.2], scale: 1.8 });
      }
      // dais + throne
      g.add(box(8.5, 0.35, 11, 0x6e625c, { pos: [16.6, 0.175, 0] })); g.add(box(7.5, 0.35, 9.6, 0x7a6e68, { pos: [17.1, 0.525, 0] }));
      g.add(box(7.4, 0.04, 2.9, 0xa31f2f, { pos: [17.1, 0.72, 0], cast: false }));
      const th = new THREE.Group(); th.position.set(18.2, DAIS_Y, 0); const red = mat(0x9c1c2b); const gold = mat(0xd6a82b, { metalness: 0.7, roughness: 0.3 });
      th.add(box(1.7, 1.0, 2.2, 0, { m: red, pos: [0, 0.5, 0] })); th.add(box(0.5, 4.6, 2.6, 0, { m: gold, pos: [0.95, 2.3, 0] })); th.add(box(0.3, 3.6, 2.0, 0, { m: red, pos: [0.72, 2.5, 0] }));
      for (const z of [-1.25, 1.25]) { th.add(box(1.7, 1.6, 0.34, 0, { m: gold, pos: [0, 0.8, z] })); th.add(mesh(new THREE.SphereGeometry(0.26, 12, 10), 0, { m: gold, pos: [-0.75, 1.72, z] })); th.add(mesh(new THREE.ConeGeometry(0.22, 0.9, 6), 0, { m: gold, pos: [0.95, 5.0, z * 0.9] })); }
      th.add(mesh(new THREE.ConeGeometry(0.3, 1.2, 6), 0, { m: gold, pos: [0.95, 5.3, 0] }));
      g.add(th);
      add('dungeon:banner_red', { pos: [20.6, 6.5, -3], rot: -90, scale: 2.4 }); add('dungeon:banner_red', { pos: [20.6, 6.5, 3], rot: -90, scale: 2.4 });
      g.add(box(1, 12, 22, 0x3a3038, { pos: [21.4, 6, 0] }));
      g.add(candelabra(12.0, -2.6)); g.add(candelabra(12.6, 4.8)); g.add(candelabra(-3, -6.4)); g.add(candelabra(-17, -6.4));
      const warm = new THREE.PointLight(0xffc680, 120, 40, 1.4); warm.position.set(12, 8, 6); g.add(warm);
      // the cast
      const U = stage.addActor({ id: 'usurper', kind: 'skeleton_mage', name: 'Usurper', at: [14.3, DAIS_Y, -0.3], yaw: -90, banner: false, scale: 1.3 });
      const staff = stage.assets.instance('skprop:Skeleton_Staff'); const hand = stage.findBone(U, 'handslot.l'); if (staff && hand) hand.add(staff);
      stage.addActor({ id: 'heir', kind: 'knight', name: 'Heir', color: '#f4f1ea', at: [10.5, 0, 0.5], yaw: -90, banner: false, scale: 0.86 });
      [['tg1', [12.6, 0, -4.2]], ['tg2', [15.6, DAIS_Y, -3.2]]].forEach(([id, at]) => { const a = stage.addActor({ id, kind: 'skeleton_warrior', name: id, at, yaw: -90, banner: false, scale: 1.1 }); const w = stage.assets.instance('skprop:Skeleton_Blade'); const hb = stage.findBone(a, 'handslot.r'); if (w && hb) hb.add(w); });
      const kinds = ['mage', 'barbarian', 'rogue', 'knight', 'rogueHooded']; const tints = ['#b9a7c9', '#c9b29a', '#9fb8a8', '#c7c2a0', '#a9b4cc', '#cfa7a7', '#b0c7b0', '#c4b6d6'];
      CROWD.forEach((id, i) => stage.addActor({ id, kind: kinds[i % kinds.length], name: id, color: tints[i], at: [-5.5 + i * 2.05 + (i % 2) * 0.3, 0, -4.6 - (i % 2) * 1.3], yaw: 20 - i * 3, banner: false, scale: 0.92 + (i % 3) * 0.05 }));
      return g;
    },
    update(dt, stage) {
      for (const { f, c } of flames) { f.position.y = 1.78 + 0.8 * c.scale.y + 0.14; f.scale.y = 1 + Math.sin(stage.time * 18 + f.position.x * 7) * 0.2; }
    },
    rigs: {
      throne: {
        /** Time-lapse: the candles burn down to stubs. */
        melt(stage, { dur }) { candles.forEach((c, i) => stage.tween({ dur, delay: (i % 3) * 0.05, ease: 'linear', owner: c, key: 'melt', update: (k) => { c.scale.y = 1 - k * 0.82; } })); },
      },
    },
  };
}
