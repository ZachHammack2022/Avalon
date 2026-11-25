import test from 'node:test';
import assert from 'node:assert/strict';
import { coachFor, counselFor, questStrip, roleTips, ROLE_TIPS, HOW_TO } from '../public/phone/guide.js';
import { ROLE_INFO } from '../shared/roles-info.js';

const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const st = (role, extra = {}) => ({ pub: { players, game: { questIndex: 3, rejectCount: 4, results: [] } }, me: { role, quest: { canFail: false }, ...extra } });

test('every role has tips and a description', () => {
  for (const r of Object.keys(ROLE_INFO)) assert.ok(ROLE_TIPS[r]?.length, r);
  assert.ok(HOW_TO.length >= 5);
});
test('secret counsel follows team; the on-screen hint never does', () => {
  assert.match(counselFor('quest-card', st('loyal')), /Success/);
  const evil = counselFor('quest-card', st('minion', { quest: { canFail: true } }));
  assert.match(evil, /Fail/); assert.match(evil, /TWO Fails/); // quest 4 with 7 players
  for (const screen of ['roleReveal', 'waitLeader', 'propose', 'vote', 'voted', 'quest-card', 'quest-pick', 'watchQuest', 'assassinate', 'waitAssassin'])
    assert.equal(coachFor(screen, st('loyal')), coachFor(screen, st('minion')), screen);
});
test('vote hint warns on the last rejection', () => {
  assert.match(coachFor('vote', st('loyal')), /Last chance/);
});
test('unknown screens give no hint; strip reads right', () => {
  assert.equal(coachFor('cutscene', st('loyal')), null);
  assert.match(questStrip(st('loyal').pub), /Quest 4 of 5 · team of 4 · needs 2 Fails/);
});

test('role tips follow the roles in this game', () => {
  const cfg = (o) => ({ merlin: true, assassin: true, percival: false, morgana: false, mordred: false, oberon: false, ...o });
  // without a game, the general tips
  for (const r of Object.keys(ROLE_TIPS)) assert.deepEqual(roleTips(r, null), ROLE_TIPS[r]);
  // Percival without Morgana sees only Merlin
  assert.match(roleTips('percival', cfg({ percival: true })).join(' '), /Morgana is not in this game/);
  assert.doesNotMatch(roleTips('percival', cfg({ percival: true })).join(' '), /You do not know which/);
  assert.deepEqual(roleTips('percival', cfg({ percival: true, morgana: true })), ROLE_TIPS.percival);
  // Merlin hears about Mordred only when Mordred is dealt in
  assert.doesNotMatch(roleTips('merlin', cfg()).join(' '), /Mordred, if|Mordred is in/);
  assert.match(roleTips('merlin', cfg({ mordred: true })).join(' '), /Mordred is in this game/);
  // the Minions that know each other hear about Oberon; Oberon and the good roles do not
  for (const r of ['minion', 'assassin', 'morgana', 'mordred']) assert.match(roleTips(r, cfg({ oberon: true })).join(' '), /Oberon is in this game/, r);
  for (const r of ['oberon', 'loyal', 'merlin', 'percival']) assert.doesNotMatch(roleTips(r, cfg({ oberon: true })).join(' '), /Oberon is in this game/, r);
  for (const r of Object.keys(ROLE_TIPS)) assert.ok(roleTips(r, cfg({ percival: true, morgana: true, mordred: true, oberon: true })).length, r);
});
