import test from 'node:test';
import assert from 'node:assert/strict';
import { coachFor, questStrip, ROLE_TIPS, HOW_TO } from '../public/phone/guide.js';
import { ROLE_INFO } from '../shared/roles-info.js';

const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const st = (role, extra = {}) => ({ pub: { players, game: { questIndex: 3, rejectCount: 4, results: [] } }, me: { role, quest: { canFail: false }, ...extra } });

test('every role has tips and a description', () => {
  for (const r of Object.keys(ROLE_INFO)) assert.ok(ROLE_TIPS[r]?.length, r);
  assert.ok(HOW_TO.length >= 5);
});
test('quest card advice follows team', () => {
  assert.match(coachFor('quest-card', st('loyal')).text, /Success/);
  const evil = coachFor('quest-card', st('minion', { quest: { canFail: true } })).text;
  assert.match(evil, /Fail/); assert.match(evil, /TWO Fails/); // quest 4 with 7 players
});
test('vote advice warns on the last rejection', () => {
  assert.match(coachFor('vote', st('loyal')).text, /one more rejection/);
});
test('unknown screens give no coaching; strip reads right', () => {
  assert.equal(coachFor('cutscene', st('loyal')), null);
  assert.match(questStrip(st('loyal').pub), /Quest 4 of 5 · 4 on the team · 2 Fails/);
});
