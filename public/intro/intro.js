import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, lerp, smoothstep, ease, fbm, rng } from './util.js';
import { Track, Dragon } from './dragon.js';
import { makeSky, makeTerrain, makeTrees, heightAt, CAVE_PEAK } from './world.js';
import { Village } from './village.js';
import { makeCave, CAVE_X, heapH } from './cave.js';

export const DURATION = 62;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const MOUTH = (() => { const x = CAVE_PEAK.x + 45, z = CAVE_PEAK.z + 35; return V(x, heightAt(x, z) + 12, z); })();
// ---- dragon tracks (head position over time) ----
const outdoor = new Track([
  [0, 46, 112, -260], [5, 26, 92, -160], [9, 8, 66, -75], [11.5, 0, 40, -30], [13.5, -6, 34, 40],
  [15, -22, 38, 110], [16.8, 4, 40, 165], [18.2, 38, 33, 145], [19.6, 28, 26, 100], [21.2, 4, 17, 62],
  [23, 0, 14, 30], [25, 0, 12, -5], [27, 0, 12, -40], [28.6, 0, 15, -72],
  [30, -22, 32, -112], [33, -62, 60, -155], [36, -102, 92, -205], [39, -165, 118, -250], [42, -205, 142, -275],
  [45, MOUTH.x + 26, MOUTH.y + 6, MOUTH.z + 20], [47, MOUTH.x - 6, MOUTH.y, MOUTH.z - 4],
]);
const O = (x, y, z) => V(CAVE_X + x, y, z);
// cave: fly in from behind camera, circle the hoard, spiral down to the crest
const caveKeys = [[47, 4, 24, 70], [49, 2, 19, 42], [51, -14, 15, 12], [53, -26, 12, -14], [54.8, -10, 11.5, -30], [56.4, 14, 11, -22]];
{ let th = 0.2, r = 20; for (let t = 57.4; t <= 62.01; t += 0.6) { const f = (t - 57.4) / 4.6; th = 0.35 + f * 4.0; r = 20 - f * 12; const x = Math.cos(th) * r, z = Math.sin(th) * r * 0.8; caveKeys.push([t, x, heapH(x, z) + 1.9 + (1 - f) * 3.5, z]); } }
const cave = new Track(caveKeys.map(([t, x, y, z]) => [t, CAVE_X + x, y, z]));

// ---- dragon animation parameters as a function of time ----
function dragonParams(t) {
  const p = { flap: 0, flap2: 0, fold: 0, jaw: 0, breath: 0, headPitch: 0, bank: 0, legExt: 0, sway: 1, bob: 1, neckArch: 1 };
  const breath = smoothstep(21.4, 22.2, t) * (1 - smoothstep(28.2, 29.0, t));
  let amp = 0.55, f = 0.5;
  if (t < 9) { amp = 0.35 + 0.35 * smoothstep(0, 4, t); f = 0.42; }
  else if (t < 21) { amp = 0.7; f = 0.7; }
  else if (t < 29) { amp = lerp(0.65, 0.12, breath); f = 0.55; }
  else if (t < 47) { amp = 0.75; f = 0.75; }
  else if (t < 55) { amp = 0.6; f = 0.5; }
  else { amp = 0.5 * (1 - smoothstep(55.5, 58.5, t)); f = 0.45; }
  const ph = t * f * Math.PI * 2;
  p.flap = amp * Math.sin(ph) + 0.1; p.flap2 = amp * Math.sin(ph - 0.7) + 0.1;
  p.breath = breath; p.jaw = Math.max(breath, 0.0) * 0.95; p.headPitch = -0.26 * breath;
  if (t >= 58.5) { p.fold = smoothstep(58.5, 60.8, t) * 0.92; p.flap = lerp(p.flap, 0.1, p.fold); p.flap2 = p.flap; }
  if (t > 47) p.legExt = smoothstep(55.2, 56.8, t) * (1 - smoothstep(58.5, 60.0, t) * 0.8);
  p.eyeOpen = t > 59 ? 0.3 + 0.7 * smoothstep(60.4, 61.8, t) * 0 + 0.7 * smoothstep(60.8, 61.8, t) : 1;
  if (t > 58.5) p.eyeOpen = 0.08 + 0.92 * smoothstep(60.6, 61.8, t);
  if (t > 47) p.headLift = 2.6 * smoothstep(58.5, 60.3, t);
  if (t > 59.3) p.headPitch = -0.15 * smoothstep(59.3, 61, t);
  // bank from path curvature
  const tr = t < 47 ? outdoor : cave, h0 = tr.head(Math.max(tr.t0, t - 0.5)), h1 = tr.head(Math.min(tr.t1, t + 0.5)), hm = tr.head(clamp(t, tr.t0, tr.t1));
  const a = V(hm.x - h0.x, 0, hm.z - h0.z), b = V(h1.x - hm.x, 0, h1.z - hm.z);
  if (a.lengthSq() > 1e-4 && b.lengthSq() > 1e-4) { const cr = a.x * b.z - a.z * b.x; p.bank = clamp(-cr / (a.length() * b.length()) * 4.2, -0.9, 0.9) * (t < 56 ? 1 : 0); }
  return p;
}

