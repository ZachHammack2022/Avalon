// THE CUTSCENE CONTRACT.
// A cutscene is data: a list of beats `{ t, op, ...args }`. `t` is seconds from the start of the
// beat's segment. This file defines every op the TV engine understands (public/tv/engine/stage.js
// implements them) and a validator used by tests, the preview harness, and the server on boot.
//
// Arg type codes:  who  actor ref   | pos  position   | num  number   | str  string   | bool
//                  obj  free object | any  anything   | `?` prefix = optional
//
// Actor refs ("who"):
//   'culprit'  framed player (FAIL outcome segments only)
//   'hero'     nominated hero (SUCCESS outcome segments only)
//   'lead'     a seed-chosen team member; usable everywhere. NOT outcome-related, so it is safe in
//              the shared segments (setup/approach/moment), which must never hint at the outcome.
//   'team:0'..'team:4'  n-th team member (0-based, team order as proposed)
//   'team:all' every team member   'team:others' team members who are neither culprit nor hero
//   '<id>'     any actor you spawned with spawnActor, or listed in a scene's `ids`
// Positions: [x,y,z] | [x,z] (y = ground) | 'markName' (marks defined by the scene) | an actor ref
//   (position of that actor) | {at:ref, offset:[x,y,z]}

import { ANIMS, PLAYER_ANIMS } from './anims.js';

const CAMERA_SHOTS = ['wide', 'follow', 'closeUp', 'pushIn', 'lowAngle', 'overShoulder', 'orbit', 'shake', 'cut', 'crane'];
const FX_KINDS = ['firePuff', 'smoke', 'coinBurst', 'dust', 'sparkle', 'splash'];
const SFX = ['stinger', 'fanfare', 'wahwah', 'scratch', 'bonk', 'creak', 'clink', 'alarm', 'gasp', 'whoosh', 'thud', 'poof', 'splash', 'roar', 'rumble', 'ding', 'sneeze'];
const EASES = ['linear', 'in', 'out', 'inOut', 'bounce', 'back'];

export const OPS = {
  // --- actors ---
  formation: { args: { name: 'str', '?center': 'pos', '?facing': 'num', '?spacing': 'num', '?walk': 'bool', '?dur': 'num' },
    desc: "Arrange the whole team (sizes 2-5). name: line | column | arc | huddle | row. walk:true walks them there." },
  place:     { args: { who: 'who', at: 'pos', '?face': 'any' }, desc: 'Teleport an actor. face = degrees or a pos to look at.' },
  walkTo:    { args: { who: 'who', to: 'pos', '?speed': 'num', '?dur': 'num', '?anim': 'str' }, desc: 'Walk (Walking_A) then idle.' },
  runTo:     { args: { who: 'who', to: 'pos', '?speed': 'num', '?dur': 'num' }, desc: 'Run (Running_A) then idle.' },
  play:      { args: { who: 'who', anim: 'str', '?loop': 'bool', '?speed': 'num', '?fade': 'num', '?then': 'str' }, desc: 'Play a KayKit animation clip. loop:false clips return to `then` (default Idle).' },
  lookAt:    { args: { who: 'who', at: 'pos', '?dur': 'num' }, desc: 'Turn head/body toward a position or actor.' },
  face:      { args: { who: 'who', at: 'any', '?dur': 'num' }, desc: 'Turn body to face a position/actor/degrees.' },
  hide:      { args: { who: 'who' }, desc: 'Make an actor or prop invisible.' },
  show:      { args: { who: 'who' }, desc: 'Make an actor or prop visible.' },
  tweenTo:   { args: { who: 'who', '?pos': 'pos', '?rot': 'any', '?scale': 'any', dur: 'num', '?ease': 'str' }, desc: 'Cartoony motion for actors or props: position, rotation (deg [x,y,z]), scale (num or [x,y,z]).' },
  spawnActor:{ args: { id: 'str', kind: 'str', at: 'pos', '?face': 'any', '?scale': 'num', '?color': 'str' }, desc: 'kind: a class (knight|mage|rogue|barbarian|rogueHooded) or skeleton_warrior|skeleton_minion|skeleton_rogue|skeleton_mage.' },
  // --- props ---
  spawnProp: { args: { id: 'str', model: 'str', '?at': 'pos', '?scale': 'any', '?rot': 'any', '?color': 'str' }, desc: "model: 'builtin:<box|sphere|cylinder|cone|plank|note|crown|rope>' or an asset name from asset-manifest.js." },
  attach:    { args: { prop: 'str', who: 'who', '?slot': 'str', '?offset': 'any' }, desc: 'Attach a prop to an actor bone slot (handslot.r, handslot.l, head).' },
  detach:    { args: { prop: 'str', '?at': 'pos' }, desc: 'Drop a prop into the world at its current (or given) spot.' },
  arc:       { args: { id: 'str', to: 'pos', dur: 'num', '?height': 'num', '?spin': 'num' }, desc: 'Physics-free ballistic arc for a prop.' },
  removeProp:{ args: { id: 'str' }, desc: 'Delete a prop.' },
  fx:        { args: { kind: 'str', at: 'pos', '?count': 'num', '?scale': 'num' }, desc: `Particle burst. kind: ${FX_KINDS.join(' | ')}` },
  rig:       { args: { name: 'str', action: 'str', '?dur': 'num', '?args': 'obj' }, desc: "Call a scene-defined animation, e.g. {name:'bridge', action:'unravel', dur:3}. Rigs are registered by the scene (public/tv/scenes/*.js `rigs`)." },
  // --- camera ---
  camera:    { args: { shot: 'str', '?target': 'pos', '?target2': 'pos', '?dur': 'num', '?dist': 'num', '?height': 'num', '?angle': 'num', '?intensity': 'num', '?pos': 'pos', '?ease': 'str' },
    desc: `shot: ${CAMERA_SHOTS.join(' | ')}. shake uses intensity (0-1) for dur seconds; cut uses pos+target.` },
  // --- UI / audio / time ---
  caption:   { args: { text: 'str', '?dur': 'num', '?style': 'str' }, desc: 'Bottom caption (run through narrate()). Slots: {culprit} {hero} {team}.' },
  banner:    { args: { who: 'who', '?text': 'str', '?dur': 'num' }, desc: 'Name banner over an actor (default: their name).' },
  title:     { args: { text: 'str', '?dur': 'num' }, desc: 'Full-screen title card (time-skip captions, etc.).' },
  freeze:    { args: { '?caption': 'str', '?dur': 'num' }, desc: 'Record scratch + freeze frame + caption. Default caption: "Yep. That\'s {culprit}."' },
  sfx:       { args: { name: 'str', '?volume': 'num' }, desc: `One-shot sound. name: ${SFX.join(' | ')}` },
  music:     { args: { track: 'str' }, desc: "'scene' loop, or 'stop' (the beat of silence)." },
  slowmo:    { args: { scale: 'num', dur: 'num' }, desc: 'Scale time for dur real seconds. (Segment timing is NOT stretched; keep `at` times consistent.)' },
  fade:      { args: { to: 'str', '?dur': 'num' }, desc: "to: 'black' | 'clear'." },
};

