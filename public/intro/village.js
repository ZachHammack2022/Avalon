import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, lerp, smoothstep } from './util.js';
import { heightAt } from './world.js';

const WALLS = [0xc9a875, 0xb98d5e, 0xd4b88a, 0xa77c52, 0xcfa36a, 0x9c7a5a];
const ROOFS = [0x7a2e22, 0x5a2a20, 0x6d3a22, 0x4a3426, 0x8a3a24];
const CHAR = new THREE.Color(0x120d0a);

function prismRoof(w, d, h, over) {
  const hw = w / 2 + over, hd = d / 2 + over, p = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, -hd - 0.2], [0, h, hd + 0.2]];
  const t = [[0, 4, 1], [3, 2, 5], [0, 3, 5], [0, 5, 4], [1, 4, 5], [1, 5, 2], [0, 1, 2], [0, 2, 3]];
  const pos = []; for (const f of t) for (const i of f) pos.push(...p[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

export class Village {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.houses = []; this.people = []; this.lamps = [];
    const rand = rng(99);
    const addHouse = (x, z, rotY, w, d, h, kind = 'house') => {
      const g = new THREE.Group(), y = heightAt(x, z); g.position.set(x, y, z); g.rotation.y = rotY;
      const wc = new THREE.Color(WALLS[(rand() * WALLS.length) | 0]).multiplyScalar(0.8 + rand() * 0.3), rc = new THREE.Color(ROOFS[(rand() * ROOFS.length) | 0]);
      const wm = new THREE.MeshStandardMaterial({ color: wc, flatShading: true, roughness: 0.9 }), rm = new THREE.MeshStandardMaterial({ color: rc, flatShading: true, roughness: 0.85 });
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm); walls.position.y = h / 2; walls.castShadow = walls.receiveShadow = true; g.add(walls);
      // timber frame
      const tm = new THREE.MeshStandardMaterial({ color: 0x2e2118, flatShading: true });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), tm); b.position.set(sx * w / 2, h / 2, sz * d / 2); g.add(b); }
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), new THREE.MeshStandardMaterial({ color: 0x5b5650, flatShading: true })); base.position.y = 0.3; g.add(base);
      const rh = w * 0.42 + rand() * 0.8, roof = new THREE.Mesh(prismRoof(w, d, rh, 0.7), rm); roof.position.y = h; roof.castShadow = true; g.add(roof);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x6a5f58, flatShading: true })); ch.position.set(w * 0.2, h + rh * 0.55, d * 0.15); g.add(ch);
      // windows (emissive warm), door
      const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.22).multiplyScalar(1.6) });
      const wins = [];
      const nw = Math.max(1, Math.floor(w / 3));
      for (let i = 0; i < nw; i++) { const wx = (i - (nw - 1) / 2) * 2.6; for (const side of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), winMat); m.position.set(wx, h * 0.58, side * (d / 2 + 0.02)); if (side < 0) m.rotation.y = Math.PI; g.add(m); wins.push(m); } }
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.12), tm); door.position.set(0, 1.05, d / 2 + 0.05); g.add(door);
      this.group.add(g);
      const hs = { g, x, z, y, h: h + rh, w, d, wm, rm, wc, rc, winMat, roof, ignite: Infinity, kind, wins };
      this.houses.push(hs); return hs;
    };
    // street houses
    for (const side of [-1, 1]) {
      for (let z = -62; z < 90; z += 11 + rand() * 4) {
        if (Math.abs(z) < 16) continue; // plaza
        const w = 6.5 + rand() * 2.5, d = 6 + rand() * 3, h = 3.6 + rand() * 1.4;
        const x = side * (9 + w / 2 + rand() * 2.5);
        addHouse(x, z + (rand() - 0.5) * 3, side > 0 ? -Math.PI / 2 + (rand() - 0.5) * 0.12 : Math.PI / 2 + (rand() - 0.5) * 0.12, w, d, h);
      }
    }
    // back row
    for (const side of [-1, 1]) for (let z = -70; z < 95; z += 15 + rand() * 7) {
      const w = 6 + rand() * 3, d = 6 + rand() * 3, x = side * (26 + rand() * 10);
      addHouse(x, z, rand() * Math.PI * 2, w, d, 3.4 + rand() * 1.5);
    }
    // church tower at the plaza end
    this.tower = this.addTower(0, -78); 
    this.addProps(rand);
    this.addPeople(rand);
    this.initFire(rand);
  }
  addTower(x, z) {
    const g = new THREE.Group(), y = heightAt(x, z); g.position.set(x, y, z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8c8378, flatShading: true, roughness: 0.95 });
    const nave = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 20), stone); nave.position.y = 4.5; g.add(nave);
    const nr = new THREE.Mesh(prismRoof(14, 20, 6, 0.8).rotateY(0), new THREE.MeshStandardMaterial({ color: 0x4a3a34, flatShading: true })); nr.position.y = 9; g.add(nr);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(6, 24, 6), stone); tw.position.set(0, 12, 12); g.add(tw);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(4.6, 12, 4), new THREE.MeshStandardMaterial({ color: 0x3a2e2c, flatShading: true })); sp.position.set(0, 30, 12); sp.rotation.y = Math.PI / 4; g.add(sp);
    const wm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(1.4) });
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.6), wm); w.position.set(-5.5 + i * 3.7, 5, -10.03); w.rotation.y = Math.PI; g.add(w); const w2 = w.clone(); w2.position.z = 10.03; w2.rotation.y = 0; g.add(w2); }
    this.group.add(g); return g;
  }
  addProps(rand) {
    // lantern posts along the street, market stalls, well, haystacks, carts, fences
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, flatShading: true });
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.3).multiplyScalar(2.2) });
    for (let z = -60; z <= 88; z += 14) for (const sx of [-1, 1]) {
      const x = sx * 5.6, y = heightAt(x, z); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.6, 5), wood); p.position.set(x, y + 1.8, z); this.group.add(p);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), lampMat); l.position.set(x, y + 3.7, z); this.group.add(l); this.lamps.push(l);
    }
    const cloth = [0xb03a2a, 0x2f6a8a, 0xc99a2a, 0x4a7a3a];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 15, z = Math.sin(a) * 15 + 0, y = heightAt(x, z); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -a + Math.PI / 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.6), wood); t.position.y = 0.5; g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 4), new THREE.MeshStandardMaterial({ color: cloth[i % 4], flatShading: true, side: THREE.DoubleSide })); r.position.y = 3.0; r.rotation.y = Math.PI / 4; g.add(r);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), wood); p.position.set(sx * 1.4, 1.25, sz * 0.7); g.add(p); }
      this.group.add(g);
    }
    // well
    const wy = heightAt(0, 0); const well = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x78726a, flatShading: true })); well.position.set(0, wy + 0.55, 0); this.group.add(well);
    // haystacks & crates
    for (let i = 0; i < 14; i++) {
      const side = rand() < 0.5 ? -1 : 1, x = side * (15 + rand() * 20), z = -60 + rand() * 140, y = heightAt(x, z);
      if (rand() < 0.5) { const h = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.6, 7), new THREE.MeshStandardMaterial({ color: 0xc9a43a, flatShading: true })); h.position.set(x, y + 1.3, z); this.group.add(h); }
      else { const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), wood); c.position.set(x, y + 0.55, z); c.rotation.y = rand() * 3; this.group.add(c); }
    }
    // fences
    for (let i = 0; i < 40; i++) {
      const side = rand() < 0.5 ? -1 : 1, x = side * (7 + rand() * 1), z = -60 + i * 3.6, y = heightAt(x, z);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), wood); p.position.set(x, y + 0.55, z); this.group.add(p);
    }
  }
  addPeople(rand) {
    const skins = [0xf1c9a0, 0xd9a577, 0xb8845a, 0x8a5a3a];
    const cloth = [0x3b5b8a, 0x8a3b3b, 0x4f7a4a, 0xc9a24a, 0x6a4a8a, 0x8a6a3a, 0xd0d0c0, 0x2e2e3a];
    const build = (panic) => {
      const parts = [], col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed(); };
      const body = new THREE.CylinderGeometry(0.22, 0.32, 0.95, 6); body.translate(0, 1.0, 0);
      const head = new THREE.IcosahedronGeometry(0.2, 0); head.translate(0, 1.7, 0);
      const legL = new THREE.CylinderGeometry(0.1, 0.09, 0.6, 5); legL.translate(-0.12, 0.3, 0); const legR = legL.clone().translate(0.24, 0, 0);
      const arm = (sx) => { const a = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 5); a.translate(0, -0.3, 0); a.rotateZ(sx * (panic ? 2.7 : 0.15)); a.translate(sx * 0.3, 1.45, 0); return a; };
      return [body, head, legL, legR, arm(-1), arm(1)];
    };
    this.personGeos = [false, true].map((panic) => { const [b, h, l, r, a1, a2] = build(panic); const toC = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }; return { b, h, l, r, a1, a2, toC }; });
    for (let i = 0; i < 80; i++) {
      const x = (rand() - 0.5) * 10 + (rand() < 0.4 ? (rand() < 0.5 ? -1 : 1) * 12 * rand() : 0), z = -58 + rand() * 135;
      const cc = cloth[(rand() * cloth.length) | 0], sk = skins[(rand() * skins.length) | 0];
      const mk = (panic) => { const P = this.personGeos[panic ? 1 : 0]; const geos = [P.toC(P.b.clone(), cc), P.toC(P.h.clone(), sk), P.toC(P.l.clone(), 0x3a2e24), P.toC(P.r.clone(), 0x3a2e24), P.toC(P.a1.clone(), sk), P.toC(P.a2.clone(), sk)]; return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))); };
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
      const m = new THREE.Mesh(mk(false), mat); m.castShadow = true; m.scale.setScalar(0.95 + rand() * 0.15);
      const p = { m, geoCalm: m.geometry, geoPanic: mk(true), mat, home: new THREE.Vector3(x, 0, z), seed: rand() * 100, dir: rand() < 0.5 ? -1 : 1, alarm: Infinity, die: Infinity, runDirX: (x > 0 ? 1 : -1) * (0.6 + rand() * 0.4), runDirZ: (rand() - 0.5) * 0.8, base: new THREE.Color(0xffffff), scale: m.scale.x };
      this.group.add(m); this.people.push(p);
    }
  }
  // fire emitters on house roofs: flames (additive) + smoke (normal), all in the vertex shader
  initFire(rand) {
    const N = this.houses.length, PER = 72;
    const mkAttrs = (per, smoke) => {
      const total = N * per, o = new Float32Array(total * 3), s = new Float32Array(total), ig = new Float32Array(total), sz = new Float32Array(total);
      let k = 0;
      this.houses.forEach((h, hi) => { for (let i = 0; i < per; i++) { o[k * 3] = h.x + (rand() - 0.5) * h.w * 0.8; o[k * 3 + 1] = h.y + h.h * (smoke ? 0.8 : 0.5 + rand() * 0.5); o[k * 3 + 2] = h.z + (rand() - 0.5) * h.d * 0.8; s[k] = rand(); ig[k] = hi; k++; } });
      return { o, s, ig, total };
    };
    const mkPoints = (a, smoke) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a.o, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(a.s, 1)); g.setAttribute('aHouse', new THREE.BufferAttribute(a.ig, 1));
      this.igniteArr = this.igniteArr || new Float32Array(this.houses.length).fill(1e9);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPx: { value: 700 }, uIgnite: { value: this.igniteArr } },
        vertexShader: `
          attribute float aSeed; attribute float aHouse; uniform float uTime; uniform float uPx; uniform float uIgnite[${this.houses.length}];
          varying float vAge; varying float vOn; varying float vSeed;
          void main(){
            float ig = uIgnite[int(aHouse)]; float since = uTime - ig; float on = smoothstep(0.0, 1.2, since);
            float sp = ${smoke ? '0.11' : '0.55'} * (0.7 + aSeed*0.6);
            float age = fract(uTime*sp + aSeed*13.0); vAge = age; vSeed = aSeed;
            vec3 p = position;
            float rise = ${smoke ? '70.0' : '15.0'} * (0.6+aSeed*0.8) * (0.4+0.6*on);
            p.y += age*rise; p.x += (sin(uTime*1.3+aSeed*40.)*0.8 + 6.0*age*age*${smoke ? '1.6' : '0.3'}) * (age); p.z += cos(uTime*1.1+aSeed*30.)*0.8*age;
            vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
            float sz = ${smoke ? '(5.0 + age*26.0)' : '(6.5*sin(min(age,1.0)*3.14159)+0.8)*(0.6+aSeed*0.8)'};
            vOn = on * (since > 0.0 ? 1.0 : 0.0);
            gl_PointSize = sz * uPx / max(1.0, -mv.z) * vOn;
          }`,
        fragmentShader: `
          varying float vAge; varying float vOn; varying float vSeed;
          void main(){
            vec2 c = gl_PointCoord - .5; float d = length(c); if (vOn < 0.01) discard; ${smoke ? 'if (d > .5) discard;' : ''}
            ${smoke ? `
            float a = (1.0 - vAge) * smoothstep(0.5, 0.1, d) * 0.5;
            vec3 col = mix(vec3(0.16,0.12,0.1), vec3(0.06,0.055,0.055), vAge) + vec3(0.7,0.25,0.05)*0.22*pow(1.0-vAge,3.0)*0.8;
            gl_FragColor = vec4(col, a);` : `
            float yy = 1.0 - gl_PointCoord.y; float wob = sin(yy*9.0 + vSeed*40.0)*0.06*yy; float wdt = max(0.02, (1.0 - yy*0.92) * 0.42); float dx = abs(gl_PointCoord.x - 0.5 + wob) / wdt;
            float a = smoothstep(1.0, 0.2, dx) * smoothstep(0.0, 0.12, yy) * smoothstep(1.0, 0.7, yy); a *= (1.0 - vAge*vAge*0.8);
            vec3 col = mix(vec3(1.0,0.62,0.18), vec3(0.95,0.2,0.03), smoothstep(0.0,0.6,vAge)); col = mix(col, vec3(0.5,0.05,0.0), smoothstep(0.7,1.0,vAge));
            gl_FragColor = vec4(col*1.0, a*0.42);`}
          }`,
      });
      const p = new THREE.Points(g, mat); p.frustumCulled = false; return p;
    };
    const fa = mkAttrs(PER, false), sa = mkAttrs(24, true);
    this.flames = mkPoints(fa, false); this.smoke = mkPoints(sa, true); this.smoke.renderOrder = 2; this.flames.renderOrder = 3;
    this.group.add(this.smoke, this.flames);
  }
  // compute ignite times and person fates from the dragon track
  plan(track, headFn, breathStart, breathEnd) {
    const samples = []; for (let t = 8; t <= breathEnd + 6; t += 0.1) samples.push({ t, p: headFn(t).clone() });
    for (const h of this.houses) {
      let best = Infinity, bt = Infinity;
      for (const s of samples) { if (s.t < breathStart - 1.5 || s.t > breathEnd) continue; const d = Math.hypot(s.p.x - h.x, s.p.z - h.z) + Math.max(0, s.p.y - h.y - 10) * 0.8; if (d < best) { best = d; bt = s.t; } }
      h.ignite = best < 24 ? bt + 0.1 + Math.abs(Math.sin(h.x * 13.1 + h.z * 7.7)) * 0.5 : Infinity;
    }
    for (let pass = 0; pass < 3; pass++) for (const a of this.houses) for (const b of this.houses) { if (a === b) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 26 && b.ignite + 2 + d / 7 < a.ignite) a.ignite = b.ignite + 2 + d / 7; }
    this.houses.forEach((h, i) => { this.igniteArr[i] = h.ignite < 60 ? h.ignite : 1e9; });
    for (const p of this.people) {
      p.alarm = Infinity; p.die = Infinity;
      for (const s of samples) { const d = Math.hypot(s.p.x - p.home.x, s.p.z - p.home.z); if (d < 160 && p.alarm === Infinity) p.alarm = s.t - 0.2 + (Math.sin(p.seed) + 1) * 0.6; }
      for (const s of samples) { if (s.t < breathStart + 0.5 || s.t > breathEnd) continue; const d = Math.hypot(s.p.x - p.home.x - Math.sign(p.runDirX) * 0, s.p.z - p.home.z); if (d < 9 && Math.abs(p.home.x) < 11 && (Math.sin(p.seed * 3.7) > -0.25)) { p.die = s.t + 0.6 + (Math.sin(p.seed * 9) + 1) * 0.5; break; } }
    }
  }
  update(t, px) {
    this.flames.material.uniforms.uTime.value = t; this.smoke.material.uniforms.uTime.value = t;
    this.flames.material.uniforms.uPx.value = px; this.smoke.material.uniforms.uPx.value = px;
    const tmp = new THREE.Color();
    for (const h of this.houses) {
      const b = clamp((t - h.ignite) / 3), c = h.kind === 'x' ? 0 : b;
      h.wm.color.copy(h.wc).lerp(CHAR, b * 0.9); h.rm.color.copy(h.rc).lerp(CHAR, b);
      const fl = 0.8 + 0.2 * Math.sin(t * 19 + h.x * 3.1); h.rm.emissive.setRGB(1.0, 0.28, 0.04).multiplyScalar(smoothstep(0, 1.5, t - h.ignite) * (1 - smoothstep(10, 24, t - h.ignite) * 0.7) * 0.9 * fl); h.wm.emissive.setRGB(1.0, 0.25, 0.03).multiplyScalar(smoothstep(0.5, 3, t - h.ignite) * 0.35 * fl);
      const f = clamp((t - h.ignite) / 1.5); h.winMat.color.setRGB(1.0, lerp(0.62, 0.3 + 0.2 * Math.sin(t * 25 + h.x), f), lerp(0.22, 0.04, f)).multiplyScalar(lerp(1.6, 3.2, f));
      h.roof.scale.y = 1 - 0.55 * smoothstep(8, 16, t - h.ignite); // roofs sag after burning
    }
    for (const p of this.people) {
      const m = p.m, hx = p.home.x, hz = p.home.z;
      let x = hx, z = hz, ry = 0, y = 0, lean = 0, panic = false;
      if (t < p.alarm) {
        const ph = t * 0.6 + p.seed; x = hx + Math.sin(ph) * 2.2 * p.dir; z = hz + Math.cos(ph * 0.8) * 3.0; ry = Math.atan2(Math.cos(ph) * 2.2 * p.dir, -Math.sin(ph * 0.8) * 2.4); y = Math.abs(Math.sin(t * 6 + p.seed)) * 0.05;
      } else {
        const tr = t - p.alarm, tt = Math.min(tr, p.die - p.alarm), rx = p.runDirX, rz = p.runDirZ, n = Math.hypot(rx, rz) || 1;
        const run = 5.5 * (1 + 0.2 * Math.sin(p.seed)); x = hx + (rx / n) * run * Math.max(0, tt - 0.4) * 0.9; z = hz + (rz / n) * run * Math.max(0, tt - 0.4) * 0.9;
        ry = Math.atan2(rx, rz); y = Math.abs(Math.sin(t * 12 + p.seed)) * 0.12 * (tr < p.die - p.alarm ? 1 : 0); lean = 0.18; panic = tr > 0.2;
      }
      const dead = t > p.die; const fall = dead ? smoothstep(0, 0.5, t - p.die) : 0;
      m.geometry = panic && !dead ? p.geoPanic : p.geoCalm;
      m.position.set(x, heightAt(x, z) + y + (dead ? 0.15 * fall : 0), z);
      m.rotation.set(0, ry, 0); m.rotateX(lean * (1 - fall)); if (dead) { m.rotateX(-fall * Math.PI / 2 * 0.98); }
      p.mat.color.setScalar(1).lerp(new THREE.Color(0.15, 0.1, 0.08), dead ? smoothstep(0.3, 2.0, t - p.die) : 0);
    }
  }
}
