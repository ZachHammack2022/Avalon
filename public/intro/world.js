import * as THREE from 'three';
import { rng, fbm, ridged, clamp, lerp, smoothstep } from './util.js';

export const CAVE_PEAK = { x: -300, z: -330, h: 250 };
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const valley = smoothstep(95, 230, d);
  let h = (fbm(x * 0.006 + 10, z * 0.006) - 0.35) * 70 * valley * 0.5;
  h += Math.pow(ridged(x * 0.0028 + 4, z * 0.0028 + 9, 5), 2.2) * 330 * smoothstep(150, 520, d) * (0.55 + 0.45 * smoothstep(300, 700, d));
  // sun notch to the north so the sun clears the peaks
  const notch = Math.exp(-Math.pow((x - 40) / 140, 2)) * smoothstep(-200, -500, z) * 0.0;
  h -= notch;
  // mild rolling ground in the valley
  h += (fbm(x * 0.03, z * 0.03) - 0.5) * 3.2 * smoothstep(40, 110, d);
  // cave mountain
  const cx = x - CAVE_PEAK.x, cz = z - CAVE_PEAK.z, cd = Math.hypot(cx, cz);
  const cone = CAVE_PEAK.h * Math.pow(Math.max(0, 1 - cd / 190), 1.35) * (0.9 + 0.2 * fbm(x * 0.02, z * 0.02));
  h = Math.max(h, cone + h * 0.15);
  return h;
}

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(0.1, 0.1, -1).normalize() }, uMix: { value: 0 }, uTime: { value: 0 }, uFire: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform float uMix; uniform float uTime; uniform float uFire;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+7.1; a*=.5;} return s; }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        float sd = max(dot(d, normalize(uSun)), 0.);
        vec3 zenith = mix(vec3(0.05,0.16,0.32), vec3(0.015,0.045,0.13), uMix);
        vec3 mid = mix(vec3(0.55,0.28,0.2), vec3(0.12,0.17,0.32), uMix);
        vec3 horizon = mix(vec3(1.0,0.5,0.14), vec3(0.55,0.32,0.28), uMix);
        float t = clamp(y,0.,1.);
        vec3 col = mix(horizon, mid, smoothstep(0.0,0.22,t)); col = mix(col, zenith, smoothstep(0.12,0.75,t));
        col += vec3(1.0,0.55,0.18) * pow(sd, 6.) * 0.3 * (1.-uMix*0.6) + vec3(1.0,0.78,0.4) * pow(sd, 48.) * 0.6 * (1.-uMix*0.5);
        // sun disc
        float disc = smoothstep(0.9993, 0.9997, sd); col = mix(col, vec3(1.0,0.86,0.55)*3.0, disc*(1.-uMix));
        // clouds on a plane
        vec2 uv = d.xz / (abs(y)+0.12) * 0.9 + vec2(uTime*0.004, 0.);
        float c = fbm(uv*1.3); float c2 = fbm(uv*3.1+4.);
        float cl = smoothstep(0.48, 0.8, c*0.8 + c2*0.35) * smoothstep(-0.02, 0.1, y) * (1. - smoothstep(0.5, 0.9, y));
        vec3 under = mix(vec3(0.95,0.38,0.13), vec3(0.22,0.18,0.3), uMix) * (0.45 + 0.9*pow(sd,2.)) ;
        vec3 top = mix(vec3(0.35,0.2,0.28), vec3(0.08,0.1,0.18), uMix);
        vec3 ccol = mix(top, under, smoothstep(0.55,0.78,c) ) + vec3(1.,0.65,0.3)*pow(sd,5.)*0.9*(1.-uMix);
        col = mix(col, ccol, cl*0.88);
        // distant fire glow on the horizon
        col += vec3(1.,0.35,0.06) * uFire * smoothstep(0.35,0.0,y) * 0.5;
        // stars at night
        float st = step(0.997, h(floor(d.xz/(abs(y)+0.3)*260.))) * smoothstep(0.1,0.4,y) * uMix * 0.8; col += st;
        gl_FragColor = vec4(col,1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}

export function makeTerrain() {
  const SIZE = 2400, SEG = 400, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), r = rng(7);
  const grass = new THREE.Color(0x48601f), dry = new THREE.Color(0x6e6a2a), rock = new THREE.Color(0x4e4440), rock2 = new THREE.Color(0x6a5a50), snow = new THREE.Color(0xe8eef6), dirt = new THREE.Color(0x5a4326), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) , z = pos.getZ(i); const h = heightAt(x, z); pos.setY(i, h);
  }
  geo.computeVertexNormals(); const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = 1 - nrm.getY(i), d = Math.hypot(x, z);
    c.copy(grass).lerp(dry, fbm(x * 0.02, z * 0.02) * 1.2).multiplyScalar(0.8 + 0.4 * fbm(x * 0.1, z * 0.1));
    c.lerp(rock, smoothstep(0.1, 0.35, slope + clamp((h - 60) / 400)));
    c.lerp(rock2, fbm(x * 0.05, z * 0.05) * 0.4 * smoothstep(40, 120, h));
    c.lerp(snow, smoothstep(0.0, 1.0, clamp((h - (150 + fbm(x * 0.01, z * 0.01) * 50)) / 40)) * (1 - smoothstep(0.3, 0.6, slope)));
    c.lerp(dirt, (1 - smoothstep(3, 9, Math.abs(x))) * (1 - smoothstep(60, 100, Math.abs(z - 10))) ); // street
    c.lerp(dirt, (1 - smoothstep(10, 22, Math.hypot(x, z))) * 0.8); // plaza
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.receiveShadow = true; return m;
}

// instanced pines (two stacked cones) + trunk
export function makeTrees(count = 2600) {
  const rand = rng(21), g = new THREE.Group();
  const cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, 0.5, 0);
  const mats = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
  const cones = new THREE.InstancedMesh(cone, mats, count * 3), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x3a281a, flatShading: true }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0, k = 0;
  for (let i = 0; i < count * 6 && n < count; i++) {
    const ang = rand() * Math.PI * 2, dist = 30 + Math.pow(rand(), 0.7) * 700, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    if (Math.abs(x) < 24 && z > -80 && z < 100) continue; // keep village clear
    if (Math.hypot(x, z) < 24) continue;
    if (Math.hypot(x + 42, z - 200) < 55 || Math.hypot(x, z - 40) < 25) continue;
    const h = heightAt(x, z); if (h > 130) continue; if (fbm(x * 0.012, z * 0.012) < 0.42 && dist < 120) continue;
    const s = 4 + rand() * 7;
    trunks.setMatrixAt(n, m4.compose(new THREE.Vector3(x, h - 0.2, z), q.identity(), new THREE.Vector3(s * 0.2, s * 0.5, s * 0.2)));
    for (let l = 0; l < 3; l++) {
      const w = s * (0.62 - l * 0.14), hh = s * (0.55 - l * 0.05);
      cones.setMatrixAt(k, m4.compose(new THREE.Vector3(x, h + s * (0.3 + l * 0.3), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(w, hh, w)));
      c.setHSL(0.27 + rand() * 0.05, 0.4, 0.14 + rand() * 0.07 + l * 0.015); cones.setColorAt(k, c); k++;
    }
    n++;
  }
  cones.count = k; trunks.count = n; cones.castShadow = false; g.add(cones, trunks); return g;
}