export const KNOWN = { CAMERA_SHOTS, FX_KINDS, SFX, EASES };

const ACTOR_REF = /^(culprit|hero|lead|team:[0-4]|team:all|team:others|[a-z][A-Za-z0-9_-]*)$/;
const RESERVED = new Set(['culprit', 'hero', 'lead']);
const SHARED_SEGMENTS = ['setup', 'approach', 'moment'];

/** Collect actor/prop ids a script spawns, so refs can be checked. */
function spawned(beats, into) {
  for (const b of beats) if ((b.op === 'spawnActor' || b.op === 'spawnProp') && typeof b.id === 'string') into.add(b.id);
  return into;
}

const checkType = (type, v) => {
  switch (type) {
    case 'who': return typeof v === 'string';
    case 'pos': return typeof v === 'string' || (Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every((n) => typeof n === 'number')) || (v && typeof v === 'object' && 'at' in v);
    case 'num': return typeof v === 'number' && Number.isFinite(v);
    case 'str': return typeof v === 'string';
    case 'bool': return typeof v === 'boolean';
    case 'obj': return v && typeof v === 'object';
    default: return true;
  }
};

/** Validate one beat. `ctx.outcome` ('success'|'fail'|null=shared), `ctx.ids` set of spawned ids. Returns error strings. */
export function validateBeat(b, ctx) {
  const errs = [];
  const where = `${ctx.where} @${b && b.t}`;
  if (!b || typeof b !== 'object') return [`${where}: beat is not an object`];
  if (typeof b.t !== 'number' || b.t < 0) errs.push(`${where}: bad "t"`);
  const spec = OPS[b.op];
  if (!spec) return [...errs, `${where}: unknown op "${b.op}"`];
  const optional = new Set();
  const types = {};
  for (const [k, t] of Object.entries(spec.args)) {
    const name = k.replace('?', '');
    types[name] = t;
    if (k.startsWith('?')) optional.add(name);
  }
  for (const name of Object.keys(types)) {
    if (!(name in b)) { if (!optional.has(name)) errs.push(`${where}: ${b.op} missing "${name}"`); continue; }
    if (!checkType(types[name], b[name])) errs.push(`${where}: ${b.op}.${name} should be ${types[name]}`);
  }
  for (const k of Object.keys(b)) if (k !== 't' && k !== 'op' && !(k in types)) errs.push(`${where}: ${b.op} has unknown arg "${k}"`);

  const refs = [];
  for (const [name, t] of Object.entries(types)) if (t === 'who' && typeof b[name] === 'string') refs.push(b[name]);
  if (b.op === 'camera' && b.shot && !CAMERA_SHOTS.includes(b.shot)) errs.push(`${where}: unknown camera shot "${b.shot}"`);
  if (b.op === 'fx' && b.kind && !FX_KINDS.includes(b.kind)) errs.push(`${where}: unknown fx kind "${b.kind}"`);
  if (b.op === 'sfx' && b.name && !SFX.includes(b.name)) errs.push(`${where}: unknown sfx "${b.name}"`);
  for (const k of ['anim', 'then']) {
    if (!((b.op === 'play' || b.op === 'walkTo') && typeof b[k] === 'string')) continue;
    // player avatars only have the 76 Adventurer clips; skeletons/custom actors have 95
    const playerRef = typeof b.who === 'string' && (RESERVED.has(b.who) || b.who.startsWith('team:'));
    const pool = playerRef ? PLAYER_ANIMS : ANIMS;
    if (!pool.includes(b[k])) errs.push(`${where}: ${playerRef ? 'player avatars have no' : 'unknown'} animation "${b[k]}"`);
  }
  if (b.op === 'tweenTo' && b.ease && !EASES.includes(b.ease)) errs.push(`${where}: unknown ease "${b.ease}"`);
  for (const k of ['target', 'target2', 'pos', 'at', 'to']) if (typeof b[k] === 'string' && ACTOR_REF.test(b[k]) && (RESERVED.has(b[k]) || b[k].startsWith('team:'))) refs.push(b[k]);

  for (const [name, t] of Object.entries(types)) {
    const r = b[name];
    if (t === 'who' && typeof r === 'string' && !RESERVED.has(r) && !r.startsWith('team:') && ACTOR_REF.test(r) && !ctx.ids.has(r)) {
      errs.push(`${where}: ${b.op}.${name} refers to "${r}", which is never spawned (spawnActor/spawnProp) or listed in the quest's sceneIds`);
    }
  }
  for (const r of refs) {
    if (!ACTOR_REF.test(r)) { errs.push(`${where}: bad actor ref "${r}"`); continue; }
    if (r === 'culprit' && ctx.outcome !== 'fail') errs.push(`${where}: "culprit" is only available in fail segments (shared segments must not hint at the outcome)`);
    if (r === 'hero' && ctx.outcome !== 'success') errs.push(`${where}: "hero" is only available in success segments`);
    if (r === 'team:others' && !ctx.outcome) { /* fine: just team minus nobody known */ }
  }
  if (typeof b.text === 'string' || typeof b.caption === 'string') {
    const text = `${b.text || ''} ${b.caption || ''}`;
    for (const m of text.matchAll(/\{(\w+)\}/g)) {
      if (!['culprit', 'hero', 'team', 'lead', 'intro'].includes(m[1])) errs.push(`${where}: unknown slot {${m[1]}}`);
      if (m[1] === 'culprit' && ctx.outcome !== 'fail') errs.push(`${where}: {culprit} not allowed here`);
      if (m[1] === 'hero' && ctx.outcome !== 'success') errs.push(`${where}: {hero} not allowed here`);
    }
  }
  return errs;
}

