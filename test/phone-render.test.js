// Renders the real phone app (public/phone/app.js) in a tiny fake DOM, fed with the exact state every player's phone
// receives during real bot games: every screen must draw, and the record must be where players look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, textOf } from './fake-dom.js';
import { fill, makeRoom, runUntil } from './helpers.js';
import { screenFor } from '../public/phone/model.js';
import { ROLE_INFO } from '../shared/roles-info.js';
import { awards, backedFailures, noToEvil, teamCase } from '../shared/record.js';

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
  let sawPickWent = false;
  const sawCrown = new Set();
  const sawWent = new Set();
  let sawWaiting = false;
  let lastScreen = '';
  let sawStandIn = false;
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
      // while a team is picked or voted on, the panel says who leads next (and warns on the fifth proposal)
      const crown = panel.querySelector('p.crown');
      assert.equal(!!crown, s.pub.phase === 'propose' || s.pub.phase === 'vote', `${screen}: crown line`);
      if (crown) {
        assert.match(textOf(crown), s.pub.game.rejectCount === 4 ? /Evil wins/ : /fifth/);
        assert.equal(crown.classList.contains('last'), s.pub.game.rejectCount === 4);
        sawCrown.add(s.pub.game.rejectCount);
      }
      const table = panel.querySelector('table');
      if (!s.pub.game.history.length && s.pub.phase !== 'vote') {
        assert.equal(table, null);
        assert.match(textOf(panel), /Every proposal and vote will show up here/);
        continue;
      }
      // one row per player, one cell per proposal (plus the live one while voting), every cell labelled
      const rows = table.querySelectorAll('tr').filter((tr) => tr.querySelector('td') && !tr.classList.contains('tally'));
      assert.equal(rows.length, s.pub.players.length);
      const cols = s.pub.game.history.length + (s.pub.phase === 'vote' ? 1 : 0);
      // under every proposal, its tally: revealed votes, or how many are in while they are face-down
      const tally = table.querySelector('.tally').querySelectorAll('td');
      assert.equal(tally.length, cols);
      s.pub.game.history.forEach((hh, i) => {
        const yes = Object.values(hh.votes).filter(Boolean).length;
        assert.equal(textOf(tally[i]), `${yes}–${s.pub.players.length - yes}`);
      });
      if (s.pub.phase === 'vote') assert.equal(textOf(tally[cols - 1]), `${s.pub.game.voted.length}/${s.pub.players.length}`);
      for (const tr of rows) {
        const cells = tr.querySelectorAll('td');
        assert.equal(cells.length, cols);
        assert.ok(cells.every((td) => /quest \d proposal \d/.test(td.getAttribute('aria-label'))));
      }
      // the legend explains the star and the skull only when the record shows them
      const legend = textOf(panel.querySelector('.rb-legend'));
      assert.equal(/hero/.test(legend), table.querySelectorAll('.mk.hero').length > 0, `${screen}: ${legend}`);
      assert.equal(/blamed/.test(legend), table.querySelectorAll('.mk.blamed').length > 0, `${screen}: ${legend}`);
      // the human seat in these games is played by a stand-in once its grace runs out: its votes are striped
      const autos = table.querySelectorAll('td.auto');
      assert.equal(/stand-in vote/.test(legend), autos.length > 0, `${screen}: ${legend}`);
      for (const td of autos) assert.match(td.getAttribute('aria-label'), /by a stand-in/);
      if (autos.length) sawStandIn = true;
      // roles are never on a phone's record before the game is over
      assert.equal(table.querySelectorAll('.rl').length, s.pub.phase === 'gameover' ? s.pub.players.length : 0, screen);
      // once only a few are left, the locked-in screen names who the table is waiting on
      if (screen === 'voted') {
        const left = s.pub.players.filter((p) => !s.pub.game.voted.includes(p.id));
        const said = textOf(main);
        if (left.length <= 3) {
          assert.ok(left.every((p) => said.includes(p.id === s.me.id ? 'you' : p.name)), said);
          assert.match(said, /Waiting on/);
          sawWaiting = true;
        } else assert.doesNotMatch(said, /Waiting on/);
      }
      // the proposed team carries each member's quest history (shown results only)
      if (screen === 'vote' || screen === 'voted') {
        const members = main.querySelector('.team').querySelectorAll('.member');
        assert.equal(members.length, s.pub.game.team.length);
        members.forEach((m, i) => {
          const id = s.pub.game.team[i];
          const want = s.pub.game.results.filter((r) => r.team.includes(id)).map((r) => (r.outcome === 'success' ? 'ok' : 'ko'));
          const got = m.querySelector('.went');
          assert.deepEqual(got ? got.querySelectorAll('.ic').map((ic) => (ic.classList.contains('ok') ? 'ok' : 'ko')) : [], want, `${screen}: member ${id}`);
          if (want.length) { sawWent.add(want.length); assert.match(got.getAttribute('aria-label'), /went on \d quests?/); }
        });
      }
      // the leader picks with the same history beside every name
      if (screen === 'propose') {
        const chips = main.querySelectorAll('.person');
        assert.equal(chips.length, s.pub.players.length);
        chips.forEach((c, i) => {
          const id = s.pub.players[i].id;
          const want = s.pub.game.results.filter((r) => r.team.includes(id)).map((r) => (r.outcome === 'success' ? 'ok' : 'ko'));
          const got = c.querySelector('.went');
          assert.deepEqual(got ? got.querySelectorAll('.ic').map((ic) => (ic.classList.contains('ok') ? 'ok' : 'ko')) : [], want, `propose: ${id}`);
          if (want.length) sawPickWent = true;
        });
      }
      // while the votes are face-down only "has voted" shows for the live proposal
      if (s.pub.phase === 'vote') assert.ok(table.querySelectorAll('td.live').every((td) => !td.classList.contains('yes') && !td.classList.contains('no')));
    }
  }
  assert.ok(announced.size > 8, 'screen changes are announced');
  assert.ok(sawCrown.has(0) && sawCrown.size > 1, `crown lines seen at reject counts ${[...sawCrown]}`);
  assert.ok(sawWent.size > 1, 'team members with one and with several past quests');
  assert.ok(sawPickWent, 'the leader saw quest history while picking');
  assert.ok(sawWaiting, 'a locked-in vote named the stragglers');
  assert.ok(sawStandIn, 'the stand-in seat shows up on the record');
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
  assert.match(textOf(sheet), /The Votes row under each column/);
  // How to play teaches the record as part of the game
  sheet.querySelectorAll('button').find((b) => textOf(b) === 'How to play').click();
  assert.match(textOf(sheet), /The record.*best evidence/);
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