// ---- camera shots: keys [time, px,py,pz, lx,ly,lz, fov] with Catmull-Rom; lookAt may blend with dragon head ----
function camPath(keys, t) {
  const n = keys.length; if (t <= keys[0][0]) return keys[0]; if (t >= keys[n - 1][0]) return keys[n - 1];
  let i = 0; while (keys[i + 1][0] < t) i++;
  const k = (j) => keys[clamp(j, 0, n - 1)], f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const out = [t]; const s = f * f * (3 - 2 * f) * 0.4 + f * 0.6;
  for (let c = 1; c < 8; c++) { const p0 = k(i - 1)[c], p1 = k(i)[c], p2 = k(i + 1)[c], p3 = k(i + 2)[c]; out.push(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)); }
  return out;
}

const SHOTS = [
  { id: 'S01', t0: 0, t1: 9, keys: [[0, -50, 9, 215, 20, 100, -260, 28], [9, -34, 12, 190, 10, 75, -200, 26]], follow: (t) => 0.2 + 0.7 * smoothstep(0, 8, t) },
  { id: 'S02', t0: 9, t1: 13, keys: [[9, 2, 1.75, 44, 0, 8, -40, 58], [13, 1, 1.75, 38, -1, 22, -10, 54]], follow: (t) => smoothstep(9.5, 11.5, t) },
  { id: 'S02b', t0: 13, t1: 18, keys: [[13, 3, 2.0, -34, 0, 38, 60, 50], [18, 2, 2.2, -30, -10, 40, 130, 46]], follow: (t) => 0.9 },
  { id: 'S03', t0: 18, t1: 30, keys: [[18, -100, 18, 190, 20, 30, 140, 36], [21, -96, 14, 110, 0, 16, 60, 34], [23.5, -92, 11, 50, 0, 12, 20, 34], [26, -90, 10, -5, 0, 10, -22, 34], [28.5, -84, 12, -55, 0, 14, -72, 36], [30, -70, 11, -60, 0, 15, -85, 40]], follow: (t) => 0.92 },
  { id: 'S04', t0: 30, t1: 38, keys: [[30, 0, 2.6, -8, -10, 22, -112, 52], [34, 1, 3, -10, -40, 55, -140, 44], [38, 2, 4, -12, -90, 92, -200, 38]], follow: (t) => 0.35 + 0.55 * smoothstep(30, 34, t) },
  { id: 'S05', t0: 38, t1: 47, dyn: true, keys: [[38, -90, 128, -160, -200, 135, -270, 38], [43, -145, 150, -190, -250, 150, -295, 36], [47, -170, 160, -215, -268, 152, -302, 34]], follow: (t) => 0.75 },
  { id: 'S06', t0: 47, t1: 62, keys: [[47, 8, 4.8, 44, 4, 8, -10, 62], [51, 4, 4.8, 40, -4, 9, -14, 58], [54.8, 22, 5.5, 34, -8, 9, -8, 52], [58, 38, 16, 34, -2, 9, -4, 44], [62, 30, 11, 26, -3, 10, -6, 34]].map((k) => [k[0], k[1] + CAVE_X, k[2], k[3], k[4] + CAVE_X, k[5], k[6], k[7]]), follow: (t) => t < 49 ? 0 : t < 56 ? 0.75 * smoothstep(49, 51, t) : (0.3 * (1 - smoothstep(56, 58, t)) + 0.95 * smoothstep(58, 59.5, t)) },
];