/** Validate a whole quest definition's scripts. Returns a list of error strings (empty = valid). */
export function validateQuestScripts(quest) {
  const errs = [];
  const D = quest.durations;
  const ids = new Set(quest.sceneIds || []);
  const seg = (beats, name, len, outcome, extraIds) => {
    if (!Array.isArray(beats) || beats.length === 0) { errs.push(`${quest.id}.${name}: no beats`); return; }
    const local = new Set([...ids, ...extraIds]);
    spawned(beats, local);
    for (const b of beats) {
      errs.push(...validateBeat(b, { where: `${quest.id}.${name}`, outcome, ids: local }));
      if (typeof b.t === 'number' && b.t > len + 1e-6) errs.push(`${quest.id}.${name} @${b.t}: beat is after the segment ends (${len}s)`);
      if (typeof b.t === 'number' && typeof b.dur === 'number' && b.t + b.dur > len + 0.5) errs.push(`${quest.id}.${name} @${b.t}: ${b.op} runs ${b.dur}s past the segment end (${len}s)`);
    }
  };
  const shared = new Set();
  for (const s of SHARED_SEGMENTS) {
    seg(quest.beats[s], s, D[s], null, shared);
    spawned(quest.beats[s] || [], shared);
  }
  seg(quest.beats.success, 'success', D.success, 'success', shared);
  if (!quest.gags || quest.gags.length !== 4) errs.push(`${quest.id}: needs exactly 4 fail gags`);
  for (const g of quest.gags || []) {
    if (!(g.duration >= 6 && g.duration <= 8)) errs.push(`${quest.id}.${g.id}: fail gag duration should be 6-8s`);
    seg(quest.beats.fail && quest.beats.fail[g.id], `fail.${g.id}`, g.duration, 'fail', shared);
  }
  return errs;
}
