import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirm, knownPlayers, screenFor, startHint, toggleSelection, leaderName } from '../public/phone/model.js';
import { awards, cardFor } from '../public/tv/cards.js';
import { Room } from '../server/room.js';
import { FakeClock, FakeConn, fill, makeRoom, playBotGame } from './helpers.js';

const players = [['p1', 'Ann'], ['p2', 'Bo'], ['p3', 'Cy'], ['p4', 'Dee'], ['p5', 'Eli']].map(([id, name], i) => ({ id, name, cls: 'knight', color: '#fff', bot: false, vip: i === 0, connected: true, takeover: false, ready: false }));
const pub = (phase, game = {}, extra = {}) => ({ room: 'ABCD', phase, players, config: { roles: {}, classic: false }, game: { n: 5, questIndex: 0, quest: { id: 'bridge', name: 'The Old Bridge' }, teamSize: 2, leader: 'p2', rejectCount: 0, team: ['p1', 'p3'], results: [], ...game }, ...extra });

test('phone: screen selection follows phase + legal action', () => {
  const st = (p, legal, quest) => ({ pub: p, me: { legal, quest } });
  assert.equal(screenFor(null), 'connecting');
  assert.equal(screenFor(st({ phase: 'lobby', players }, { action: 'wait' })), 'lobby');
  assert.equal(screenFor(st(pub('roleReveal'), { action: 'ready' })), 'roleReveal');
  assert.equal(screenFor(st(pub('propose'), { action: 'propose', size: 2 })), 'propose');
  assert.equal(screenFor(st(pub('propose'), { action: 'wait' })), 'waitLeader');
  assert.equal(screenFor(st(pub('vote'), { action: 'vote' })), 'vote');
  assert.equal(screenFor(st(pub('vote'), { action: 'wait' })), 'voted');
  assert.equal(screenFor(st(pub('questPlay'), { action: 'wait' }, { onTeam: true, step: 'card' })), 'quest-card');
  assert.equal(screenFor(st(pub('questPlay'), { action: 'wait' }, { onTeam: true, step: 'pick' })), 'quest-pick');
  assert.equal(screenFor(st(pub('questPlay'), { action: 'wait' }, { onTeam: true, step: 'done' })), 'quest-done');
  assert.equal(screenFor(st(pub('questPlay'), { action: 'wait' }, { onTeam: false })), 'watchQuest');
  assert.equal(screenFor(st(pub('assassination'), { action: 'assassinate' })), 'assassinate');
  assert.equal(screenFor(st(pub('assassination'), { action: 'wait' })), 'waitAssassin');
  assert.equal(screenFor(st(pub('gameover'), { action: 'again' })), 'gameover');
});

test('phone: every team member sees the same screens regardless of card/role (identical flow)', () => {
  // the screen depends only on quest.step, never on role or canFail
  const a = screenFor({ pub: pub('questPlay'), me: { legal: { action: 'wait' }, quest: { onTeam: true, step: 'card', canFail: false } } });
  const b = screenFor({ pub: pub('questPlay'), me: { legal: { action: 'wait' }, quest: { onTeam: true, step: 'card', canFail: true } } });
  assert.equal(a, b);
});

test('phone: team selection is capped at the required size', () => {
  let sel = [];
  for (const id of ['a', 'b', 'c']) sel = toggleSelection(sel, id, 2);
  assert.deepEqual(sel, ['a', 'b']);
  assert.equal(canConfirm(sel, 2), true);
  assert.deepEqual(toggleSelection(sel, 'a', 2), ['b']);
  assert.equal(canConfirm(['a'], 2), false);
});

test('phone: knowledge names and hints', () => {
  const s = { pub: pub('roleReveal'), me: { knows: ['p3', 'p5', 'zz'] } };
  assert.deepEqual(knownPlayers(s).map((p) => p.name), ['Cy', 'Eli']);
  assert.equal(leaderName(pub('propose')), 'Bo');
  assert.match(startHint({ validation: { errors: ['Too many evil roles'], warnings: [] } }), /Too many/);
  assert.equal(startHint({ validation: { errors: [], warnings: [] } }), '');
  assert.equal(startHint({ validation: { errors: [], warnings: ['A.', 'B.'] } }), 'A. B.');
  assert.equal(startHint({ validation: { errors: ['Stop.'], warnings: ['A.'] } }), 'Stop.');
});

