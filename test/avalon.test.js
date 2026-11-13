import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIL_COUNT, TEAM_SIZES, failsRequired, validateRoleConfig, normalizeRoleConfig, MIN_PLAYERS, MAX_PLAYERS } from '../shared/avalon.js';

test('tables match the Avalon rulebook', () => {
  assert.deepEqual(EVIL_COUNT, { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 });
  assert.deepEqual(TEAM_SIZES[5], [2, 3, 2, 3, 3]);
  assert.deepEqual(TEAM_SIZES[6], [2, 3, 4, 3, 4]);
  assert.deepEqual(TEAM_SIZES[7], [2, 3, 3, 4, 4]);
  for (const n of [8, 9, 10]) assert.deepEqual(TEAM_SIZES[n], [3, 4, 4, 5, 5]);
});

test('quest 4 needs two fails at 7+ players, everything else one', () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    for (let q = 0; q < 5; q++) assert.equal(failsRequired(n, q), q === 3 && n >= 7 ? 2 : 1, `n=${n} q=${q}`);
  }
});

test('default config: Merlin + Assassin', () => {
  const c = normalizeRoleConfig();
  assert.deepEqual(c, { merlin: true, assassin: true, percival: false, morgana: false, mordred: false, oberon: false });
});

test('Assassin is forced on whenever Merlin is on', () => {
  assert.equal(normalizeRoleConfig({ merlin: true, assassin: false }).assassin, true);
});

test('role validation: evil special roles may not exceed the evil count', () => {
  // 5 players: 2 evil. Assassin + Morgana ok; + Mordred is too many.
  assert.ok(validateRoleConfig(5, { percival: true, morgana: true }).ok);
  assert.equal(validateRoleConfig(5, { percival: true, morgana: true, mordred: true }).ok, false);
  // 7 players: 3 evil: Assassin+Morgana+Mordred ok, +Oberon not.
  assert.ok(validateRoleConfig(7, { percival: true, morgana: true, mordred: true }).ok);
  assert.equal(validateRoleConfig(7, { percival: true, morgana: true, mordred: true, oberon: true }).ok, false);
  assert.ok(validateRoleConfig(10, { percival: true, morgana: true, mordred: true, oberon: true }).ok);
});

test('Percival / Morgana without Merlin are blocked; Morgana without Percival only warns', () => {
  assert.equal(validateRoleConfig(7, { merlin: false, percival: true }).ok, false);
  assert.equal(validateRoleConfig(7, { merlin: false, morgana: true }).ok, false);
  const v = validateRoleConfig(7, { morgana: true });
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => /Morgana/.test(w)));
});

test('player count must be 5-10', () => {
  assert.equal(validateRoleConfig(4, {}).ok, false);
  assert.equal(validateRoleConfig(11, {}).ok, false);
  assert.ok(validateRoleConfig(5, {}).ok);
});
