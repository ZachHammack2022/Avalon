import test from 'node:test';
import assert from 'node:assert/strict';
import { awards, backedFailures, bestDisguise, cleanText, failedTeamVotes, sentByText, teamCase, crownOrder, crownText, describeColumn, endReason, noToEvil, recordFor, rejectText, sharpestEye, tallyText, voteReads, voteReport } from '../shared/record.js';
import { FakeConn, fill, makeRoom, runUntil } from './helpers.js';

const players = ['Ann', 'Bo', 'Cy', 'Dee', 'Eli'].map((name, i) => ({ id: `p${i + 1}`, name, color: '#fff', cls: 'knight' }));
const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
const history = [
  { questIndex: 0, leader: 'p1', team: ['p1', 'p2'], votes: V('p1', 'p2'), approved: false },
  { questIndex: 0, leader: 'p2', team: ['p2', 'p3'], votes: V('p2', 'p3', 'p4'), approved: true },
  { questIndex: 1, leader: 'p3', team: ['p1', 'p3', 'p5'], votes: V('p1', 'p3', 'p4', 'p5'), approved: true },
];
const results = [
  { questIndex: 0, outcome: 'success', team: ['p2', 'p3'], hero: 'p3', culprit: null },
  { questIndex: 1, outcome: 'fail', team: ['p1', 'p3', 'p5'], hero: null, culprit: 'p5' },
];
const pub = (phase, game = {}, extra = {}) => ({ phase, players, game: { questIndex: 2, leader: 'p4', team: [], rejectCount: 0, history, results, ...game }, ...extra });

test('record: nothing before the game starts', () => {
  assert.equal(recordFor({ phase: 'lobby', players }), null);
  assert.equal(recordFor(null), null);
  const fresh = recordFor(pub('roleReveal', { questIndex: 0, history: [], results: [] }));
  assert.equal(fresh.empty, true);
  assert.equal(fresh.rows.length, 5);
  assert.deepEqual(fresh.quests.map((q) => q.size), [2, 3, 2, 3, 3]);
  assert.equal(fresh.quests[0].current, true);
});

test('record: every revealed proposal is a column, grouped by quest, with votes, team, leader and tally', () => {
  const rec = recordFor(pub('propose'));
  assert.equal(rec.columns.length, 3);
  assert.deepEqual(rec.columns.map((c) => [c.questIndex, c.attempt]), [[0, 1], [0, 2], [1, 1]]);
  assert.deepEqual(rec.columns.map((c) => [c.yes, c.no]), [[2, 3], [3, 2], [4, 1]]);
  // the sent proposal carries its quest's outcome; rejected ones do not
  assert.deepEqual(rec.columns.map((c) => c.outcome), [null, 'success', 'fail']);
  assert.deepEqual(rec.quests[0].cols, ['c0', 'c1']);
  assert.deepEqual(rec.quests[1].cols, ['c2']);
  assert.equal(rec.quests[2].current, true);
  const ann = rec.rows[0];
  assert.deepEqual(ann.cells.map((c) => c.vote), ['yes', 'no', 'yes']);
  assert.deepEqual(ann.cells.map((c) => c.onTeam), [true, false, true]);
  assert.deepEqual(ann.cells.map((c) => c.leader), [true, false, false]);
  assert.deepEqual(ann.quests, ['fail']);
  const cy = rec.rows[2];
  assert.deepEqual(cy.quests, ['success', 'fail']);
  assert.equal(cy.hero, 1);
  assert.equal(rec.rows[4].blamed, 1);
});

test('record: the team being voted on shows up live, with who has voted but not how', () => {
  const rec = recordFor(pub('vote', { team: ['p2', 'p4', 'p5'], voted: ['p1', 'p4'] }));
  const live = rec.columns[rec.columns.length - 1];
  assert.equal(live.live, true);
  assert.equal(live.approved, null);
  assert.equal(live.questIndex, 2);
  assert.deepEqual(rec.rows.map((r) => r.cells[3].vote), ['in', null, null, 'in', null]);
  assert.equal(live.voted, 2);
  assert.equal(tallyText(live, 5), '2/5');
  assert.equal(tallyText(rec.columns[0], 5), '2–3');
  assert.equal(rec.columns[0].voted, 5);
  assert.deepEqual(rec.rows.map((r) => r.cells[3].onTeam), [false, true, false, true, true]);
  assert.equal(rec.rows[3].cells[3].leader, true);
  // outside the vote phase there is no live column (the revealed one lives in history)
  assert.equal(recordFor(pub('voteReveal', { team: ['p2', 'p4', 'p5'] })).columns.length, 3);
});

