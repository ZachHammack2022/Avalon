// Helpers for building scene environments.
import * as THREE from 'three';
import { seeded } from '/shared/rng.js';

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });

export function mesh(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], cast = true, receive = true, m } = {}) {
  const x = new THREE.Mesh(geo, m || mat(color));
  x.position.set(...pos); x.rotation.set(...rot.map((d) => (d * Math.PI) / 180));
  x.castShadow = cast; x.receiveShadow = receive; return x;
}
export const box = (w, h, d, color, o) => mesh(new THREE.BoxGeometry(w, h, d), color, o);
export const cyl = (rt, rb, h, color, o, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, o);

export function ground(color, radius = 70, y = 0) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat(color));
  g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; return g;
}

/** Place a loaded KayKit asset (or nothing if it is not loaded). `rot` in degrees about Y. */
export function put(stage, name, { pos = [0, 0, 0], rot = 0, scale = 1 } = {}) {
  const o = stage.assets.instance(name);
  if (!o) return null;
  o.position.set(...pos); o.rotation.y = (rot * Math.PI) / 180; o.scale.setScalar(scale);
  return o;
}

/** Deterministic scatter of assets in an annulus (same every run). */
export function scatter(stage, group, names, count, { inner = 12, outer = 40, scale = [2, 3.2], seed = 7, avoid = null } = {}) {
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    const a = r.next() * Math.PI * 2; const d = inner + r.next() * (outer - inner);
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    if (avoid && avoid(x, z)) continue;
    const o = put(stage, names[Math.floor(r.next() * names.length)], { pos: [x, 0, z], rot: r.next() * 360, scale: scale[0] + r.next() * (scale[1] - scale[0]) });
    if (o) group.add(o);
  }
}

export function flame(color = 0xff8a2a) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
  cone.position.y = 0.9; g.add(cone);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xffe58a }));
  inner.position.y = 0.7; g.add(inner);
  const light = new THREE.PointLight(color, 40, 26, 1.6); light.position.y = 1.3; light.castShadow = false; g.add(light);
  g.userData = { cone, inner, light };
  return g;
}
export function flicker(f, t, base = 40) {
  const { cone, inner, light } = f.userData;
  const k = 1 + Math.sin(t * 17) * 0.06 + Math.sin(t * 29 + 1) * 0.05;
  cone.scale.set(1, k, 1); inner.scale.set(1, 1 + Math.sin(t * 23) * 0.08, 1); light.intensity = base * (0.9 + (k - 1) * 2);
}
