import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirm, knownPlayers, screenFor, startHint, toggleSelection, leaderName } from '../public/phone/model.js';
import { cardFor, trackFor } from '../public/tv/cards.js';
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
});

test('TV cards: every phase renders plain text, without secrets, and the fail count only in classic', () => {
  const lobby = cardFor({ phase: 'lobby', room: 'ABCD', players, validation: { ok: false, errors: ['Need 5'], warnings: [] } }, { joinUrl: 'http://x' });
  assert.equal(lobby.big, 'ABCD');
  assert.ok(lobby.lines.some((l) => l.includes('http://x')));
  assert.equal(cardFor(pub('roleReveal')).title, 'Check your phones');
  assert.match(cardFor(pub('propose')).lines[0], /Bo is choosing a team of 2/);
  assert.match(cardFor(pub('vote', { voted: ['p1'] })).lines.join(' '), /1 of 5/);
  const rev = cardFor(pub('voteReveal', { approved: false, votes: { p1: true, p2: false, p3: false, p4: false, p5: true }, rejectCount: 1 }));
  assert.equal(rev.title, 'Team rejected!');
  assert.ok(rev.lines.some((l) => l.includes('Bo: ✘')));
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

test('TV: quest track shows only revealed results (no spoilers during the cutscene)', () => {
  assert.deepEqual(trackFor(pub('cutscene', { questIndex: 1, results: [{ outcome: 'success' }] })), ['success', 'current', 'pending', 'pending', 'pending']);
  assert.deepEqual(trackFor({ phase: 'lobby' }), []);
});

test('TV: game over card lists every role and the recap with framing', () => {
  const rv = { winner: 'evil', reason: 'assassination-hit', roles: { p1: 'merlin', p2: 'assassin', p3: 'loyal', p4: 'minion', p5: 'loyal' }, recap: [{ questIndex: 0, outcome: 'fail', culprit: 'p3', hero: null, framed: true, failCount: 1 }] };
  const c = cardFor(pub('gameover', {}, { reveal: rv }));
  assert.equal(c.title, 'Evil wins!');
  const text = c.lines.join('\n');
  assert.match(text, /Ann: Merlin/);
  assert.match(text, /Cy \(framed!\)/);
  assert.match(text, /found Merlin/);
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