test('record: roles only appear once the game is over', () => {
  assert.ok(recordFor(pub('assassination')).rows.every((r) => r.role === null));
  const done = recordFor(pub('gameover', {}, { reveal: { roles: { p1: 'merlin', p2: 'assassin', p3: 'loyal', p4: 'minion', p5: 'loyal' } } }));
  assert.deepEqual(done.rows.map((r) => r.role), ['merlin', 'assassin', 'loyal', 'minion', 'loyal']);
  assert.ok(done.quests.every((q) => !q.current));
});

test('record: in Classic mode the Fail count of each quest is part of the record', () => {
  const classic = [{ ...results[0], failCount: 1 }, { ...results[1], failCount: 2 }];
  const rec = recordFor(pub('propose', { results: classic }));
  assert.deepEqual(rec.quests.map((q) => q.failCount), [1, 2, null, null, null]);
  assert.deepEqual(rec.columns.map((c) => c.failCount), [null, 1, 2]);
  const name = (id) => players.find((p) => p.id === id).name;
  assert.match(describeColumn(rec.columns[1], name), /The quest succeeded with 1 Fail card\.$/);
  assert.match(describeColumn(rec.columns[2], name), /The quest failed with 2 Fail cards\.$/);
  // without Classic the count is secret and never mentioned
  assert.ok(recordFor(pub('propose')).columns.every((c) => c.failCount === null));
});

test('record: votes a stand-in cast are marked, and so is a seat that is away right now', () => {
  const hist = [history[0], { ...history[1], standIn: ['p4'] }, history[2]];
  const away = players.map((p) => (p.id === 'p4' ? { ...p, connected: false } : { ...p, connected: true }));
  const rec = recordFor({ ...pub('propose', { history: hist }), players: away });
  const dee = rec.rows[3];
  assert.deepEqual(dee.cells.map((c) => c.standIn), [false, true, false]);
  assert.equal(dee.away, true);
  assert.ok(rec.rows.filter((r) => r.id !== 'p4').every((r) => !r.away && r.cells.every((c) => !c.standIn)));
  const name = (id) => players.find((p) => p.id === id).name;
  assert.match(describeColumn(rec.columns[1], name), /Approved 3 to 2\. A stand-in voted for Dee\./);
  // a bot is never "away", and nobody is once the game is over
  assert.equal(recordFor({ ...pub('propose'), players: away.map((p) => ({ ...p, bot: true })) }).rows[3].away, false);
  assert.equal(recordFor({ ...pub('gameover', {}, { reveal: { roles: {} } }), players: away }).rows[3].away, false);
});

test('record: plain-language column summaries', () => {
  const rec = recordFor(pub('vote', { team: ['p4', 'p5'], voted: [] }));
  const name = (id) => players.find((p) => p.id === id).name;
  assert.equal(describeColumn(rec.columns[0], name), 'Quest 1, proposal 1: Ann proposed Ann and Bo. Rejected 2 to 3.');
  assert.equal(describeColumn(rec.columns[2], name), 'Quest 2, proposal 1: Cy proposed Ann, Cy and Eli. Approved 4 to 1. The quest failed.');
  assert.match(describeColumn(rec.columns[3], name), /Dee proposed Dee and Eli\. Voting now\./);
});

