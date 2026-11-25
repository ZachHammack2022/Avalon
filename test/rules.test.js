import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRoles, buildRoleList, knowledgeFor, resolveQuest } from '../server/rules.js';
import { EVIL_COUNT, ROLES, isEvilRole, validateRoleConfig, ROLE_TOGGLES } from '../shared/avalon.js';
import { seeded } from '../shared/rng.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
/** Every combination of the role toggles (Merlin, Assassin, Percival, Morgana, Mordred, Oberon, Lancelot). */
function allConfigs() {
  const out = [];
  for (let mask = 0; mask < 1 << ROLE_TOGGLES.length; mask++) {
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
      for (const r of ['goodlancelot', 'evillancelot']) assert.equal(list.includes(r), v.config.lancelot, `${r} n=${n}`);
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
            assert.deepEqual([...set].sort(), evilIds.filter((e) => roleOf(e) !== 'mordred').sort(), 'Merlin: all evil except Mordred (Oberon and Evil Lancelot are visible)');
          } else if (role === 'goodlancelot' || role === 'evillancelot') {
            const other = role === 'goodlancelot' ? 'evillancelot' : 'goodlancelot';
            assert.equal(k.kind, 'lancelot');
            assert.deepEqual([...set], order.filter((x) => roleOf(x) === other), `${role} sees only the other Lancelot`);
          } else if (role === 'percival') {
            assert.deepEqual([...set].sort(), order.filter((x) => roleOf(x) === 'merlin' || roleOf(x) === 'morgana').sort());
          } else if (role === 'oberon') {
            assert.equal(set.size, 0, 'Oberon knows no one');
          } else if (isEvilRole(role)) {
            assert.deepEqual([...set].sort(), evilIds.filter((e) => e !== id && roleOf(e) !== 'oberon').sort(), `${role} sees evil except Oberon (Evil Lancelot included)`);
          } else {
            assert.equal(set.size, 0, `${role} knows nothing`);
          }
        }
      }
    }
  }
});

test('Lancelot: the two know each other; the Minions see Evil Lancelot, who does not see them; Merlin sees him', () => {
  const order = ids(8);
  const roles = ['merlin', 'percival', 'goodlancelot', 'loyal', 'loyal', 'assassin', 'morgana', 'evillancelot'];
  const a = new Map(order.map((id, i) => [id, roles[i]]));
  const k = (i) => knowledgeFor(order[i], a, order);
  assert.deepEqual(k(2).knows, ['p8']); assert.equal(k(2).kind, 'lancelot'); assert.match(k(2).note, /Evil Lancelot/);
  assert.deepEqual(k(7).knows, ['p3']); assert.equal(k(7).kind, 'lancelot'); assert.match(k(7).note, /do not know who they are/);
  assert.deepEqual(k(5).knows, ['p7', 'p8'], 'the Assassin sees Morgana and Evil Lancelot');
  assert.match(k(5).note, /One of them is Evil Lancelot/);
  assert.deepEqual(k(0).knows, ['p6', 'p7', 'p8'], 'Merlin sees every Minion, Evil Lancelot included');
  assert.deepEqual(k(1).knows, ['p1', 'p7'], 'Percival is unchanged');
  assert.deepEqual(k(3).knows, [], 'a Loyal Servant knows nobody');
});

test('Lancelot takes one good and one evil seat', () => {
  const list = buildRoleList(7, { lancelot: true });
  assert.deepEqual(list, ['merlin', 'goodlancelot', 'loyal', 'loyal', 'assassin', 'evillancelot', 'minion']);
  assert.throws(() => buildRoleList(5, { lancelot: true, morgana: true, percival: true }), /Too many evil roles/);
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
const mk = (n, q, c) => resolveQuest({ playerCount: n, questIndex: q, cards: cards(c) });

test('one Fail fails a normal quest; the result names the whole team, nobody singled out', () => {
  const r = mk(5, 0, { a: 'success', b: 'fail' });
  assert.equal(r.outcome, 'fail');
  assert.equal(r.failCount, 1);
  assert.deepEqual(Object.keys(r).sort(), ['failCount', 'outcome'], 'no culprit, no hero');
  const ok = mk(5, 0, { a: 'success', b: 'success' });
  assert.equal(ok.outcome, 'success');
  assert.deepEqual(Object.keys(ok).sort(), ['failCount', 'outcome']);
});

test('resolving a quest needs only the cards (no second choice, no randomness)', () => {
  const c = { a: 'fail', b: 'fail', c: 'success', d: 'success' };
  const first = mk(8, 1, c);
  for (let i = 0; i < 20; i++) assert.deepEqual(mk(8, 1, c), first);
  assert.deepEqual(first, { outcome: 'fail', failCount: 2 });
});

test('quest 4 at 7+ players needs two Fails; a single hidden Fail leaves a success', () => {
  for (const n of [7, 8, 9, 10]) {
    const one = mk(n, 3, { a: 'success', b: 'fail', c: 'success', d: 'success' });
    assert.equal(one.outcome, 'success', `n=${n}`);
    assert.equal(one.failCount, 1);
    const two = mk(n, 3, { a: 'fail', b: 'fail', c: 'success', d: 'success' });
    assert.equal(two.outcome, 'fail');
  }
  // 5-6 players: quest 4 fails on one
  assert.equal(mk(5, 3, { a: 'fail', b: 'success', c: 'success' }).outcome, 'fail');
  assert.equal(mk(6, 3, { a: 'fail', b: 'success', c: 'success' }).outcome, 'fail');
});

test('role notes mention the evil that is hidden from you: Mordred for Merlin, Oberon for the other Minions', () => {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
  const deal = (roles) => new Map(ids.slice(0, roles.length).map((id, i) => [id, roles[i]]));
  const full = deal(['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon']);
  assert.match(knowledgeFor('p1', full).note, /Mordred is evil too, but hidden from you/);
  for (const id of ['p7', 'p8', 'p9']) assert.match(knowledgeFor(id, full).note, /Oberon is evil too, but hidden from you/, id);
  assert.doesNotMatch(knowledgeFor('p10', full).note, /hidden from you\./, 'Oberon is told they work alone instead');
  assert.match(knowledgeFor('p10', full).note, /You work alone/);
  const plain = deal(['merlin', 'loyal', 'loyal', 'assassin', 'minion']);
  assert.doesNotMatch(knowledgeFor('p1', plain).note, /Mordred/);
  assert.doesNotMatch(knowledgeFor('p4', plain).note, /Oberon/);
  // good players hear nothing about the hidden evil (it is not their knowledge)
  for (const id of ['p2', 'p3']) assert.doesNotMatch(knowledgeFor(id, full).note, /Mordred|Oberon/);
});
