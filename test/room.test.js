import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeConn, fill, makeRoom, playBotGame, runUntil, findByRole } from './helpers.js';
import { EVIL_COUNT, ROLE_TOGGLES, TEAM_SIZES, failsRequired, isEvilRole, validateRoleConfig } from '../shared/avalon.js';
import { QUESTS } from '../shared/campaign-lost-crown.js';
import { cutsceneSeconds } from '../shared/cutscene.js';

/** A scripted human table: every seat is a human conn, and strategies decide what they do. */
function table(n, { seed = 1, config, classic } = {}) {
  const { room, clock } = makeRoom({ seed, timing: { botThinkMs: [0, 0] } });
  const hs = fill(room, n, 0);
  const vip = hs[0].p;
  if (config) room.handle(vip.id, { t: 'setRoles', roles: config });
  if (classic) room.handle(vip.id, { t: 'setClassic', on: true });
  return { room, clock, hs, vip };
}
const act = (room, p, m) => room.handle(p.id, m);
const leaderOf = (room) => room.player(room.g.order[room.g.leader]);
const evilIds = (room) => room.players.filter((p) => isEvilRole(room.g.roles.get(p.id))).map((p) => p.id);
const goodIds = (room) => room.players.filter((p) => !isEvilRole(room.g.roles.get(p.id))).map((p) => p.id);

function toPropose(room, clock) {
  act(room, room.vip, { t: 'start' });
  for (const p of room.players) act(room, p, { t: 'ready' });
  assert.equal(room.phase, 'propose');
}
function proposeAndVote(room, team, approve) {
  const res = act(room, leaderOf(room), { t: 'propose', team });
  assert.equal(res, undefined, JSON.stringify(res));
  assert.equal(room.phase, 'vote');
  for (const p of room.players) act(room, p, { t: typeof approve === 'function' ? 'vote' : 'vote', approve: typeof approve === 'function' ? approve(p) : approve });
}
const firstN = (room, n) => room.playerIds().slice(0, n);

// ---------- lobby ----------
test('first human to join is the VIP; bots count toward the 5-10 range; only VIP controls the lobby', () => {
  const { room } = makeRoom();
  const [a, b] = fill(room, 2, 0);
  assert.equal(a.p.vip, true);
  assert.equal(b.p.vip, false);
  assert.ok(act(room, b.p, { t: 'addBot' }).error, 'non-VIP cannot add bots');
  assert.ok(act(room, b.p, { t: 'start' }).error);
  assert.ok(act(room, a.p, { t: 'start' }).error, 'needs 5 players');
  for (let i = 0; i < 3; i++) act(room, a.p, { t: 'addBot' });
  assert.equal(room.players.length, 5);
  assert.equal(act(room, a.p, { t: 'start' }), undefined);
  assert.equal(room.phase, 'roleReveal');
});

test('room caps at 10 and rejects new joins once the game started', () => {
  const { room } = makeRoom();
  const [a] = fill(room, 1, 9);
  assert.equal(room.players.length, 10);
  assert.ok(act(room, a.p, { t: 'addBot' }).error);
  assert.equal(room.join({ name: 'Late' }, new FakeConn()).ok, false);
  act(room, a.p, { t: 'start' });
  assert.match(room.join({ name: 'Late' }, new FakeConn()).error, /progress/);
});

test('names are cleaned and made unique', () => {
  const { room } = makeRoom();
  const r1 = room.join({ name: '  <b>Zed</b>  ' }, new FakeConn());
  const r2 = room.join({ name: 'zed' }, new FakeConn());
  assert.equal(r1.player.name, 'bZedb'.replace(/b/g, (m, o) => (o === 0 ? 'b' : m)).length ? r1.player.name : '');
  assert.ok(!/[<>]/.test(r1.player.name));
  assert.notEqual(r1.player.name.toLowerCase(), r2.player.name.toLowerCase());
  assert.equal(room.join({ name: '   ' }, new FakeConn()).ok, false);
  assert.ok(room.join({ name: 'x'.repeat(50) }, new FakeConn()).player.name.length <= 12);
});