test('record: a real game builds a consistent board from what phones receive, and never leaks a result early', () => {
  const { room, clock } = makeRoom({ seed: 21 });
  const [h] = fill(room, 1, 6);
  const tv = new FakeConn(); room.attachTv(tv);
  room.handle(room.vip.id, { t: 'start' });
  room.detachPhone(h.p.id, h.conn); // a stand-in bot plays for the human
  assert.ok(runUntil(room, clock, 'gameover'));
  let maxCols = 0;
  for (const m of tv.msgs.filter((x) => x.t === 'state' && x.pub.game)) {
    const rec = recordFor(m.pub);
    assert.equal(rec.rows.length, 7);
    for (const row of rec.rows) assert.equal(row.cells.length, rec.columns.length);
    // every column's team has exactly the quest's size, and one leader
    for (const [i, c] of rec.columns.entries()) {
      assert.equal(c.team.length, rec.quests[c.questIndex].size);
      assert.equal(rec.rows.filter((r) => r.cells[i].leader).length, 1);
      if (!c.live) assert.equal(c.yes + c.no, 7);
    }
    // a quest's outcome is never on the board while its cutscene is still playing
    if (m.pub.phase === 'cutscene') assert.equal(rec.quests[m.pub.game.questIndex].outcome, null);
    if (m.pub.phase !== 'gameover') assert.ok(rec.rows.every((r) => r.role === null));
    maxCols = Math.max(maxCols, rec.columns.length);
  }
  assert.ok(maxCols >= 3);
  const final = recordFor(tv.state.pub);
  assert.ok(final.rows.every((r) => r.role));
  // the game-over pub carries the whole vote record, so every phone and the TV can read the votes against the roles
  assert.ok(Object.values(voteReads(tv.state.pub)).some((r) => r.of > 0));
  // the sent proposal of every played quest carries that quest's outcome
  for (const q of final.quests.filter((x) => x.outcome)) {
    const sent = final.columns.filter((c) => c.questIndex === q.index && c.approved);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].outcome, q.outcome);
  }
});

test('crown order: who leads each remaining proposal of this quest, ending with the fifth', () => {
  const nm = (id) => players.find((p) => p.id === id).name;
  const at = (phase, rejectCount, extra = {}) => ({ phase, players, game: { leader: 'p4', rejectCount, ...extra } });
  assert.deepEqual(crownOrder(at('propose', 0)), ['p4', 'p5', 'p1', 'p2', 'p3']); // wraps around the table
  assert.match(crownText(at('propose', 0), nm), /^Next to lead: Eli, Ann, Bo, then Cy for the fifth proposal\.$/);
  assert.deepEqual(crownOrder(at('vote', 2)), ['p4', 'p5', 'p1']);
  assert.equal(crownText(at('vote', 2), nm), 'Next to lead: Eli, then Ann for the fifth proposal.');
  assert.equal(crownText(at('vote', 3), nm), 'If rejected, Eli leads the fifth and final proposal.');
  assert.equal(crownText(at('propose', 4), nm), 'Fifth proposal: if this team is rejected, Evil wins.');
  // the server's seat order wins over the player list
  assert.deepEqual(crownOrder(at('propose', 3, { order: ['p4', 'p2', 'p5', 'p1', 'p3'] })), ['p4', 'p2']);
  // only while a team is being picked or voted on
  for (const phase of ['roleReveal', 'voteReveal', 'questPlay', 'cutscene', 'questResult', 'assassination', 'gameover']) {
    assert.equal(crownOrder(at(phase, 0)), null, phase);
    assert.equal(crownText(at(phase, 0), nm), '', phase);
  }
  assert.equal(crownOrder({ phase: 'lobby', players }), null);
  assert.equal(crownOrder(at('propose', 0, { leader: 'nobody' })), null);
});

test('crown order: in real games it names the actual next leaders and the fifth proposal\'s leader', () => {
  const { room, clock } = makeRoom({ seed: 5 });
  const [h] = fill(room, 1, 6);
  room.handle(room.vip.id, { t: 'start' });
  room.detachPhone(h.p.id, h.conn); // its stand-in plays
  let checked = 0;
  let last = null;
  const broadcast = room.broadcast.bind(room);
  room.broadcast = () => {
    broadcast();
    const pub = room.publicState();
    assert.deepEqual(pub.game ? pub.game.order : room.playerIds(), room.playerIds());
    if (pub.phase === 'propose' && (!last || last.leader !== pub.game.leader)) {
      if (last && last.crown && last.questIndex === pub.game.questIndex) {
        // the crown moved exactly where the record said it would
        assert.equal(pub.game.leader, last.crown[1]);
        assert.deepEqual(crownOrder(pub), last.crown.slice(1));
        checked++;
      }
      last = { leader: pub.game.leader, questIndex: pub.game.questIndex, crown: crownOrder(pub) };
      assert.equal(last.crown.length, 5 - pub.game.rejectCount);
    }
  };
  assert.ok(runUntil(room, clock, 'gameover'));
  assert.ok(checked > 0, 'saw a rejected team pass the crown on');
});

