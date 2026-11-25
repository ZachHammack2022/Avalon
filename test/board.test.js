import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIP_START, FLIP_STEP, boardTree, flipKeyFor } from '../public/tv/board.js';

const players = ['Ann', 'Bo', 'Cy', 'Dee', 'Eli'].map((name, i) => ({ id: `p${i + 1}`, name, color: '#fff', cls: 'knight' }));
const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
const history = [
  { questIndex: 0, leader: 'p1', team: ['p1', 'p2'], votes: V('p1', 'p2'), approved: false },
  { questIndex: 0, leader: 'p2', team: ['p2', 'p3'], votes: V('p2', 'p3', 'p4'), approved: true },
  { questIndex: 1, leader: 'p3', team: ['p1', 'p3', 'p5'], votes: V('p1', 'p3', 'p4', 'p5'), approved: true },
];
const results = [
  { questIndex: 0, outcome: 'success', team: ['p2', 'p3'] },
  { questIndex: 1, outcome: 'fail', team: ['p1', 'p3', 'p5'] },
];
const pub = (phase, game = {}, extra = {}) => ({ phase, players, game: { questIndex: 2, leader: 'p4', team: [], rejectCount: 1, history, results, ...game }, ...extra });

/** every node in a tree (strings skipped) */
const walk = (nodes, out = []) => { for (const n of [].concat(nodes)) if (n && typeof n === 'object') { out.push(n); walk(n.kids, out); } return out; };
const has = (n, c) => n.cls.split(' ').includes(c);
const find = (tree, c) => walk(tree).filter((n) => has(n, c));
const text = (n) => (typeof n === 'string' ? n : n.kids.map(text).join(''));

test('board: nothing before the game, an inviting empty state before the first vote', () => {
  assert.equal(boardTree({ phase: 'lobby', players }), null);
  const fresh = boardTree(pub('propose', { questIndex: 0, history: [], results: [], rejectCount: 0 }));
  assert.equal(find(fresh, 'bd-grid').length, 0);
  assert.match(text(find(fresh, 'bd-empty')[0]), /Every proposal and vote/);
  // the quest shields are there from the start, with team sizes, and quest 1 marked current
  const shields = find(fresh, 'bq');
  assert.equal(shields.length, 5);
  assert.ok(has(shields[0], 'current'));
  assert.deepEqual(shields.map((s) => text(s.kids[1])), ['2 go', '3 go', '2 go', '3 go', '3 go']);
});

test('board: shields, reject pips, one column per proposal grouped under its quest', () => {
  const tree = boardTree(pub('propose'));
  const shields = find(tree, 'bq');
  assert.deepEqual(shields.map((s) => s.cls.split(' ')[1]), ['success', 'fail', 'current', 'pending', 'pending']);
  assert.equal(find(tree, 'pips')[0].kids.filter((k) => k.cls === 'on').length, 1);
  assert.match(text(find(tree, 'bd-rej')[0]), /Rejected 1\/5/);
  const heads = find(tree, 'qh');
  assert.deepEqual(heads.map((h) => [text(h), h.attrs.colspan]), [['Q1', '2'], ['Q2', '1']]);
  assert.equal(find(tree, 'bd-grid')[0].attrs.style, '--cols:3');
  const rows = walk(tree).filter((n) => n.tag === 'tr' && !has(n, 'tally') && n.kids[0] && has(n.kids[0], 'nm') && n.kids[0].kids.length);
  assert.equal(rows.length, 5);
  // under every proposal, how the vote went
  assert.deepEqual(find(tree, 't').map((t) => [text(t), t.cls.split(' ')[1]]), [['2–3', 'ko'], ['3–2', 'ok'], ['4–1', 'ok']]);
  const [ann] = rows;
  const cells = ann.kids.slice(1);
  assert.deepEqual(cells.map((c) => text(c).slice(0, 1)), ['✔', '✘', '✔']);
  // Ann led the first proposal and was on it; it was rejected
  assert.ok(has(cells[0], 'lead') && has(cells[0], 'team') && has(cells[0], 'rej'));
  assert.equal(find(cells[0], 'crown').length, 1);
  // Ann went on quest 2, which failed; a quest's first column carries the divider
  assert.ok(has(cells[2], 'went') && has(cells[2], 'fail') && has(cells[2], 'qs'));
  assert.ok(!has(cells[1], 'qs'));
  // the whole team that went is marked the same way: nobody on it is singled out as a hero or a culprit
  const eli = rows[4].kids.slice(1);
  assert.ok(has(eli[2], 'went') && has(eli[2], 'fail'));
  const cy = rows[2].kids.slice(1);
  assert.ok(has(cy[1], 'went') && !has(cy[1], 'fail'));
  assert.equal(find(tree, 'hero').length + find(tree, 'blamed').length + find(tree, 'mk').length, 0);
  assert.equal(find(tree, 'bd-legend').length, 1);
  assert.doesNotMatch(text(find(tree, 'bd-legend')[0]), /hero|blamed/);
});