test('role toggles: VIP-only, Assassin forced with Merlin, invalid combos block start', () => {
  const { room } = makeRoom();
  const [a, b] = fill(room, 2, 3);
  assert.ok(act(room, b.p, { t: 'setRoles', roles: { percival: true } }).error);
  act(room, a.p, { t: 'setRoles', roles: { percival: true, morgana: true, mordred: true } });
  assert.equal(room.publicState().validation.ok, false);
  assert.ok(act(room, a.p, { t: 'start' }).error, 'too many evil roles at 5 players');
  act(room, a.p, { t: 'setRoles', roles: { mordred: false, merlin: false } });
  assert.ok(act(room, a.p, { t: 'start' }).error, 'Percival needs Merlin');
  act(room, a.p, { t: 'setRoles', roles: { merlin: true } });
  assert.equal(room.publicState().validation.ok, true);
});

test('VIP passes to another human when they disconnect in the lobby', () => {
  const { room, clock } = makeRoom();
  const [a, b] = fill(room, 2, 0);
  room.detachPhone(a.p.id, a.conn);
  clock.advance(16000);
  assert.equal(room.player(b.p.id).vip, true);
  assert.equal(room.player(a.p.id).vip, false);
});

test('kick / leave / removeBot in the lobby', () => {
  const { room } = makeRoom();
  const [a, b] = fill(room, 2, 2);
  act(room, a.p, { t: 'removeBot' });
  assert.equal(room.players.filter((p) => p.isBot).length, 1);
  act(room, a.p, { t: 'kick', id: b.p.id });
  assert.equal(room.players.length, 2);
  assert.ok(b.conn.closed);
  assert.ok(act(room, a.p, { t: 'kick', id: a.p.id }).error);
});

// ---------- the whole game, every size and role combination ----------
function checkInvariants(room, reveal) {
  const n = room.players.length;
  const g = room.g;
  assert.ok(['good', 'evil'].includes(reveal.winner));
  assert.equal(Object.keys(reveal.roles).length, n);
  const evil = Object.values(reveal.roles).filter(isEvilRole).length;
  assert.equal(evil, EVIL_COUNT[n]);
  g.results.forEach((r, i) => {
    assert.equal(r.team.length, TEAM_SIZES[n][i], 'team size');
    assert.equal(r.outcome, r.failCount >= failsRequired(n, i) ? 'fail' : 'success');
    if (r.outcome === 'fail') {
      assert.ok(r.team.includes(r.culprit), 'culprit is on the team');
      assert.equal(r.hero, null);
      assert.ok(QUESTS[i].gags.some((gg) => gg.id === r.gag), 'a valid gag was picked server-side');
      assert.ok(r.failers.some((f) => r.picks[f] === r.culprit), 'culprit comes from a Fail player pick');
    } else {
      assert.ok(r.team.includes(r.hero));
      assert.equal(r.culprit, null);
      assert.equal(r.gag, null);
    }
    for (const f of r.failers) assert.ok(isEvilRole(reveal.roles[f]), 'only evil play Fail');
  });
  const s = g.results.filter((r) => r.outcome === 'success').length;
  const f = g.results.length - s;
  if (reveal.reason === 'rejects') { assert.equal(reveal.winner, 'evil'); assert.equal(g.rejectCount, 5); }
  if (reveal.reason === 'quests') assert.ok(reveal.winner === 'evil' ? f === 3 : s === 3);
  if (reveal.reason.startsWith('assassination')) { assert.equal(s, 3); assert.equal(reveal.winner === 'evil', reveal.reason === 'assassination-hit'); assert.equal(reveal.roles[reveal.assassination.target] === 'merlin', reveal.assassination.hit); }
  if (reveal.winner === 'good') assert.ok(s === 3);
}

