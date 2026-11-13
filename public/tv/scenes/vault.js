// Quest 3: The Vault. The usurper's treasury: a torch-lit hall running along +X to an enormous round vault door
// set in the right-hand wall (x~12.4, facing -X). Guards g1/g2 wait off-stage (hidden), g3 is on his break inside.
import * as THREE from 'three';
import { box, cyl, flame, flicker, glowDisc, mat, mesh, put } from './kit.js';
import { makeSign } from '../engine/bubbles.js';

const DOOR_X = 12.35; const R = 3.2;

export function vaultScene() {
  const torches = []; let alarm; let alarmOn = false; let glow; let goldBack;
  let fallPivot; let door; let wheel; let leverArm; let gate; let glowPool;

  function buildDoor() {
    fallPivot = new THREE.Group(); fallPivot.position.set(DOOR_X, 0.02, 0);
    door = new THREE.Group(); door.position.set(0, R + 0.1, 0); fallPivot.add(door);
    const steel = mat(0x8d919c, { metalness: 0.75, roughness: 0.38 }); const dark = mat(0x4b4e58, { metalness: 0.7, roughness: 0.5 }); const brass = mat(0xc79a2e, { metalness: 0.85, roughness: 0.3 });
    door.add(mesh(new THREE.CylinderGeometry(R, R, 0.6, 48), 0, { m: steel, rot: [0, 0, 90] }));
    door.add(mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, 0.72, 48), 0, { m: dark, rot: [0, 0, 90] }));
    door.add(mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.84, 40), 0, { m: steel, rot: [0, 0, 90] }));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; door.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 10), 0, { m: brass, rot: [0, 0, 90], pos: [-0.36, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9] })); }
    wheel = new THREE.Group(); wheel.position.x = -0.62;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.11, 10, 28), brass); rim.rotation.y = Math.PI / 2; rim.castShadow = true; wheel.add(rim);
    for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), 0, { m: brass }); sp.rotation.x = (i / 3) * Math.PI; wheel.add(sp); }
    wheel.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 14), 0, { m: brass, rot: [0, 0, 90], pos: [0.15, 0, 0] }));
    door.add(wheel);
    return fallPivot;
  }

  return {
    name: 'vault', music: 'vault', center: [2, 0, 0], forward: 90, wideDist: 17, wideHeight: 6.5, wideAngle: -18,
    bg: 0x0e0b0a, fog: { color: 0x0e0b0a, near: 30, far: 70 },
    hemi: { sky: 0x8d7a66, ground: 0x2a1e16, i: 1.35 }, sun: { color: 0xffd9a8, i: 1.2, pos: [-4, 16, 12] },
    marks: {
      spawn: [-19, 1], start: [-9, 1], mid: [6.2, 1], goal: [10, 1], spot: [8, 1], door: [12, 0], pick: [10.7, -1.1], knock: [10.8, 1.0],
      crowd: [9.3, 0.3], side: [11.3, 4.0], lever: [4.4, -4.9], noteSpot: [11.7, 4.7], gate: [-12.5, 1.2], guardA: [10.3, 6.0], guardB: [8.9, 6.3], inside: [14.0, 0],
    },
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'skeleton_warrior', 'skeleton_minion', 'skprop:Skeleton_Blade', 'skprop:Skeleton_Shield_Large_A', 'prop:mug_full',
      'dungeon:floor_tile_large', 'dungeon:wall', 'dungeon:wall_arched', 'dungeon:wall_doorway', 'dungeon:torch_mounted', 'dungeon:pillar_decorated', 'dungeon:banner_red', 'dungeon:banner_yellow', 'dungeon:chest_gold', 'dungeon:coin_stack_large', 'dungeon:coin_stack_medium',
      'dungeon:barrel_large', 'dungeon:crates_stacked', 'dungeon:box_stacked', 'dungeon:keg_decorated', 'dungeon:sword_shield_gold', 'dungeon:trunk_large_A'],
    build(stage) {
      const g = new THREE.Group();
      const add = (name, o) => { const m = put(stage, name, o); if (m) g.add(m); return m; };
      for (let x = -6; x <= 4; x++) for (let z = -2; z <= 2; z++) add('dungeon:floor_tile_large', { pos: [x * 4, 0, z * 4] });
      g.add(box(60, 0.3, 30, 0x2a2420, { pos: [-2, -0.2, 0], cast: false }));
      g.add(box(27, 0.05, 2.6, 0x8f1f2c, { pos: [-2.5, 0.04, 0.6], cast: false })); // carpet to the door
      g.add(box(27, 0.045, 3.0, 0xc79a2e, { pos: [-2.5, 0.03, 0.6], cast: false }));
      // back wall + dressing
      for (let x = -6; x <= 3; x++) { add(x % 3 === 0 ? 'dungeon:wall_arched' : 'dungeon:wall', { pos: [x * 4, 0, -7] }); add('dungeon:wall', { pos: [x * 4, 4, -7] }); }
      for (const x of [-14, -6, 2, 9]) add('dungeon:pillar_decorated', { pos: [x, 0, -6], scale: 1.25 });
      [[-10, 'red'], [-2, 'yellow'], [6, 'red']].forEach(([x, c]) => add(`dungeon:banner_${c}`, { pos: [x, 2.6, -6.4], scale: 1.6 }));
      for (const [x, z] of [[-10, -6.1], [-2, -6.1], [6.6, -6.1]]) {
        add('dungeon:torch_mounted', { pos: [x, 2.3, z], scale: 1.5 });
        const f = flame(); f.scale.setScalar(0.5); f.position.set(x, 3.1, z + 0.55); f.userData.light.intensity = 34; f.userData.light.distance = 22; torches.push(f); g.add(f);
      }
      add('dungeon:barrel_large', { pos: [-5, 0, -5.2] }); add('dungeon:crates_stacked', { pos: [-7.4, 0, -5.3], rot: 20 }); add('dungeon:keg_decorated', { pos: [9.6, 0, -5.4], rot: -20 });
      add('dungeon:box_stacked', { pos: [-17, 0, -5.2], rot: 10 }); add('dungeon:trunk_large_A', { pos: [0.2, 0, -5.4], rot: 8 }); add('dungeon:sword_shield_gold', { pos: [-14, 2.6, -6.6], scale: 1.5 });
      // vault wall with a round opening, and the treasure chamber behind it
      const wallM = mat(0x3a3430);
      g.add(box(2, 9, 5, 0, { m: wallM, pos: [13.9, 4.5, -5.6] })); g.add(box(2, 9, 5, 0, { m: wallM, pos: [13.9, 4.5, 5.6] })); g.add(box(2, 2.6, 6.4, 0, { m: wallM, pos: [13.9, 7.7, 0] }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R + 1.6, 48), mat(0x57504a, { metalness: 0.4, roughness: 0.6 })); ring.rotation.y = -Math.PI / 2; ring.position.set(12.88, R + 0.1, 0); g.add(ring);
      g.add(box(7, 0.3, 8, 0x5a4a20, { pos: [16.4, -0.05, 0] }));
      goldBack = new THREE.Mesh(new THREE.PlaneGeometry(13, 10), new THREE.MeshBasicMaterial({ color: 0x1a1408 })); goldBack.rotation.y = -Math.PI / 2; goldBack.position.set(15.9, 4, 0); g.add(goldBack);
      const gold = mat(0xf0b92b, { metalness: 0.75, roughness: 0.3, emissive: 0x4a3200 });
      g.add(mesh(new THREE.ConeGeometry(2.6, 2.6, 14), 0, { m: gold, pos: [15.4, 1.3, -1.7] })); g.add(mesh(new THREE.ConeGeometry(2.0, 1.9, 14), 0, { m: gold, pos: [15.2, 0.95, 2.0] }));
      add('dungeon:chest_gold', { pos: [14.2, 0, -2.0], rot: -60, scale: 1.3 }); add('dungeon:coin_stack_large', { pos: [13.9, 0, 2.2] }); add('dungeon:coin_stack_medium', { pos: [14.3, 0, 1.2] });
      glow = new THREE.PointLight(0xffd36a, 0, 30, 1.3); glow.position.set(14.5, 3.4, 0); g.add(glow);
      glowPool = glowDisc(5, 0xffd36a, 0); glowPool.position.set(9.5, 0.07, 0.3); g.add(glowPool);
      g.add(buildDoor());
      // the lever nobody should pull
      const lv = new THREE.Group(); lv.position.set(4.4, 0, -6.35);
      lv.add(box(0.9, 1.3, 0.3, 0x3d3a40, { pos: [0, 1.5, 0] }));
      leverArm = new THREE.Group(); leverArm.position.set(0, 1.5, 0.2); leverArm.rotation.x = -0.9;
      leverArm.add(cyl(0.06, 0.06, 1.1, 0x9a9da6, { pos: [0, 0.55, 0] }, 8)); leverArm.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), 0xd8262c, { pos: [0, 1.15, 0] })); lv.add(leverArm);
      const sign = makeSign('DO NOT\nPULL', { w: 1.9, h: 1.1 }); sign.position.set(0, 3.1, 0.05); lv.add(sign);
      lv.add(box(2.1, 1.3, 0.08, 0x5a1a10, { pos: [0, 3.1, 0] }));
      g.add(lv);
      // the front gate, far left
      g.add(box(1.4, 9, 6, 0, { m: wallM, pos: [-19, 4.5, -5] })); g.add(box(1.4, 9, 6, 0, { m: wallM, pos: [-19, 4.5, 7] })); g.add(box(1.4, 3.5, 6, 0, { m: wallM, pos: [-19, 7.25, 1] }));
      const day = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.5), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); day.rotation.y = Math.PI / 2; day.position.set(-19.6, 2.75, 1); day.userData.dim = true; g.add(day);
      gate = new THREE.Group(); gate.position.set(-18.4, 6, 1);
      for (let i = 0; i < 7; i++) gate.add(box(0.14, 5.6, 0.14, 0x2c2c30, { pos: [0, 0, -2.7 + i * 0.9] }));
      for (let j = 0; j < 4; j++) gate.add(box(0.14, 0.14, 5.6, 0x2c2c30, { pos: [0, -2.2 + j * 1.45, 0] }));
      g.add(gate);
      alarm = new THREE.PointLight(0xff2020, 0, 60, 1.2); alarm.position.set(0, 7, 3); g.add(alarm);
      // cast: two door guards waiting off-stage, one on his break inside the vault
      [['g1', 'skeleton_warrior', [-24, 5.2], 1.15, 'skprop:Skeleton_Blade'], ['g2', 'skeleton_warrior', [-26, 6], 1.1, 'skprop:Skeleton_Shield_Large_A'], ['g3', 'skeleton_minion', [14.0, 0.3], 1, 'prop:mug_full']].forEach(([id, kind, at, scale, held]) => {
        const a = stage.addActor({ id, kind, name: id, at: [at[0], 0, at[1]], yaw: id === 'g3' ? -90 : 90, banner: false, scale });
        const item = stage.assets.instance(held); const hand = stage.findBone(a, id === 'g2' ? 'handslot.l' : 'handslot.r'); if (item && hand) hand.add(item);
        if (id !== 'g3') a.setHidden(true);
      });
      return g;
    },
    update(dt, stage) {
      torches.forEach((f, i) => flicker(f, stage.time + i * 1.7, 34));
      if (alarmOn) alarm.intensity = 150 * (0.5 + 0.5 * Math.sin(stage.time * 13));
    },
    rigs: {
      vault: {
        /** One tumbler: the wheel turns a notch. */
        tumble(stage, { dur, turns = 0.18 }) { const a0 = wheel.rotation.x; stage.tween({ dur, ease: 'back', owner: wheel, key: 'turn', update: (k) => { wheel.rotation.x = a0 + k * turns * Math.PI * 2; } }); },
        spin(stage, { dur }) { const a0 = wheel.rotation.x; stage.tween({ dur, ease: 'out', owner: wheel, key: 'turn', update: (k) => { wheel.rotation.x = a0 + k * Math.PI * 5; } }); },
        /** The door rolls aside along the wall; gold light floods out (glow:false keeps it dark). */
        open(stage, { dur, glow: lit = true }) {
          stage.tween({ dur, ease: 'inOut', owner: door, key: 'roll', update: (k) => { door.position.z = -k * 6.7; door.position.x = -Math.sin(Math.min(1, k * 4) * Math.PI / 2) * 0.45; door.rotation.x = k * (6.7 / R); } });
          if (lit) stage.tween({ dur: dur * 1.2, ease: 'out', owner: glow, key: 'glow', update: (k) => { glow.intensity = k * 260; glowPool.material.opacity = k * 0.55; goldBack.material.color.setRGB(1.0 * k + 0.1, 0.78 * k + 0.08, 0.3 * k + 0.03); } });
        },
        /** The whole door topples outward like a drawbridge and flattens whoever is in front of it. */
        fall(stage, { dur }) {
          stage.tween({ dur, ease: 'in', owner: fallPivot, key: 'fall', update: (k) => { fallPivot.rotation.z = k * (Math.PI / 2 - 0.03); } });
          stage.tween({ dur: 0.4, delay: dur, owner: glow, key: 'glow', update: (k) => { glow.intensity = k * 220; glowPool.material.opacity = k * 0.4; goldBack.material.color.setRGB(k + 0.1, 0.78 * k + 0.08, 0.3 * k + 0.03); } });
        },
        rise(stage, { dur }) { const a0 = fallPivot.rotation.z; stage.tween({ dur, ease: 'inOut', owner: fallPivot, key: 'fall', update: (k) => { fallPivot.rotation.z = a0 * (1 - k); } }); },
        pull(stage, { dur }) { stage.tween({ dur, ease: 'bounce', owner: leverArm, key: 'pull', update: (k) => { leverArm.rotation.x = -0.9 + k * 2.3; } }); },
        alarm() { alarmOn = true; },
        /** The portcullis slams down behind the evicted team. */
        gate(stage, { dur }) { stage.tween({ dur, ease: 'bounce', owner: gate, key: 'gate', update: (k) => { gate.position.y = 6 - k * 3.2; } }); },
      },
    },
  };
}