test('end reason: one sentence on why the game ended, naming the Assassin\'s target and the real Merlin', () => {
  const nm = (id) => players.find((p) => p.id === id).name;
  const roles = { p1: 'merlin', p2: 'assassin', p3: 'loyal', p4: 'minion', p5: 'loyal' };
  const rv = (winner, reason, assassination = null) => ({ winner, reason, roles, assassination });
  assert.equal(endReason(rv('good', 'quests'), nm), 'Three quests succeeded.');
  assert.equal(endReason(rv('evil', 'quests'), nm), 'Three quests failed.');
  assert.equal(endReason(rv('evil', 'rejects'), nm), 'Five proposals in a row were rejected.');
  assert.equal(endReason(rv('evil', 'assassination-hit', { assassin: 'p2', target: 'p1', hit: true }), nm), 'The Assassin struck Ann, who was Merlin.');
  assert.equal(endReason(rv('good', 'assassination-miss', { assassin: 'p2', target: 'p3', hit: false }), nm), 'The Assassin struck Cy, but Merlin was Ann.');
  assert.equal(endReason(rv('good', 'assassination-miss'), nm), 'The Assassin missed Merlin.');
  assert.equal(endReason(null, nm), '');
});

test('reject text: the crown passes on, with a warning before the fifth, and the fifth rejection ends the game', () => {
  assert.equal(rejectText(1), 'The crown passes on. 1 of 5 teams rejected.');
  assert.equal(rejectText(3), 'The crown passes on. 3 of 5 teams rejected.');
  assert.equal(rejectText(4), 'The crown passes on. 4 of 5 teams rejected: one more and Evil wins.');
  assert.equal(rejectText(5), '5 teams in a row were rejected. Evil wins.');
});