test('board: Classic mode keeps the Fail count under each played shield', () => {
  const plain = find(boardTree(pub('propose')), 'fc');
  assert.equal(plain.length, 0);
  const classic = [{ ...results[0], failCount: 0 }, { ...results[1], failCount: 2 }];
  const fc = find(boardTree(pub('propose', { results: classic })), 'fc');
  assert.deepEqual(fc.map(text), ['0 Fails', '2 Fails']); // short enough to sit under a shield
  assert.deepEqual(fc.map((n) => has(n, 'some')), [false, true]);
});

test('board: stand-in votes are striped and explained, and an away seat is tagged', () => {
  assert.equal(find(boardTree(pub('propose')), 'auto').length, 0);
  assert.doesNotMatch(text(find(boardTree(pub('propose')), 'bd-legend')[0]), /stand-in/);
  const hist = [history[0], { ...history[1], standIn: ['p4'] }, history[2]];
  const tree = boardTree({ ...pub('propose', { history: hist }), players: players.map((p) => ({ ...p, connected: p.id !== 'p4' })) });
  const auto = find(tree, 'auto').filter((n) => n.tag === 'td');
  assert.equal(auto.length, 1);
  assert.equal(text(auto[0]).slice(0, 1), '✔');
  assert.match(text(find(tree, 'bd-legend')[0]), /stand-in vote/);
  assert.deepEqual(find(tree, 'aw').map(text), ['away']);
  assert.equal(walk(tree).filter((n) => n.tag === 'tr' && has(n, 'away')).length, 1);
});

test('board: the team under vote shows live, with face-down marks for who has voted', () => {
  const tree = boardTree(pub('vote', { team: ['p4', 'p5'], voted: ['p2'] }));
  const live = find(tree, 'live').filter((c) => has(c, 'c'));
  assert.equal(live.length, 5);
  // the live tally counts face-down votes, never how they went
  assert.equal(text(find(tree, 't').pop()), '1/5');
  assert.deepEqual(live.map((c) => c.kids.filter((k) => typeof k === 'string').join('')), ['', '?', '', '', '']);
  assert.ok(has(live[3], 'team') && has(live[3], 'lead'));
  assert.ok(find(tree, 'qh').some((h) => text(h) === 'Q3' && has(h, 'current')));
});

test('board: a freshly revealed column turns over one vote at a time, in step with the 3D tokens', () => {
  const p = pub('voteReveal');
  assert.equal(flipKeyFor(p, 2), 'c2');
  assert.equal(flipKeyFor(p, 3), null); // already known
  assert.equal(flipKeyFor(p, null), null); // first paint (a refresh) does not replay
  assert.equal(flipKeyFor(pub('propose'), 2), null);
  const all = find(boardTree(p, { flip: 'c2' }), 'flip');
  const flips = all.filter((c) => has(c, 'c'));
  assert.equal(flips.length, 5);
  assert.deepEqual(flips.map((c) => c.attrs.style), players.map((_, i) => `animation-delay:${(FLIP_START + i * FLIP_STEP).toFixed(2)}s`));
  // the tally appears only once the last vote has turned over, so it never gives the result away early
  const tally = all.filter((c) => has(c, 't'));
  assert.equal(tally.length, 1);
  assert.equal(tally[0].attrs.style, `animation-delay:${(FLIP_START + 5 * FLIP_STEP).toFixed(2)}s`);
});

test('board: roles and team colours only at game over', () => {
  assert.equal(find(boardTree(pub('assassination')), 'role').length, 0);
  const roles = { p1: 'merlin', p2: 'assassin', p3: 'loyal', p4: 'minion', p5: 'loyal' };
  const tree = boardTree(pub('gameover', {}, { reveal: { roles } }));
  assert.deepEqual(find(tree, 'role').map(text), ['Merlin', 'Assassin', 'Loyal Servant', 'Minion', 'Loyal Servant']);
  assert.equal(find(tree, 'team-evil').length, 2);
  assert.ok(find(tree, 'bq').every((s) => !has(s, 'current')));
});