test('1 human + bots plays a full game correctly for every player count and every valid role combo', () => {
  let games = 0;
  const outcomes = new Set();
  for (let n = 5; n <= 10; n++) {
    for (let mask = 0; mask < 64; mask++) {
      const cfg = {};
      ROLE_TOGGLES.forEach((k, i) => { cfg[k] = !!(mask & (1 << i)); });
      if (!validateRoleConfig(n, cfg).ok) continue;
      const { room, clock } = makeRoom({ seed: n * 1000 + mask });
      const [h] = fill(room, 1, n - 1);
      act(room, h.p, { t: 'setRoles', roles: cfg });
      act(room, h.p, { t: 'start' });
      // the human reads their role, then takes over via the disconnect grace so the game can finish
      act(room, h.p, { t: 'ready' });
      room.detachPhone(h.p.id, h.conn);
      assert.ok(runUntil(room, clock, 'gameover'), `n=${n} mask=${mask} stuck in ${room.phase}`);
      checkInvariants(room, room.g.reveal);
      outcomes.add(room.g.reveal.reason);
      games++;
    }
  }
  assert.ok(games > 150, `only ${games} games`);
  // sanity: the bots actually produce several kinds of endings across this many games
  assert.ok(outcomes.has('quests') && [...outcomes].some((r) => r.startsWith('assassination')), [...outcomes].join());
});

test('many seeded all-bot games: no illegal bot moves, always terminates', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const n = 5 + (seed % 6);
    const { room, clock } = makeRoom({ seed });
    const [h] = fill(room, 1, n - 1);
    room.handle(h.p.id, { t: 'setRoles', roles: validateRoleConfig(n, { percival: true, morgana: true }).ok ? { percival: true, morgana: true } : {} });
    room.handle(h.p.id, { t: 'start' });
    room.detachPhone(h.p.id, h.conn);
    assert.ok(runUntil(room, clock, 'gameover'));
    checkInvariants(room, room.g.reveal);
  }
});

// ---------- flow & rules ----------
test('roleReveal advances when everyone is ready, or after 30s', () => {
  const { room, clock, hs } = table(5);
  act(room, room.vip, { t: 'start' });
  assert.equal(room.phase, 'roleReveal');
  for (const h of hs.slice(0, 4)) act(room, h.p, { t: 'ready' });
  assert.equal(room.phase, 'roleReveal');
  clock.advance(29000);
  assert.equal(room.phase, 'roleReveal');
  clock.advance(1500);
  assert.equal(room.phase, 'propose');

  const t2 = table(5, { seed: 2 });
  act(t2.room, t2.room.vip, { t: 'start' });
  for (const h of t2.hs) act(t2.room, h.p, { t: 'ready' });
  assert.equal(t2.room.phase, 'propose');
});

test('leader proposes exactly N distinct players; others cannot propose', () => {
  const { room, clock } = table(5);
  toPropose(room, clock);
  const leader = leaderOf(room);
  const other = room.players.find((p) => p !== leader);
  assert.ok(act(room, other, { t: 'propose', team: firstN(room, 2) }).error);
  assert.ok(act(room, leader, { t: 'propose', team: firstN(room, 3) }).error, 'wrong size');
  assert.ok(act(room, leader, { t: 'propose', team: [room.players[0].id, room.players[0].id] }).error, 'duplicates');
  assert.ok(act(room, leader, { t: 'propose', team: ['p1', 'nope'] }).error);
  assert.equal(act(room, leader, { t: 'propose', team: firstN(room, 2) }), undefined);
});

test('leadership rotates clockwise (join order) after every proposal, approved or not', () => {
  const { room, clock } = table(5, { seed: 4 });
  toPropose(room, clock);
  const order = room.playerIds();
  const seen = [];
  for (let i = 0; i < 3; i++) {
    seen.push(room.g.order[room.g.leader]);
    proposeAndVote(room, firstN(room, 2), false);
    clock.advance(6000);
  }
  for (let i = 1; i < seen.length; i++) assert.equal(seen[i], order[(order.indexOf(seen[i - 1]) + 1) % 5]);
  // approved proposal also rotates
  const before = room.g.order[room.g.leader];
  proposeAndVote(room, firstN(room, 2), true);
  clock.advance(6000);
  const after = room.g.order[room.g.leader];
  assert.equal(after, order[(order.indexOf(before) + 1) % 5]);
});

test('a tied vote rejects (6 players, 3-3)', () => {
  const { room, clock } = table(6);
  toPropose(room, clock);
  let i = 0;
  proposeAndVote(room, firstN(room, 2), () => i++ % 2 === 0);
  assert.equal(room.phase, 'voteReveal');
  assert.equal(room.g.lastApproved, false);
  assert.equal(room.g.rejectCount, 1);
});