test('vote reads: a vote is right when it waved a clean team through or voted down one with evil on it', () => {
  const roles = { p1: 'merlin', p2: 'loyal', p3: 'loyal', p4: 'percival', p5: 'assassin' };
  const v = (o) => o; // votes on a player's own team are listed but never counted
  const hist = [
    { questIndex: 0, leader: 'p2', team: ['p2', 'p5'], votes: v({ p1: false, p2: true, p3: true, p4: false, p5: true }), approved: false },
    { questIndex: 0, leader: 'p3', team: ['p2', 'p3'], votes: v({ p1: true, p2: true, p3: true, p4: true, p5: false }), approved: true },
    { questIndex: 1, leader: 'p5', team: ['p3', 'p5', 'p4'], votes: v({ p1: false, p2: false, p3: true, p4: true, p5: true }), approved: true },
    { questIndex: 2, leader: 'p1', team: ['p1', 'p2'], votes: v({ p1: true, p2: true, p3: true, p4: true, p5: false }), approved: true },
  ];
  const over = (h = hist, r = roles) => ({ phase: 'gameover', players, game: { history: h }, reveal: { roles: r, recap: [] } });
  assert.equal(voteReads(pub('propose')), null, 'not before the roles are public');
  const reads = voteReads(over());
  assert.deepEqual(reads.p1, { right: 3, of: 3 });
  assert.deepEqual(reads.p2, { right: 1, of: 1 });
  assert.deepEqual(reads.p3, { right: 1, of: 2 }, 'approved a team with the Assassin on it');
  assert.deepEqual(reads.p4, { right: 3, of: 3 }, 'its own team on quest 2 is left out');
  // Merlin could see evil, so the award goes to the best good player who could not
  assert.deepEqual(sharpestEye(over()), { id: 'p4', right: 3, of: 3 });
  assert.match(awards(over(), []).join('\n'), /^★ Sharpest eye: Dee, who read 3 of 3 teams right$/m);
  // the full record's report: every player with counted votes, in seat order, evil players marked
  assert.deepEqual(voteReport(over()), [
    { id: 'p1', evil: false, right: 3, of: 3 }, { id: 'p2', evil: false, right: 1, of: 1 }, { id: 'p3', evil: false, right: 1, of: 2 },
    { id: 'p4', evil: false, right: 3, of: 3 }, { id: 'p5', evil: true, right: 0, of: 2 }]);
  assert.equal(voteReport(pub('propose')), null);
  // votes a stand-in cast for a player who was away say nothing about them
  const away = hist.map((h, i) => (i === 0 ? { ...h, standIn: ['p4'] } : h));
  assert.deepEqual(voteReads(over(away)).p4, { right: 2, of: 2 });
  assert.equal(sharpestEye(over(away)), null, 'nobody with three counted votes besides Merlin');
  // three in four right is the bar; evil players are never in the running
  assert.equal(sharpestEye(over(hist, { ...roles, p4: 'morgana' })), null);
  // ...for that one: an evil player whose votes looked like Good's gets the best disguise instead
  assert.equal(bestDisguise(over()), null, 'the Assassin voted like Good on 0 of 2');
  assert.deepEqual(bestDisguise(over(hist, { ...roles, p4: 'morgana' })), { id: 'p4', right: 3, of: 3 });
  assert.match(awards(over(hist, { ...roles, p4: 'morgana' }), []).join('\n'), /^★ Best disguise: Dee, who voted like Good on 3 of 3 teams$/m);
  assert.equal(bestDisguise(over(away, { ...roles, p4: 'morgana' })), null, 'three counted votes at least');
  assert.equal(bestDisguise(pub('propose')), null, 'not before the roles are public');
});

test('the Assassin\'s read: how often each player voted down a team with someone the Assassin knows is evil on it', () => {
  // the file's history: p5 (say the Assassin) was on the third team only; with p2 as an ally, the first two count too
  const p = pub('assassination');
  assert.deepEqual(noToEvil(p, ['p5']), { p2: { no: 1, of: 1 }, p4: { no: 0, of: 1 } }, 'its own team and allies are left out');
  assert.deepEqual(noToEvil(p, ['p5', 'p2']), { p1: { no: 1, of: 1 }, p3: { no: 1, of: 1 }, p4: { no: 1, of: 3 } });
  // a vote a stand-in cast says nothing about the player
  const away = pub('assassination', { history: history.map((h, i) => (i === 0 ? { ...h, standIn: ['p4'] } : h)) });
  assert.deepEqual(noToEvil(away, ['p5', 'p2']).p4, { no: 0, of: 2 });
  assert.deepEqual(noToEvil({ phase: 'lobby', players }, ['p5']), {});
});

test('backed failures: the failed teams each player voted to send without going on them', () => {
  // quest 2 (p1, p3 and p5) failed; p4 voted to send it from outside, p2 voted against
  assert.deepEqual(backedFailures(pub('propose')), { p4: 1 });
  // a stand-in's vote says nothing about the player
  const away = history.map((h, i) => (i === 2 ? { ...h, standIn: ['p4'] } : h));
  assert.deepEqual(backedFailures(pub('propose', { history: away })), {});
  // a quest whose result is not public yet (its cutscene still playing) does not count
  assert.deepEqual(backedFailures(pub('cutscene', { results: results.slice(0, 1) })), {});
  assert.deepEqual(backedFailures({ phase: 'lobby', players }), {});
});

test('failed team votes: how each player voted on the teams that went and failed', () => {
  // quest 2 (p1, p3 and p5) failed: of the two outside it, p4 voted to send it and p2 against
  assert.deepEqual(failedTeamVotes(pub('propose')), { p2: { against: 1, of: 1 }, p4: { against: 0, of: 1 } });
  const away = history.map((h, i) => (i === 2 ? { ...h, standIn: ['p4'] } : h));
  assert.deepEqual(failedTeamVotes(pub('propose', { history: away })), { p2: { against: 1, of: 1 } }, 'stand-in votes left out');
  assert.deepEqual(failedTeamVotes(pub('cutscene', { results: results.slice(0, 1) })), {}, 'only public results');
  assert.deepEqual(failedTeamVotes({ phase: 'lobby', players }), {});
});

