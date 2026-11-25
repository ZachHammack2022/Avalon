import test from 'node:test';
import assert from 'node:assert/strict';
import { assassinRead, coachFor, counselFor, evilRead, merlinRead, percivalRead, questStrip, secretRead, roleTips, ROLE_TIPS, HOW_TO } from '../public/phone/guide.js';
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
  for (const screen of ['roleReveal', 'waitLeader', 'propose', 'vote', 'voted', 'quest-card', 'watchQuest', 'assassinate', 'waitAssassin'])
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
  for (const r of ['minion', 'assassin', 'morgana', 'mordred']) assert.match(roleTips(r, cfg({ lancelot: true })).join(' '), /Evil Lancelot is among the allies you see/, r);
  assert.doesNotMatch(roleTips('minion', cfg({})).join(' '), /Lancelot/);
});

test('roles in play: the special roles switched on, named in the usual order', async () => {
  const { rolesInPlay, rolesText } = await import('../shared/roles-info.js');
  assert.deepEqual(rolesInPlay({ oberon: true, merlin: true, assassin: true }), ['merlin', 'assassin', 'oberon']);
  assert.equal(rolesText({ merlin: true }), 'Merlin');
  assert.equal(rolesText({ merlin: true, assassin: true, mordred: true }), 'Merlin, Assassin and Mordred');
  assert.equal(rolesText({}), 'No special roles');
  assert.equal(rolesText(null), 'No special roles');
});

test('Percival reads the record: how each of the two candidates voted on teams that failed', () => {
  const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
  const game = { questIndex: 2, results: [
    { questIndex: 0, outcome: 'fail', team: ['p0', 'p1'] },
    { questIndex: 1, outcome: 'fail', team: ['p0', 'p2', 'p3'] },
  ], history: [
    { questIndex: 0, leader: 'p0', team: ['p0', 'p1'], votes: V('p0', 'p1', 'p4', 'p5'), approved: true },
    { questIndex: 1, leader: 'p1', team: ['p0', 'p2', 'p3'], votes: V('p0', 'p2', 'p3', 'p5'), approved: true },
  ] };
  const st2 = (role, knows) => ({ pub: { players, game }, me: { role, knows } });
  // p4 voted against one of the two failed teams; p6 against both
  assert.equal(percivalRead(st2('percival', ['p4', 'p6'])),
    'P4 voted against 1 of 2 failed teams; P6 voted against 2 of 2 failed teams. Merlin sees the Minions, so Merlin tends to vote against teams that go on to fail.');
  // a candidate who went on every failed team has no counted votes, so only the other is read
  assert.match(percivalRead(st2('percival', ['p0', 'p6'])), /^P6 voted against 2 of 2 failed teams\./);
  assert.equal(percivalRead(st2('percival', ['p6'])), null, 'without Morgana, Percival already knows Merlin');
  assert.equal(percivalRead(st2('loyal', [])), null);
  assert.equal(percivalRead({ pub: { players, game: { questIndex: 0, results: [], history: [] } }, me: { role: 'percival', knows: ['p4', 'p6'] } }), null, 'nothing before a quest fails');
});

test('Merlin reads the record: how often Merlin voted down a team with a visible Minion, the Assassin\'s tell', () => {
  const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
  const evilTeam = (q, team, ...yes) => ({ questIndex: q, leader: team[0], team, votes: V(...yes), approved: false });
  // p6 is Merlin and sees p1 and p2
  const hist = [evilTeam(0, ['p1', 'p3'], 'p1', 'p3'), evilTeam(0, ['p2', 'p4'], 'p2', 'p4'), evilTeam(0, ['p6', 'p1'], 'p6', 'p1')];
  const st2 = (history, role = 'merlin') => ({ pub: { players, game: { questIndex: 0, results: [], history } }, me: { id: 'p6', role, knows: ['p1', 'p2'] } });
  assert.equal(merlinRead(st2(hist)), 'You voted down 2 of 2 teams with a Minion you can see on them. That is the pattern the Assassin looks for.', 'its own team is left out');
  assert.equal(merlinRead(st2(hist.slice(0, 1))), 'You voted down 1 of 1 team with a Minion you can see on it. One vote is not a pattern yet.');
  const mixed = hist.concat(evilTeam(1, ['p2', 'p5'], 'p2', 'p5', 'p6'));
  assert.match(merlinRead(st2(mixed)), /2 of 3 teams.*Mixed enough not to stand out/);
  assert.equal(merlinRead(st2([])), null);
  assert.equal(merlinRead(st2(hist, 'loyal')), null);
  assert.equal(secretRead(st2(hist)), merlinRead(st2(hist)));
});