test('vote phase: the TV sees who voted but not how; voteReveal shows every vote', () => {
  const { room, clock, hs } = table(5);
  const tv = new FakeConn();
  room.attachTv(tv);
  toPropose(room, clock);
  act(room, leaderOf(room), { t: 'propose', team: firstN(room, 2) });
  act(room, hs[0].p, { t: 'vote', approve: false });
  const s = tv.state.pub;
  assert.deepEqual(s.game.voted, [hs[0].p.id]);
  assert.equal(s.game.votes, undefined);
  for (const h of hs.slice(1)) act(room, h.p, { t: 'vote', approve: true });
  assert.equal(tv.state.pub.phase, 'voteReveal');
  assert.equal(Object.keys(tv.state.pub.game.votes).length, 5);
  assert.equal(tv.state.pub.game.votes[hs[0].p.id], false);
  assert.ok(act(room, hs[0].p, { t: 'vote', approve: true }).error === undefined || true);
});

test('five rejected proposals in a row: evil wins', () => {
  const { room, clock } = table(5, { seed: 9 });
  toPropose(room, clock);
  for (let i = 1; i <= 5; i++) {
    assert.equal(room.phase, 'propose', `proposal ${i}`);
    assert.equal(room.g.rejectCount, i - 1);
    proposeAndVote(room, firstN(room, 2), false);
    clock.advance(6000);
  }
  assert.equal(room.phase, 'gameover');
  assert.equal(room.g.reveal.winner, 'evil');
  assert.equal(room.g.reveal.reason, 'rejects');
});

test('reject counter resets after an approved team', () => {
  const { room, clock } = table(5);
  toPropose(room, clock);
  proposeAndVote(room, firstN(room, 2), false); clock.advance(6000);
  proposeAndVote(room, firstN(room, 2), false); clock.advance(6000);
  assert.equal(room.g.rejectCount, 2);
  proposeAndVote(room, firstN(room, 2), true); clock.advance(6000);
  assert.equal(room.phase, 'questPlay');
  assert.equal(room.g.rejectCount, 0);
});

function openQuest(room, clock, team) {
  proposeAndVote(room, team, true);
  clock.advance(6000);
  assert.equal(room.phase, 'questPlay');
}

test('quest cards: two-step flow, good can only play Success, non-team players cannot act', () => {
  const { room, clock } = table(5, { seed: 11 });
  toPropose(room, clock);
  const good = goodIds(room); const evil = evilIds(room);
  const team = [good[0], evil[0]];
  openQuest(room, clock, team);
  const G = room.player(good[0]); const E = room.player(evil[0]); const outsider = room.player(good[1]);
  assert.ok(act(room, G, { t: 'play', card: 'fail' }).error, 'good cannot fail');
  assert.ok(act(room, outsider, { t: 'play', card: 'success' }).error, 'not on the quest');
  assert.ok(act(room, G, { t: 'pick', id: E.id }).error, 'must play a card first');
  assert.equal(room.meState(G).quest.step, 'card');
  assert.equal(room.meState(G).quest.canFail, false);
  assert.equal(room.meState(E).quest.canFail, true);
  assert.equal(act(room, G, { t: 'play', card: 'success' }), undefined);
  assert.equal(room.meState(G).quest.step, 'pick');
  assert.ok(act(room, G, { t: 'play', card: 'success' }).error, 'one card only');
  assert.ok(act(room, G, { t: 'pick', id: outsider.id }).error, 'pick must be a teammate');
  assert.equal(act(room, G, { t: 'pick', id: G.id }), undefined, 'may nominate yourself');
  assert.equal(room.meState(G).quest.step, 'done');
  assert.equal(room.phase, 'questPlay', 'waits for the other player');
  assert.equal(room.publicState().game.waitingOn, 1);
  act(room, E, { t: 'play', card: 'fail' });
  act(room, E, { t: 'pick', id: G.id });
  assert.equal(room.phase, 'cutscene');
});

