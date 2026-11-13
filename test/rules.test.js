import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRoles, buildRoleList, knowledgeFor, resolveQuest } from '../server/rules.js';
import { EVIL_COUNT, ROLES, isEvilRole, validateRoleConfig, ROLE_TOGGLES } from '../shared/avalon.js';
import { seeded } from '../shared/rng.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
/** Every combination of the 4 optional toggles (+ merlin on/off). */
function allConfigs() {
  const out = [];
  for (let mask = 0; mask < 64; mask++) {
    const cfg = {};
    ROLE_TOGGLES.forEach((k, i) => { cfg[k] = !!(mask & (1 << i)); });
    out.push(cfg);
  }
  return out;
}

test('role list has the right size and team split for every valid player count x role combo', () => {
  let tested = 0;
  for (let n = 5; n <= 10; n++) {
    for (const cfg of allConfigs()) {
      const v = validateRoleConfig(n, cfg);
      if (!v.ok) { assert.throws(() => buildRoleList(n, cfg)); continue; }
      const list = buildRoleList(n, cfg);
      assert.equal(list.length, n);
      assert.equal(list.filter(isEvilRole).length, EVIL_COUNT[n], `evil count n=${n}`);
      for (const r of ['merlin', 'percival', 'morgana', 'mordred', 'oberon']) assert.equal(list.includes(r), v.config[r], `${r} n=${n}`);
      assert.equal(list.includes('assassin'), v.config.assassin);
      assert.equal(new Set(list.filter((r) => ROLES[r].special)).size, list.filter((r) => ROLES[r].special).length, 'specials unique');
      tested++;
    }
  }
  assert.ok(tested > 100);
});

/** Table-driven check of the knowledge rules over every valid game and many deals. */
test('role knowledge matches the goals table for every combination', () => {
  for (let n = 5; n <= 10; n++) {
    for (const cfg of allConfigs()) {
      if (!validateRoleConfig(n, cfg).ok) continue;
      for (let seed = 1; seed <= 4; seed++) {
        const order = ids(n);
        const a = assignRoles(order, cfg, seeded(seed * 31 + n));
        const roleOf = (id) => a.get(id);
        const evilIds = order.filter((id) => isEvilRole(roleOf(id)));
        for (const id of order) {
          const k = knowledgeFor(id, a, order);
          const role = roleOf(id);
          const set = new Set(k.knows);
          assert.ok(!set.has(id), 'never lists self');
          if (role === 'merlin') {
            assert.deepEqual([...set].sort(), evilIds.filter((e) => roleOf(e) !== 'mordred').sort(), 'Merlin: all evil except Mordred (Oberon is visible)');
          } else if (role === 'percival') {
            assert.deepEqual([...set].sort(), order.filter((x) => roleOf(x) === 'merlin' || roleOf(x) === 'morgana').sort());
          } else if (role === 'oberon') {
            assert.equal(set.size, 0, 'Oberon knows no one');
          } else if (isEvilRole(role)) {
            assert.deepEqual([...set].sort(), evilIds.filter((e) => e !== id && roleOf(e) !== 'oberon').sort(), `${role} sees evil except Oberon`);
          } else {
            assert.equal(set.size, 0, `${role} knows nothing`);
          }
        }
      }
    }
  }
});

test('knowledge lists are in seat order (cannot leak role order)', () => {
  const order = ids(7);
  const a = assignRoles(order, { percival: true, morgana: true, mordred: true }, seeded(5));
  for (const id of order) {
    const k = knowledgeFor(id, a, order);
    assert.deepEqual(k.knows, order.filter((x) => k.knows.includes(x)));
  }
});

const cards = (obj) => new Map(Object.entries(obj));
const mk = (n, q, c, p, seed = 7) => resolveQuest({ playerCount: n, questIndex: q, cards: cards(c), picks: cards(p), rng: seeded(seed) });

test('one Fail fails a normal quest and shows exactly one culprit', () => {
  const r = mk(5, 0, { a: 'success', b: 'fail' }, { a: 'a', b: 'a' });
  assert.equal(r.outcome, 'fail');
  assert.equal(r.culprit, 'a', "the failer's framing pick");
  assert.equal(r.hero, null);
});

test('culprit is always drawn from the FAIL players framing picks, never success players picks', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = mk(8, 1, { a: 'success', b: 'fail', c: 'fail', d: 'success' }, { a: 'a', b: 'c', c: 'd', d: 'a' }, seed);
    assert.equal(r.outcome, 'fail');
    assert.ok(['c', 'd'].includes(r.culprit), `got ${r.culprit}`);
  }
});

test('with several Fails the culprit varies over the fail players picks (random)', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 100; seed++) seen.add(mk(8, 1, { a: 'fail', b: 'fail', c: 'success', d: 'success' }, { a: 'c', b: 'd', c: 'a', d: 'a' }, seed).culprit);
  assert.deepEqual([...seen].sort(), ['c', 'd']);
});

test('quest 4 at 7+ players needs two Fails; a single hidden Fail leaves a success (and no hero from the failer)', () => {
  for (const n of [7, 8, 9, 10]) {
    const one = mk(n, 3, { a: 'success', b: 'fail', c: 'success', d: 'success' }, { a: 'a', b: 'b', c: 'a', d: 'a' });
    assert.equal(one.outcome, 'success', `n=${n}`);
    assert.equal(one.failCount, 1);
    assert.notEqual(one.hero, 'b', "the failer's pick is a framing target, not a hero nomination");
    const two = mk(n, 3, { a: 'fail', b: 'fail', c: 'success', d: 'success' }, { a: 'c', b: 'c', c: 'a', d: 'a' });
    assert.equal(two.outcome, 'fail');
  }
  // 5-6 players: quest 4 fails on one
  assert.equal(mk(5, 3, { a: 'fail', b: 'success', c: 'success' }, { a: 'b', b: 'a', c: 'a' }).outcome, 'fail');
  assert.equal(mk(6, 3, { a: 'fail', b: 'success', c: 'success' }, { a: 'b', b: 'a', c: 'a' }).outcome, 'fail');
});

test('success: hero is chosen among success players nominations only', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = mk(7, 3, { a: 'success', b: 'fail', c: 'success', d: 'success' }, { a: 'c', b: 'b', c: 'a', d: 'c' }, seed);
    assert.equal(r.outcome, 'success');
    assert.ok(['c', 'a'].includes(r.hero));
  }
});
