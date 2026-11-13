// Quest 4: The Dragon's Hoard. A cave; a chunky dragon asleep on a mountain of gold, the crown resting on its head.
// The team comes in from the cave mouth on the left (-X) and tiptoes to `mid`; the dragon's snout rests at `nose`.
import * as THREE from 'three';
import { box, cyl, glowDisc, ground, mat, mesh, put } from './kit.js';
import { seeded } from '/shared/rng.js';

const HEAD_SLEEP = { p: [4.3, 1.3, 1.2], r: [0, 0.6, 0] };
const HEAD_UP = { p: [5.6, 6.3, 1.6], r: [0, 0.45, -0.45] };
const NECK_ROOT = new THREE.Vector3(6.9, 4.4, -1.0);

export function dragonScene() {
  const P = {}; const neck = []; const stacks = []; let glints = []; let awake = false; let flying = false; let jet; let jetLight; let wingT = 0; let trailT = 0; let mouthGlow;
  const sooted = new Set();

  function buildDragon(stage) {
    const d = new THREE.Group();
    const green = mat(0x46a85f, { flatShading: true }); const dark = mat(0x2f7d49, { flatShading: true }); const belly = mat(0xe3cf7a, { flatShading: true }); const horn = mat(0xf2ead0);
    const body = mesh(new THREE.IcosahedronGeometry(1, 2), 0, { m: green, pos: [10, 4.2, -2.5] }); body.scale.set(4.3, 2.4, 3.1);
    const tum = mesh(new THREE.IcosahedronGeometry(1, 2), 0, { m: belly, pos: [9.6, 3.5, -1.6] }); tum.scale.set(3.7, 1.9, 2.6);
    d.add(body, tum);
    for (let i = 0; i < 7; i++) d.add(mesh(new THREE.ConeGeometry(0.42, 1.1, 5), 0, { m: dark, pos: [7.4 + i * 0.95, 6.35 - Math.abs(i - 3) * 0.13, -2.5] }));
    // tail: curls round the front of the hoard
    for (let i = 0; i < 10; i++) { const t = i / 9; const a = -0.3 + t * 2.5; const r = 1.25 - t * 0.95; const s = mesh(new THREE.IcosahedronGeometry(r, 1), 0, { m: green, pos: [12.3 + Math.cos(a) * 3.2 - t * 1.5, 3.4 - t * 2.9, -1.2 + Math.sin(a) * 4.0] }); d.add(s); if (i === 9) d.add(mesh(new THREE.ConeGeometry(0.5, 1.2, 4), 0, { m: dark, pos: [s.position.x - 0.6, 0.6, s.position.z + 0.3], rot: [0, 0, 70] })); }
    for (const [x, z] of [[6.6, 0.9], [8.2, 1.5]]) { d.add(mesh(new THREE.IcosahedronGeometry(0.75, 1), 0, { m: green, pos: [x, 1.7, z] })); for (let c = 0; c < 3; c++) d.add(mesh(new THREE.ConeGeometry(0.12, 0.4, 5), 0, { m: horn, pos: [x - 0.6, 1.45, z - 0.3 + c * 0.3], rot: [0, 0, 100] })); }
    for (let i = 0; i < 5; i++) { const n = mesh(new THREE.IcosahedronGeometry(1.2 - i * 0.09, 1), 0, { m: green }); neck.push(n); d.add(n); }
    // wings (folded along the back until it wakes)
    P.wings = [-1, 1].map((s) => {
      const w = new THREE.Group(); w.position.set(9.2, 6.0, -2.5 + s * 1.4);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.5, 4.8); sh.lineTo(3.2, 2.6); sh.lineTo(4.6, 3.6); sh.lineTo(5.4, 1.2); sh.lineTo(6.2, 1.8); sh.lineTo(5.6, -0.4); sh.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xd9813a, side: THREE.DoubleSide, roughness: 0.9, flatShading: true })); m.castShadow = true;
      const arm = mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.2, 6), 0, { m: dark, pos: [0.75, 2.4, 0], rot: [0, 0, -17] });
      const inner = new THREE.Group(); inner.add(m, arm); inner.rotation.y = s > 0 ? 0 : 0; w.add(inner); w.userData = { s };
      d.add(w); return w;
    });
    // head (snout along local -X)
    const h = new THREE.Group();
    const blob = (m, sx, sy, sz, pos, det = 2) => { const o = mesh(new THREE.IcosahedronGeometry(1, det), 0, { m, pos }); o.scale.set(sx, sy, sz); return o; };
    h.add(blob(green, 1.3, 1.0, 1.15, [0.45, 0.3, 0]));
    h.add(blob(green, 1.35, 0.66, 0.9, [-1.25, 0.1, 0]));
    for (const z of [-0.42, 0.42]) h.add(blob(green, 0.36, 0.3, 0.34, [-2.2, 0.42, z], 1));
    P.jaw = new THREE.Group(); P.jaw.position.set(0.3, -0.42, 0); P.jaw.add(blob(belly, 1.5, 0.27, 0.82, [-1.35, -0.1, 0]));
    for (const z of [-0.55, 0.55]) for (let i = 0; i < 4; i++) P.jaw.add(mesh(new THREE.ConeGeometry(0.1, 0.32, 5), 0, { m: horn, pos: [-2.5 + i * 0.5, 0.2, z * (0.7 + i * 0.1)] }));
    h.add(P.jaw);
    P.nostrils = [-0.42, 0.42].map((z) => { const n = mesh(new THREE.SphereGeometry(0.15, 10, 8), 0x1d3a26, { pos: [-2.42, 0.56, z], cast: false }); h.add(n); return n; });
    for (const z of [-0.7, 0.7]) { h.add(mesh(new THREE.ConeGeometry(0.28, 1.5, 6), 0, { m: horn, pos: [1.4, 1.35, z], rot: [0, 0, -38] })); h.add(mesh(new THREE.ConeGeometry(0.3, 0.9, 4), 0, { m: dark, pos: [1.2, 0.5, z * 1.75], rot: [z > 0 ? 60 : -60, 0, -30] })); }
    P.eyes = [-1, 1].map((s) => {
      const e = new THREE.Group(); e.position.set(0.25, 0.78, s * 0.74);
      e.add(blob(green, 0.56, 0.5, 0.52, [0, 0, 0])); // the lid
      const ball = new THREE.Group(); const iris = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), new THREE.MeshBasicMaterial({ color: 0xffd21f })); iris.position.z = s * 0.2;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); pupil.scale.set(0.42, 1.6, 0.5); pupil.position.z = s * 0.56;
      ball.add(iris, pupil); ball.scale.y = 0.001; ball.visible = false; e.add(ball); e.userData.ball = ball;
      const lash = mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 14, Math.PI), 0x16301f, { cast: false }); lash.rotation.z = Math.PI; lash.position.set(0, 0.12, s * 0.49); lash.scale.z = 0.5; e.add(lash); e.userData.lash = lash;
      h.add(e);
      return e;
    });
    mouthGlow = new THREE.PointLight(0xff7a20, 0, 14, 1.5); mouthGlow.position.set(-2.4, 0, 0); h.add(mouthGlow);
    // fire breath: an additive cone out of the mouth along -X
    jet = new THREE.Group(); jet.position.set(-2.6, -0.2, 0); jet.visible = false;
    const cone = (r, len, color, op) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.z = -Math.PI / 2; m.position.x = -len / 2; return m; };
    jet.add(cone(2.6, 10, 0xff5a10, 0.75), cone(1.6, 8.5, 0xffb020, 0.85), cone(0.8, 7, 0xfff0a0, 0.9));
    jetLight = new THREE.PointLight(0xff7a20, 0, 40, 1.2); jetLight.position.set(-4, 0.5, 0); jet.add(jetLight);
    h.add(jet);
    const crown = stage._builtin('crown'); crown.scale.setScalar(1.7); crown.position.set(0.7, 1.12, 0); crown.rotation.z = 0.12; h.add(crown); stage.props.set('crown', crown);
    h.position.set(...HEAD_SLEEP.p); h.rotation.set(...HEAD_SLEEP.r); d.add(h); P.head = h; P.dragon = d; P.body = body;
    return d;
  }
  const setWings = (k, flap = 0) => P.wings.forEach((w) => { const s = w.userData.s; w.rotation.set(s * (1.35 - k * 1.0 + flap * 0.5), 0, 0); w.rotation.z = -0.9 + k * 0.5; });
  function headTo(stage, to, dur, ease = 'inOut') {
    const p0 = P.head.position.clone(); const r0 = P.head.rotation.clone(); const p1 = new THREE.Vector3(...to.p);
    stage.tween({ dur, ease, owner: P.head, key: 'head', update: (k) => { P.head.position.lerpVectors(p0, p1, k); P.head.rotation.set(r0.x + (to.r[0] - r0.x) * k, r0.y + (to.r[1] - r0.y) * k, r0.z + (to.r[2] - r0.z) * k); } });
  }
  const eyes = (stage, open, dur) => P.eyes.forEach((e) => { const b = e.userData.ball; const a = b.scale.y; const z = open ? 1 : 0.001; b.visible = true; e.userData.lash.visible = !open; stage.tween({ dur, ease: 'out', owner: b, key: 'lid', update: (k) => { b.scale.y = a + (z - a) * k; if (k >= 1 && !open) b.visible = false; } }); });
  const sfx = (stage, name, v) => { if (!stage.silent && stage.audio) stage.audio.sfx(name, v); };
  function fire(stage, dur) {
    jet.visible = true; sfx(stage, 'fwoosh');
    stage.tween({ dur, ease: 'linear', owner: jet, key: 'jet', update: (k) => {
      const grow = Math.min(1, k * 5); const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      jet.scale.set(grow, 0.7 + Math.sin(k * 40) * 0.12, 0.7 + Math.cos(k * 33) * 0.12); jet.children.forEach((c) => { if (c.material) c.material.opacity = 0.85 * fade; }); jetLight.intensity = 400 * fade;
      const p = new THREE.Vector3(-2 - grow * 7 * ((k * 7) % 1), 0, 0); P.head.localToWorld(p); stage.fx.burst(k < 0.75 ? 'firePuff' : 'smoke', p, 3, 1.5);
      if (k >= 1) { jet.visible = false; jetLight.intensity = 0; }
    } });
  }

  return {
    name: 'dragon', music: 'dragon', center: [2, 0, 1], forward: 90, wideDist: 19, wideHeight: 6.5, wideAngle: -6,
    bg: 0x0a0706, fog: { color: 0x120b08, near: 30, far: 80 },
    hemi: { sky: 0xb89468, ground: 0x33200f, i: 1.5 }, sun: { color: 0x9fc4ff, i: 1.5, pos: [-16, 14, 10] },
    marks: {
      spawn: [-21, 3], start: [-11, 3], mid: [-1.6, 2.8], goal: [1.4, 2.2], spot: [1.4, 2.2], out: [-11, 3], nose: [1.15, 3.3], petSpot: [2.7, 1.0], coins: [-3.4, 4.4],
      eye: [5.1, 2.1, 2.0], snout: [2.3, 1.7, 2.6], maw: [2.2, 1.3, 2.7], back: [7.9, 6.25, -0.9], climb: [7.2, 0, 3.4], heroSpot: [1.3, 4.2], head: [4.8, 2.4, 1.3],
    },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'dungeon:coin_stack_large', 'dungeon:coin_stack_medium', 'dungeon:coin_stack_small', 'dungeon:chest_gold', 'dungeon:trunk_large_A', 'dungeon:sword_shield_gold', 'hex:rock_single_A', 'hex:rock_single_B', 'hex:rock_single_D'],
    props: {
      fireball(stage) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshBasicMaterial({ color: 0xff6a10 })));
        g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), new THREE.MeshBasicMaterial({ color: 0xffe07a })));
        const l = new THREE.PointLight(0xff7a20, 260, 30, 1.3); g.add(l); g.userData.fireball = true;
        return g;
      },
    },
    build(stage) {
      const g = new THREE.Group();
      g.add(ground(0x3a2a1e, 100));
      const r = seeded(404);
      // cave shell: a ring of rock teeth, stalactites, and the mouth of the cave on the left
      const rock = mat(0x4a392b, { flatShading: true }); const rock2 = mat(0x38291f, { flatShading: true });
      for (let i = 0; i < 34; i++) { const a = (i / 34) * Math.PI * 2; if (Math.cos(a) < -0.9 && Math.abs(Math.sin(a)) < 0.3) continue; if (Math.sin(a) > 0.45) continue; const R = 27 + r.next() * 8; g.add(mesh(new THREE.ConeGeometry(4 + r.next() * 4, 14 + r.next() * 12, 6), 0, { m: i % 2 ? rock : rock2, pos: [2 + Math.cos(a) * R, 5, Math.sin(a) * R * 0.75 - 3] })); }
      for (let i = 0; i < 26; i++) g.add(mesh(new THREE.ConeGeometry(0.6 + r.next() * 1.2, 3 + r.next() * 6, 5), 0, { m: rock2, pos: [-22 + r.next() * 46, 17 - r.next() * 2, -16 + r.next() * 22], rot: [180, 0, 0], cast: false }));
      for (let i = 0; i < 12; i++) { const m = put(stage, ['hex:rock_single_A', 'hex:rock_single_B', 'hex:rock_single_D'][i % 3], { pos: [-20 + r.next() * 30, 0, -7 - r.next() * 5], rot: r.next() * 360, scale: 3 + r.next() * 4 }); if (m) g.add(m); }
      const day = new THREE.Mesh(new THREE.CircleGeometry(7.5, 20), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, fog: false })); day.position.set(-30, 4, 2); day.rotation.y = Math.PI / 2; day.scale.y = 1.2; day.userData.dim = true; g.add(day);
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(6.5, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shaft.position.set(9, 13, -2); g.add(shaft);
      // the hoard
      const gold = mat(0xf2b82a, { metalness: 0.45, roughness: 0.35, emissive: 0x3a2500, flatShading: true });
      const heap = mesh(new THREE.IcosahedronGeometry(1, 3), 0, { m: gold, pos: [10.5, -0.6, -2.6] }); heap.scale.set(9.5, 3.6, 7.2); g.add(heap);
      for (const [x, z, s] of [[2.5, -3.5, 2.2], [-2.5, -2.2, 1.5], [-6, 6.4, 1.3], [4.5, 6.2, 1.8], [-9.5, -1.8, 1.2], [0.5, 6.8, 1.0]]) { const m = mesh(new THREE.IcosahedronGeometry(1, 2), 0, { m: gold, pos: [x, -0.25 * s, z] }); m.scale.set(s * 1.6, s * 0.75, s * 1.4); g.add(m); }
      for (let i = 0; i < 30; i++) {
        const x = -13 + r.next() * 18; const z = -3.5 + r.next() * 10.5; if ((z > 1.6 && z < 4.2) || (x > -3 && x < 5 && z > 1.2)) continue; // keep the team's lane clear
        const m = put(stage, ['dungeon:coin_stack_large', 'dungeon:coin_stack_medium', 'dungeon:coin_stack_small'][i % 3], { pos: [x, 0, z], rot: r.next() * 360, scale: 1.1 + r.next() * 0.5 }); if (m) { g.add(m); stacks.push(m); }
      }
      for (const [n, x, z, rot, s] of [['dungeon:chest_gold', -4.5, -1.6, 30, 1.4], ['dungeon:chest_gold', 7.2, 6.0, 200, 1.3], ['dungeon:trunk_large_A', -8.5, -3.6, 20, 1.2], ['dungeon:sword_shield_gold', 0.6, -2.4, 0, 1.6]]) { const m = put(stage, n, { pos: [x, 0, z], rot, scale: s }); if (m) g.add(m); }
      const warm = new THREE.PointLight(0xffa850, 260, 50, 1.3); warm.position.set(2, 7, 7); g.add(warm);
      const pool = glowDisc(12, 0xffb040, 0.2); pool.position.set(1, 0.05, 2.5); g.add(pool);
      for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.fx.tex, color: 0xfff2b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(-10 + r.next() * 26, 0.4 + r.next() * 2.6, -4 + r.next() * 10); s.userData.p = r.next() * 10; glints.push(s); g.add(s); }
      g.add(buildDragon(stage)); setWings(0);
      return g;
    },
    update(dt, stage) {
      const t = stage.time;
      if (!awake) { const br = Math.sin(t * 1.5); P.body.scale.set(4.3, 2.4 + br * 0.07, 3.1 + br * 0.05); if (!stage.tweens.some((w) => w.owner === P.head)) P.head.position.y = HEAD_SLEEP.p[1] + br * 0.035; }
      if (flying) { wingT += dt; setWings(1, Math.sin(wingT * 9)); }
      // the neck is a chain of blobs strung between the shoulders and wherever the head is
      const hp = P.head.position;
      neck.forEach((n, i) => { const k = (i + 0.6) / (neck.length + 0.4); n.position.lerpVectors(NECK_ROOT, hp, k); n.position.y += Math.sin(k * Math.PI) * 0.45; n.position.x += (1 - k) * 0.4; });
      for (const s of glints) { const k = Math.max(0, Math.sin(t * 1.3 + s.userData.p)) ** 12; s.scale.setScalar(0.1 + k * 0.7); s.material.opacity = k; }
      const fb = stage.props.get('fb');
      if (fb && fb.visible) { fb.rotation.z += dt * 9; trailT += dt; if (trailT > 0.04) { trailT = 0; stage.fx.burst('firePuff', fb.position, 2, 1.3); stage.fx.burst('embers', fb.position, 2, 1.2); } }
    },
    rigs: {
      dragon: {
        openEye(stage, { dur }) { eyes(stage, true, dur); },
        closeEye(stage, { dur }) { eyes(stage, false, dur); },
        /** Lid flickers but stays shut (the moment). */
        twitch(stage, { dur }) { P.eyes.forEach((e) => { const b = e.userData.ball; stage.tween({ dur, ease: 'linear', owner: b, key: 'lid', update: (k) => { b.visible = k < 1; b.scale.y = 0.001 + Math.max(0, Math.sin(k * Math.PI * 3)) * 0.16 * (1 - k); } }); }); },
        /** Nostrils flare, a wisp of smoke. */
        sniff(stage, { dur }) {
          P.nostrils.forEach((n) => stage.tween({ dur, ease: 'linear', owner: n, key: 'sniff', update: (k) => { n.scale.setScalar(1 + Math.sin(k * Math.PI * 4) ** 2 * 0.7 * (1 - k)); } }));
          stage.tween({ dur, ease: 'linear', owner: P.head, key: 'wig', update: (k) => { P.head.rotation.x = Math.sin(k * 30) * 0.03 * (1 - k); } });
          stage.fx.burst('smoke', stage.pos('snout'), 4, 0.6);
        },
        purr(stage, { dur }) { stage.tween({ dur, ease: 'linear', owner: P.head, key: 'wig', update: (k) => { P.head.rotation.x = Math.sin(k * dur * 38) * 0.035 * Math.sin(k * Math.PI); P.head.position.y = HEAD_SLEEP.p[1] + Math.sin(k * Math.PI) * 0.18; } }); },
        /** Head rears back for a sneeze (hold it there with slow-mo, then call `sneeze`). */
        inhale(stage, { dur }) { headTo(stage, { p: [5.2, 3.2, 1.4], r: [0, 0.45, -0.75] }, dur, 'out'); P.nostrils.forEach((n) => stage.tween({ dur, owner: n, key: 'sniff', update: (k) => n.scale.setScalar(1 + k * 0.9) })); },
        /** ACHOO: head snaps forward, fire everywhere. */
        sneeze(stage, { dur }) {
          headTo(stage, { p: [4.2, 1.7, 1.6], r: [0, 0.2, 0.1] }, 0.12, 'in'); sfx(stage, 'sneeze');
          stage.tween({ dur: 0.001, delay: 0.1, owner: jet, key: 'go', update: () => {}, done: () => { fire(stage, dur); P.jaw.rotation.z = 0.5; } });
          stage.tween({ dur: 0.3, delay: 0.1 + dur, owner: P.jaw, key: 'jaw', update: (k) => { P.jaw.rotation.z = 0.5 * (1 - k); } });
          P.nostrils.forEach((n) => n.scale.setScalar(1));
        },
        /** Eyes open, head comes up, wings out, jaw drops: the dragon is AWAKE. Safe to call twice. */
        roar(stage, { dur }) {
          if (!awake) { awake = true; eyes(stage, true, 0.12); if (!flying) headTo(stage, HEAD_UP, dur, 'back'); stage.tween({ dur, ease: 'back', owner: P.wings, key: 'wings', update: (k) => { if (!flying) setWings(k); } }); }
          stage.tween({ dur: 0.9, ease: 'linear', owner: P.jaw, key: 'jaw', update: (k) => { P.jaw.rotation.z = Math.sin(k * Math.PI) * 0.6; mouthGlow.intensity = Math.sin(k * Math.PI) * 120; } });
        },
        /** Takes off (carrying `who`, if given) and hovers over the hoard. */
        fly(stage, { dur, who }) {
          awake = true; flying = true; eyes(stage, true, 0.1); headTo(stage, { p: [5.2, 5.2, 1.6], r: [0, 0.2, -0.2] }, 0.4);
          if (who) for (const o of stage.objs(who)) if (o.actor) { stage.stopMotion(o.actor); P.dragon.attach(o.actor.root); }
          const d = P.dragon;
          stage.tween({ dur, ease: 'inOut', owner: d, key: 'fly', update: (k) => { d.position.set(-k * 5.5, k * 6.5, k * 1.5); d.rotation.z = Math.sin(k * Math.PI) * 0.12; } });
          stage.tween({ dur: 30, delay: dur, ease: 'linear', owner: d, key: 'fly', update: (k) => { d.position.y = 6.5 + Math.sin(k * 30 * 2.2) * 0.5; } });
          stage.fx.burst('dust', new THREE.Vector3(8, 0.3, 2), 30, 2.4); stage.fx.burst('coinBurst', new THREE.Vector3(7, 1, 1), 26, 1.4);
        },
        /** A stack of coins goes over (same in every outcome). */
        topple(stage, { dur }) {
          const s = stacks.reduce((best, m) => (Math.hypot(m.position.x + 3.4, m.position.z - 4.6) < Math.hypot(best.position.x + 3.4, best.position.z - 4.6) ? m : best), stacks[0]);
          stage.tween({ dur, ease: 'bounce', owner: s, key: 'top', update: (k) => { s.rotation.z = k * 1.45; } });
          stage.fx.burst('coinBurst', s.position.clone().setY(0.6), 14, 1);
        },
        /** Charcoal: `who` comes out of the fire black from head to toe. */
        soot(stage, { who = 'team:all' }) {
          for (const o of stage.objs(who)) { if (!o.actor || sooted.has(o.actor)) continue; sooted.add(o.actor); o.actor.model.traverse((m) => { if (m.isMesh) for (const mm of [].concat(m.material)) if (mm.color) mm.color.multiplyScalar(0.12); }); stage.fx.burst('soot', o.obj.getWorldPosition(new THREE.Vector3()).setY(o.obj.position.y + 1.2), 5, 1); }
        },
      },
    },
  };
}