test('team case: who on a proposed team went on a failed quest or voted to send one, in one line', () => {
  const nm = (id) => players.find((p) => p.id === id).name;
  const p = pub('vote');
  assert.equal(teamCase(p, ['p1', 'p2'], nm), 'Ann went on 1 failed quest.');
  assert.equal(teamCase(p, ['p4', 'p2', 'p1'], nm), 'Dee voted to send 1 failed team. Ann went on 1 failed quest.');
  assert.equal(teamCase(p, ['p2', 'p4'], nm), 'Dee voted to send 1 failed team.');
  assert.equal(teamCase(p, ['p2'], nm), 'Nobody on this team went on or voted for a failed quest.');
  assert.equal(teamCase(p, ['p1', 'p3', 'p4'], nm), 'Ann, Cy and Dee all went on or voted for failed quests.', 'three names: no counts');
  assert.equal(teamCase(pub('vote', { results: results.slice(0, 1) }), ['p1', 'p2'], nm), null, 'nothing before a quest fails');
  // a player on two failed quests who also voted to send a third
  const more = pub('vote', {
    history: history.concat({ questIndex: 2, leader: 'p4', team: ['p1', 'p3'], votes: V('p1', 'p3', 'p5'), approved: true }),
    results: results.concat({ questIndex: 2, outcome: 'fail', team: ['p1', 'p3'], hero: null, culprit: 'p1' }),
  });
  assert.equal(teamCase(more, ['p5'], nm), 'Eli went on 1 failed quest and voted to send 1 failed team.');
  assert.equal(teamCase(more, ['p3'], nm), 'Cy went on 2 failed quests.');
});

test('clean record: who never went on or voted to send a failed quest, for the table while a leader picks', () => {
  const nm = (id) => players.find((p) => p.id === id).name;
  // quest 2 failed with p1, p3 and p5 on it, and p4 voted to send it from outside: only Bo is clean
  assert.equal(cleanText(pub('propose'), nm), 'Never on or behind a failed quest: Bo.');
  // a stand-in's vote says nothing about Dee
  const away = history.map((h, i) => (i === 2 ? { ...h, standIn: ['p4'] } : h));
  assert.equal(cleanText(pub('propose', { history: away }), nm), 'Never on or behind a failed quest: Bo and Dee.');
  assert.equal(cleanText(pub('propose', { results: results.slice(0, 1) }), nm), null, 'nothing before a quest fails');
  // Bo then goes on a failed quest too: nobody is left
  const all = pub('propose', {
    history: history.concat({ questIndex: 2, leader: 'p4', team: ['p2', 'p4'], votes: V('p2', 'p4'), approved: true }),
    results: results.concat({ questIndex: 2, outcome: 'fail', team: ['p2', 'p4'], hero: null, culprit: 'p2' }),
  });
  assert.equal(cleanText(all, nm), 'Everyone has gone on or voted for a failed quest.');
  assert.equal(cleanText({ phase: 'lobby', players }, nm), null);
});

test('sent by: right after a quest fails, who voted to send that team from outside it', () => {
  const nm = (id) => players.find((p) => p.id === id).name;
  // quest 2 (p1, p3 and p5) failed; only p4 voted it through from outside
  assert.equal(sentByText(pub('questResult'), results[1], nm), 'Voted to send it from outside the team: Dee.');
  const away = history.map((h, i) => (i === 2 ? { ...h, standIn: ['p4'] } : h));
  assert.equal(sentByText(pub('questResult', { history: away }), results[1], nm), 'Nobody outside the team voted to send it.', 'stand-in votes left out');
  assert.equal(sentByText(pub('questResult'), results[0], nm), null, 'nothing for a success');
  assert.equal(sentByText(pub('questResult', { history: [] }), results[1], nm), null);
});
