import test from 'node:test';
import assert from 'node:assert/strict';
import { botAssassinate, botCard, botPick, botPropose, botVote, distrust, merlinScore } from '../server/bots.js';
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

test('good bots read the record: they leave players off failed quests out of their teams and vote against them', () => {
  const failedWith = { b: 1, c: 2 };
  for (let s = 1; s < 200; s++) {
    // a clean team is possible (a + d + e), so it is the one proposed
    assert.deepEqual(botPropose(base({ rng: seeded(s), failedWith })).sort(), ['a', 'd', 'e']);
    // with only one clean seat left, the least-suspected of the rest fills the team
    assert.deepEqual(botPropose(base({ rng: seeded(s), size: 4, failedWith })).sort(), ['a', 'b', 'd', 'e']);
    // evil bots are not swayed by it
    const ev = botPropose(base({ rng: seeded(s), team: 'evil', allyIds: ['b'], failedWith }));
    assert.ok(ev.includes('a') && ev.length === 3);
  }
  const rate = (o) => { const rng = seeded(7); let y = 0; for (let i = 0; i < 4000; i++) if (botVote(base({ rng, failedWith, ...o }))) y++; return y / 4000; };
  assert.ok(Math.abs(rate({ proposedTeam: ['d', 'e'] }) - 0.65) < 0.03, 'a clean team: as before');
  assert.ok(Math.abs(rate({ proposedTeam: ['b', 'd'] }) - 0.3) < 0.03, 'someone from a failed quest: mostly rejected');
  assert.equal(rate({ proposedTeam: ['b', 'd'], rejectCount: 4 }), 1, 'but never the fifth proposal');
  assert.equal(rate({ proposedTeam: ['a', 'c'] }), 1, 'and always when the bot itself is on it');
});

test('a Merlin bot steers away from the evil it can see', () => {
  const evilSeen = ['d'];
  for (let s = 1; s < 200; s++) assert.ok(!botPropose(base({ rng: seeded(s), evilSeen })).includes('d'));
  assert.equal(distrust(base({ evilSeen }), 'd'), 3);
  assert.equal(distrust(base({ evilSeen, failedWith: { a: 3 } }), 'a'), 0, 'never distrusts itself');
  const rng = seeded(11);
  let y = 0;
  for (let i = 0; i < 4000; i++) if (botVote(base({ rng, evilSeen, proposedTeam: ['b', 'd'] }))) y++;
  assert.ok(Math.abs(y / 4000 - 0.1) < 0.02, `got ${y / 4000}`);
});

test('assassin bot reads the vote record for Merlin: whoever voted down evil teams and waved clean ones through', () => {
  // a is the Assassin, b its ally. d voted like someone who could see evil; e did the opposite.
  const all = (o) => ({ a: true, b: true, c: true, d: true, e: true, ...o });
  const history = [
    { leader: 'b', team: ['b', 'c'], votes: all({ d: false }), approved: true },
    { leader: 'e', team: ['e', 'b'], votes: all({ d: false }), approved: true },
    { leader: 'd', team: ['d', 'c'], votes: all({}), approved: true },
  ];
  const ctx = (o = {}) => base({ allyIds: ['b'], history, ...o });
  assert.equal(merlinScore(ctx(), 'd'), 3, 'two dirty teams voted down, one clean team proposed');
  assert.equal(merlinScore(ctx(), 'e'), -1, 'approved a dirty team and proposed one, approved a clean one');
  assert.equal(merlinScore(ctx(), 'c'), -1, 'its own team does not count; approved a dirty team');
  for (let s = 1; s < 100; s++) assert.equal(botAssassinate(ctx({ rng: seeded(s) })), 'd');
  // votes a stand-in cast while a player was away say nothing about them
  const away = history.map((h, i) => (i < 2 ? { ...h, standIn: ['d'] } : h));
  assert.equal(merlinScore(ctx({ history: away }), 'd'), 1, 'only the clean team d proposed counts');
  // ties are broken at random, never towards evil
  const picks = new Set();
  for (let s = 1; s < 100; s++) picks.add(botAssassinate(ctx({ rng: seeded(s), history: [] })));
  assert.deepEqual([...picks].sort(), ['c', 'd', 'e']);
});
