import * as THREE from 'three';
import { clamp } from './util.js';

// ---- Head track: keyframed positions in time, dense arclength table so the body can trail the head ----
export class Track {
  constructor(keys, dt = 0.02) {
    this.t0 = keys[0][0]; this.t1 = keys[keys.length - 1][0]; this.dt = dt;
    const pts = keys.map((k) => new THREE.Vector3(k[1], k[2], k[3]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = keys.length;
    const uOf = (t) => { // piecewise-linear time->u, monotone
      if (t <= keys[0][0]) return 0; if (t >= keys[n - 1][0]) return 1;
      let i = 0; while (keys[i + 1][0] < t) i++;
      const f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      const s = f * f * (3 - 2 * f) * 0.35 + f * 0.65; // gentle ease at keys
      return (i + s) / (n - 1);
    };
    const N = Math.ceil((this.t1 - this.t0) / dt) + 1;
    this.P = new Float32Array(N * 3); this.L = new Float32Array(N);
    const v = new THREE.Vector3(); let len = 0, prev = null;
    for (let i = 0; i < N; i++) {
      curve.getPoint(uOf(this.t0 + i * dt), v);
      this.P.set([v.x, v.y, v.z], i * 3);
      if (prev) len += v.distanceTo(prev); this.L[i] = len; prev = v.clone();
    }
    this.N = N; this.total = len;
    const d = new THREE.Vector3(this.P[3] - this.P[0], this.P[4] - this.P[1], this.P[5] - this.P[2]).normalize();
    this.startDir = d;
  }
  lengthAt(t) { const f = clamp((t - this.t0) / this.dt, 0, this.N - 1); const i = Math.floor(f), j = Math.min(this.N - 1, i + 1); return this.L[i] + (this.L[j] - this.L[i]) * (f - i); }
  head(t, out = new THREE.Vector3()) { const f = clamp((t - this.t0) / this.dt, 0, this.N - 1); const i = Math.floor(f), j = Math.min(this.N - 1, i + 1), w = f - i; return out.set(this.P[i * 3] + (this.P[j * 3] - this.P[i * 3]) * w, this.P[i * 3 + 1] + (this.P[j * 3 + 1] - this.P[i * 3 + 1]) * w, this.P[i * 3 + 2] + (this.P[j * 3 + 2] - this.P[i * 3 + 2]) * w); }
  // point at arclength u (0 = start), extrapolating straight before start
  atLen(u, out = new THREE.Vector3()) {
    if (u <= 0) { out.set(this.P[0], this.P[1], this.P[2]); return out.addScaledVector(this.startDir, u); }
    let lo = 0, hi = this.N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.L[m] < u) lo = m; else hi = m; }
    const seg = this.L[hi] - this.L[lo] || 1, w = clamp((u - this.L[lo]) / seg, 0, 1);
    return out.set(this.P[lo * 3] + (this.P[hi * 3] - this.P[lo * 3]) * w, this.P[lo * 3 + 1] + (this.P[hi * 3 + 1] - this.P[lo * 3 + 1]) * w, this.P[lo * 3 + 2] + (this.P[hi * 3 + 2] - this.P[lo * 3 + 2]) * w);
  }
}

const LEN = 38, RINGS = 56, SIDES = 10;
// radius profile along s (0 head end .. LEN tail tip)
function radiusAt(s) {
  const k = (a, b, x) => clamp((x - a) / (b - a));
  const sm = (x) => x * x * (3 - 2 * x);
  if (s < 8) return 0.42 + 0.55 * sm(k(0, 8, s));
  if (s < 15) return 0.97 + 0.75 * sm(k(8, 12, s)) - 0.15 * sm(k(12, 15, s));
  if (s < 21) return 1.57 - 0.35 * sm(k(15, 21, s));
  return 1.22 * Math.pow(1 - k(21, LEN, s), 1.25) + 0.05;
}

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const S = 1.55; // dragon scale; the group is scaled, so internal space is world / S
const M = {
  scale: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0.08 }),
  bone: new THREE.MeshStandardMaterial({ color: 0x4a2418, flatShading: true, roughness: 0.7 }),
  membrane: new THREE.MeshStandardMaterial({ color: 0xa83522, emissive: 0x3a0e04, flatShading: true, roughness: 0.75, side: THREE.DoubleSide }),
  horn: new THREE.MeshStandardMaterial({ color: 0xd9c9a0, flatShading: true, roughness: 0.5 }),
  eye: new THREE.MeshBasicMaterial({ color: 0xffb020 }),
  mouth: new THREE.MeshBasicMaterial({ color: 0xff6a10 }),
  claw: new THREE.MeshStandardMaterial({ color: 0xcfc3a4, flatShading: true, roughness: 0.5 }),
};

