import * as THREE from 'three';
import { rng, fbm, vnoise, clamp, smoothstep } from './util.js';

export const CAVE_X = 3000;
export function heapH(x, z) {
  const r = Math.hypot(x, z);
  const base = 11.5 * Math.pow(Math.max(0, 1 - r / 27), 1.5);
  return base + (fbm(x * 0.22 + 3, z * 0.22) - 0.5) * 2.4 * smoothstep(30, 6, r) + 0.8 * Math.max(0, 1 - Math.hypot(x - 4, z + 3) / 7);
}
export function rockFloor(x, z) { return -0.5 + (fbm(x * 0.08, z * 0.08) - 0.5) * 1.6; }

export function makeCave(envMap) {
  const g = new THREE.Group(); g.position.set(CAVE_X, 0, 0);
  const rand = rng(5);
  // rock shell, inside-out, with an entrance behind the camera (+z) and a hole in the ceiling
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 2.4 + 7, v.z * 2.4 + v.y * 2.4) , n2 = fbm(v.x * 7 + 1, v.z * 7 + v.y * 7);
    const r = 1 + (n - 0.5) * 0.45 + (n2 - 0.5) * 0.12;
    let x = v.x * r * 70, y = v.y * r * 38, z = v.z * r * 62;
    if (y < 0) y = rockFloor(x, z) + y * 0.0;
    p.setXYZ(i, x, y, z);
  }
  let idx = [];
  const ni = geo.index ? geo.index.array : null; const arr = ni || [...Array(p.count).keys()];
  const c = new THREE.Vector3();
  for (let i = 0; i < arr.length; i += 3) {
    c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(p, arr[i + k])); c.divideScalar(3);
    const entrance = c.z > 40 && Math.abs(c.x) < 22 && c.y < 26; const hole = Math.hypot(c.x - 14, c.z + 6) < 6 && c.y > 24;
    if (entrance || hole) continue; idx.push(arr[i], arr[i + 1], arr[i + 2]);
  }
  geo.setIndex(idx); const flat = geo.toNonIndexed(); flat.computeVertexNormals();
  const col = new Float32Array(flat.attributes.position.count * 3); const cc = new THREE.Color();
  for (let i = 0; i < flat.attributes.position.count; i += 3) { const y = flat.attributes.position.getY(i); cc.setHSL(0.06 + rand() * 0.02, 0.18, 0.05 + rand() * 0.035 + clamp(y / 90) * 0.01); for (let k = 0; k < 3; k++) col.set([cc.r, cc.g, cc.b], (i + k) * 3); }
  flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const shell = new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide })); shell.receiveShadow = true; g.add(shell);
  const ray = new THREE.Raycaster(); const ceilingAt = (x, z) => { ray.set(new THREE.Vector3(x + CAVE_X, 0, z), new THREE.Vector3(0, 1, 0)); const hit = ray.intersectObject(shell, false)[0]; return hit ? hit.point.y : null; };
  shell.updateMatrixWorld(true);
  // stalactites and stalagmites
  const rockM = new THREE.MeshStandardMaterial({ color: 0x3a2e28, flatShading: true, roughness: 0.95 });
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, d = 10 + rand() * 44, x = Math.cos(a) * d * 1.05, z = Math.sin(a) * d * 0.9; if (z > 44 && Math.abs(x) < 24) continue;
    const up = rand() < 0.45, h = 2.5 + rand() * 7, w = 0.5 + rand() * 1.4;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), rockM); m.rotation.y = rand() * 3;
    if (up) { m.position.set(x, rockFloor(x, z) + h / 2 - 0.3, z); } else { m.rotation.x = Math.PI; const ceil = ceilingAt(x, z); if (ceil == null) continue; m.position.set(x, ceil - h / 2 + 0.6, z); }
    m.castShadow = true; g.add(m);
  }
  // hoard: dark gold base heap + instanced coins
  const hg = new THREE.PlaneGeometry(64, 64, 96, 96); hg.rotateX(-Math.PI / 2);
  const hp = hg.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i); hp.setY(i, Math.max(heapH(x, z) - 0.5, rockFloor(x, z) - 0.2)); }
  hg.computeVertexNormals();
  const goldBase = new THREE.MeshStandardMaterial({ color: 0xa5701a, flatShading: true, roughness: 0.4, metalness: 0.9, envMap, envMapIntensity: 1.1 });
  const heap = new THREE.Mesh(hg, goldBase); heap.receiveShadow = true; heap.castShadow = true; g.add(heap);
  const COINS = 14000, coinM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 1.0, flatShading: true, envMap, envMapIntensity: 0.6 });
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.11, 9), coinM, COINS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), tc = new THREE.Color();
  for (let i = 0; i < COINS; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 30, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.95, y = heapH(x, z) + (rand() - 0.2) * 0.5;
    e.set((rand() - 0.5) * 2.2, rand() * 6.28, (rand() - 0.5) * 2.2); q.setFromEuler(e); const s = 0.8 + rand() * 0.5;
    coins.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)));
    const k = rand(); tc.setHSL(0.115 + rand() * 0.03, 0.85 + rand() * 0.1, 0.42 + rand() * 0.22 + (k > 0.96 ? 0.2 : 0)); coins.setColorAt(i, tc);
  }
  coins.castShadow = true; coins.receiveShadow = true; g.add(coins);
  // treasures: gems, goblets, crowns, swords, shields, bars, chests
  const gemCols = [0xd01030, 0x1a6fd0, 0x18b050, 0xd0a010, 0xb040d0];
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 22, x = Math.cos(a) * d, z = Math.sin(a) * d, y = heapH(x, z);
    const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + rand() * 0.35, 0), new THREE.MeshStandardMaterial({ color: gemCols[i % 5], emissive: gemCols[i % 5], emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1, flatShading: true }));
    gm.position.set(x, y + 0.3, z); gm.rotation.set(rand() * 3, rand() * 3, rand() * 3); g.add(gm);
  }
  const lathe = new THREE.LatheGeometry([[0.01, 0], [0.35, 0.02], [0.12, 0.15], [0.1, 0.5], [0.4, 0.95], [0.46, 1.05], [0.38, 1.0], [0.01, 0.6]].map((p) => new THREE.Vector2(p[0], p[1])), 8);
  for (let i = 0; i < 16; i++) { const a = rand() * Math.PI * 2, d = rand() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d; const m = new THREE.Mesh(lathe, coinM.clone()); m.material.vertexColors = false; m.material.color.set(0xe0b030); m.position.set(x, heapH(x, z) + 0.1, z); m.rotation.set((rand() - 0.5) * 1.5, 0, (rand() - 0.5) * 1.5); m.scale.setScalar(1.3); m.castShadow = true; g.add(m); }
  for (let i = 0; i < 4; i++) { // crowns
    const a = rand() * Math.PI * 2, d = 5 + rand() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d; const cr = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.7, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 1, roughness: 0.25, envMap, envMapIntensity: 1.7, side: THREE.DoubleSide, flatShading: true })); cr.add(band);
    for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), band.material); const aa = k / 8 * 6.28; sp.position.set(Math.cos(aa) * 0.98, 0.6, Math.sin(aa) * 0.98); cr.add(sp); }
    cr.position.set(x, heapH(x, z) + 0.5, z); cr.rotation.set((rand() - 0.5) * 0.8, rand() * 6, (rand() - 0.5) * 0.8); cr.scale.setScalar(1.6); g.add(cr);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0xbfc6d0, metalness: 0.9, roughness: 0.35, envMap, flatShading: true });
  for (let i = 0; i < 12; i++) { const a = rand() * Math.PI * 2, d = 8 + rand() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d; const sw = new THREE.Group(); const bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 0.06), steel); bl.position.y = 2.4; const hl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.16), goldBase); hl.position.y = 0.3; sw.add(bl, hl); sw.position.set(x, heapH(x, z), z); sw.rotation.set(1.1 + rand() * 0.4, rand() * 6, (rand() - 0.5) * 0.6); g.add(sw); }
  for (let i = 0; i < 7; i++) { const a = rand() * Math.PI * 2, d = 10 + rand() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d; const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.15, 12), new THREE.MeshStandardMaterial({ color: [0xa02020, 0x2050a0, 0xc0b0a0][i % 3], metalness: 0.5, roughness: 0.5, flatShading: true })); sh.position.set(x, heapH(x, z) + 0.7, z); sh.rotation.set(0.6 + rand() * 0.5, rand() * 6, rand() * 0.5); g.add(sh); }
  const barM = new THREE.MeshStandardMaterial({ color: 0xf0b83a, metalness: 1, roughness: 0.3, envMap, envMapIntensity: 1.5, flatShading: true });
  for (let i = 0; i < 40; i++) { const a = rand() * Math.PI * 2, d = 18 + rand() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d; const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.8), barM); b.position.set(x, heapH(x, z) + 0.2, z); b.rotation.y = rand() * 6; b.castShadow = true; g.add(b); }
  // chests with gold spilling
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c16, flatShading: true, roughness: 0.8 });
  for (const [x, z, ry] of [[-22, 16, 0.5], [24, 12, -0.7], [-30, -8, 1.1], [30, -14, 2.4], [-8, 30, 0.2]]) {
    const c = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.7, 2.2), wood); b.position.y = 0.85; const lid = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 2.3), wood); lid.position.set(0, 2.5, -1.4); lid.rotation.x = -1.1;
    const fill = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 1.9), barM); fill.position.y = 1.7; c.add(b, lid, fill); c.position.set(x, Math.max(heapH(x, z), rockFloor(x, z)), z); c.rotation.y = ry; c.castShadow = true; g.add(c);
    for (let k = 0; k < 40; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8), barM); s.position.set(x + (rand() - 0.5) * 6, Math.max(heapH(x, z), 0) + 0.15, z + (rand() - 0.5) * 6); s.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5); g.add(s); }
  }
  // light shaft from the ceiling hole (additive cone with gradient)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 12, 40, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uI: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uI; void main(){ float a = pow(1.0-vUv.y, 1.4)*0.05*uI; a *= smoothstep(0.0,0.1,vUv.y); gl_FragColor = vec4(vec3(0.5,0.65,1.0)*a, a); }',
  }));
  shaft.position.set(14, 40 - 18, -6); shaft.renderOrder = 4; g.add(shaft);
  // lights
  const torch = (x, y, z, i) => { const l = new THREE.PointLight(0xff8a30, i, 90, 1.6); l.position.set(x, y, z); g.add(l); const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.55, 0.15).multiplyScalar(2.5) })); f.position.set(x, y, z); g.add(f); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5), wood); s.position.set(x, y - 1.6, z); g.add(s); return l; };
  const lights = { torches: [torch(-44, 8, -10, 700), torch(40, 8, -22, 600), torch(-30, 8, 40, 500), torch(32, 8, 40, 500)] };
  lights.glow = new THREE.PointLight(0xffb040, 90, 80, 1.5); lights.glow.position.set(0, 22, 4); g.add(lights.glow);
  lights.moon = new THREE.SpotLight(0x8fb0ff, 5500, 130, 0.22, 0.6, 1.2); lights.moon.position.set(14, 40, -6); lights.moon.target.position.set(2, 8, 0); lights.moon.castShadow = true; lights.moon.shadow.mapSize.set(1024, 1024); lights.moon.shadow.bias = -0.0004; g.add(lights.moon, lights.moon.target);
  lights.amb = new THREE.HemisphereLight(0x403048, 0x5a3a14, 0.32); g.add(lights.amb);
  g.userData.lights = lights; g.visible = false; return g;
}