export async function createIntro(canvas, opts = {}) {
  const quality = opts.quality || 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  const W = opts.width || canvas.clientWidth || 1280, H = opts.height || canvas.clientHeight || 720;
  renderer.setPixelRatio(opts.pixelRatio || Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(W, H, !!opts.width ? true : false);
  if (opts.width) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const sky = makeSky(); scene.add(sky);
  const terrain = makeTerrain(); const trees = makeTrees(); const world = new THREE.Group(); world.add(terrain, trees); scene.add(world);
  const village = new Village(world);
  // cave scene env map: a bright warm studio-ish environment for gold reflections
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x201008);
  const addL = (c, i, x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) })); m.position.set(x, y, z); envScene.add(m); };
  addL(0xffa040, 6, 30, 10, 20, 12); addL(0xffd890, 8, -30, 20, -10, 10); addL(0x6080ff, 3, 0, 60, 0, 14); addL(0xff7020, 5, 0, 5, -40, 14); addL(0xffb060, 4, 20, -5, 30, 10);
  const env = pm.fromScene(envScene, 0.04).texture;
  const caveG = makeCave(env); scene.add(caveG);
  const dragon = new Dragon(); scene.add(dragon.group);
  // cave mouth on the mountain: dark arch + warm glow, plus a light
  { const mg = new THREE.Group(); mg.position.copy(MOUTH); const nrm = V(0.79, 0.12, 0.61).normalize(); mg.lookAt(MOUTH.clone().add(nrm));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(15, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.18).multiplyScalar(2.3) })); glow.scale.set(0.8, 1.05, 1); glow.position.z = 0.5; mg.add(glow);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(15, 3.2, 5, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2c2420, flatShading: true, roughness: 1 })); arch.scale.set(0.8, 1.05, 1.4); arch.position.z = 0.3; mg.add(arch);
    for (const s of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 6), arch.material); col.position.set(s * 12.2, -9, 0.3); mg.add(col); }
    const ml = new THREE.PointLight(0xff9a3a, 9000, 160, 1.5); ml.position.set(0, 0, 8); mg.add(ml); world.add(mg); }
  { // final hero camera: close on the resting head
    const he = dragon.headPose(cave, 61.9, dragonParams(61.9)).pos; const k = SHOTS[5].keys;
    k[k.length - 1] = [62, he.x + 13, he.y + 7.5, he.z - 3, he.x - 1, he.y + 3, he.z, 30]; k.splice(k.length - 1, 0, [60, he.x + 12, he.y + 7, he.z - 3, he.x, he.y + 2.6, he.z, 34]); }
  const dragonFill = new THREE.PointLight(0xff9a50, 0, 60, 1.6); scene.add(dragonFill);
  const dragonRim = new THREE.PointLight(0x7fa0ff, 0, 60, 1.6); scene.add(dragonRim);
  // lights
  const sunL = new THREE.DirectionalLight(0xffa860, 3.2); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
  const sc = sunL.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600; sunL.shadow.bias = -0.0006; sunL.shadow.normalBias = 0.5;
  scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight(0x7a8fb8, 0x3a2a1c, 0.9); scene.add(hemi);
  const fireLight = new THREE.PointLight(0xff7a20, 0, 120, 1.4); scene.add(fireLight);
  const fireLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff6a18, 0, 60, 1.5); scene.add(l); return l; });
  const sunDir = V(0.19, 0.22, -0.96).normalize(); sky.material.uniforms.uSun.value.copy(sunDir);
  scene.fog = new THREE.FogExp2(0xb86a48, 0.0008);

  // plan village destruction from the dragon track
  const headAt = (t) => dragon.headPose(outdoor, t, dragonParams(t)).pos;
  village.plan(outdoor, (t) => outdoor.head(t, V(0, 0, 0)), 21.6, 28.4);

  // ---- breath particles ----
  const NB = 7000, BT0 = 21.8, BT1 = 28.4, LIFE = 1.7, rb = rng(1234);
  const br = { o: new Float32Array(NB * 3), d: new Float32Array(NB * 3), b: new Float32Array(NB), s: new Float32Array(NB), v: new Float32Array(NB) };
  for (let i = 0; i < NB; i++) {
    const b = BT0 + (i / NB) * (BT1 - BT0); const hp = dragon.headPose(outdoor, b, dragonParams(b), {});
    const dir = hp.T.clone(); const sp = 0.16 + 0.2 * rb(); const a = rb() * 6.28; dir.addScaledVector(hp.R, Math.cos(a) * sp * rb()).addScaledVector(hp.U, Math.sin(a) * sp * rb()).normalize();
    br.o.set([hp.mouth.x, hp.mouth.y, hp.mouth.z], i * 3); br.d.set([dir.x, dir.y, dir.z], i * 3); br.b[i] = b; br.s[i] = rb(); br.v[i] = 34 + 22 * rb();
  }
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3)); bgeo.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(NB).fill(-1), 1)); bgeo.setAttribute('aSz', new THREE.BufferAttribute(new Float32Array(NB), 1));
  const bmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 700 } },
    vertexShader: 'attribute float aAge; attribute float aSz; uniform float uPx; varying float vA; void main(){ vA=aAge; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize = aAge<0.?0.: aSz*uPx/max(1.,-mv.z); }',
    fragmentShader: 'varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5||vA<0.) discard; float a=smoothstep(.5,0.,d)*(1.-vA*vA); vec3 col=mix(vec3(1.,.95,.6),vec3(1.,.32,.04),smoothstep(0.,.55,vA)); col=mix(col,vec3(.5,.06,0.),smoothstep(.55,1.,vA)); gl_FragColor=vec4(col*1.0,a*.38); }',
  });
  const breathPts = new THREE.Points(bgeo, bmat); breathPts.frustumCulled = false; breathPts.renderOrder = 5; scene.add(breathPts);
  const updateBreath = (t) => {
    const P = bgeo.attributes.position.array, A = bgeo.attributes.aAge.array, S = bgeo.attributes.aSz.array;
    for (let i = 0; i < NB; i++) {
      const age = t - br.b[i];
      if (age < 0 || age > LIFE) { A[i] = -1; continue; }
      const f = age / LIFE, d = br.v[i] * (age - 0.2 * age * age * 0.3);
      P[i * 3] = br.o[i * 3] + br.d[i * 3] * d; P[i * 3 + 1] = br.o[i * 3 + 1] + br.d[i * 3 + 1] * d + 3.0 * age * age; P[i * 3 + 2] = br.o[i * 3 + 2] + br.d[i * 3 + 2] * d;
      A[i] = f; S[i] = (1.5 + 10 * Math.sqrt(f)) * (0.6 + br.s[i] * 0.8);
    }
    bgeo.attributes.position.needsUpdate = bgeo.attributes.aAge.needsUpdate = bgeo.attributes.aSz.needsUpdate = true;
  };

  // ---- post ----
  const composer = new EffectComposer(renderer); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, new THREE.PerspectiveCamera()));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.6, 0.92); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uVig: { value: 0.35 }, uFade: { value: 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uVig; uniform float uFade; void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; vec2 q=vUv-.5; float v=1.-dot(q,q)*uVig*2.2; c*=v; float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,1.08); gl_FragColor=vec4(c*uFade,1.); }' });
  composer.addPass(grade);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 6000);
  composer.passes[0].camera = camera;

  const tmpH = V(0, 0, 0);
  function render(t) {
    t = clamp(t, 0, DURATION - 0.001);
    const inCave = t >= 47, mixN = smoothstep(26, 46, t) * 0.75;
    const shot = SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
    world.visible = !inCave; sky.visible = !inCave; caveG.visible = inCave;
    const dp = dragonParams(t); const track = inCave ? cave : outdoor; dragon.update(track, t, dp);
    // fire glow in sky once the village is burning
    sky.material.uniforms.uMix.value = mixN; sky.material.uniforms.uTime.value = t; sky.material.uniforms.uFire.value = smoothstep(22, 30, t) * (1 - smoothstep(38, 46, t));
    // camera
    const c = camPath(shot.keys, t); const hh = dragon.headPose(track, t, dp).pos;
    let w = shot.follow(t); const look = V(c[4], c[5], c[6]).lerp(hh, w);
    let dynPos = null;
    if (shot.dyn) { const a = outdoor.head(Math.max(outdoor.t0, t - 0.4), V(0, 0, 0)), b = outdoor.head(Math.min(outdoor.t1, t + 0.4), V(0, 0, 0)); const T = b.sub(a).normalize(), side = V().crossVectors(T, V(0, 1, 0)).normalize(); const k = smoothstep(38, 40, t); dynPos = hh.clone().addScaledVector(T, -105).addScaledVector(side, 42 + 8 * Math.sin(t * 0.4)).add(V(0, 22 + 6 * (1 - k), 0)); look.copy(hh).addScaledVector(T, 50).add(V(0, 4, 0)); }
    const sh = 0.05 * (shot.id === 'S06' ? 0.3 : 1); // handheld
    camera.position.set(c[1] + Math.sin(t * 1.3) * sh, c[2] + Math.sin(t * 1.7 + 1) * sh, c[3] + Math.cos(t * 1.1) * sh); if (dynPos) camera.position.copy(dynPos);
    camera.fov = c[7]; camera.aspect = W / H; camera.updateProjectionMatrix();
    { const dv = look.clone().sub(camera.position), hz = Math.hypot(dv.x, dv.z), maxUp = hz * Math.tan(1.15); if (dv.y > maxUp) look.y = camera.position.y + maxUp; }
    if (opts.camOverride) { const o = opts.camOverride; camera.position.set(...o.slice(0, 3)); camera.fov = o[6] || 40; camera.updateProjectionMatrix(); look.set(o[3], o[4], o[5]); }
    camera.lookAt(look);
    // lighting by phase
    const dusk = mixN;
    const sunMix = smoothstep(22, 36, t); sunL.color.setRGB(1.0, lerp(0.66, 0.55, sunMix), lerp(0.4, 0.5, sunMix)); sunL.intensity = lerp(3.4, 1.2, sunMix) * (inCave ? 0 : 1);
    sunL.position.copy(camera.position).addScaledVector(sunDir, 300); sunL.target.position.copy(camera.position).add(V(0, 0, -20)); if (shot.id === 'S03' || shot.id === 'S02' || shot.id === 'S02b' || shot.id === 'S04') { sunL.target.position.set(0, 0, 0); sunL.position.copy(sunDir).multiplyScalar(300); sunL.shadow.camera.left = -120; sunL.shadow.camera.right = 120; sunL.shadow.camera.top = 120; sunL.shadow.camera.bottom = -120; } else { sunL.castShadow = true; }
    hemi.intensity = inCave ? 0.0 : lerp(1.5, 1.5, dusk); hemi.color.setRGB(lerp(0.55, 0.42, dusk), lerp(0.6, 0.5, dusk), lerp(0.75, 0.85, dusk));
    scene.fog.color.setRGB(lerp(0.82, 0.3, dusk), lerp(0.4, 0.22, dusk), lerp(0.2, 0.24, dusk)); scene.fog.density = inCave ? 0 : lerp(0.0008, 0.0007, dusk);
    // fire lights: follow the three nearest burning houses to camera
    const burning = village.houses.filter((h) => t > h.ignite + 0.3 && t < h.ignite + 60).sort((a, b) => Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z));
    fireLights.forEach((l, i) => { const h = burning[i]; if (!h || inCave) { l.intensity = 0; return; } l.position.set(h.x, h.y + h.h + 2, h.z); l.intensity = 900 * clamp((t - h.ignite) / 2) * (0.85 + 0.15 * Math.sin(t * 23 + i * 5)); });
    const br01 = dp.breath; const mouth = dragon.headPose(outdoor, t, dp).mouth; fireLight.position.copy(mouth).add(V(0, -3, 0)); fireLight.intensity = (!inCave ? br01 : 0) * 2600;
    const px = renderer.getPixelRatio() * H * 0.9; village.update(t, px); bmat.uniforms.uPx.value = px; updateBreath(t);
    if (inCave) { const hp2 = dragon.headPose(cave, t, dp).pos; dragonFill.position.copy(hp2).add(V(6, 7, 8)); dragonFill.intensity = 260; dragonRim.position.copy(hp2).add(V(-9, 7, -9)); dragonRim.intensity = 420; } else { dragonFill.intensity = 0; dragonRim.intensity = 0; }
    // cave lighting animation
    if (inCave) { const L = caveG.userData.lights; L.torches.forEach((l, i) => { l.intensity = (i < 2 ? 260 : 180) * (0.9 + 0.1 * Math.sin(t * 17 + i * 3) * Math.sin(t * 9 + i)); }); scene.fog.density = 0.0022; scene.fog.color.setRGB(0.1, 0.06, 0.04); bloom.strength = 0.12; } else bloom.strength = 0.32;
    // fade in / out
    grade.uniforms.uFade.value = Math.min(smoothstep(0, 0.8, t), 1 - smoothstep(DURATION - 1.2, DURATION - 0.1, t) * (opts.fadeOut === false ? 0 : 1));
    composer.render();
  }
  return { opts, render, duration: DURATION, renderer, scene, camera, dragon, village, shots: SHOTS, dragonParams, outdoor, cave, composer, headAt: (t) => headAt(t) };
}
