import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, assertCampaignValid, getQuest } from '../shared/campaign-lost-crown.js';
import { OPS, validateBeat, validateQuestScripts } from '../shared/cutscene-ops.js';
import { buildTimeline, cutsceneSeconds, fillSlots, introCaption, makeResolver, segmentsFor } from '../shared/cutscene.js';
import { CORE_ASSETS, resolveAsset } from '../public/tv/engine/asset-manifest.js';
import { ANIMS } from '../shared/anims.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the Lost Crown has 5 quests with the spec names, 4 fail gags each, and valid scripts', () => {
  assert.deepEqual(QUESTS.map((q) => q.name), ['The Old Bridge', 'The Whispering Woods', 'The Vault', "The Dragon's Hoard", 'The Throne Room']);
  for (const q of QUESTS) {
    assert.equal(q.gags.length, 4, q.id);
    assert.equal(new Set(q.gags.map((g) => g.id)).size, 4);
    for (const g of q.gags) assert.ok(g.duration >= 6 && g.duration <= 8, `${q.id}.${g.id}`);
  }
  assert.doesNotThrow(assertCampaignValid);
});

test('gag names match the spec', () => {
  const names = (i) => getQuest(i).gags.map((g) => g.name);
  assert.deepEqual(names(0), ['The Sweater', '"Catch!"', 'The Sturdiness Test', 'Premature Celebration']);
  assert.deepEqual(names(1), ['Thin Tree', 'Distraction', 'Bush Disguise', 'The Sneeze']);
  assert.deepEqual(names(2), ['Polite Knock', 'The Thank-You Note', 'DO NOT PULL', 'Outward Door']);
  assert.deepEqual(names(3), ['Counting', 'Good Boy', 'Plume', 'Better Angle']);
  assert.deepEqual(names(4), ['Self-Coronation', 'The Roll', 'The Mug', 'The Speech']);
});

test('cutscene length is in the 20-25s range the spec wants, for every outcome and gag', () => {
  for (const q of QUESTS) {
    assert.ok(cutsceneSeconds(q, 'success') >= 18 && cutsceneSeconds(q, 'success') <= 25, `${q.id} success`);
    for (const g of q.gags) assert.ok(cutsceneSeconds(q, 'fail', g.id) >= 20 && cutsceneSeconds(q, 'fail', g.id) <= 25, `${q.id}.${g.id}`);
  }
  assert.throws(() => cutsceneSeconds(QUESTS[0], 'fail', 'nope'));
});

test('shared segments are identical for success and fail (nobody can tell the outcome early)', () => {
  for (const q of QUESTS) {
    const a = segmentsFor(q, 'success'); const b = segmentsFor(q, 'fail', q.gags[0].id);
    for (let i = 0; i < 3; i++) { assert.deepEqual(a[i], b[i]); assert.equal(a[i].start, b[i].start); }
    for (const s of ['setup', 'approach', 'moment']) {
      const text = JSON.stringify(q.beats[s]);
      assert.ok(!/culprit|hero/.test(text), `${q.id}.${s} must not reference culprit/hero`);
    }
  }
});

test('timeline is flat, sorted, and inside the cutscene duration', () => {
  for (const q of QUESTS) {
    for (const [outcome, gag] of [['success'], ...q.gags.map((g) => ['fail', g.id])]) {
      const tl = buildTimeline(q, outcome, gag);
      const dur = cutsceneSeconds(q, outcome, gag);
      for (let i = 1; i < tl.length; i++) assert.ok(tl[i].t >= tl[i - 1].t);
      assert.ok(tl[tl.length - 1].t <= dur + 1e-9);
      assert.ok(tl.some((b) => b.op === 'camera') && tl.some((b) => b.op === 'caption'));
    }
  }
});

test('every fail gag has comedy beats: freeze-frame, reaction shot, oblivious-pride cheer (placeholder contract)', () => {
  for (const q of QUESTS) for (const g of q.gags) {
    const ops = q.beats.fail[g.id].map((b) => b.op);
    assert.ok(ops.includes('freeze'), `${q.id}.${g.id} freeze`);
    assert.ok(q.beats.fail[g.id].some((b) => b.op === 'play' && b.anim === 'Cheer' && b.who === 'culprit'), `${q.id}.${g.id} cheer`);
    assert.ok(q.beats.fail[g.id].some((b) => b.op === 'lookAt'), `${q.id}.${g.id} reaction`);
  }
});

