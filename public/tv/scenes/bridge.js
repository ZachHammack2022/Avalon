// Quest 1: The Old Bridge. Dusk, a deep gorge, a rickety rope bridge along +X from x=-9 to x=9.
// The bridge is 12 "bays" (plank + rail segments + suspenders) hung from two pivots so it can sag, shed bays,
// unravel like a sweater, punch a culprit-shaped hole, or split and swing down against the cliffs.
import * as THREE from 'three';
import { beam, box, disc, mat, mesh, put, scatter, sky } from './kit.js';

const N = 12; const BAY = 1.5; const X0 = -9; const WATER = -9; const FLOAT_Y = -9.8;
const bayX = (i) => X0 + BAY * (i + 0.5);
const sag = (x) => -0.55 * (1 - (x / 9) ** 2); // rail droop

export function bridgeScene() {
  const bays = []; const pivots = {}; let river; let streaks = []; const floaters = new Set(); let holeMesh = null;

  function buildBay(i) {
    const g = new THREE.Group(); const x = bayX(i);
    const wood = [0x8a5a2b, 0x7a4f26, 0x96642f][i % 3];
    const plank = box(BAY - 0.14, 0.16, 2.5, wood, { pos: [0, -0.08, 0], rot: [0, (i % 2 ? 1 : -1) * 1.5, 0] }); plank.name = 'plank'; g.add(plank);
    for (const z of [-1.3, 1.3]) {
      const yl = 1.15 + sag(x - BAY / 2); const yr = 1.15 + sag(x + BAY / 2);
      g.add(beam([-BAY / 2, yl, z], [BAY / 2, yr, z], 0.05, 0xc9ab72, { cast: false }));
      g.add(beam([0, (yl + yr) / 2, z], [0, -0.05, z], 0.025, 0xb59a6a, { cast: false }));
    }
    g.userData = { i, x, gone: false };
    return g;
  }
  /** Which bay is under world x (clamped). */
  const bayAt = (x) => bays[Math.max(0, Math.min(N - 1, Math.floor((x - X0) / BAY)))];

  function dropBay(stage, bay, delay = 0, style = 'fall') {
    if (bay.userData.gone) return; bay.userData.gone = true;
    const y0 = bay.position.y; const spin = (bay.userData.i % 2 ? 1 : -1) * (1.2 + (bay.userData.i % 3) * 0.5);
    stage.tween({ dur: 1.1, delay, ease: 'in', owner: bay, key: 'drop', update: (k) => {
      bay.position.y = y0 - k * 11; bay.rotation.x = k * spin; bay.rotation.z = k * spin * (style === 'unravel' ? 0.2 : 0.6);
      if (k >= 1) bay.visible = false;
    } });
  }
  /** Actor drops into the river, splashes, then bobs downstream. */
  function plunge(stage, actor, delay = 0, { quiet = false } = {}) {
    if (actor.falling) return; actor.falling = true;
    const root = actor.root; let y0 = null;
    stage.tween({ dur: 0.001, delay, owner: actor, key: 'move', update: () => { actor.play('Jump_Idle', { loop: true }); } });
    stage.tween({ dur: 0.95, delay, ease: 'in', owner: actor, key: 'plunge',
      update: (k) => { if (y0 === null) y0 = root.position.y; root.position.y = y0 + (FLOAT_Y - y0) * k; root.rotation.z = Math.sin(k * 9) * 0.25 * (1 - k); },
      done: () => {
        root.rotation.z = 0; floaters.add(actor); actor.floatT = floaters.size * 1.3; actor.play('Idle', { loop: true });
        stage.fx.burst('splash', new THREE.Vector3(root.position.x, WATER, root.position.z), 26, 1.6);
        if (!quiet && !stage.silent && stage.audio) stage.audio.sfx('splash', 0.8);
      } });
  }

  return {
    name: 'bridge', music: 'bridge', center: [0, 0, 0], forward: 90, wideDist: 19, wideHeight: 6.5, wideAngle: 0,
    bg: 0xf0a060, fog: { color: 0xe39a72, near: 40, far: 150 },
    hemi: { sky: 0xffd0a0, ground: 0x6a4a5a, i: 1.25 }, sun: { color: 0xffb870, i: 2.2, pos: [-16, 11, 14] },
    marks: { spawn: [-23, 0], start: [-13.5, 0], mid: [0, 0], goal: [14, 0], spot: [0, 0], far: [13.5, 0], edge: [-10.5, 0], gorge: [5, 6] },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'hex:rock_single_A', 'hex:rock_single_B', 'hex:mountain_A', 'hex:mountain_B', 'hex:trees_A_small', 'hex:trees_B_medium', 'hex:tree_single_A', 'hex:building_castle_blue', 'hex:building_tower_A_blue', 'hex:flag_blue'],
    build(stage) {
      const g = new THREE.Group();
      g.add(sky([[0, '#ffc27a'], [0.18, '#f58f5e'], [0.45, '#b0608a'], [1, '#3b2f6b']]));
      g.add(disc(9, 0xfff0c0, [-50, 9, -150]));
      // cliffs: grass tops, striated rock faces, a few ledges
      for (const s of [-1, 1]) {
        g.add(box(26, 0.5, 46, 0x5d8f3e, { pos: [s * 22, -0.25, 0] }));
        g.add(box(26, 5, 46, 0x8b6748, { pos: [s * 22, -3, 0] }));
        g.add(box(27, 5, 47, 0x74543d, { pos: [s * 22.6, -8, 0] }));
        g.add(box(28.5, 6, 48, 0x5f4433, { pos: [s * 23.4, -13.5, 0] }));
        for (const z of [-12, -4.5, 5, 13]) g.add(box(1.2, 1.1, 2.6, 0x6f5140, { pos: [s * 9.2, -2.5 - ((z + 20) % 3), z], rot: [0, 12, 0] }));
        // anchor posts + the rope coming off them
        for (const z of [-1.3, 1.3]) { g.add(box(0.26, 1.7, 0.26, 0x5b3f24, { pos: [s * 9.25, 0.85, z] })); g.add(beam([s * 9.25, 1.2, z], [s * 10.8, 0, z], 0.045, 0xc9ab72, { cast: false })); }
      }
      river = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), mat(0x2f8fd8, { roughness: 0.25, metalness: 0.1 }));
      river.rotation.x = -Math.PI / 2; river.position.y = WATER; river.receiveShadow = true; g.add(river);
      for (let i = 0; i < 26; i++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1.6 + (i % 4)), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55 })); st.rotation.x = -Math.PI / 2; st.position.set(-8 + ((i * 5.3) % 16), WATER + 0.03, -40 + ((i * 17) % 80)); st.userData.dim = true; streaks.push(st); g.add(st); }
      for (const [x, z, s2] of [[-3, -30, 2.2], [5, -44, 3], [-6, 22, 2]]) { const r = put(stage, 'hex:rock_single_B', { pos: [x, WATER - 0.3, z], scale: s2 * 2.4 }); if (r) g.add(r); }
      // the bridge: two half-spans, each hinged at its cliff
      for (const side of ['L', 'R']) { const p = new THREE.Group(); p.position.set(side === 'L' ? X0 : -X0, 0, 0); pivots[side] = p; g.add(p); }
      for (let i = 0; i < N; i++) { const b = buildBay(i); const side = i < N / 2 ? 'L' : 'R'; b.position.set(b.userData.x - pivots[side].position.x, 0, 0); pivots[side].add(b); bays.push(b); }
      // dressing: the kingdom on the far side, mountains, trees
      const castle = put(stage, 'hex:building_castle_blue', { pos: [27, 0, -11], rot: -30, scale: 9 }); if (castle) g.add(castle);
      const tower = put(stage, 'hex:building_tower_A_blue', { pos: [19, 0, -15], rot: 20, scale: 6 }); if (tower) g.add(tower);
      const flag = put(stage, 'hex:flag_blue', { pos: [11.5, 0, -3.2], rot: 90, scale: 3 }); if (flag) g.add(flag);
      for (const [x, z, s2, n] of [[-34, -40, 16, 'A'], [30, -52, 20, 'B'], [-8, -64, 24, 'A'], [48, -30, 14, 'A'], [-52, -18, 12, 'B']]) { const m = put(stage, `hex:mountain_${n}`, { pos: [x, -2, z], scale: s2 }); if (m) g.add(m); }
      scatter(stage, g, ['hex:trees_A_small', 'hex:trees_B_medium', 'hex:tree_single_A', 'hex:rock_single_A'], 90, { inner: 12, outer: 38, scale: [2.6, 4.2], seed: 21, avoid: (x, z) => z > -2.5 || Math.abs(x) < 11.5 || (Math.abs(z) < 4 && Math.abs(x) < 30) || (x > 14 && z < -4 && z > -22) });
      return g;
    },
    update(dt, stage) {
      for (const st of streaks) { st.position.z += dt * 7; if (st.position.z > 40) st.position.z -= 80; }
      for (const a of floaters) { // bob + drift downstream (toward the camera)
        a.floatT += dt; a.root.position.y = FLOAT_Y + Math.sin(a.floatT * 3.1) * 0.12; a.root.position.z += dt * 0.9;
      }
    },
    rigs: {
      bridge: {
        /** A groan runs down the span: bays dip in a travelling wave. */
        creak(stage, { dur }) {
          bays.forEach((b, i) => { if (!b.userData.gone) stage.tween({ dur: 0.5, delay: (i / N) * dur * 0.6, ease: 'linear', owner: b, key: 'creak', update: (k) => { b.position.y = -Math.sin(k * Math.PI) * 0.16; b.rotation.x = Math.sin(k * Math.PI * 2) * 0.05; } }); });
        },
        /** One hard bounce centred on `who` (or mid). */
        bounce(stage, { who, amount = 0.3 }) {
          const cx = who ? stage.pos(who).x : 0;
          bays.forEach((b) => { if (b.userData.gone) return; const f = Math.max(0, 1 - Math.abs(b.userData.x - cx) / 6); stage.tween({ dur: 0.45, ease: 'linear', owner: b, key: 'creak', update: (k) => { b.position.y = -Math.sin(k * Math.PI) * amount * f; } }); });
        },
        /** Drop `n` bays that nobody is standing on, outermost first, alternating ends. */
        shed(stage, { n = 2, dur = 0.4 }) {
          const occupied = new Set([...stage.cast.values()].map((a) => bayAt(a.root.position.x)));
          const free = bays.filter((b) => !b.userData.gone && !occupied.has(b));
          const order = []; let lo = 0; let hi = free.length - 1;
          while (lo <= hi) { order.push(free[lo++]); if (lo <= hi) order.push(free[hi--]); }
          order.slice(0, n).forEach((b, k) => dropBay(stage, b, (k * dur) / n));
        },
        /** Bays vanish one by one from the near cliff toward the far one; anyone on a bay goes with it (except `spare`). */
        unravel(stage, { dur, spare }) {
          const keep = new Set(spare ? stage.objs(spare).map((o) => o.actor) : []);
          bays.forEach((b, i) => {
            const delay = (i * dur) / N; dropBay(stage, b, delay, 'unravel');
            for (const a of stage.cast.values()) if (!keep.has(a) && bayAt(a.root.position.x) === b) plunge(stage, a, delay + 0.12);
          });
        },
        /** Success: the bridge falls away behind the running team. */
        collapse(stage, { dur }) { bays.forEach((b, i) => dropBay(stage, b, (i * dur) / N)); },
        /** `who` drops into the river (staggered). */
        fall(stage, { who = 'team:all', stagger = 0.12, quiet = false }) { stage.objs(who).forEach((o, i) => o.actor && plunge(stage, o.actor, i * stagger, { quiet })); },
        /** The plank under `who` is replaced by one with a person-shaped hole. */
        hole(stage, { who }) {
          const p = stage.pos(who); const bay = bayAt(p.x); const plank = bay.getObjectByName('plank'); plank.visible = false;
          const sh = new THREE.Shape(); const hw = (BAY - 0.14) / 2; sh.moveTo(-hw, -1.25); sh.lineTo(hw, -1.25); sh.lineTo(hw, 1.25); sh.lineTo(-hw, 1.25); sh.closePath();
          // gingerbread outline (x across the plank, y along it), arms up in surprise
          const h = new THREE.Path(); const pts = [[0, 0.62], [0.2, 0.55], [0.26, 0.36], [0.2, 0.2], [0.5, 0.42], [0.62, 0.3], [0.3, -0.02], [0.28, -0.3], [0.4, -0.72], [0.18, -0.76], [0, -0.38], [-0.18, -0.76], [-0.4, -0.72], [-0.28, -0.3], [-0.3, -0.02], [-0.62, 0.3], [-0.5, 0.42], [-0.2, 0.2], [-0.26, 0.36], [-0.2, 0.55]];
          pts.forEach(([x, y], i) => (i ? h.lineTo(x * 1.0, y * 1.45) : h.moveTo(x * 1.0, y * 1.45))); h.closePath(); sh.holes.push(h);
          holeMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }), plank.material);
          holeMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2); holeMesh.position.set(0, -0.16, 0); holeMesh.castShadow = true; holeMesh.receiveShadow = true; bay.add(holeMesh);
          stage.fx.burst('dust', new THREE.Vector3(p.x, 0, p.z), 14, 1);
        },
        /** The span parts in the middle and both halves swing down against the cliffs. */
        swing(stage, { dur }) {
          for (const side of ['L', 'R']) { const p = pivots[side]; const dir = side === 'L' ? -1 : 1; stage.tween({ dur, ease: 'bounce', owner: p, key: 'swing', update: (k) => { p.rotation.z = dir * k * 1.42; } }); }
        },
      },
    },
  };
}