test('phone: the Assassin sees every other player to strike, with known allies marked and listed last', () => {
  let found = null;
  for (let seed = 1; seed < 80 && !found; seed++) found = gameStates(seed).find((s) => screenFor(s) === 'assassinate');
  assert.ok(found, 'a game that reached the assassination');
  sq.inject(found);
  const chips = $('main').querySelector('.people').querySelectorAll('.person');
  assert.equal(chips.length, found.me.legal.options.length);
  const allies = found.me.knows;
  assert.ok(allies.length > 0, 'the Assassin knows its allies');
  const tagged = chips.filter((c) => c.querySelector('small') && textOf(c.querySelector('small')) === 'your ally');
  assert.equal(tagged.length, allies.length);
  // allies come after everyone else
  const order = chips.map((c) => (tagged.includes(c) ? 1 : 0));
  assert.deepEqual(order, order.slice().sort());
  // good has won three quests by now, so the record of who went shows beside the names
  assert.ok(chips.filter((c) => c.querySelector('.went')).length >= 2);
  // and the record is read for the Assassin: how each suspect voted on teams with evil on them
  const reads = noToEvil(found.pub, [found.me.id, ...allies]);
  const named = found.me.legal.options.filter((id) => !allies.includes(id) && reads[id]);
  assert.ok(named.length >= 2, 'several suspects voted on a team with evil on it');
  for (const id of named) {
    const chip = chips.find((c) => textOf(c).includes(found.pub.players.find((x) => x.id === id).name));
    assert.match(textOf(chip.querySelector('small')), new RegExp(`^Voted down ${reads[id].no} of ${reads[id].of} evil teams?$`));
  }
  assert.match(textOf($('main')), /Merlin tends to vote down teams with evil on them/);
});

