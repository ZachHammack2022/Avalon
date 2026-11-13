import test from 'node:test';
import assert from 'node:assert/strict';
import { botAssassinate, botCard, botPick, botPropose, botVote } from '../server/bots.js';
import { seeded } from '../shared/rng.js';

const ids = ['a', 'b', 'c', 'd', 'e'];
const base = (o = {}) => ({ selfId: 'a', team: 'good', allyIds: [], size: 3, playerIds: ids, proposedTeam: ['b', 'c'], rejectCount: 0, teamIds: ['a', 'b'], rng: seeded(1), ...o });

test('propose: includes self, correct size, distinct, valid ids', () => {
  for (let s = 1; s < 200; s++) {
    for (const team of ['good', 'evil']) {
      const t = botPropose(base({ rng: seeded(s), team, allyIds: team === 'evil' ? ['b'] : [] }));
      assert.equal(t.length, 3);
      assert.ok(t.includes('a'));
      assert.equal(new Set(t).size, 3);
      assert.ok(t.every((x) => ids.includes(x)));
    }
  }
});

test('vote: good approves ~65%, always if on the team, always on the fifth proposal', () => {
  const rng = seeded(3);
  let yes = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (botVote(base({ rng }))) yes++;
  assert.ok(Math.abs(yes / N - 0.65) < 0.03, `got ${yes / N}`);
  for (let i = 0; i < 50; i++) assert.equal(botVote(base({ rng, proposedTeam: ['a', 'b'] })), true);
  for (let i = 0; i < 50; i++) assert.equal(botVote(base({ rng, rejectCount: 4 })), true);
});

test('vote: evil approves iff an evil player is on the team (fifth proposal excepted)', () => {
  const ctx = base({ team: 'evil', allyIds: ['c'] });
  assert.equal(botVote({ ...ctx, proposedTeam: ['b', 'c'] }), true);
  assert.equal(botVote({ ...ctx, proposedTeam: ['b', 'd'] }), false);
  assert.equal(botVote({ ...ctx, proposedTeam: ['b', 'd'], rejectCount: 4 }), true);
});

test('quest: good always plays Success; evil Fails ~70% (less after a failed team)', () => {
  const rng = seeded(9);
  for (let i = 0; i < 100; i++) assert.equal(botCard(base({ rng })), 'success');
  const rate = (o) => { let f = 0; for (let i = 0; i < 5000; i++) if (botCard(base({ rng, team: 'evil', ...o })) === 'fail') f++; return f / 5000; };
  assert.ok(Math.abs(rate({}) - 0.7) < 0.03);
  assert.ok(rate({ lastTeamFailed: true }) < 0.5);
});

test('pick: framing target is a random good teammate; hero nomination is a teammate', () => {
  for (let s = 1; s < 100; s++) {
    const f = botPick(base({ rng: seeded(s), team: 'evil', allyIds: ['b'], teamIds: ['a', 'b', 'c'], card: 'fail' }));
    assert.equal(f, 'c', 'not self, not an ally');
    assert.ok(['a', 'b', 'c'].includes(botPick(base({ rng: seeded(s), teamIds: ['a', 'b', 'c'], card: 'success' }))));
  }
  assert.ok(['a', 'b'].includes(botPick(base({ team: 'evil', allyIds: ['b'], teamIds: ['a', 'b'], card: 'fail' }))), 'falls back when no good teammate');
});

test('assassin bot: never itself or a known ally', () => {
  for (let s = 1; s < 100; s++) {
    const t = botAssassinate(base({ rng: seeded(s), allyIds: ['b'] }));
    assert.ok(!['a', 'b'].includes(t));
  }
});