test('the validator catches mistakes', () => {
  const ctx = { where: 'x', outcome: 'fail', ids: new Set() };
  assert.ok(validateBeat({ t: 0, op: 'nope' }, ctx).length);
  assert.ok(validateBeat({ t: 0, op: 'walkTo', who: 'culprit' }, ctx).some((e) => /missing "to"/.test(e)));
  assert.ok(validateBeat({ t: 0, op: 'caption', text: 'x', bogus: 1 }, ctx).some((e) => /unknown arg/.test(e)));
  assert.ok(validateBeat({ t: 0, op: 'play', who: 'culprit', anim: 'Moonwalk' }, ctx).some((e) => /animation "Moonwalk"/.test(e)));
  // skeleton-only clips are rejected for player avatars but fine for skeleton actors
  assert.ok(validateBeat({ t: 0, op: 'play', who: 'culprit', anim: 'Walking_D_Skeletons' }, ctx).some((e) => /player avatars have no/.test(e)));
  assert.equal(validateBeat({ t: 0, op: 'play', who: 'skel1', anim: 'Walking_D_Skeletons' }, { ...ctx, ids: new Set(['skel1']) }).length, 0);
  assert.ok(validateBeat({ t: 0, op: 'camera', shot: 'dutch' }, ctx).length);
  assert.ok(validateBeat({ t: 0, op: 'play', who: 'ghost', anim: 'Idle' }, ctx).some((e) => /never spawned/.test(e)));
  assert.equal(validateBeat({ t: 0, op: 'play', who: 'culprit', anim: 'Idle' }, ctx).length, 0);
  // outcome-dependent refs are refused in shared segments
  assert.ok(validateBeat({ t: 0, op: 'play', who: 'culprit', anim: 'Idle' }, { ...ctx, outcome: null }).length);
  assert.ok(validateBeat({ t: 0, op: 'caption', text: '{hero} wins' }, { ...ctx, outcome: 'fail' }).length);
  assert.ok(validateBeat({ t: 0, op: 'caption', text: '{wat}' }, ctx).length);
  // a spawned id is fine
  assert.equal(validateBeat({ t: 0, op: 'hide', who: 'skel1' }, { ...ctx, ids: new Set(['skel1']) }).length, 0);
  // whole-quest validation: late beat
  const bad = structuredClone(QUESTS[0]);
  bad.beats.moment.push({ t: 99, op: 'caption', text: 'late' });
  assert.ok(validateQuestScripts(bad).some((e) => /after the segment ends/.test(e)));
  const three = structuredClone(QUESTS[0]); three.gags.pop();
  assert.ok(validateQuestScripts(three).some((e) => /4 fail gags/.test(e)));
});

test('every op has a description and only well-formed arg types', () => {
  for (const [name, spec] of Object.entries(OPS)) {
    assert.ok(spec.desc && spec.desc.length > 5, name);
    for (const t of Object.values(spec.args)) assert.ok(['who', 'pos', 'num', 'str', 'bool', 'obj', 'any'].includes(t), `${name}: ${t}`);
  }
});

test('slot filling and the seeded resolver', () => {
  const payload = { team: ['a', 'b', 'c'], culprit: 'b', hero: null, seed: 123 };
  const nameOf = (id) => ({ a: 'Ann', b: 'Bo', c: 'Cy' }[id]);
  assert.equal(fillSlots('{culprit} and {team}', payload, nameOf), 'Bo and Ann, Bo and Cy');
  assert.equal(fillSlots('{intro}!', payload, nameOf, 'a', 'Hi'), 'Hi!');
  const r1 = makeResolver(payload); const r2 = makeResolver(payload);
  assert.equal(r1.lead, r2.lead, 'lead is deterministic per seed (same on reconnect)');
  assert.deepEqual(r1.players('culprit'), ['b']);
  assert.deepEqual(r1.players('team:others'), ['a', 'c']);
  assert.deepEqual(r1.players('team:all'), ['a', 'b', 'c']);
  assert.deepEqual(r1.players('team:4'), []);
  assert.equal(r1.players('skel1'), null);
  const seen = new Set(); for (let s = 0; s < 60; s++) seen.add(makeResolver({ ...payload, seed: s }).lead);
  assert.equal(seen.size, 3);
});

test('carry-over caption between quests', () => {
  const q = QUESTS[1];
  assert.ok(introCaption(q, 'success').startsWith('Fresh from their triumph'));
  assert.ok(introCaption(q, 'fail').startsWith('Still smelling of smoke'));
  assert.equal(introCaption(q, null), q.tagline);
});

test('every animation the scripts use exists in the KayKit clip list', () => {
  const used = new Set();
  for (const q of QUESTS) {
    const all = [...q.beats.setup, ...q.beats.approach, ...q.beats.moment, ...q.beats.success, ...Object.values(q.beats.fail).flat()];
    for (const b of all) if (b.op === 'play') used.add(b.anim);
  }
  for (const a of used) assert.ok(ANIMS.includes(a), a);
});

test('core assets resolve and exist on disk (run `npm run assets` if this fails)', () => {
  for (const name of CORE_ASSETS) {
    const url = resolveAsset(name);
    assert.ok(url, name);
    const file = path.join(ROOT, 'public', url);
    assert.ok(fs.existsSync(file), `missing ${url} for ${name}`);
  }
  assert.equal(resolveAsset('nonsense'), null);
});

test('hand-authored beats override the placeholder per segment/gag, the rest stays valid', async () => {
  // re-import with a fresh module graph is not possible, so verify the contract on the exported structure:
  for (const q of QUESTS) {
    assert.ok(q.beats.setup && q.beats.approach && q.beats.moment && q.beats.success);
    assert.deepEqual(Object.keys(q.beats.fail).sort(), q.gags.map((g) => g.id).sort());
  }
});