test('phone: in the lobby every player, not only the host, sees which roles are in the game', () => {
  const lobby = gameStates(8).filter((s) => s.pub.phase === 'lobby');
  const guest = lobby.find((s) => !s.me.vip);
  const host = lobby.find((s) => s.me.vip);
  sq.inject(guest);
  assert.match(textOf($('main')), /Roles this game · 3 Evil, 4 Good/);
  assert.match(textOf($('main')), /Merlin and Assassin/);
  assert.equal($('main').querySelectorAll('.toggle').length, 0, 'guests cannot change them');
  sq.inject(host);
  assert.doesNotMatch(textOf($('main')), /Roles this game/);
  // the host's summary names the roles too, instead of only counting them
  assert.match(textOf($('main')), /Roles · 3 Evil, 4 Good/);
  assert.match(textOf($('main')), /Merlin and Assassin/);
  // every warning is shown, not just the first
  const odd = clone(host);
  odd.pub.validation = { ok: true, errors: [], warnings: ['First warning.', 'Second warning.'] };
  sq.inject(odd);
  assert.match(textOf($('main')), /First warning\. Second warning\./);
});

test('phone: game over says why the game ended and lists only the quests that were played', () => {
  const end = gameStates(3, 6, { classic: true }).filter((s) => s.pub.phase === 'gameover').pop();
  const nm = (id) => end.pub.players.find((p) => p.id === id).name;
  const merlin = Object.keys(end.pub.reveal.roles).find((id) => end.pub.reveal.roles[id] === 'merlin');
  sq.inject(end);
  const text = textOf($('main'));
  const why = { quests: /Three quests (succeeded|failed)\./, rejects: /Five proposals in a row were rejected\./,
    'assassination-hit': new RegExp(`struck ${nm(merlin)}, who was Merlin\\.`), 'assassination-miss': new RegExp(`but Merlin was ${nm(merlin)}\\.`) }[end.pub.reveal.reason];
  assert.match(text, why);
  const played = end.pub.reveal.recap.length;
  assert.match(text, played === 1 ? /The quest/ : new RegExp(`The ${played} quests played`));
  assert.doesNotMatch(text, /The five quests/);
  // Classic: each quest's Fail count is in the recap
  assert.equal((text.match(/\d Fail cards?/g) || []).length >= played, true);
  // the awards the TV shows are on every phone too
  const lines = awards(end.pub, end.pub.reveal.recap);
  assert.ok(lines.length, 'this game has awards');
  for (const line of lines) assert.ok(text.includes(line.replace(/^★ /, '')), line);
  // an assassination miss names the real Merlin
  const miss = clone(end);
  const other = miss.pub.players.find((p) => p.id !== merlin).id;
  Object.assign(miss.pub.reveal, { winner: 'good', reason: 'assassination-miss', assassination: { assassin: other, target: other, hit: false } });
  sq.inject(miss);
  assert.match(textOf($('main')), new RegExp(`The Assassin struck ${nm(other)}, but Merlin was ${nm(merlin)}\\.`));
});

test('phone: the fifth rejected team says Evil wins, not that the crown passes on', () => {
  const rev = gameStates(5).find((s) => s.pub.phase === 'voteReveal' && !s.pub.game.approved);
  assert.ok(rev, 'a team was rejected');
  for (const [count, text] of [[4, /one more and Evil wins/], [5, /5 teams in a row were rejected\. Evil wins\./]]) {
    const s = clone(rev);
    s.pub.game.rejectCount = count;
    sq.inject(s);
    assert.match(textOf($('main')), text);
    if (count === 5) assert.doesNotMatch(textOf($('main')), /crown passes on/);
  }
});

test('phone: the vote reveal marks a vote that a stand-in cast for an absent player', () => {
  const rev = gameStates(5).find((s) => s.pub.phase === 'voteReveal');
  const last = rev.pub.game.history[rev.pub.game.history.length - 1];
  const s = clone(rev);
  const away = s.pub.players[1].id;
  s.pub.game.history[s.pub.game.history.length - 1] = { ...last, standIn: [away] };
  sq.inject(s);
  const rows = $('main').querySelectorAll('.vote');
  assert.equal(rows.length, s.pub.players.length);
  rows.forEach((row, i) => {
    const tag = row.querySelector('small');
    assert.equal(tag ? textOf(tag) : null, s.pub.players[i].id === away ? 'stand-in vote' : null);
  });
});