test('TV cards: every phase renders plain text, without secrets, and the fail count only in classic', () => {
  const lobby = cardFor({ phase: 'lobby', room: 'ABCD', players, validation: { ok: false, errors: ['Need 5'], warnings: [] } }, { joinUrl: 'http://x' });
  assert.equal(lobby.big, 'ABCD');
  assert.ok(lobby.lines.some((l) => l.includes('http://x')));
  // the table can see which roles are in the game before it starts
  const roles = cardFor({ phase: 'lobby', room: 'ABCD', players, config: { roles: { merlin: true, assassin: true, percival: true, morgana: false, mordred: false, oberon: false }, classic: true }, validation: { ok: true, errors: [], warnings: [] } });
  assert.ok(roles.lines.includes('Roles: Merlin, Assassin and Percival · Classic (fail counts shown)'), roles.lines.join('\n'));
  assert.ok(roles.lines.includes('Waiting for the host to start…'));
  assert.ok(cardFor({ phase: 'lobby', room: 'ABCD', players, config: { roles: {} } }).lines.includes('Roles: No special roles'));
  assert.equal(cardFor(pub('roleReveal')).title, 'Check your phones');
  assert.match(cardFor(pub('propose')).lines[0], /Bo is choosing a team of 2/);
  assert.match(cardFor(pub('vote', { voted: ['p1'] })).lines.join(' '), /1 of 5/);
  assert.match(cardFor(pub('vote', { voted: ['p1'] })).lines.join(' '), /Voted: Ann/);
  assert.match(cardFor(pub('vote', { voted: ['p1', 'p3', 'p4'] })).lines.join(' '), /Waiting on Bo and Eli/);
  assert.doesNotMatch(cardFor(pub('vote', { voted: [] })).lines.join(' '), /Waiting on|Voted:/);
  // where the crown goes next, and the warning on the fifth proposal
  assert.match(cardFor(pub('propose')).lines.join(' '), /Next to lead: Cy, Dee, Eli, then Ann for the fifth proposal/);
  assert.match(cardFor(pub('vote', { voted: [], rejectCount: 3 })).lines.join(' '), /If rejected, Cy leads the fifth and final proposal/);
  assert.match(cardFor(pub('vote', { voted: [], rejectCount: 4 })).lines.join(' '), /Fifth proposal: if this team is rejected, Evil wins/);
  const rev = cardFor(pub('voteReveal', { approved: false, votes: { p1: true, p2: false, p3: false, p4: false, p5: true }, rejectCount: 1 }));
  assert.equal(rev.title, 'Team rejected!');
  assert.equal(rev.lines[0], '2 approve · 3 reject');
  assert.ok(rev.lines.some((l) => l.includes('1 of 5')));
  // the fourth rejection warns, and the fifth ends the game instead of passing the crown
  const no = { p1: false, p2: false, p3: false, p4: false, p5: false };
  assert.match(cardFor(pub('voteReveal', { approved: false, votes: no, rejectCount: 4 })).lines.join(' '), /one more and Evil wins/);
  const fifth = cardFor(pub('voteReveal', { approved: false, votes: no, rejectCount: 5 })).lines.join(' ');
  assert.match(fifth, /5 teams in a row were rejected\. Evil wins\./);
  assert.doesNotMatch(fifth, /crown passes on/);
  assert.match(cardFor(pub('questPlay', { waitingOn: 2 })).lines.join(' '), /Waiting on 2/);
  const fail = cardFor(pub('questResult', { results: [{ questIndex: 0, outcome: 'fail', culprit: 'p3', hero: null, team: ['p1', 'p3'] }] }));
  assert.equal(fail.title, 'Quest failed!');
  assert.match(fail.lines[0], /Cy/);
  assert.ok(!fail.lines.join(' ').includes('Fail card'));
  const classic = cardFor(pub('questResult', { results: [{ questIndex: 0, outcome: 'fail', culprit: 'p3', hero: null, failCount: 2, team: [] }] }));
  assert.ok(classic.lines.join(' ').includes('2 Fail cards'));
  const ok = cardFor(pub('questResult', { results: [{ questIndex: 0, outcome: 'success', culprit: null, hero: 'p4', team: [] }] }));
  assert.match(ok.lines[0], /Hero: Dee/);
  assert.equal(cardFor(pub('assassination')).kind, 'assassination');
});

