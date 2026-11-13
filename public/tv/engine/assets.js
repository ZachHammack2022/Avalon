// GLTF loading + caching. `instance()` returns a fresh clone (SkeletonUtils handles skinned meshes).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { resolveAsset } from './asset-manifest.js';

export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map(); // name -> Promise<gltf|null>
    this.ready = new Map(); // name -> gltf
    this.missing = new Set();
  }

  load(name) {
    if (!this.cache.has(name)) {
      const url = resolveAsset(name);
      const p = url
        ? this.loader.loadAsync(url).then((g) => { this.ready.set(name, g); return g; })
        : Promise.reject(new Error(`unknown asset "${name}"`));
      this.cache.set(name, p.catch((e) => { this.missing.add(name); console.warn(`[assets] ${name}: ${e.message || e}`); return null; }));
    }
    return this.cache.get(name);
  }

  async preload(names, onProgress) {
    let done = 0;
    await Promise.all([...new Set(names)].map((n) => this.load(n).then(() => onProgress && onProgress(++done, names.length))));
  }

  has(name) { return this.ready.has(name); }

  /** Synchronous clone of a preloaded asset (null if not loaded). Carries `userData.clips`. */
  instance(name) {
    const g = this.ready.get(name);
    if (!g) return null;
    const o = SkeletonUtils.clone(g.scene);
    o.userData.clips = g.animations || [];
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    return o;
  }
}

/** Fallback so a missing asset never breaks a cutscene: a visible magenta marker box. */
export function placeholder(size = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
  m.position.y = size / 2;
  const g = new THREE.Group(); g.add(m); return g;
}