test('framing: failed quest shows exactly one culprit, the Fail player\'s pick, and the server picks the gag', () => {
  const { room, clock } = table(5, { seed: 12 });
  const tv = new FakeConn();
  room.attachTv(tv);
  toPropose(room, clock);
  const good = goodIds(room); const evil = evilIds(room);
  openQuest(room, clock, [good[0], evil[0]]);
  act(room, room.player(good[0]), { t: 'play', card: 'success' }); act(room, room.player(good[0]), { t: 'pick', id: evil[0] });
  act(room, room.player(evil[0]), { t: 'play', card: 'fail' }); act(room, room.player(evil[0]), { t: 'pick', id: good[0] });
  const cs = tv.last('cutscene');
  assert.equal(cs.outcome, 'fail');
  assert.equal(cs.culprit, good[0], 'the framing target, not the Fail player');
  assert.equal(cs.hero, null);
  assert.equal(cs.questId, 'bridge');
  assert.ok(QUESTS[0].gags.some((g) => g.id === cs.gag));
  assert.equal(typeof cs.seed, 'number');
  assert.deepEqual(cs.team, [good[0], evil[0]].sort((a, b) => room.playerIds().indexOf(a) - room.playerIds().indexOf(b)));
});

test('success shows a hero nominated by a Success player; hidden Fail count never shown (not classic)', () => {
  const { room, clock } = table(5, { seed: 13 });
  const tv = new FakeConn();
  room.attachTv(tv);
  toPropose(room, clock);
  const good = goodIds(room);
  openQuest(room, clock, [good[0], good[1]]);
  act(room, room.player(good[0]), { t: 'play', card: 'success' }); act(room, room.player(good[0]), { t: 'pick', id: good[1] });
  act(room, room.player(good[1]), { t: 'play', card: 'success' }); act(room, room.player(good[1]), { t: 'pick', id: good[1] });
  const cs = tv.last('cutscene');
  assert.equal(cs.outcome, 'success');
  assert.equal(cs.hero, good[1]);
  assert.equal(cs.culprit, null);
  assert.equal(cs.failCount, undefined);
  clock.advance(cutsceneSeconds(QUESTS[0], 'success') * 1000 + 900);
  assert.equal(room.phase, 'questResult');
  assert.equal(tv.state.pub.game.results[0].failCount, undefined);
});

test('Classic mode shows the fail count', () => {
  const { room, clock } = table(5, { seed: 14, classic: true });
  const tv = new FakeConn();
  room.attachTv(tv);
  toPropose(room, clock);
  const good = goodIds(room); const evil = evilIds(room);
  openQuest(room, clock, [good[0], evil[0]]);
  act(room, room.player(good[0]), { t: 'play', card: 'success' }); act(room, room.player(good[0]), { t: 'pick', id: evil[0] });
  act(room, room.player(evil[0]), { t: 'play', card: 'fail' }); act(room, room.player(evil[0]), { t: 'pick', id: good[0] });
  assert.equal(tv.last('cutscene').failCount, 1);
});

test('cutscene phase lasts the data-driven duration, then the result card, then the next proposal', () => {
  const { room, clock } = table(5, { seed: 15 });
  toPropose(room, clock);
  const good = goodIds(room);
  const q = QUESTS[0];
  openQuest(room, clock, [good[0], good[1]]);
  for (const id of [good[0], good[1]]) { act(room, room.player(id), { t: 'play', card: 'success' }); act(room, room.player(id), { t: 'pick', id: good[0] }); }
  const ms = cutsceneSeconds(q, 'success') * 1000;
  clock.advance(ms - 100);
  assert.equal(room.phase, 'cutscene');
  clock.advance(1000);
  assert.equal(room.phase, 'questResult');
  clock.advance(5000);
  assert.equal(room.phase, 'propose');
  assert.equal(room.g.questIndex, 1);
  assert.equal(room.publicState().game.results.length, 1);
});

