// Renders the real phone app (public/phone/app.js) in a tiny fake DOM, fed with the exact state every player's phone
// receives during real bot games: every screen must draw, and the record must be where players look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, textOf } from './fake-dom.js';
import { fill, makeRoom, runUntil } from './helpers.js';
import { screenFor } from '../public/phone/model.js';

const document = installDom();
await import('../public/phone/app.js');
const sq = globalThis.__sq;
const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Every state message every seat would get over a whole bot game (one human seat, played by its stand-in). */
function gameStates(seed, bots = 6, { classic = false } = {}) {
  const { room, clock } = makeRoom({ seed });
  const [h] = fill(room, 1, bots);
  if (classic) room.handle(room.vip.id, { t: 'setClassic', on: true });
  const out = [];
  const broadcast = room.broadcast.bind(room);
  room.broadcast = () => {
    broadcast();
    const pub = clone(room.publicState());
    for (const p of room.players) out.push({ t: 'state', pub, me: clone(room.meState(p)) });
  };
  room.broadcast(); // the lobby
  room.handle(room.vip.id, { t: 'start' });
  room.detachPhone(h.p.id, h.conn);
  assert.ok(runUntil(room, clock, 'gameover'), 'game finished');
  return out;
}

const WITH_RECORD = ['waitLeader', 'propose', 'vote', 'voted', 'watchQuest', 'quest-done', 'cutscene', 'questResult', 'assassinate', 'waitAssassin', 'gameover'];
const WITHOUT_RECORD = ['lobby', 'roleReveal', 'voteReveal', 'quest-card', 'quest-pick'];

test('phone: every screen of real games renders, with the record inline wherever players wait or decide', () => {
  const seen = new Set();
  const announced = new Set();
  let lastScreen = '';
  for (const seed of [3, 8, 21]) {
    for (const s of gameStates(seed)) {
      sq.inject(s);
      const screen = screenFor(s);
      seen.add(screen);
      const main = $('main');
      assert.equal(main.dataset.screen, screen);
      // the screen is announced by its heading when it changes; the screen itself is not a live region
      assert.equal(main.getAttribute('aria-live'), null);
      if (screen !== lastScreen && main.querySelector('h1')) {
        const said = textOf($('announce'));
        assert.ok(said.includes(textOf(main.querySelector('h1'))), `${screen}: "${said}"`);
        announced.add(said);
      }
      lastScreen = screen;
      const panel = main.querySelector('.record');
      if (WITHOUT_RECORD.includes(screen)) assert.equal(panel, null, `${screen} keeps its focus`);
      if (WITH_RECORD.includes(screen)) assert.ok(panel, `record on ${screen}`);
      if (!panel) continue;
      const table = panel.querySelector('table');
      if (!s.pub.game.history.length && s.pub.phase !== 'vote') {
        assert.equal(table, null);
        assert.match(textOf(panel), /Every proposal and vote will show up here/);
        continue;
      }
      // one row per player, one cell per proposal (plus the live one while voting), every cell labelled
      const rows = table.querySelectorAll('tr').filter((tr) => tr.querySelector('td'));
      assert.equal(rows.length, s.pub.players.length);
      const cols = s.pub.game.history.length + (s.pub.phase === 'vote' ? 1 : 0);
      for (const tr of rows) {
        const cells = tr.querySelectorAll('td');
        assert.equal(cells.length, cols);
        assert.ok(cells.every((td) => /quest \d proposal \d/.test(td.getAttribute('aria-label'))));
      }
      // the legend explains the star and the skull only when the record shows them
      const legend = textOf(panel.querySelector('.rb-legend'));
      assert.equal(/hero/.test(legend), table.querySelectorAll('.mk.hero').length > 0, `${screen}: ${legend}`);
      assert.equal(/blamed/.test(legend), table.querySelectorAll('.mk.blamed').length > 0, `${screen}: ${legend}`);
      // roles are never on a phone's record before the game is over
      assert.equal(table.querySelectorAll('.rl').length, s.pub.phase === 'gameover' ? s.pub.players.length : 0, screen);
      // while the votes are face-down only "has voted" shows for the live proposal
      if (s.pub.phase === 'vote') assert.ok(table.querySelectorAll('td.live').every((td) => !td.classList.contains('yes') && !td.classList.contains('no')));
    }
  }
  assert.ok(announced.size > 8, 'screen changes are announced');
  for (const sc of [...WITH_RECORD.filter((x) => x !== 'assassinate' && x !== 'waitAssassin'), 'lobby', 'roleReveal', 'voteReveal', 'quest-card']) assert.ok(seen.has(sc), `saw ${sc}`);
});

test('phone: the record is one tap away from the top bar during a game, and has its own full view', () => {
  const states = gameStates(8);
  const lobby = states.find((s) => s.pub.phase === 'lobby');
  const mid = states.filter((s) => s.pub.phase === 'propose' && s.pub.game.history.length >= 2).pop();
  assert.ok(mid, 'a game with at least two proposals');

  sq.inject(mid);
  const btn = $('roomtag').querySelector('.recbtn');
  assert.ok(btn, 'Record button in the top bar');
  btn.click();
  const sheet = $('sheet');
  assert.equal(sheet.hidden, false);
  assert.equal(sheet.getAttribute('aria-label'), 'The record');
  const big = sheet.querySelector('table');
  assert.ok(big.classList.contains('big'));
  assert.match(textOf(sheet), /Proposal by proposal/);
  assert.equal(sheet.querySelectorAll('.prop').length, mid.pub.game.history.length);
  // the help sheet no longer hides the record behind a tab, and explains how to read it instead
  $('helpbtn').click();
  assert.equal(sheet.getAttribute('aria-label'), 'Help');
  const tabs = sheet.querySelectorAll('button').filter((b) => b.getAttribute('role') === 'tab').map(textOf);
  assert.deepEqual(tabs, ['Now', 'How to play', 'Roles']);
  assert.match(textOf(sheet), /Reading the record/);
  // old links to the record tab still land on the record
  sq.openSheet('log');
  assert.equal(sheet.getAttribute('aria-label'), 'The record');

  // in the lobby the top bar shows the room code instead
  sq.inject(lobby);
  assert.equal($('roomtag').querySelector('.recbtn'), null);
  assert.match(textOf($('roomtag')), /Room/);
});

test('phone: in Classic mode each played quest shows its Fail count under the shield, and the full record says it too', () => {
  const states = gameStates(8, 6, { classic: true });
  const late = states.filter((s) => s.pub.phase === 'propose' && s.pub.game.results.length >= 2).pop();
  assert.ok(late, 'a game that reached quest 3');
  sq.inject(late);
  const counts = $('main').querySelectorAll('small.fc').map(textOf);
  assert.deepEqual(counts, late.pub.game.results.map((r) => `${r.failCount} Fail${r.failCount === 1 ? '' : 's'}`));
  $('roomtag').querySelector('.recbtn').click();
  const sheet = $('sheet');
  for (const r of late.pub.game.results.filter((x) => x.failCount)) assert.match(textOf(sheet), new RegExp(`${r.failCount} Fail card`));
  // without Classic no count shows anywhere
  const plain = gameStates(8).filter((s) => s.pub.phase === 'propose' && s.pub.game.results.length >= 2).pop();
  sq.inject(plain);
  assert.equal($('main').querySelectorAll('small.fc').length, 0);
});