test('TV: a refresh mid-cutscene shows the result card (skip to result)', () => {
  const card = cardFor(pub('cutscene', {}, { cutscene: { outcome: 'fail', culprit: 'p2', hero: null } }));
  assert.equal(card.kind, 'result');
  assert.match(card.lines[0], /Bo/);
});

test('TV: game over card lists both sides with their roles and the recap with framing', () => {
  const rv = { winner: 'evil', reason: 'assassination-hit', roles: { p1: 'merlin', p2: 'assassin', p3: 'loyal', p4: 'minion', p5: 'loyal' }, recap: [{ questIndex: 0, outcome: 'fail', culprit: 'p3', hero: null, framed: true, failCount: 1 }] };
  const c = cardFor(pub('gameover', {}, { reveal: rv }));
  assert.equal(c.title, 'Evil wins!');
  const text = c.lines.join('\n');
  assert.match(text, /^Loyal Servants: Ann \(Merlin\), Cy and Eli$/m);
  assert.match(text, /^Minions of Mordred: Bo \(Assassin\) and Dee$/m);
  assert.match(text, /Cy \(framed!\)/);
  assert.match(text, /found Merlin/);
  const miss = cardFor(pub('gameover', {}, { reveal: { ...rv, winner: 'good', reason: 'assassination-miss', assassination: { assassin: 'p2', target: 'p3', hit: false } } }));
  assert.equal(miss.lines[0], 'The Assassin struck Cy, but Merlin was Ann.');
});

test('whole game via the exact public state the TV cards consume: every phase of a real game renders', () => {
  const { room, clock } = makeRoom({ seed: 5 });
  const tv = new FakeConn(); room.attachTv(tv);
  fill(room, 1, 6);
  const vip = room.vip;
  room.handle(vip.id, { t: 'start' });
  room.handle(vip.id, { t: 'ready' });
  room.detachPhone(vip.id, vip.conn);
  for (let i = 0; i < 20000 && room.phase !== 'gameover'; i++) clock.advance(250);
  const phases = new Set();
  for (const m of tv.msgs.filter((x) => x.t === 'state')) {
    phases.add(m.pub.phase);
    const c = cardFor(m.pub);
    assert.ok(c.title !== undefined && Array.isArray(c.lines), m.pub.phase);
  }
  for (const p of ['roleReveal', 'propose', 'vote', 'voteReveal', 'questPlay', 'cutscene', 'questResult', 'gameover']) assert.ok(phases.has(p), `phase ${p} seen`);
  void Room; void FakeClock; void playBotGame;
});

test('game-over awards: hero, scapegoat and walking disaster come from the recap', () => {
  const pub = { players: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }] };
  const recap = [
    { outcome: 'success', hero: 'a' }, { outcome: 'success', hero: 'a' },
    { outcome: 'fail', culprit: 'b', framed: true }, { outcome: 'fail', culprit: 'c', framed: false }, { outcome: 'fail', culprit: 'c', framed: false },
  ];
  const lines = awards(pub, recap);
  assert.match(lines[0], /Hero of the realm: Ann \(2 quests\)/);
  assert.match(lines[1], /Scapegoat: Bo, framed once/);
  assert.match(lines[2], /Walking disaster: Cy \(2 catastrophes\)/);
  assert.deepEqual(awards(pub, []), []);
});

test('TV: the game over card fits a full table: two lines for the sides, however many players', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ ...players[0], id: `q${i}`, name: `Player ${i + 1}`, vip: i === 0 }));
  const kinds = ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon'];
  const roles = Object.fromEntries(ten.map((p, i) => [p.id, kinds[i]]));
  const recap = [0, 1, 2, 3, 4].map((questIndex) => (questIndex % 2
    ? { questIndex, outcome: 'fail', culprit: 'q2', hero: null, framed: true }
    : { questIndex, outcome: 'success', hero: 'q3', culprit: null }));
  const c = cardFor({ ...pub('gameover', {}, { reveal: { winner: 'good', reason: 'quests', roles, recap } }), players: ten });
  // the card is cut off at 80% of the screen height: about 15 lines at the game-over size
  assert.ok(c.lines.length <= 12, `${c.lines.length} lines`);
  assert.equal(c.lines[1], 'Loyal Servants: Player 1 (Merlin), Player 2 (Percival), Player 3, Player 4, Player 5 and Player 6');
  assert.equal(c.lines[2], 'Minions of Mordred: Player 7 (Assassin), Player 8 (Morgana), Player 9 (Mordred) and Player 10 (Oberon)');
});