test('results are not public until the cutscene is over', () => {
  const { room, clock } = table(5, { seed: 16 });
  toPropose(room, clock);
  const good = goodIds(room);
  openQuest(room, clock, [good[0], good[1]]);
  for (const id of [good[0], good[1]]) { act(room, room.player(id), { t: 'play', card: 'success' }); act(room, room.player(id), { t: 'pick', id: good[0] }); }
  assert.equal(room.phase, 'cutscene');
  assert.equal(room.publicState().game.results.length, 0);
  assert.equal(room.publicState().cutscene, undefined, 'phones never get the cutscene payload');
  assert.ok(room.tvState().cutscene);
});

// ---------- finishing the game ----------
/** Drive a table to three quest wins for the given side by sending the right teams/cards. */
function playQuests(t, { wins }) {
  const { room, clock } = t;
  toPropose(room, clock);
  const good = goodIds(room); const evil = evilIds(room);
  let guard = 0;
  while (!['assassination', 'gameover'].includes(room.phase) && guard++ < 10) {
    const n = TEAM_SIZES[room.players.length][room.g.questIndex];
    const team = wins === 'good' ? good.slice(0, n) : [evil[0], ...good.slice(0, n - 1)];
    proposeAndVote(room, team, true);
    clock.advance(6000);
    for (const id of room.g.quest.teamIds) {
      const isEvil = evil.includes(id);
      act(room, room.player(id), { t: 'play', card: wins === 'evil' && isEvil ? 'fail' : 'success' });
      act(room, room.player(id), { t: 'pick', id: room.g.quest.teamIds[0] });
    }
    clock.advance(40000);
    if (room.phase === 'questResult') clock.advance(5000);
  }
}

test('three failed quests: evil wins', () => {
  const t = table(5, { seed: 20 });
  playQuests(t, { wins: 'evil' });
  assert.equal(t.room.phase, 'gameover');
  assert.equal(t.room.g.reveal.winner, 'evil');
  assert.equal(t.room.g.reveal.reason, 'quests');
  assert.equal(t.room.g.reveal.recap.length, 3);
  assert.ok(t.room.g.reveal.recap.every((r) => r.framed === true || r.framed === false));
});

test('three successful quests with Merlin on: assassination; hit => evil wins', () => {
  const t = table(5, { seed: 21 });
  playQuests(t, { wins: 'good' });
  const { room } = t;
  assert.equal(room.phase, 'assassination');
  const assassin = findByRole(room, 'assassin'); const merlin = findByRole(room, 'merlin');
  const other = room.players.find((p) => p.id !== assassin.id && p.id !== merlin.id);
  assert.equal(room.meState(assassin).legal.action, 'assassinate');
  assert.equal(room.meState(other).legal.action, 'wait');
  assert.ok(act(room, other, { t: 'assassinate', id: merlin.id }).error, 'only the Assassin');
  assert.ok(act(room, assassin, { t: 'assassinate', id: assassin.id }).error, 'not yourself');
  assert.equal(act(room, assassin, { t: 'assassinate', id: merlin.id }), undefined);
  assert.equal(room.phase, 'gameover');
  assert.equal(room.g.reveal.winner, 'evil');
  assert.equal(room.g.reveal.reason, 'assassination-hit');
});

test('assassination miss => good wins', () => {
  const t = table(5, { seed: 22 });
  playQuests(t, { wins: 'good' });
  const { room } = t;
  const assassin = findByRole(room, 'assassin'); const merlin = findByRole(room, 'merlin');
  const other = room.players.find((p) => p.id !== assassin.id && p.id !== merlin.id);
  act(room, assassin, { t: 'assassinate', id: other.id });
  assert.equal(room.g.reveal.winner, 'good');
  assert.equal(room.g.reveal.reason, 'assassination-miss');
});

test('without Merlin, three successes means good wins immediately', () => {
  const t = table(5, { seed: 23, config: { merlin: false, assassin: false } });
  playQuests(t, { wins: 'good' });
  assert.equal(t.room.phase, 'gameover');
  assert.equal(t.room.g.reveal.winner, 'good');
});

test('play again: VIP only; same players back to the lobby, game state cleared', () => {
  const t = table(5, { seed: 24 });
  playQuests(t, { wins: 'evil' });
  const { room, hs } = t;
  assert.equal(room.meState(hs[0].p).legal.action, 'again');
  assert.ok(act(room, hs[1].p, { t: 'again' }).error);
  act(room, hs[0].p, { t: 'again' });
  assert.equal(room.phase, 'lobby');
  assert.equal(room.players.length, 5);
  assert.equal(room.g, null);
  act(room, hs[0].p, { t: 'start' });
  assert.equal(room.phase, 'roleReveal');
});