export class Dragon {
  constructor() {
    this.group = new THREE.Group(); this.group.scale.setScalar(S);
    // body tube
    const nV = RINGS * SIDES;
    const pos = new Float32Array(nV * 3), col = new Float32Array(nV * 3), idx = [];
    for (let r = 0; r < RINGS - 1; r++) for (let j = 0; j < SIDES; j++) {
      const a = r * SIDES + j, b = r * SIDES + (j + 1) % SIDES, c = (r + 1) * SIDES + j, d = (r + 1) * SIDES + (j + 1) % SIDES;
      idx.push(a, c, b, b, c, d);
    }
    const back = new THREE.Color(0x7a2616), belly = new THREE.Color(0xd9a04a), c = new THREE.Color();
    for (let r = 0; r < RINGS; r++) for (let j = 0; j < SIDES; j++) {
      const phi = (j / SIDES) * Math.PI * 2, down = clamp(-Math.sin(phi) * 1.4 - 0.25, 0, 1); // belly weight
      c.copy(back).lerp(belly, down * down); const stripe = ((r % 4 < 2) ? 1 : 0.88) * (0.9 + 0.2 * ((r * 7 + j * 13) % 5) / 4); c.multiplyScalar(stripe);
      col.set([c.r, c.g, c.b], (r * SIDES + j) * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.body = new THREE.Mesh(g, M.scale); this.body.frustumCulled = false; this.body.castShadow = true; this.group.add(this.body);
    this.bodyPos = pos;
    // dorsal spikes
    this.spikeCount = 30;
    this.spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1, 4), M.horn, this.spikeCount); this.spikes.frustumCulled = false; this.group.add(this.spikes);
    this.buildHead(); this.buildWings(); this.buildLegs();
    this.spine = Array.from({ length: RINGS }, v3); this.frames = Array.from({ length: RINGS }, () => ({ T: v3(), U: v3(), R: v3() }));
  }
  buildHead() {
    const h = this.head = new THREE.Group(); this.group.add(h); h.scale.setScalar(1.5);
    const mk = (geo, mat, p, r, s) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(...p); if (r) m.rotation.set(...r); if (s) m.scale.set(...s); m.castShadow = true; return m; };
    const dark = new THREE.MeshStandardMaterial({ color: 0x6e2415, flatShading: true, roughness: 0.6 });
    // skull: tapered 5-sided prism lying along z
    const skull = new THREE.CylinderGeometry(0.62, 0.95, 1.9, 6); skull.rotateX(Math.PI / 2); // narrow end toward +z
    h.add(mk(skull, dark, [0, 0.05, 0.9], null, [1.0, 0.8, 1]));
    const snout = new THREE.CylinderGeometry(0.34, 0.6, 1.8, 6); snout.rotateX(Math.PI / 2);
    h.add(mk(snout, dark, [0, -0.05, 2.1], null, [1, 0.62, 1]));
    // brow ridges
    for (const sx of [-1, 1]) {
      h.add(mk(new THREE.BoxGeometry(0.3, 0.2, 0.8), dark, [sx * 0.52, 0.42, 1.0], [0, sx * -0.25, sx * -0.3]));
      h.add(mk(new THREE.SphereGeometry(0.13, 6, 5), M.eye, [sx * 0.6, 0.3, 1.15]));
      // horns
      h.add(mk(new THREE.ConeGeometry(0.2, 2.2, 5), M.horn, [sx * 0.5, 0.55, -0.25], [-1.9, 0, sx * 0.35]));
      h.add(mk(new THREE.ConeGeometry(0.1, 1.0, 4), M.horn, [sx * 0.75, 0.0, 0.15], [-1.5, 0, sx * 1.0]));
      h.add(mk(new THREE.SphereGeometry(0.06, 4, 3), new THREE.MeshBasicMaterial({ color: 0x000000 }), [sx * 0.16, 0.12, 2.95]));
    }
    // upper teeth
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) h.add(mk(new THREE.ConeGeometry(0.06, 0.28, 4), M.claw, [sx * (0.3 - i * 0.015), -0.34, 1.35 + i * 0.28], [Math.PI, 0, 0]));
    // lower jaw pivot at back of mouth
    const jaw = this.jaw = new THREE.Group(); jaw.position.set(0, -0.28, 0.5); h.add(jaw);
    const jg = new THREE.CylinderGeometry(0.3, 0.52, 2.5, 6); jg.rotateX(Math.PI / 2);
    jaw.add(mk(jg, dark, [0, -0.12, 1.2], null, [1, 0.32, 1]));
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) jaw.add(mk(new THREE.ConeGeometry(0.05, 0.24, 4), M.claw, [sx * 0.24, 0.07, 1.0 + i * 0.28]));
    this.mouthGlow = mk(new THREE.PlaneGeometry(0.7, 2.0), M.mouth, [0, -0.28, 1.6], [-Math.PI / 2, 0, 0]); this.mouthGlow.castShadow = false; h.add(this.mouthGlow);
    this.mouthGlow.material = M.mouth.clone();
    this.eyeMat = M.eye;
  }
  buildWings() {
    this.wings = [1, -1].map((side) => {
      const w = { side, bones: [], mem: null };
      const nT = 3 * 4 + 3 + 3; // membrane triangles: fingers scallops (6*... ) computed below
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 9), 3));
      w.mem = new THREE.Mesh(geo, M.membrane); w.mem.frustumCulled = false; w.mem.castShadow = true; this.group.add(w.mem);
      const bg = new THREE.CylinderGeometry(1, 1, 1, 5);
      for (let i = 0; i < 2 + 4; i++) { const b = new THREE.Mesh(bg, M.bone); b.frustumCulled = false; b.castShadow = true; this.group.add(b); w.bones.push(b); }
      w.claw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 4), M.claw); this.group.add(w.claw);
      return w;
    });
  }
  buildLegs() {
    this.legs = [];
    for (const [ring, big] of [[17, 1], [30, 0]]) for (const side of [1, -1]) {
      const l = { ring, side, big, t: new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 1, 5), M.bone), s: new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.2, 1, 5), M.bone), f: new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 1.2), M.bone), claws: [] };
      for (const m of [l.t, l.s, l.f]) { m.castShadow = true; m.frustumCulled = false; this.group.add(m); }
      for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 4), M.claw); this.group.add(c); l.claws.push(c); }
      this.legs.push(l);
    }
  }
  // world pose of head for a given time: used by update and by fire breath emitter
  headPose(track, t, p, out = {}) {
    const P = track.head(t, out.pos || v3()); const L = track.lengthAt(t);
    const b = track.atLen(L - 3.2, out.b || v3());
    const T = out.T || v3(); T.subVectors(P, b).normalize();
    out.pos = P; out.b = b; out.T = T;
    // pitch offset around right axis
    const R = (out.R || v3()).crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize(); out.R = R;
    const U = (out.U || v3()).crossVectors(R, T).normalize(); out.U = U;
    if (p.headPitch) { T.applyAxisAngle(R, p.headPitch); U.applyAxisAngle(R, p.headPitch); }
    const mouth = (out.mouth || v3()).copy(P).addScaledVector(T, 2.6 * S).addScaledVector(U, -0.35 * S); out.mouth = mouth;
    return out;
  }
  update(track, t, p) {
    const L = track.lengthAt(t);
    const T0 = v3(), P = this.spine;
    const bank = p.bank || 0;
    // spine points
    for (let i = 0; i < RINGS; i++) {
      const s = (i / (RINGS - 1)) * LEN; track.atLen(L - s * S, P[i]).multiplyScalar(1 / S);
      const ph = t * 2.2 - s * 0.16, k = s / LEN;
      const sway = (p.sway ?? 1) * 1.9 * Math.pow(k, 1.3) * Math.sin(ph);
      P[i]._sway = sway + 0.8 * Math.sin(s * 0.55 - t * 1.5) * Math.sin(Math.min(s, 9) / 9 * Math.PI) * (p.neckArch ?? 1); P[i]._bob = (p.bob ?? 1) * (0.35 * Math.pow(k, 1.1) * Math.sin(ph * 0.9 + 1.2) + 0.5 * Math.sin(Math.min(s, 9) / 9 * Math.PI) * (p.neckArch ?? 1) * 1.5);
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < RINGS; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(RINGS - 1, i + 1)];
      const f = this.frames[i]; f.T.subVectors(a, b).normalize(); // points toward head
      f.R.crossVectors(f.T, up); if (f.R.lengthSq() < 1e-6) f.R.set(1, 0, 0); f.R.normalize();
      f.U.crossVectors(f.R, f.T).normalize();
      const bk = bank * Math.min(1, i / 8) ; f.R.applyAxisAngle(f.T, bk); f.U.applyAxisAngle(f.T, bk);
    }
    // apply offsets after frames (lateral/vertical sway)
    for (let i = 0; i < RINGS; i++) { const f = this.frames[i]; P[i].addScaledVector(f.R, P[i]._sway).addScaledVector(f.U, P[i]._bob); }
    const pos = this.bodyPos;
    for (let i = 0; i < RINGS; i++) {
      const f = this.frames[i], s = (i / (RINGS - 1)) * LEN, r = radiusAt(s);
      for (let j = 0; j < SIDES; j++) {
        const phi = (j / SIDES) * Math.PI * 2 + 0.3, cx = Math.cos(phi) * r * 1.12, cy = Math.sin(phi) * r * (0.82 + (Math.sin(phi) > 0 ? 0.1 : 0));
        const o = (i * SIDES + j) * 3;
        pos[o] = P[i].x + f.R.x * cx + f.U.x * cy; pos[o + 1] = P[i].y + f.R.y * cx + f.U.y * cy; pos[o + 2] = P[i].z + f.R.z * cx + f.U.z * cy;
      }
    }
    this.body.geometry.attributes.position.needsUpdate = true; this.body.geometry.computeVertexNormals(); this.body.geometry.computeBoundingSphere();
    // spikes
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), basis = new THREE.Matrix4();
    for (let k = 0; k < this.spikeCount; k++) {
      const i = Math.min(RINGS - 1, Math.round(((k + 1.5) / (this.spikeCount + 1)) * (RINGS - 1) * 0.98)), s = (i / (RINGS - 1)) * LEN, r = radiusAt(s), f = this.frames[i];
      const sp = v3().copy(P[i]).addScaledVector(f.U, r * 0.86 + 0.05);
      basis.makeBasis(f.R, f.U, f.T); q.setFromRotationMatrix(basis); const h = 0.25 + r * 0.45; sc.set(0.8 + r * 0.3, h, 0.8 + r * 0.3);
      m4.compose(sp.addScaledVector(f.U, h * 0.35), q, sc); this.spikes.setMatrixAt(k, m4);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    // head
    const hp = this.headPose(track, t, p);
    const hb = new THREE.Matrix4().makeBasis(hp.R, hp.U, hp.T); this.head.quaternion.setFromRotationMatrix(hb);
    this.head.position.copy(hp.pos).multiplyScalar(1 / S).addScaledVector(hp.T, -1.3).addScaledVector(hp.U, 0.0);
    this.jaw.rotation.x = (p.jaw || 0) * 0.55 + 0.04;
    this.mouthGlow.material.color.setRGB(1, 0.35 + (p.breath || 0) * 0.4, 0.05).multiplyScalar(0.25 + (p.breath || 0) * 2.2);
    this.mouthGlow.visible = (p.jaw || 0) > 0.05;
    this.eyeMat.color.setRGB(1, 0.62, 0.1).multiplyScalar(p.eyeOpen === undefined ? 1.6 : 0.15 + 1.6 * p.eyeOpen);
    // wings
    const ringW = 14, fw = this.frames[ringW], ringB = 30;
    const flap = p.flap ?? 0, flap2 = p.flap2 ?? flap, fold = p.fold ?? 0;
    const rot = (v, ang, axis) => v.applyAxisAngle(axis, ang);
    const toW = (x, y, z, f, base) => v3().copy(base).addScaledVector(f.R, x).addScaledVector(f.U, y).addScaledVector(f.T, z);
    const hips = P[ringB], hf = this.frames[ringB];
    for (const w of this.wings) {
      const sd = w.side, Z = new THREE.Vector3(0, 0, 1);
      const sh = new THREE.Vector3(sd * 0.9, 0.9, 0);
      const ua = new THREE.Vector3(sd * 1, 0.25, 0.55).normalize().multiplyScalar(5.2 * (1 - fold * 0.55)); rot(ua, -sd * flap, Z); if (fold) ua.set(sd * 0.55, 0.9, -0.2).multiplyScalar(fold).add(ua.clone().multiplyScalar(1 - fold));
      const E = sh.clone().add(ua);
      const fa = new THREE.Vector3(sd * 1, 0.05, -0.55).normalize().multiplyScalar(7.2 * (1 - fold * 0.75)); rot(fa, -sd * flap2, Z); if (fold) fa.lerp(new THREE.Vector3(-sd * 0.2, 0.2, -1).multiplyScalar(7.2 * 0.25), fold);
      const W = E.clone().add(fa);
      const fingers = [[1, 0.05, 0.6, 11], [1, 0.0, 0.0, 14], [0.9, -0.05, -0.55, 13.5], [0.7, -0.1, -1.0, 10.5]].map(([x, y, z, len]) => {
        const d = new THREE.Vector3(sd * x, y, z).normalize(); rot(d, -sd * (flap2 * 1.1 + 0.2), Z);
        if (fold) d.lerp(new THREE.Vector3(-sd * 0.15, 0.15, -1), fold).normalize();
        d.y -= 0.06 * Math.abs(Math.sin(flap2)) ; return W.clone().addScaledVector(d, len * (1 - fold * 0.72));
      });
      const B1 = new THREE.Vector3(sd * 0.9, 0, 0); // placeholder body attach (hips), converted separately
      const S = toW(sh.x, sh.y, sh.z, fw, P[ringW]), Ew = toW(E.x, E.y, E.z, fw, P[ringW]), Ww = toW(W.x, W.y, W.z, fw, P[ringW]);
      const Fw = fingers.map((f) => toW(f.x, f.y, f.z, fw, P[ringW]));
      const Bw = toW(sd * 1.0, 0.1, 0, hf, hips);
      const bones = [[S, Ew, 0.6], [Ew, Ww, 0.45], [Ww, Fw[0], 0.26], [Ww, Fw[1], 0.26], [Ww, Fw[2], 0.22], [Ww, Fw[3], 0.18]];
      w.bones.forEach((b, i) => this.place(b, bones[i][0], bones[i][1], bones[i][2]));
      // membrane triangles
      const tri = []; const mid = (a, b) => v3().copy(a).lerp(b, 0.5).lerp(Ww, 0.22);
      const chain = [Fw[0], Fw[1], Fw[2], Fw[3], Bw];
      for (let i = 0; i < chain.length - 1; i++) { const m = mid(chain[i], chain[i + 1]); tri.push([Ww, chain[i], m], [Ww, m, chain[i + 1]]); }
      tri.push([Ww, Bw, S], [S, Ew, Ww]);
      const arr = w.mem.geometry.attributes.position.array; let o = 0;
      for (const t3 of tri) for (const p3 of (sd > 0 ? t3 : [t3[0], t3[2], t3[1]])) { arr[o++] = p3.x; arr[o++] = p3.y; arr[o++] = p3.z; }
      w.mem.geometry.setDrawRange(0, tri.length * 3); w.mem.geometry.attributes.position.needsUpdate = true; w.mem.geometry.computeVertexNormals(); w.mem.geometry.computeBoundingSphere();
      this.place(w.claw, Ww, Ww.clone().addScaledVector(fw.T, 0.9).addScaledVector(fw.U, 0.4), 0.18, true);
    }
    // legs
    const ext = p.legExt ?? 0;
    for (const l of this.legs) {
      const f = this.frames[l.ring], base = P[l.ring], sz = l.big ? 1 : 0.8;
      const hip = toW(l.side * (radiusAt((l.ring / (RINGS - 1)) * LEN) * 0.8), -0.4, 0, f, base);
      const tuck = v3().copy(f.T).multiplyScalar(-1.8).addScaledVector(f.U, -1.0).addScaledVector(f.R, l.side * 0.25);
      const down = v3(0, -1, 0).multiplyScalar(2.6).addScaledVector(f.T, 0.4);
      const knee = hip.clone().add(tuck.clone().multiplyScalar(1 - ext).add(down.clone().multiplyScalar(ext)).multiplyScalar(sz * 0.5)).addScaledVector(f.R, l.side * 0.7 * ext);
      const foot = knee.clone().add(v3().copy(f.T).multiplyScalar(-1.5 * (1 - ext) + 0.3 * ext).addScaledVector(v3(0, -1, 0), 1.0 * ext + -0.1 * (1 - ext)).multiplyScalar(sz));
      this.place(l.t, hip, knee, 0.5 * sz); this.place(l.s, knee, foot, 0.34 * sz);
      l.f.position.copy(foot).addScaledVector(f.T, 0.5); l.f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.R, v3(0, 1, 0), f.T)); l.f.scale.setScalar(sz);
      l.claws.forEach((c, i) => { c.position.copy(foot).addScaledVector(f.T, 1.05 * sz).addScaledVector(f.R, (i - 1) * 0.3 * sz).addScaledVector(v3(0, -1, 0), 0.05); c.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.R, f.T.clone().negate(), v3(0, 1, 0).negate().cross(f.R).normalize())); });
    }
    // tail blade
    return this;
  }
  place(mesh, a, b, thick, cone) {
    const d = v3().subVectors(b, a), len = d.length() || 1e-3;
    mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
    if (cone) { mesh.position.copy(b); mesh.scale.set(1, 1, 1); mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), d); } else mesh.scale.set(thick, len, thick);
  }
}
