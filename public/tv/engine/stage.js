// The Stage: a three.js world that executes cutscene ops (see shared/cutscene-ops.js).
// It owns the renderer, camera rig, actors, props, particles and the tween list.
import * as THREE from 'three';
import { Assets, placeholder } from './assets.js';
import { createActor } from './actor.js';
import { Fx } from './fx.js';
import { shotPose, shakeOffset, ease } from './camera.js';
import { formationSlots, angleDelta, yawToward } from './formation.js';
import { buildScene } from '../scenes/index.js';
import { CHARACTER_FILES } from './asset-manifest.js';
import { narrate } from './narrate.js';

const LOOPING = /(Idle|Walking|Running|Pose|Blocking|Aiming|Spellcasting|Taunt|Cheer_Loop)/;
const WALK_SPEED = 1.8; const RUN_SPEED = 5;
const toV3 = (a) => new THREE.Vector3(a[0], a.length === 2 ? 0 : a[1], a.length === 2 ? a[1] : a[2]);
const sanitizeBone = (n) => n.replace(/[.[\]:/]/g, '');

export class Stage {
  constructor(canvas, { assets = new Assets(), audio = null, hud = null, quality = 'high', preserveDrawingBuffer = false } = {}) {
    this.canvas = canvas; this.assets = assets; this.audio = audio; this.hud = hud; this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
    this.camera.position.set(0, 8, 16);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5); this.sun.castShadow = quality !== 'low';
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0005; this.scene.add(this.sun, this.sun.target);
    this.fx = new Fx(this.scene);
    this.actors = new Map(); this.props = new Map(); this.cast = new Map();
    this.tweens = []; this.pendingSpawns = [];
    this.sceneDef = null; this.sceneName = '';
    this.rt = null; // runtime context from the cutscene player: {resolver, payload, fill}
    this.time = 0; this.timeScale = 1; this.slow = null; this.frozenLeft = 0;
    this.silent = false;
    this.camSpec = { shot: 'wide' }; this.camStart = 0; this.camState = null; this.shake = null;
    this.stats = { frames: 0, fps: 0, _t: 0, _n: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth; const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ---------- world management ----------
  clearWorld() {
    for (const a of this.actors.values()) this.world.remove(a.root);
    for (const p of this.props.values()) p.removeFromParent();
    this.actors.clear(); this.props.clear(); this.cast.clear();
    this.tweens.length = 0; this.pendingSpawns.length = 0; this.fx.clear();
    this.timeScale = 1; this.slow = null; this.frozenLeft = 0; this.shake = null;
    if (this.sceneDef && this.sceneDef.root) { this.world.remove(this.sceneDef.root); this.sceneDef.dispose && this.sceneDef.dispose(); }
    this.sceneDef = null;
  }

  async loadScene(name, extraAssets = []) {
    this.clearWorld();
    const def = buildScene(name);
    await this.assets.preload([...(def.preload || []), ...extraAssets]);
    def.root = def.build(this);
    this.world.add(def.root);
    this.sceneDef = def; this.sceneName = name;
    this.scene.background = new THREE.Color(def.bg ?? 0x1a1a2e);
    this.scene.fog = def.fog ? new THREE.Fog(def.fog.color, def.fog.near, def.fog.far) : null;
    const hm = def.hemi || { sky: 0xffffff, ground: 0x666666, i: 1 };
    this.hemi.color.set(hm.sky); this.hemi.groundColor.set(hm.ground); this.hemi.intensity = hm.i;
    const sn = def.sun || { color: 0xffffff, i: 1.5, pos: [8, 14, 6] };
    this.sun.color.set(sn.color); this.sun.intensity = sn.i; this.sun.position.set(...sn.pos);
    this.sun.target.position.set(...(def.center || [0, 0, 0]));
    this.camSpec = { shot: 'wide' }; this.camState = null;
    return def;
  }

  /** Add a player's avatar (or any kind) to the world. */
  addActor({ id, kind, name, color, at = [0, 0, 0], yaw = 0, scale = 1, banner = true, player = false }) {
    const a = createActor(this.assets, { id, kind, name, color, withBanner: banner, withRing: player });
    a.root.position.copy(toV3(at)); a.setYaw(yaw); a.root.scale.setScalar(scale);
    this.world.add(a.root); this.actors.set(id, a);
    return a;
  }

  get marks() { return (this.sceneDef && this.sceneDef.marks) || {}; }
  teamCenter() {
    const list = [...this.cast.values()].filter((a) => !a.hidden);
    if (!list.length) return toV3(this.sceneDef && this.sceneDef.center ? this.sceneDef.center : [0, 0, 0]);
    const c = new THREE.Vector3(); for (const a of list) c.add(a.root.position); return c.multiplyScalar(1 / list.length);
  }

  // ---------- reference resolution ----------
  /** Resolve a "who" to a list of {actor?, obj} (actors and props). */
  objs(ref) {
    const ids = this.rt && this.rt.resolver.players(ref);
    if (ids) return ids.map((id) => this.cast.get(id)).filter(Boolean).map((actor) => ({ actor, obj: actor.root }));
    if (this.actors.has(ref)) { const actor = this.actors.get(ref); return [{ actor, obj: actor.root }]; }
    if (this.props.has(ref)) return [{ obj: this.props.get(ref) }];
    return [];
  }

  /** Resolve a position spec to a Vector3 (world, feet). Multi-target refs give the centroid. */
  pos(spec) {
    if (Array.isArray(spec)) return toV3(spec);
    if (typeof spec === 'string') {
      const m = this.marks[spec];
      if (m) return toV3(m);
      const os = this.objs(spec);
      if (os.length) { const c = new THREE.Vector3(); for (const o of os) { const w = new THREE.Vector3(); o.obj.getWorldPosition(w); c.add(w); } return c.multiplyScalar(1 / os.length); }
      throw new Error(`cannot resolve position "${spec}" (no such mark, actor or prop)`);
    }
    if (spec && typeof spec === 'object' && spec.at !== undefined) return this.pos(spec.at).add(toV3(spec.offset || [0, 0, 0]));
    throw new Error('bad position');
  }

  // ---------- tweens ----------
  tween({ dur, ease: e = 'inOut', update, done, owner, key, delay = 0 }) {
    if (owner) this.tweens = this.tweens.filter((t) => !(t.owner === owner && t.key === key));
    if (dur <= 0.0001 && delay <= 0) { update(1); done && done(); return; }
    this.tweens.push({ t: -delay, dur: Math.max(dur, 0.0001), e, update, done, owner, key });
  }
  _updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t += dt;
      if (tw.t < 0) continue; // still waiting out its delay
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(ease(tw.e, k));
      if (k >= 1) { this.tweens.splice(i, 1); tw.done && tw.done(); }
    }
  }

  moveActor(actor, to, { dur, speed = WALK_SPEED, anim = 'Walking_A', endYaw = null } = {}) {
    const from = actor.root.position.clone();
    const dist = from.distanceTo(to);
    const d = dur ?? dist / speed;
    if (dist > 0.05) actor.setYaw(yawToward([from.x, 0, from.z], [to.x, 0, to.z]));
    if (d <= 0.001 || dist < 0.02) { actor.root.position.copy(to); if (endYaw !== null) actor.setYaw(endYaw); return; }
    actor.play(anim, { loop: true });
    this.tween({ dur: d, ease: 'linear', owner: actor, key: 'move',
      update: (k) => actor.root.position.lerpVectors(from, to, k),
      done: () => { actor.play('Idle'); if (endYaw !== null) actor.setYaw(endYaw); } });
  }

  turnActor(actor, targetYaw, dur = 0.3) {
    const from = actor.yaw; const delta = angleDelta(from, targetYaw);
    this.tween({ dur, ease: 'out', owner: actor, key: 'turn', update: (k) => actor.setYaw(from + delta * k) });
  }

  // ---------- op execution ----------
  exec(beat) {
    const fn = this[`_op_${beat.op}`];
    if (!fn) { console.warn(`[stage] op not implemented: ${beat.op}`); return; }
    try { fn.call(this, beat); } catch (e) { console.error(`[stage] ${beat.op} failed:`, e.message, beat); }
  }
  _say(fn) { if (!this.silent && fn) fn(); }
  _text(t) { return this.rt ? this.rt.fill(t) : t; }

  _op_formation(b) {
    const team = this.rt.payload.team.map((id) => this.cast.get(id)).filter(Boolean);
    const center = b.center !== undefined ? this.pos(b.center) : this.pos('start');
    const slots = formationSlots(b.name, team.length, { center: [center.x, center.z], facing: b.facing ?? (this.sceneDef.forward ?? 90), spacing: b.spacing ?? 1.7 });
    team.forEach((a, i) => {
      const s = slots[i]; const to = new THREE.Vector3(s.x, 0, s.z);
      if (b.walk) this.moveActor(a, to, { dur: b.dur, endYaw: s.yaw }); else { a.root.position.copy(to); a.setYaw(s.yaw); }
    });
  }
  _op_place(b) {
    const to = this.pos(b.at);
    for (const { actor, obj } of this.objs(b.who)) {
      obj.position.copy(to);
      if (actor && b.face !== undefined) actor.setYaw(typeof b.face === 'number' ? b.face : yawToward([to.x, 0, to.z], this._xz(b.face)));
    }
  }
  _xz(spec) { const p = this.pos(spec); return [p.x, 0, p.z]; }
  _op_walkTo(b) { for (const { actor } of this.objs(b.who)) if (actor) this.moveActor(actor, this.pos(b.to), { dur: b.dur, speed: b.speed ?? WALK_SPEED, anim: b.anim || 'Walking_A' }); }
  _op_runTo(b) { for (const { actor } of this.objs(b.who)) if (actor) this.moveActor(actor, this.pos(b.to), { dur: b.dur, speed: b.speed ?? RUN_SPEED, anim: 'Running_A' }); }
  _op_play(b) {
    for (const { actor } of this.objs(b.who)) if (actor) actor.play(b.anim, { loop: b.loop ?? LOOPING.test(b.anim), fade: b.fade ?? 0.15, speed: b.speed ?? 1, then: b.then ?? 'Idle' });
  }
  _op_lookAt(b) { this._op_face({ ...b, dur: b.dur ?? 0.35 }); }
  _op_face(b) {
    for (const { actor } of this.objs(b.who)) {
      if (!actor) continue;
      const here = actor.root.position;
      const yaw = typeof b.at === 'number' ? b.at : yawToward([here.x, 0, here.z], this._xz(b.at));
      this.turnActor(actor, yaw, b.dur ?? 0.3);
    }
  }
  _op_hide(b) { for (const { actor, obj } of this.objs(b.who)) { if (actor) actor.setHidden(true); else obj.visible = false; } }
  _op_show(b) { for (const { actor, obj } of this.objs(b.who)) { if (actor) actor.setHidden(false); else obj.visible = true; } }
  _op_tweenTo(b) {
    for (const { actor, obj } of this.objs(b.who)) {
      const p0 = obj.position.clone(); const r0 = obj.rotation.clone(); const s0 = obj.scale.clone();
      const p1 = b.pos !== undefined ? this.pos(b.pos) : null;
      const r1 = b.rot ? new THREE.Euler(...b.rot.map((d) => (d * Math.PI) / 180)) : null;
      const s1 = b.scale !== undefined ? (Array.isArray(b.scale) ? new THREE.Vector3(...b.scale) : new THREE.Vector3(b.scale, b.scale, b.scale)) : null;
      this.tween({ dur: b.dur, ease: b.ease || 'inOut', owner: obj, key: 'tween',
        update: (k) => {
          if (p1) obj.position.lerpVectors(p0, p1, k);
          if (r1) { obj.rotation.set(r0.x + (r1.x - r0.x) * k, r0.y + (r1.y - r0.y) * k, r0.z + (r1.z - r0.z) * k); if (actor) actor.yaw = (obj.rotation.y * 180) / Math.PI; }
          if (s1) obj.scale.lerpVectors(s0, s1, k);
        } });
    }
  }
  _op_spawnActor(b) {
    const kind = b.kind;
    if (!CHARACTER_FILES[kind]) throw new Error(`unknown actor kind "${kind}"`);
    const make = () => {
      const at = this.pos(b.at);
      const a = this.addActor({ id: b.id, kind, name: b.id, color: b.color, at: [at.x, at.y, at.z], yaw: typeof b.face === 'number' ? b.face : 0, scale: b.scale ?? 1, banner: false });
      if (b.face !== undefined && typeof b.face !== 'number') a.setYaw(yawToward([at.x, 0, at.z], this._xz(b.face)));
    };
    if (this.assets.has(kind)) make(); else this.assets.load(kind).then(make);
  }
  _makeProp(model) {
    if (model.startsWith('builtin:')) return this._builtin(model.slice(8));
    return this.assets.instance(model) || (console.warn(`[stage] prop asset "${model}" not preloaded; add it to the scene's preload list`), placeholder(0.6));
  }
  _builtin(kind) {
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const g = new THREE.Group(); let m;
    switch (kind) {
      case 'box': m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x9b6b3a)); m.position.y = 0.5; break;
      case 'sphere': m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(0xcccccc)); m.position.y = 0.5; break;
      case 'cylinder': m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 20), mat(0xbbbbbb)); m.position.y = 0.5; break;
      case 'cone': m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 20), mat(0xcc5533)); m.position.y = 0.5; break;
      case 'plank': m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), mat(0x8a5a2b)); break;
      case 'note': m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.02), mat(0xf5ecd0)); m.position.y = 0.5; break;
      case 'rope': m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat(0xb59a6a)); m.position.y = 0.5; break;
      case 'crown': {
        m = new THREE.Group();
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.18, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }));
        m.add(band);
        for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), band.material); const a = (i / 5) * Math.PI * 2; t.position.set(Math.cos(a) * 0.27, 0.16, Math.sin(a) * 0.27); m.add(t); }
        m.position.y = 0.15; break;
      }
      default: throw new Error(`unknown builtin prop "${kind}"`);
    }
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(m); return g;
  }
  _op_spawnProp(b) {
    const o = this._makeProp(b.model);
    if (b.color) o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.set(b.color); } });
    if (b.at !== undefined) o.position.copy(this.pos(b.at));
    if (b.scale !== undefined) { if (Array.isArray(b.scale)) o.scale.set(...b.scale); else o.scale.setScalar(b.scale); }
    if (b.rot) o.rotation.set(...b.rot.map((d) => (d * Math.PI) / 180));
    this.world.add(o); this.props.set(b.id, o);
  }
  findBone(actor, slot) {
    return actor.model.getObjectByName(slot) || actor.model.getObjectByName(sanitizeBone(slot)) || null;
  }
  _op_attach(b) {
    const prop = this.props.get(b.prop); const t = this.objs(b.who)[0];
    if (!prop || !t || !t.actor) return console.warn(`[stage] attach ${b.prop} -> ${b.who} failed`);
    const bone = this.findBone(t.actor, b.slot || 'handslot.r') || t.actor.root;
    bone.add(prop); prop.position.set(...(b.offset || [0, 0, 0])); prop.rotation.set(0, 0, 0);
  }
  _op_detach(b) {
    const prop = this.props.get(b.prop); if (!prop) return;
    this.world.attach(prop);
    if (b.at !== undefined) prop.position.copy(this.pos(b.at));
  }
  _op_arc(b) {
    const prop = this.props.get(b.id); if (!prop) return;
    this.world.attach(prop);
    const from = prop.position.clone(); const to = this.pos(b.to); const h = b.height ?? 2;
    this.tween({ dur: b.dur, ease: 'linear', owner: prop, key: 'arc', update: (k) => {
      prop.position.lerpVectors(from, to, k); prop.position.y += h * 4 * k * (1 - k);
      if (b.spin) prop.rotation.z = ((b.spin * Math.PI) / 180) * k * b.dur;
    } });
  }
  _op_removeProp(b) { const p = this.props.get(b.id); if (p) { p.removeFromParent(); this.props.delete(b.id); } }
  _op_fx(b) { this.fx.burst(b.kind, this.pos(b.at), b.count ?? 16, b.scale ?? 1); }
  _op_rig(b) {
    const rig = this.sceneDef.rigs && this.sceneDef.rigs[b.name];
    const fn = rig && rig[b.action];
    if (!fn) return console.warn(`[stage] no rig ${b.name}.${b.action} in scene ${this.sceneName}`);
    fn(this, { dur: b.dur ?? 1, ...(b.args || {}) });
  }
  _op_camera(b) {
    if (b.shot === 'shake') { this.shake = { i: b.intensity ?? 0.5, until: this.time + (b.dur ?? 0.6) }; return; }
    this.camSpec = { ...b, start: this.time }; if (b.shot === 'cut') this.camState = null;
  }
  // every caption goes through narrate() so a spoken narrator can be added later (see narrate.js)
  _op_caption(b) { this._say(() => narrate(this._text(b.text), { dur: b.dur ?? 3, style: b.style })); }
  _op_banner(b) { for (const { actor } of this.objs(b.who)) if (actor) actor.showBanner(b.dur ?? 2, b.text ? this._text(b.text) : undefined); }
  _op_title(b) { this._say(() => this.hud && this.hud.title(this._text(b.text), b.dur ?? 2)); }
  _op_freeze(b) {
    const dur = b.dur ?? 1.2;
    this._say(() => { this.audio && this.audio.sfx('scratch'); this.hud && this.hud.freeze(this._text(b.caption ?? "Yep. That's {culprit}."), dur); });
    this.frozenLeft = dur;
  }
  _op_sfx(b) { this._say(() => this.audio && this.audio.sfx(b.name, b.volume ?? 1)); }
  _op_music(b) { this._say(() => this.audio && this.audio.music(b.track === 'scene' ? (this.sceneDef && this.sceneDef.music) : b.track)); }
  _op_slowmo(b) { this.slow = { scale: b.scale, left: b.dur }; }
  _op_fade(b) { this._say(() => this.hud && this.hud.fade(b.to, b.dur ?? 0.6)); }

  // ---------- frame ----------
  _camTargets(spec) {
    const center = this.teamCenter();
    const ctx = { center: center.toArray() };
    if (spec.target !== undefined) ctx.target = this.pos(spec.target).toArray();
    if (spec.target2 !== undefined) ctx.target2 = this.pos(spec.target2).toArray();
    if (spec.shot === 'cut' && spec.pos) spec.pos = Array.isArray(spec.pos) ? spec.pos : this.pos(spec.pos).toArray();
    return ctx;
  }
  _updateCamera(dt) {
    const spec = this.camSpec;
    let pose;
    try {
      const k = spec.dur ? Math.min(1, (this.time - spec.start) / spec.dur) : 0;
      const sd = this.sceneDef;
      const withDefaults = { ...spec, dist: spec.dist ?? (spec.shot === 'wide' ? sd && sd.wideDist : undefined), height: spec.height ?? (spec.shot === 'wide' ? sd && sd.wideHeight : undefined), angle: spec.angle ?? (spec.shot === 'wide' && sd ? sd.wideAngle : 0) };
      pose = shotPose(withDefaults, this._camTargets(spec), k);
    } catch (e) { return; } // transient while a scene is loading / a target does not exist yet
    const pos = new THREE.Vector3(...pose.pos); const look = new THREE.Vector3(...pose.look);
    if (!this.camState) this.camState = { pos: pos.clone(), look: look.clone(), fov: pose.fov };
    const a = 1 - Math.exp(-dt * 7); // smooth transitions between shots (~0.4s)
    this.camState.pos.lerp(pos, a); this.camState.look.lerp(look, a); this.camState.fov += (pose.fov - this.camState.fov) * a;
    this.camera.position.copy(this.camState.pos);
    if (this.shake && this.time < this.shake.until) { const o = shakeOffset(this.shake.i, this.time); this.camera.position.x += o[0]; this.camera.position.y += o[1]; this.camera.position.z += o[2]; } else this.shake = null;
    this.camera.lookAt(this.camState.look);
    if (Math.abs(this.camera.fov - this.camState.fov) > 0.01) { this.camera.fov = this.camState.fov; this.camera.updateProjectionMatrix(); }
  }

  update(dt) {
    this.time += dt;
    if (this.frozenLeft > 0) { this.frozenLeft -= dt; return; }
    if (this.slow) { this.slow.left -= dt; if (this.slow.left <= 0) this.slow = null; }
    const w = dt * (this.slow ? this.slow.scale : 1);
    this._updateTweens(w);
    for (const a of this.actors.values()) a.update(w);
    this.fx.update(w);
    if (this.sceneDef && this.sceneDef.update) this.sceneDef.update(w, this);
    this._updateCamera(dt);
  }

  render(dtReal = 0) {
    this.renderer.render(this.scene, this.camera);
    const s = this.stats; s.frames++; s._t += dtReal; s._n++;
    if (s._t >= 0.5) { s.fps = s._n / s._t; s._t = 0; s._n = 0; }
  }
}