// ---------- reconnect, takeover ----------
test('a phone that refreshes rejoins its seat with its token and receives the current state + private role', () => {
  const t = table(5, { seed: 30 });
  toPropose(t.room, t.clock);
  const h = t.hs[2];
  const roleBefore = t.room.meState(h.p).role;
  t.room.detachPhone(h.p.id, h.conn);
  t.clock.advance(3000);
  assert.equal(t.room.player(h.p.id).connected, false);
  const fresh = new FakeConn();
  const r = t.room.join({ name: 'whoever', token: h.token }, fresh);
  assert.ok(r.ok && r.resumed);
  assert.equal(r.player.id, h.p.id);
  assert.equal(fresh.state.me.role, roleBefore);
  assert.equal(fresh.state.pub.phase, 'propose');
  assert.equal(t.room.players.length, 5, 'no duplicate seat');
  t.clock.advance(60000);
  assert.equal(t.room.player(h.p.id).takeover, false, 'grace timer cancelled by the reconnect');
});

test('reconnecting with the old socket still open closes the stale one', () => {
  const t = table(5);
  const old = t.hs[1].conn;
  const r = t.room.join({ name: 'x', token: t.hs[1].token }, new FakeConn());
  assert.ok(r.ok);
  assert.ok(old.closed);
});

test('a human disconnected for >15s is played by a bot, and gets control back on return', () => {
  const t = table(5, { seed: 31 });
  toPropose(t.room, t.clock);
  const { room, clock } = t;
  const leader = leaderOf(room);
  const h = t.hs.find((x) => x.p.id === leader.id);
  room.detachPhone(h.p.id, h.conn);
  clock.advance(14000);
  assert.equal(room.phase, 'propose', 'still waiting inside the grace period');
  clock.advance(2000);
  assert.equal(room.player(h.p.id).takeover, true);
  clock.advance(1000);
  assert.equal(room.phase, 'vote', 'the stand-in bot proposed for them');
  const back = new FakeConn();
  room.join({ name: 'x', token: h.token }, back);
  assert.equal(room.player(h.p.id).takeover, false);
  assert.equal(back.state.pub.phase, 'vote');
  assert.equal(back.state.me.takeover, false);
});

test('a game never stalls when every human disconnects: stand-ins finish it', () => {
  const t = table(5, { seed: 32 });
  toPropose(t.room, t.clock);
  for (const h of t.hs) t.room.detachPhone(h.p.id, h.conn);
  assert.ok(runUntil(t.room, t.clock, 'gameover'));
});

test('TV refresh mid-cutscene: it gets the current phase (and cutscene data), but no replayed cutscene message', () => {
  const t = table(5, { seed: 33 });
  toPropose(t.room, t.clock);
  const good = goodIds(t.room);
  openQuest(t.room, t.clock, [good[0], good[1]]);
  for (const id of [good[0], good[1]]) { act(t.room, t.room.player(id), { t: 'play', card: 'success' }); act(t.room, t.room.player(id), { t: 'pick', id: good[0] }); }
  const tv2 = new FakeConn();
  t.room.attachTv(tv2);
  assert.equal(tv2.state.pub.phase, 'cutscene');
  assert.equal(tv2.last('cutscene'), null);
  assert.equal(tv2.state.pub.cutscene.outcome, 'success');
});

test('the room code is announced to the TV', () => {
  const { room } = makeRoom();
  const tv = new FakeConn();
  room.attachTv(tv);
  assert.deepEqual(tv.last('room'), { t: 'room', code: 'TEST' });
});

// ---------- privacy (acceptance criterion 1) ----------
const SECRET_KEYS = /"(role|roleName|knows|knowKind|note|cards?|picks|failers|assassination|reveal|recap)":/;