test('phone: the role is revealed by holding a finger, Space or Enter, and hides on release', async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const states = gameStates(8);
  const reveal = states.find((s) => s.pub.phase === 'roleReveal');
  const roleName = ROLE_INFO[reveal.me.role].name;
  sq.inject(reveal);
  const card = $('main').querySelector('.cardback');
  assert.equal(card.getAttribute('tabindex'), '0');
  const secret = $('secret');
  // a tap that is let go at once never flashes the role
  card.fire('keydown', { key: ' ' }); await wait(40); card.fire('keyup', { key: ' ' }); await wait(300);
  assert.equal(secret.hidden, true);
  // other keys do nothing
  assert.equal(card.fire('keydown', { key: 'a' }).defaultPrevented, false); await wait(300);
  assert.equal(secret.hidden, true);
  // hold Space: the card appears, a held key's repeats change nothing, letting go hides it
  assert.equal(card.fire('keydown', { key: ' ' }).defaultPrevented, true, 'Space does not scroll the page');
  await wait(300);
  assert.equal(secret.hidden, false);
  assert.match(textOf(secret), new RegExp(`Your role.*${roleName}`));
  card.fire('keydown', { key: ' ', repeat: true }); await wait(300);
  assert.equal(secret.hidden, false);
  card.fire('keyup', { key: ' ' });
  assert.equal(secret.hidden, true);
  assert.equal(textOf(secret), '', 'nothing secret stays in the page');
  // moving focus away hides it too
  card.fire('keydown', { key: 'Enter' }); await wait(300);
  assert.equal(secret.hidden, false);
  card.fire('blur');
  assert.equal(secret.hidden, true);

  // later in the game the name at the top does the same, by finger or by key
  sq.inject(states.find((s) => s.pub.phase === 'propose'));
  const peek = $('peek');
  assert.equal(peek.disabled, false);
  peek.fire('pointerdown', { pointerId: 1 }); await wait(300);
  assert.equal(secret.hidden, false);
  peek.fire('pointerup', { pointerId: 1 });
  assert.equal(secret.hidden, true);
  peek.fire('keydown', { key: 'Enter' }); await wait(300);
  assert.match(textOf(secret), new RegExp(roleName));
  peek.fire('keyup', { key: 'Enter' });
  assert.equal(secret.hidden, true);
});

test('phone: the colour picker names each colour and shows who wears it; a person\'s colour cannot be picked', () => {
  const lobby = clone(gameStates(8).find((s) => s.pub.phase === 'lobby'));
  const other = lobby.pub.players[1]; other.bot = false; // one more person at the table
  const bot = lobby.pub.players[2];
  sq.inject(lobby);
  $('main').querySelector('.lookme').click();
  const swatches = $('main').querySelectorAll('.swatch');
  assert.equal(swatches.length, 10);
  for (const sw of swatches) assert.doesNotMatch(sw.getAttribute('aria-label'), /#/, 'no hex codes read aloud');
  const mine = swatches.find((sw) => sw.getAttribute('aria-pressed') === 'true');
  assert.match(sw_label(mine), /^(Red|Blue|Green|Yellow|Purple|Orange|Teal|Pink|Lime|White)$/);
  const theirs = swatches.find((sw) => sw.style.cssText.includes(other.color));
  assert.equal(theirs.disabled, true);
  assert.ok(theirs.classList.contains('taken'));
  assert.match(sw_label(theirs), new RegExp(`, worn by ${other.name}$`));
  const bots = swatches.find((sw) => sw.style.cssText.includes(bot.color));
  assert.equal(bots.disabled, false);
  assert.ok(bots.classList.contains('bot'));
  assert.match(sw_label(bots), new RegExp(`worn by ${bot.name} \\(a bot, who will take yours\\)`));
  $('main').querySelector('.lookme').click(); // close the picker again
  function sw_label(el) { return el.getAttribute('aria-label'); }
});

test('phone: when the room vanishes (server restart) a seated phone keeps knocking until the TV reopens it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sock = WebSocket.all[WebSocket.all.length - 1];
  sock.readyState = 1;
  const lobby = clone(gameStates(8).find((s) => s.pub.phase === 'lobby'));
  const code = lobby.pub.room;
  const joins = () => sock.sent.filter((m) => m.t === 'join');
  const noRoom = { t: 'error', code: 'noRoom', msg: 'No such room. Check the code on the TV.' };
  sq.inject(lobby);
  localStorage.setItem(`sq.token.${code}`, 'old-token');
  localStorage.setItem('sq.name', 'Human1');
  sq.receive(noRoom);
  assert.equal($('main').dataset.screen, 'connecting');
  assert.match(textOf($('main')), new RegExp(`Room ${code} has closed. If the TV opens it again, you will rejoin by yourself.`));
  let n = joins().length;
  t.mock.timers.tick(2999);
  assert.equal(joins().length, n);
  t.mock.timers.tick(1);
  assert.deepEqual(joins().at(-1), { t: 'join', room: code, name: 'Human1' });
  // still gone: it tries again; back: it stops
  sq.receive(noRoom);
  t.mock.timers.tick(3000);
  assert.equal(joins().length, n + 2);
  sq.receive({ t: 'joined', id: 'p1', token: 'new-token', room: code, resumed: false, standIn: false });
  sq.inject(lobby);
  t.mock.timers.tick(9000);
  assert.equal(joins().length, n + 2);
  // a phone that was never seated there (a mistyped code) just shows the error
  localStorage.removeItem(`sq.token.${code}`);
  sq.receive(noRoom);
  assert.match(textOf($('main')), /No such room/);
  n = joins().length;
  t.mock.timers.tick(9000);
  assert.equal(joins().length, n);
  sock.readyState = 0;
});

