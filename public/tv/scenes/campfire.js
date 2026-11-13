// Campfire: lobby / propose / vote backdrop, plus the night variant for the assassination.
import * as THREE from 'three';
import { box, cyl, flame, flicker, ground, put, scatter } from './kit.js';

export const SEAT_RADIUS = 4.4;
export const RING_RADIUS = 7.2;

/** Seats around the fire for n players: evenly spaced, facing the fire (yaw in degrees). */
export function seatSlots(n, radius = SEAT_RADIUS) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.PI; // first seat at the front (toward camera = +z)
    const x = Math.sin(a) * radius; const z = -Math.cos(a) * radius;
    return { x, z, yaw: (Math.atan2(-x, -z) * 180) / Math.PI };
  });
}

// keep the corridor between the camera (+z) and the seats clear of scenery
const clearFront = (x, z) => z > 2 && Math.abs(x) < 11;

export function campfireScene({ night = false } = {}) {
  let fire; let embers;
  return {
    name: night ? 'night' : 'campfire', music: night ? 'night' : 'camp', center: [0, 0, 0], forward: 90,
    bg: night ? 0x070912 : 0x1b2440, fog: { color: night ? 0x070912 : 0x1b2440, near: 30, far: 80 },
    hemi: night ? { sky: 0x30406a, ground: 0x0c0a08, i: 0.9 } : { sky: 0x6f86c4, ground: 0x2a2018, i: 1.25 },
    sun: night ? { color: 0x7d94ff, i: 0.7, pos: [-10, 18, 8] } : { color: 0xb8c4ff, i: 1.0, pos: [-10, 18, 8] },
    marks: { start: [-4, 0], mid: [0, 0], goal: [4, 0], spot: [0, 0] },
    wideDist: 15, wideHeight: 13, wideAngle: 0,
    preload: ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_B_medium', 'hex:rock_single_A', 'hex:rock_single_B', 'hex:tent', 'hex:flag_red', 'prop:arrow'],
    seats: seatSlots,
    build(stage) {
      const g = new THREE.Group();
      g.add(ground(night ? 0x16301c : 0x2f5d34, 90));
      // stone ring + logs
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(cyl(0.35, 0.4, 0.5, 0x777770, { pos: [Math.cos(a) * 1.5, 0.25, Math.sin(a) * 1.5] }, 7)); }
      for (let i = 0; i < 3; i++) g.add(box(1.8, 0.28, 0.28, 0x5a3b22, { pos: [0, 0.2 + i * 0.05, 0], rot: [0, i * 60, 0] }));
      fire = flame(); g.add(fire);
      // glowing ground disc
      const glow = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: night ? 0.07 : 0.12, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; g.add(glow);
      scatter(stage, g, ['hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_B_medium'], 38, { inner: 15, outer: 46, scale: [2.6, 4.2], seed: night ? 3 : 11, avoid: clearFront });
      scatter(stage, g, ['hex:rock_single_A', 'hex:rock_single_B'], 14, { inner: 10, outer: 24, scale: [2, 4], seed: 5, avoid: clearFront });
      for (const [x, z, r] of [[-12, -8, 30], [13, -9, -20]]) { const t = put(stage, 'hex:tent', { pos: [x, 0, z], rot: r, scale: 3.5 }); if (t) g.add(t); }
      embers = [];
      return g;
    },
    update(dt, stage) { if (fire) flicker(fire, stage.time, night ? 28 : 40); },
    rigs: {
      fire: { low(stage) { if (fire) fire.scale.setScalar(0.5); }, high(stage) { if (fire) fire.scale.setScalar(1.15); } },
    },
  };
}