test('the Assassin reads the record during the game: whose votes look most like Merlin\'s', () => {
  const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
  const t = (q, team, ...yes) => ({ questIndex: q, leader: team[0], team, votes: V(...yes), approved: false });
  // p0 is the Assassin and knows p1. p5 voted down all three teams with a Minion; nobody else three in four
  const hist = [t(0, ['p0', 'p2'], 'p0', 'p2', 'p1', 'p3', 'p4', 'p6'), t(0, ['p1', 'p3'], 'p0', 'p1', 'p3', 'p4', 'p6'), t(0, ['p1', 'p4'], 'p0', 'p1', 'p4', 'p2', 'p3')];
  const st2 = (history, extra = {}) => ({ pub: { phase: 'propose', players, game: { questIndex: 0, results: [], history } }, me: { id: 'p0', role: 'assassin', knows: ['p1'], ...extra } });
  assert.equal(assassinRead(st2(hist)), "Votes most like Merlin's so far: P5, who voted down 3 of 3 teams with a Minion you know on them.");
  assert.equal(assassinRead(st2(hist.slice(0, 1))), null, 'one vote is not a pattern');
  assert.equal(assassinRead(st2(hist, { role: 'minion' })), assassinRead(st2(hist)), 'every Minion who knows the others');
  assert.equal(assassinRead(st2(hist, { role: 'loyal' })), null);
  assert.equal(assassinRead(st2(hist, { role: 'oberon', knows: [] })), null, 'Oberon knows nobody');
  assert.equal(assassinRead(st2(hist, { role: 'evillancelot', knows: ['p1'] })), null, 'Evil Lancelot knows no allies: the one player he sees is Good Lancelot');
  assert.equal(secretRead(st2(hist)), assassinRead(st2(hist)), 'no quest has failed, so nothing about its own record');
});

test('a Minion reads its own record: the failed quests it went on and the failed teams it voted to send', () => {
  const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
  // two failed quests: p0 went on the first, and voted to send the second without going
  const history = [
    { questIndex: 0, leader: 'p0', team: ['p0', 'p2'], votes: V('p0', 'p2', 'p3', 'p4'), approved: true },
    { questIndex: 1, leader: 'p3', team: ['p3', 'p4', 'p5'], votes: V('p0', 'p3', 'p4', 'p5'), approved: true },
  ];
  const results = [{ questIndex: 0, outcome: 'fail', team: ['p0', 'p2'] }, { questIndex: 1, outcome: 'fail', team: ['p3', 'p4', 'p5'] }];
  const st = (me, res = results, phase = 'propose') => ({ pub: { phase, players, game: { questIndex: 2, results: res, history } }, me: { id: 'p0', role: 'minion', knows: ['p1'], ...me } });
  assert.equal(evilRead(st({})), 'The record says you went on 1 failed quest and voted to send 1 failed team you were not on. A leader picking a team sees that beside your name.');
  assert.equal(evilRead(st({ id: 'p1' })), 'The record has nothing on you: you went on no failed quest and voted to send none.');
  assert.equal(evilRead(st({ id: 'p2' })), 'The record says you went on 1 failed quest. A leader picking a team sees that beside your name.');
  assert.equal(evilRead(st({ role: 'oberon', knows: [] })), evilRead(st({})), 'Oberon too');
  assert.equal(evilRead(st({ role: 'loyal' })), null);
  assert.equal(evilRead(st({}, [])), null, 'nothing before a quest fails');
  assert.equal(evilRead(st({}, results, 'gameover')), null);
  assert.equal(secretRead(st({})), evilRead(st({})), 'nobody stands out as Merlin yet');
});