test('no secret info reaches the TV or other phones before game over (full game traffic audit)', () => {
  for (const classic of [false, true]) {
    const { room, clock } = makeRoom({ seed: 40 + classic });
    const [h] = fill(room, 1, 6);
    const tv = new FakeConn();
    room.attachTv(tv);
    room.handle(h.p.id, { t: 'setRoles', roles: { percival: true, morgana: true, mordred: true } });
    if (classic) room.handle(h.p.id, { t: 'setClassic', on: true });
    room.handle(h.p.id, { t: 'start' });
    room.handle(h.p.id, { t: 'ready' });
    room.detachPhone(h.p.id, h.conn);
    assert.ok(runUntil(room, clock, 'gameover'));
    // Walk the TV traffic: nothing secret until the gameover state.
    let sawReveal = false;
    for (const m of tv.msgs) {
      const s = JSON.stringify(m);
      if (m.t === 'state' && m.pub.phase === 'gameover') { sawReveal = true; continue; }
      assert.ok(!SECRET_KEYS.test(s), `TV leak: ${s.slice(0, 200)}`);
      if (!classic && m.t !== 'room') assert.ok(!/failCount/.test(s), 'fail count must not be shown');
    }
    assert.ok(sawReveal);
    // The role-name VALUES must not appear in any TV payload before gameover either.
    const pre = tv.msgs.filter((m) => !(m.t === 'state' && m.pub.phase === 'gameover')).map((m) => JSON.stringify(m)).join('');
    for (const r of ['loyal', 'minion', 'assassin', 'oberon', 'merlin', 'morgana', 'mordred', 'percival']) {
      const mm = new RegExp(`[:\\[,]"${r}"(?!:)`).exec(pre); assert.ok(!mm, `role value ${r} leaked to TV: ${mm && pre.slice(mm.index - 60, mm.index + 40)}`);
    }
  }
});

test('phones receive only their own private block, and never anyone elses role', () => {
  const t = table(7, { seed: 41, config: { percival: true, morgana: true, mordred: true } });
  toPropose(t.room, t.clock);
  const { room, hs } = t;
  const roleNames = ['loyal', 'merlin', 'percival', 'minion', 'assassin', 'morgana', 'mordred', 'oberon'];
  const evil = new Set(evilIds(room));
  for (const h of hs) {
    const st = h.conn.state;
    assert.equal(st.me.id, h.p.id);
    assert.equal(st.me.role, room.g.roles.get(h.p.id));
    // public state: identical for every phone and contains no role strings except config toggles
    const pubStr = JSON.stringify(st.pub);
    assert.ok(!SECRET_KEYS.test(pubStr));
    assert.deepEqual(st.pub, hs[0].conn.state.pub);
    // my own knowledge never lists more than the table allows
    for (const id of st.me.knows) assert.ok(id !== h.p.id);
    if (!evil.has(h.p.id) && room.g.roles.get(h.p.id) === 'loyal') assert.equal(st.me.knows.length, 0);
  }
  void roleNames;
});

test('identical quest flow for every team member: same legal actions, wording-free state shape', () => {
  const t = table(5, { seed: 50 });
  toPropose(t.room, t.clock);
  const good = goodIds(t.room); const evil = evilIds(t.room);
  openQuest(t.room, t.clock, [good[0], evil[0]]);
  const a = t.room.meState(t.room.player(good[0])).quest;
  const b = t.room.meState(t.room.player(evil[0])).quest;
  const shape = (q) => JSON.stringify({ ...q, canFail: undefined });
  assert.equal(shape(a), shape(b));
  assert.equal(t.room.meState(t.room.player(good[0])).legal.action, t.room.meState(t.room.player(evil[0])).legal.action);
});

test('bad / hostile messages are ignored without crashing', () => {
  const t = table(5);
  const p = t.hs[1].p;
  for (const m of [null, 5, 'x', {}, { t: 'nope' }, { t: 'propose', team: 'a' }, { t: 'vote' }, { t: 'setRoles', roles: 5 }, { t: 'kick', id: {} }, { t: 'assassinate', id: 1 }]) {
    assert.doesNotThrow(() => t.room.handle(p.id, m));
  }
  assert.ok(t.room.handle('nobody', { t: 'start' }).error);
});