test('phone: the leader sees, beside each name, the failed teams that player voted to send', () => {
  let found = null;
  for (let seed = 1; seed < 60 && !found; seed++) {
    found = gameStates(seed).find((s) => screenFor(s) === 'propose' && Object.keys(backedFailures(s.pub)).some((id) => id !== s.me.id));
  }
  assert.ok(found, 'a leader picking a team after a failed quest');
  sq.inject(found);
  const backed = backedFailures(found.pub);
  const chips = $('main').querySelector('.people').querySelectorAll('.person');
  for (const p of found.pub.players) {
    const chip = chips.find((c) => textOf(c.querySelector('.pname')).startsWith(p.name));
    const small = chip.querySelector('small');
    if (p.id === found.me.id) assert.equal(textOf(small), 'you');
    else if (backed[p.id]) assert.equal(textOf(small), `Voted to send ${backed[p.id]} failed team${backed[p.id] === 1 ? '' : 's'}`);
    else assert.equal(small, null);
  }
});

test('phone: the vote screen reads the record against the proposed team', () => {
  let found = null;
  for (let seed = 1; seed < 60 && !found; seed++) {
    found = gameStates(seed).find((s) => screenFor(s) === 'vote' && s.pub.game.results.some((r) => r.outcome === 'fail'));
  }
  assert.ok(found, 'a vote after a failed quest');
  sq.inject(found);
  const nm = (id) => (id === found.me.id ? 'You' : found.pub.players.find((p) => p.id === id).name);
  const line = $('main').querySelector('.teamcase');
  assert.ok(line, 'the case line is shown');
  assert.equal(textOf(line).trim(), teamCase(found.pub, found.pub.game.team, nm));
  const early = gameStates(1).find((s) => screenFor(s) === 'vote' && !s.pub.game.results.length);
  sq.inject(early);
  assert.equal($('main').querySelector('.teamcase'), null);
});

test('phone: in the full record every vote chip says whose vote it was and how they voted, stand-ins marked', () => {
  const late = gameStates(4).filter((s) => s.pub.phase === 'propose' && (s.pub.game.history || []).some((x) => x.standIn && x.standIn.length)).pop();
  assert.ok(late, 'a game where a stand-in voted for the away human');
  sq.inject(late);
  sq.openSheet('record');
  const props = $('sheet').querySelectorAll('.prop');
  assert.equal(props.length, late.pub.game.history.length);
  // the sheet lists the newest quest first, each quest's proposals in order
  const hist = late.pub.game.history;
  const shown = [...new Set(hist.map((x) => x.questIndex))].sort((a, b) => b - a).flatMap((q) => hist.filter((x) => x.questIndex === q));
  let autos = 0;
  props.forEach((prop, i) => {
    const x = shown[i];
    const chips = prop.querySelectorAll('.vt');
    assert.equal(chips.length, late.pub.players.length);
    chips.forEach((c, j) => {
      const pl = late.pub.players[j]; const auto = !!(x.standIn && x.standIn.includes(pl.id));
      assert.equal(c.getAttribute('aria-label'), `${pl.name}: ${x.votes[pl.id] ? 'approve' : 'reject'}${auto ? ' (stand-in vote)' : ''}`);
      assert.equal(c.classList.contains('auto'), auto);
      if (auto) autos++;
    });
  });
  assert.ok(autos > 0);
});
