// Phone controller. Plain DOM, no framework. All secrets come from the server's `me` block;
// the UI only ever shows another player's role at game over.
import { screenFor, toggleSelection, canConfirm, knownPlayers, leaderName, nameOf, lastResult, startHint } from './model.js';
import { ROLE_INFO, ROLE_TOGGLE_INFO, KNOW_LABELS } from '/shared/roles-info.js';
import { AVATAR_CLASSES, AVATAR_COLORS } from '/shared/avatars.js';
import { QUEST_COUNT, MIN_PLAYERS, MAX_REJECTS, evilCount, teamSize, failsRequired } from '/shared/avalon.js';
import { HOW_TO, GENERAL_TIPS, ROLE_TIPS, coachFor, counselFor, questStrip } from './guide.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const main = $('main');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** Tiny DOM builder. Strings become text nodes, so names can never inject markup. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

/** A player's token: their colour with their class glyph. Works for any {color, cls}. */
const avatar = (p, cls = '') => h('span', { class: `av ${cls}`, style: `--c:${(p && p.color) || '#888'}` }, icon((p && p.cls) || 'knight'));
const byId = (id) => state.pub.players.find((x) => x.id === id) || { id, name: '?', color: '#888', cls: 'knight' };

// ---------- connection ----------
const params = new URLSearchParams(location.search);
let roomCode = (params.get('room') || '').toUpperCase().slice(0, 4);
let name = store.get('sq.name') || '';
let ws = null;
let state = null;
let joined = false; // have we ever been seated this page-load?
let joinError = '';
let selected = []; // propose selection
let retry = 0;
let retryTimer = null;

function url() { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; }

function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function connect() {
  clearTimeout(retryTimer);
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  ws = new WebSocket(url());
  ws.onopen = () => {
    retry = 0; setOffline(false);
    const token = store.get(`sq.token.${roomCode}`);
    if (roomCode && name && (token || wantJoin)) send({ t: 'join', room: roomCode, name, token: token || undefined });
    else render();
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    onMessage(m);
  };
  ws.onclose = () => {
    if (joined) setOffline(true);
    retryTimer = setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
  };
  ws.onerror = () => {};
}
let wantJoin = false;

function onMessage(m) {
  switch (m.t) {
    case 'joined':
      joined = true; joinError = '';
      roomCode = m.room;
      store.set(`sq.token.${m.room}`, m.token);
      requestWakeLock();
      break;
    case 'state':
      state = m;
      if (state.pub.phase !== 'propose') selected = [];
      if (secretOpen()) showSecret();
      render();
      if (!sheet.hidden) drawSheet();
      break;
    case 'error':
      if (m.code === 'noRoom' || m.code === 'joinFailed') {
        joinError = m.msg; joined = false; wantJoin = false; state = null;
        store.del(`sq.token.${roomCode}`);
        render();
      } else toast(m.msg);
      break;
    case 'kicked':
      joined = false; state = null; store.del(`sq.token.${roomCode}`); joinError = 'You were removed from the room.'; render();
      break;
  }
}

// ---------- haptics ----------
const buzz = (pat) => { try { if (navigator.vibrate) navigator.vibrate(pat); } catch { /* unsupported */ } };
const HAPTIC = { tap: 12, confirm: [25, 40, 25], turn: [120, 60, 120], result: 200, bad: [60, 40, 60, 40, 160] };
// every button press gets a light tick; buttons can opt into a stronger pattern with data-buzz
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('button');
  if (b && !b.disabled && b.id !== 'peek') buzz(HAPTIC[b.dataset.buzz] || HAPTIC.tap);
}, true);

// ---------- connection banner ----------
function setOffline(off) {
  const b = $('offline'); if (b) b.hidden = !off;
  document.body.classList.toggle('offline', off);
}

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch { /* optional */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { hideSecret(); connect(); if (joined) requestWakeLock(); }
});

// ---------- hold-to-reveal: the only place secrets are ever drawn ----------
const peekBtn = $('peek');
const secret = $('secret');
const secretOpen = () => !secret.hidden;
const seenRole = () => !!(state && state.me && store.get(`sq.seen.${roomCode}`) === state.me.role);
function showSecret() {
  if (!state || !state.me || !state.me.role) return;
  const me = state.me; const info = ROLE_INFO[me.role];
  const known = knownPlayers(state);
  const counsel = counselFor(screenFor(state), state);
  secret.replaceChildren(h('div', { class: 'rolecard' },
    h('div', { class: 'rc-top' }, 'Your role'),
    h('div', { class: 'rc-sigil' }, icon(me.role)),
    h('div', { class: 'rc-name' }, info.name),
    h('div', { class: 'rc-team' }, info.team === 'good' ? 'Good · serves Arthur' : 'Evil · serves Mordred'),
    h('p', { class: 'rc-blurb' }, info.blurb),
    known.length ? h('div', { class: 'rc-known' },
      h('div', { class: 'label' }, KNOW_LABELS[me.knowKind] || 'You know'),
      h('div', { class: 'players' }, known.map((p) => h('span', { class: 'pill' }, avatar(byId(p.id), 'sm'), p.name)))) : (me.note ? h('p', { class: 'rc-note' }, me.note) : null),
    counsel ? h('div', { class: 'rc-counsel' }, h('div', { class: 'label' }, 'Counsel for this moment'), counsel) : null));
  if (!seenRole()) { store.set(`sq.seen.${roomCode}`, me.role); setTimeout(render, 0); }
  secret.hidden = false; peekBtn.classList.add('revealing'); document.body.classList.add('peeking');
  // never clip a secret: shrink the card to fit very small screens
  const card = secret.firstChild; const cs = getComputedStyle(secret);
  const room = secret.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  card.style.maxHeight = 'none'; card.style.transform = '';
  if (card.offsetHeight > room) { card.style.animation = 'none'; card.style.transform = `scale(${room / card.offsetHeight})`; }
}
function hideSecret() { secret.hidden = true; secret.replaceChildren(); peekBtn.classList.remove('revealing'); document.body.classList.remove('peeking'); }
/** Press-and-hold on `el` shows the role card; any release hides it. */
const HOLD_MS = 260; // long enough that a resting thumb or a stray tap never flashes the role
function bindHold(el) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; el.classList.remove('arming'); hideSecret(); };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add('arming');
    timer = setTimeout(() => { el.classList.remove('arming'); buzz(HAPTIC.tap); showSecret(); }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) el.addEventListener(ev, cancel);
  return el;
}
bindHold(peekBtn);
window.addEventListener('blur', hideSecret);
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- render ----------
let lastPhase = '';
let lastScreen = '';
let kickArmed = null; // lobby: a human's remove button was tapped once
let rolesOpen = false; // lobby: role toggles expanded
let lookOpen = false; // lobby: avatar picker expanded
let choice = null; // pending vote / card / pick / assassination target on the current screen

function render() {
  const screen = screenFor(state);
  if (screen !== lastScreen) choice = null;
  $('roomtag').replaceChildren(roomCode && state ? h('span', {}, 'Room ', h('b', {}, roomCode)) : '');
  const meP = state && state.me && state.pub.players.find((p) => p.id === state.me.id);
  const inGame = !!(state && state.pub.phase !== 'lobby' && state.me && state.me.role);
  const canPeek = inGame && state.pub.phase !== 'gameover';
  peekBtn.hidden = !meP; peekBtn.disabled = !canPeek; peekBtn.classList.toggle('live', canPeek);
  if (meP) peekBtn.replaceChildren(...[avatar(meP, 'sm'), h('span', { class: 'nm' }, meP.name), canPeek ? h('span', { class: 'holdtag' }, icon('eye'), 'Hold') : null].filter(Boolean));
  if (!inGame) hideSecret();
  const fn = screen === 'connecting' ? joinScreen : SCREENS[screen];
  const body = [].concat(fn ? fn() : [h('p', { class: 'muted center' }, 'One moment…')]).flat().filter(Boolean);
  const acts = body.filter((el) => el.classList && el.classList.contains('actions'));
  const keep = screen === lastScreen ? (main.querySelector('.scroll') || {}).scrollTop || 0 : 0;
  const scroll = h('div', { class: 'scroll' }, body.filter((el) => !acts.includes(el)));
  main.replaceChildren(scroll, ...acts);
  scroll.scrollTop = keep;
  main.dataset.screen = screen;
  const phase = state ? state.pub.phase : '';
  if (phase !== lastPhase) {
    if (phase === 'questResult') buzz(HAPTIC.result);
    else if (phase === 'roleReveal') buzz(HAPTIC.confirm);
    lastPhase = phase;
  }
  if (screen !== lastScreen) {
    if (['propose', 'vote', 'quest-card', 'quest-pick', 'assassinate'].includes(screen)) buzz(HAPTIC.turn);
    main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
    lastScreen = screen;
  }
}

// ---------- building blocks ----------
/** Standard screen: tracker, heading, table-safe hint, content, then actions pinned to the thumb zone. */
function page({ kicker, title, sub, body = [], actions = [], tracker = true, hint = true }) {
  const tip = hint && store.get('sq.coach') !== 'off' ? coachFor(screenFor(state), state) : null;
  return [
    tracker ? trackerBar() : null,
    h('div', { class: 'head' }, kicker ? h('div', { class: 'kicker' }, kicker) : null, h('h1', {}, title), sub ? h('p', { class: 'sub' }, sub) : null),
    tip ? h('p', { class: 'hint' }, tip) : null,
    ...[].concat(body),
    actions.length ? h('div', { class: 'actions' }, actions) : null,
  ];
}

function trackerBar() {
  const g = state.pub.game; if (!g) return null;
  const n = state.pub.players.length;
  return h('div', { class: 'tracker', role: 'group', 'aria-label': questStrip(state.pub) },
    h('div', { class: 'quests' }, Array.from({ length: QUEST_COUNT }, (_, i) => {
      const r = g.results[i];
      const cls = `${r ? (r.outcome === 'success' ? 's' : 'f') : ''} ${i === g.questIndex && !r ? 'cur' : ''}`;
      return h('div', { class: 'qcol' }, h('div', { class: `q ${cls}` },
        r ? icon(r.outcome === 'success' ? 'check' : 'cross') : h('b', {}, String(teamSize(n, i)))),
        h('small', {}, failsRequired(n, i) > 1 && !r ? 'needs 2' : ''));
    })),
    h('div', { class: 'rejects', 'aria-label': `${g.rejectCount} of ${MAX_REJECTS} teams rejected` },
      h('span', {}, `Rejected teams ${g.rejectCount}/${MAX_REJECTS}`), Array.from({ length: MAX_REJECTS }, (_, i) => h('i', { class: i < g.rejectCount ? 'on' : '' }))));
}

/** A row/tile for a player. `mark` is an optional trailing element. */
const personChip = (p, { sel = false, onclick, mark, tag } = {}) => h(onclick ? 'button' : 'div', { class: `person ${sel ? 'sel' : ''}`, onclick, 'aria-pressed': onclick ? String(sel) : null },
  avatar(p), h('span', { class: 'pname' }, p.name, tag ? h('small', {}, tag) : null), mark || null);

function teamRow(ids, label) {
  const g = state.pub.game;
  return h('div', { class: 'panel' },
    label ? h('div', { class: 'label' }, label) : null,
    h('div', { class: 'team' }, ids.map((id) => { const p = byId(id); return h('div', { class: 'member' }, avatar(p, 'lg'), h('span', {}, p.name), id === g.leader ? icon('leader', 'leadmark') : null); })));
}

const waiting = (ic, text) => h('div', { class: 'waiting' }, h('div', { class: 'pulse' }, icon(ic)), h('p', {}, text));
const youTag = (id) => (id === state.me.id ? 'you' : null);

function joinScreen() {
  if (joined) return [waiting('hourglass', 'Connecting…')];
  const codeIn = h('input', { type: 'text', class: 'code', maxlength: 4, placeholder: '____', value: roomCode, autocapitalize: 'characters', autocomplete: 'off', inputmode: 'text', 'aria-label': 'Room code' });
  const nameIn = h('input', { type: 'text', maxlength: 12, placeholder: 'Your name', value: name, autocomplete: 'nickname', 'aria-label': 'Your name' });
  const go = () => {
    roomCode = codeIn.value.trim().toUpperCase(); name = nameIn.value.trim();
    if (roomCode.length !== 4) return toast('Enter the 4-letter room code from the TV.');
    if (!name) return toast('Enter a name.');
    store.set('sq.name', name); wantJoin = true; joinError = '';
    if (ws && ws.readyState === 1) send({ t: 'join', room: roomCode, name, token: store.get(`sq.token.${roomCode}`) || undefined }); else connect();
  };
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const joinBtn = h('button', { class: 'primary big', onclick: go }, 'Join');
  const check = () => { joinBtn.disabled = codeIn.value.trim().length !== 4 || !nameIn.value.trim(); };
  codeIn.addEventListener('input', check); nameIn.addEventListener('input', check); check();
  return [
    h('div', { class: 'logo' }, h('div', { class: 'crest' }, icon('crown')), h('h1', {}, 'Avalon'), h('div', { class: 'tagline' }, 'The Lost Crown')),
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Room code on the TV'), codeIn),
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Your name'), nameIn),
    joinError ? h('p', { class: 'err' }, joinError) : null,
    joinBtn,
  ];
}

const SCREENS = {
  lobby() {
    const { pub, me } = state;
    const mine = pub.players.find((p) => p.id === me.id);
    const vip = me.vip; const cfg = pub.config.roles; const n = pub.players.length;
    const clsName = (AVATAR_CLASSES.find((c) => c.id === mine.cls) || {}).name || '';
    const look = h('div', { class: 'panel look' },
      h('button', { class: 'lookme', 'aria-expanded': String(lookOpen), onclick: () => { lookOpen = !lookOpen; render(); } }, avatar(mine, 'lg'), h('span', { class: 'grow' }, h('span', { class: 'label' }, 'Your look'), h('b', {}, clsName)), h('span', { class: 'chg' }, lookOpen ? 'Done' : 'Change')),
      lookOpen ? h('div', { class: 'classes' }, AVATAR_CLASSES.map((c) => h('button', { class: c.id === mine.cls ? 'sel' : '', 'aria-pressed': String(c.id === mine.cls), onclick: () => send({ t: 'setAvatar', cls: c.id }), 'aria-label': c.name }, icon(c.id), h('small', {}, c.name.split(' ')[0])))) : null,
      lookOpen ? h('div', { class: 'swatches' }, AVATAR_COLORS.map((c) => h('button', { class: `swatch ${c === mine.color ? 'sel' : ''}`, style: `--c:${c}`, 'aria-pressed': String(c === mine.color), onclick: () => send({ t: 'setAvatar', color: c }), 'aria-label': `Colour ${c}` }))) : null);
    const roster = h('div', { class: 'panel' },
      h('div', { class: 'row' }, h('div', { class: 'label grow' }, `${n} at the campfire${n < MIN_PLAYERS ? ` · need ${MIN_PLAYERS}` : ''}`),
        vip ? h('div', { class: 'stepper', role: 'group', 'aria-label': 'Bots' }, h('button', { onclick: () => send({ t: 'removeBot' }), disabled: !pub.players.some((p) => p.bot), 'aria-label': 'Remove a bot' }, '−'), h('span', {}, `${pub.players.filter((p) => p.bot).length} bots`), h('button', { onclick: () => send({ t: 'addBot' }), disabled: n >= 10, 'aria-label': 'Add a bot' }, '+')) : null),
      h('div', { class: 'roster' }, pub.players.map((p) => h('div', { class: `person ${p.connected ? '' : 'off'}` }, avatar(p), h('span', { class: 'pname' }, p.name, h('small', {}, [p.id === me.id ? 'you' : null, p.vip ? 'host' : null, p.bot ? 'bot' : null, p.connected ? null : 'away'].filter(Boolean).join(' · '))),
        !vip || p.id === me.id ? null : kickArmed === p.id ? h('button', { class: 'danger kickgo', onclick: () => { kickArmed = null; send({ t: 'kick', id: p.id }); } }, 'Remove?')
          : h('button', { class: 'ghost kick', onclick: () => { if (p.bot) send({ t: 'kick', id: p.id }); else { kickArmed = p.id; render(); setTimeout(() => { if (kickArmed === p.id) { kickArmed = null; render(); } }, 3000); } }, 'aria-label': `Remove ${p.name}` }, icon('cross'))))));
    const body = [look, roster];
    const actions = [];
    if (vip) {
      const v = pub.validation;
      const toggle = (key, label, locked) => h('button', { class: `toggle ${cfg[key] ? 'on' : ''}`, disabled: locked, role: 'switch', 'aria-checked': String(!!cfg[key]), onclick: () => send({ t: 'setRoles', roles: { [key]: !cfg[key] } }) },
        icon(key, `tg team-${ROLE_INFO[key].team}`), h('span', { class: 'grow' }, label, h('small', {}, ROLE_TOGGLE_INFO[key])), h('span', { class: 'sw' }));
      body.splice(1, 0,
        h('div', { class: 'panel roles' },
          h('button', { class: 'lookme', 'aria-expanded': String(rolesOpen), onclick: () => { rolesOpen = !rolesOpen; render(); } },
            h('span', { class: 'rolesum' }, ['merlin', 'assassin', 'percival', 'morgana', 'mordred', 'oberon'].filter((k) => cfg[k]).map((k) => icon(k, `team-${ROLE_INFO[k].team}`))),
            h('span', { class: 'grow' }, h('span', { class: 'label' }, n >= MIN_PLAYERS ? `${evilCount(n)} Evil, ${n - evilCount(n)} Good` : 'Special roles'), h('b', {}, ['merlin', 'assassin', 'percival', 'morgana', 'mordred', 'oberon'].filter((k) => cfg[k]).map((k) => ROLE_INFO[k].name).join(', ') || 'No special roles')),
            h('span', { class: 'chg' }, rolesOpen ? 'Done' : 'Change')),
          ...(rolesOpen ? [toggle('merlin', 'Merlin'), toggle('assassin', 'Assassin', cfg.merlin), toggle('percival', 'Percival'), toggle('morgana', 'Morgana'), toggle('mordred', 'Mordred'), toggle('oberon', 'Oberon'),
            h('button', { class: `toggle ${pub.config.classic ? 'on' : ''}`, role: 'switch', 'aria-checked': String(!!pub.config.classic), onclick: () => send({ t: 'setClassic', on: !pub.config.classic }) },
              icon('scroll', 'tg'), h('span', { class: 'grow' }, 'Classic: show fail count', h('small', {}, 'Off by default so Evil teams stay hidden.')), h('span', { class: 'sw' }))] : [])));
      if (v.errors.length || v.warnings.length) actions.push(h('p', { class: v.errors.length ? 'err' : 'warn' }, startHint(pub)));
      actions.push(h('button', { class: 'primary big', disabled: !v.ok, onclick: () => send({ t: 'start' }) }, n < MIN_PLAYERS ? `Need ${MIN_PLAYERS - n} more (add bots)` : 'Start game'));
    } else actions.push(h('p', { class: 'waitline' }, icon('fire'), 'Waiting for the host to start…'));
    return page({ tracker: false, kicker: vip ? 'You are the host' : 'You are in', title: 'Gather round', body, actions });
  },

  roleReveal() {
    const { me, pub } = state;
    const ready = pub.players.filter((p) => p.ready).length;
    const card = bindHold(h('div', { class: 'cardback', role: 'button', tabindex: '0', 'aria-label': 'Hold to reveal your role' }, h('div', { class: 'cb-in' }, icon('crown'), h('span', {}, 'Hold to reveal'))));
    return page({ tracker: false, kicker: 'For your eyes only', title: 'Your role', body: [card],
      actions: [h('p', { class: 'muted center small' }, `${ready} of ${pub.players.length} ready`),
        !seenRole() && !me.legal.done ? h('p', { class: 'armhint' }, 'Look at your card first') : h('button', { class: 'primary big', disabled: me.legal.done, onclick: () => send({ t: 'ready' }) }, me.legal.done ? 'Waiting for the others…' : "I'm ready")] });
  },

  waitLeader() {
    const { pub } = state; const L = byId(pub.game.leader);
    return page({ kicker: `Quest ${pub.game.questIndex + 1}`, title: `${L.name} is choosing`, sub: `A team of ${pub.game.teamSize} will go.`,
      body: [h('div', { class: 'spot' }, avatar(L, 'xxl'), icon('leader', 'spotcrown'), h('b', {}, L.name))] });
  },

  propose() {
    const { pub, me } = state; const size = me.legal.size;
    return page({ kicker: 'You wear the crown', title: `Pick ${size} for the quest`,
      body: [h('div', { class: 'people' }, pub.players.map((p) => personChip(p, { sel: selected.includes(p.id), tag: youTag(p.id), mark: icon('check', 'selmark'), onclick: () => { selected = toggleSelection(selected, p.id, size); render(); } })))],
      actions: [h('div', { class: 'slots', 'aria-hidden': 'true' }, Array.from({ length: size }, (_, i) => (selected[i] ? avatar(byId(selected[i])) : h('span', { class: 'av empty' })))),
        canConfirm(selected, size) ? h('button', { class: 'primary big', onclick: () => send({ t: 'propose', team: selected }) }, 'Send this team') : h('p', { class: 'armhint' }, `Choose ${size - selected.length} more`)] });
  },

  vote() {
    const { pub } = state; const g = pub.game;
    const tok = (val, label, ic) => h('button', { class: `token ${val ? 'yes' : 'no'}`, onclick: () => { choice = val; render(); } }, h('span', { class: 'disc' }, icon(ic)), h('b', {}, label));
    const kicker = `${byId(g.leader).name} proposes`;
    // once chosen the token turns face-down, so nobody can read the vote off the screen before the table reveal
    if (choice != null) return page({ kicker, title: 'Vote chosen', hint: false,
      body: [teamRow(g.team), h('div', { class: 'tokens one' }, h('div', { class: 'token down' }, h('span', { class: 'disc' }, icon('crown')), h('b', {}, 'Face-down')))],
      actions: [h('button', { class: 'primary big', 'data-buzz': 'confirm', onclick: () => send({ t: 'vote', approve: choice }) }, 'Lock in my vote'), h('button', { class: 'linkbtn', onclick: () => { choice = null; render(); } }, 'Change my vote')] });
    return page({ kicker, title: 'Send this team?',
      body: [teamRow(g.team), h('div', { class: 'tokens' }, tok(true, 'Approve', 'check'), tok(false, 'Reject', 'cross'))],
      actions: [h('p', { class: 'armhint' }, 'Tap a token to choose')] });
  },
  voted() {
    const { pub } = state; const g = pub.game; const voted = new Set(g.voted || []);
    return page({ kicker: 'Vote locked', title: 'Waiting for the table',
      body: [teamRow(g.team, 'Proposed team'),
        h('div', { class: 'panel' }, h('div', { class: 'label' }, `${voted.size} of ${pub.players.length} have voted`),
          h('div', { class: 'dots' }, pub.players.map((p) => h('span', { class: `vdot ${voted.has(p.id) ? 'in' : ''}`, title: p.name }, avatar(p, 'sm')))))] });
  },

  voteReveal() {
    const { pub } = state; const g = pub.game;
    const yes = pub.players.filter((p) => g.votes[p.id]).length;
    return page({ hint: false, kicker: `${yes} approve · ${pub.players.length - yes} reject`, title: g.approved ? 'Team approved' : 'Team rejected',
      sub: g.approved ? 'The quest begins.' : `The crown passes on. ${g.rejectCount} of ${MAX_REJECTS} teams rejected.`,
      body: [
        h('div', { class: 'votes' }, pub.players.map((p) => h('div', { class: `vote ${g.votes[p.id] ? 'yes' : 'no'}` }, avatar(p), h('span', { class: 'pname' }, p.name), h('span', { class: 'minitoken' }, icon(g.votes[p.id] ? 'check' : 'cross'), g.votes[p.id] ? 'Approve' : 'Reject'))))] });
  },

  'quest-card'() {
    const { me, pub } = state;
    // Nothing here differs between Good and Evil, so a glance at a neighbour's phone says nothing: both cards can be
    // tapped, the order is shuffled per player and quest (thumb position gives nothing away), and a Good player's card
    // is always played as Success whichever one they tap (their secret counsel tells them so).
    const card = (val, label, ic) => h('button', { class: `qcard ${val}`, onclick: () => { choice = val; render(); } }, h('span', { class: 'qc-art' }, icon(ic)), h('b', {}, label));
    const pair = [card('success', 'Success', 'chalice'), card('fail', 'Fail', 'skull')];
    let hsh = pub.game.questIndex * 7 + pub.game.rejectCount; for (const ch of String(me.id)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    if (hsh % 2) pair.reverse();
    const kicker = `Quest ${pub.game.questIndex + 1} · you are on the team`;
    if (choice) return page({ kicker, title: 'Card chosen', hint: false,
      body: [h('div', { class: 'qcards one' }, h('div', { class: 'qcard down' }, h('span', { class: 'qc-art' }, icon('crown')), h('b', {}, 'Face-down'))), h('p', { class: 'muted center small' }, 'Nobody can see which card this is.')],
      actions: [h('button', { class: 'primary big', 'data-buzz': 'confirm', onclick: () => send({ t: 'play', card: me.quest.canFail ? choice : 'success' }) }, 'Play this card'), h('button', { class: 'linkbtn', onclick: () => { choice = null; render(); } }, 'Change my card')] });
    return page({ kicker, title: 'Play your card',
      body: [h('div', { class: 'qcards' }, pair)],
      actions: [h('p', { class: 'armhint' }, 'Tap a card to choose')] });
  },
  'quest-pick'() {
    const { me } = state;
    return page({ kicker: 'Before the quest resolves', title: 'Who stood out?',
      body: [h('div', { class: 'people' }, me.quest.options.map((id) => personChip(byId(id), { sel: choice === id, tag: youTag(id), mark: icon('check', 'selmark'), onclick: () => { choice = id; render(); } })))],
      actions: [choice ? h('button', { class: 'primary big', onclick: () => send({ t: 'pick', id: choice }) }, `Pick ${byId(choice).name}`) : h('p', { class: 'armhint' }, 'Tap a name to choose')] });
  },
  'quest-done'() {
    const g = state.pub.game;
    return page({ kicker: 'Card played', title: 'Waiting for the team', body: [teamRow(g.team), waiting('hourglass', g.waitingOn ? `${g.waitingOn} still deciding…` : 'Almost there…')] });
  },
  watchQuest() {
    const g = state.pub.game;
    return page({ kicker: `Quest ${g.questIndex + 1}`, title: 'The team has set out', body: [teamRow(g.team, 'On the quest'), waiting('hourglass', g.waitingOn ? `${g.waitingOn} still choosing a card…` : 'Almost there…')] });
  },
  cutscene() { return page({ hint: false, kicker: 'Quest underway', title: 'Eyes on the TV', body: [waiting('tv', 'The story is playing out on the big screen.')] }); },

  questResult() {
    const { pub } = state; const r = lastResult(pub);
    if (!r) return page({ hint: false, title: 'Eyes on the TV', body: [waiting('tv', '')] });
    const ok = r.outcome === 'success'; const who = byId(ok ? r.hero : r.culprit);
    return page({ hint: false, kicker: `Quest ${r.questIndex + 1}`, title: ok ? 'Quest succeeded' : 'Quest failed',
      body: [h('div', { class: `result ${ok ? 'good' : 'bad'}` }, avatar(who, 'xxl'), h('div', { class: 'label' }, ok ? 'Hero of the quest' : 'Suspicion falls on'), h('b', {}, who.name),
        r.failCount != null ? h('small', {}, `${r.failCount} Fail card${r.failCount === 1 ? '' : 's'} played`) : null),
        ok ? null : h('p', { class: 'muted center small' }, 'That is who the story on the TV blamed. They may have been framed.')] });
  },

  assassinate() {
    const { me } = state;
    return page({ tracker: false, kicker: 'Good won three quests', title: 'Find Merlin',
      body: [h('div', { class: 'people' }, me.legal.options.map((id) => personChip(byId(id), { sel: choice === id, mark: icon('check', 'selmark'), onclick: () => { choice = id; render(); } })))],
      actions: [choice ? h('button', { class: 'danger big', 'data-buzz': 'bad', onclick: () => send({ t: 'assassinate', id: choice }) }, `Strike ${byId(choice).name}`) : h('p', { class: 'armhint' }, 'Tap a name to choose your target')] });
  },
  waitAssassin() { return page({ tracker: false, kicker: 'The last gamble', title: 'The Assassin strikes', body: [waiting('assassin', 'Someone steps from the shadows… watch the TV.')] }); },

  gameover() {
    const { pub, me } = state; const rv = pub.reveal;
    const mine = ROLE_INFO[rv.roles[me.id]]; const goodWon = rv.winner === 'good';
    const won = goodWon === (mine.team === 'good');
    return page({ tracker: false, hint: false, kicker: won ? 'Victory' : 'Defeat', title: goodWon ? 'Good wins' : 'Evil wins',
      body: [
        h('div', { class: `result ${goodWon ? 'good' : 'bad'}` }, h('span', { class: `sigil team-${mine.team}` }, icon(rv.roles[me.id])), h('div', { class: 'label' }, 'You were'), h('b', {}, mine.name), h('small', {}, won ? 'Your side took the realm.' : 'Better luck next time.')),
        rv.assassination && rv.assassination.target ? h('p', { class: 'center' }, `The Assassin struck ${nameOf(pub, rv.assassination.target)}. ${rv.winner === 'evil' ? 'It was Merlin.' : 'Merlin survives.'}`) : null,
        h('div', { class: 'panel' }, h('div', { class: 'label' }, 'Everyone revealed'),
          h('div', { class: 'reveal' }, pub.players.map((p) => { const r = ROLE_INFO[rv.roles[p.id]]; return h('div', { class: `person team-${r.team}` }, avatar(p), h('span', { class: 'pname' }, p.name, youTag(p.id) ? h('small', {}, 'you') : null), h('span', { class: 'rtag' }, icon(rv.roles[p.id]), r.name)); }))),
        h('div', { class: 'panel' }, h('div', { class: 'label' }, 'The five quests'),
          h('div', { class: 'recap' }, rv.recap.map((q) => { const ok = q.outcome === 'success'; return h('div', { class: ok ? 'good' : 'bad' }, h('span', { class: 'qn' }, icon(ok ? 'check' : 'cross'), `Quest ${q.questIndex + 1}`), h('span', {}, ok ? `Hero: ${nameOf(pub, q.hero)}` : `Suspected: ${nameOf(pub, q.culprit)}${q.framed ? ' (framed!)' : ''}`)); }))),
      ],
      actions: [me.vip ? h('button', { class: 'primary big', onclick: () => send({ t: 'again' }) }, 'Play again') : h('p', { class: 'muted center' }, 'Waiting for the host…')] });
  },
};

// ---------- help sheet (table-safe: never shows your role) ----------
const sheet = $('sheet'); const sheetBody = $('sheetbody');
let sheetTab = 'now';
function openSheet(tab) { sheetTab = tab || sheetTab; drawSheet(); sheet.hidden = false; hideSecret(); }
function closeSheet() { sheet.hidden = true; sheetBody.replaceChildren(); }
function drawSheet() {
  const pub = state && state.pub;
  const inGame = !!(state && state.me && state.me.role && pub.phase !== 'lobby');
  const tabs = [['now', 'Now'], ...(inGame ? [['log', 'Record']] : []), ['how', 'How to play'], ['roles', 'Roles']];
  if (!tabs.some(([k]) => k === sheetTab)) sheetTab = 'now';
  const content = [];
  if (sheetTab === 'now') {
    const tip = coachFor(screenFor(state), state);
    content.push(h('h2', {}, 'What do I do now?'), h('p', { class: 'hint big' }, tip || 'Nothing right now. Watch the TV.'));
    if (inGame) content.push(h('div', { class: 'panel secretnote' }, icon('eye'), h('div', {}, h('b', {}, 'Forgot who you are?'), h('p', { class: 'muted small' }, 'Press and hold your name at the top of the screen. Your role, who you know, and private advice for this moment appear only while you hold.'))),
      h('div', { class: 'panel' }, h('h3', {}, 'If you are Good'), h('ul', {}, GENERAL_TIPS.good.map((t) => h('li', {}, t)))),
      h('div', { class: 'panel' }, h('h3', {}, 'If you are Evil'), h('ul', {}, GENERAL_TIPS.evil.map((t) => h('li', {}, t)))));
    if (inGame) content.push(h('div', { class: 'panel' }, h('h3', {}, 'Reading the quest shields'), h('p', { class: 'small' }, 'Each shield is a quest; the number is how many go. Two red dots mean that quest needs two Fails to sink. The five pips count rejected teams: five in a row and Evil wins.')));
    const off = store.get('sq.coach') === 'off';
    content.push(h('button', { class: `toggle${off ? '' : ' on'}`, role: 'switch', 'aria-checked': String(!off), onclick: () => { store.set('sq.coach', off ? 'on' : 'off'); render(); drawSheet(); } }, h('span', { class: 'grow' }, 'Show hints on screen', h('small', {}, 'Turn off once you know the game.')), h('span', { class: 'sw' })));
  } else if (sheetTab === 'log') {
    // public table knowledge only: who proposed whom, how everyone voted, how each quest ended
    const g = pub.game; const hist = g.history || [];
    content.push(h('h2', {}, 'The record so far'));
    if (!hist.length) content.push(h('p', { class: 'muted' }, 'Nothing yet. Every proposal, vote and quest result will be kept here so you can check who backed whom.'));
    for (let qi = 0; qi <= Math.min(g.questIndex, QUEST_COUNT - 1); qi++) {
      const rows = hist.filter((x) => x.questIndex === qi); const r = g.results[qi];
      if (!rows.length && !r) continue;
      content.push(h('div', { class: 'panel logq' },
        h('div', { class: 'row' }, h('h3', { class: 'grow' }, `Quest ${qi + 1}`), r ? h('span', { class: `minitoken ${r.outcome === 'success' ? 'ok' : 'ko'}` }, icon(r.outcome === 'success' ? 'check' : 'cross'), r.outcome === 'success' ? 'Succeeded' : 'Failed') : h('span', { class: 'muted small' }, 'in progress')),
        ...rows.map((x) => h('div', { class: `prop ${x.approved ? 'yes' : 'no'}` },
          h('div', { class: 'row' }, avatar(byId(x.leader), 'sm'), h('span', { class: 'grow' }, h('b', {}, byId(x.leader).name), ' proposed'), h('span', { class: 'small' }, x.approved ? 'Approved' : 'Rejected')),
          h('div', { class: 'row wrapr' }, h('span', { class: 'label' }, 'Team'), x.team.map((id) => h('span', { class: 'pill' }, avatar(byId(id), 'sm'), byId(id).name))),
          h('div', { class: 'row wrapr' }, h('span', { class: 'label' }, 'Votes'), pub.players.map((pl) => h('span', { class: `vt ${x.votes[pl.id] ? 'y' : 'n'}`, title: `${pl.name}: ${x.votes[pl.id] ? 'approve' : 'reject'}` }, avatar(pl, 'sm'), icon(x.votes[pl.id] ? 'check' : 'cross')))))),
        r ? h('p', { class: 'small muted' }, r.outcome === 'success' ? `Hero: ${nameOf(pub, r.hero)}` : `Suspicion fell on ${nameOf(pub, r.culprit)}`) : null));
    }
  } else if (sheetTab === 'how') {
    content.push(h('h2', {}, 'How to play'), ...HOW_TO.map((x, i) => h('div', { class: 'panel step' }, h('span', { class: 'num' }, String(i + 1)), h('div', {}, h('h3', {}, x.h), h('p', {}, x.p)))));
  } else {
    const cfg = pub && pub.config ? pub.config.roles : null;
    const row = ([id, info]) => { const on = id === 'loyal' || id === 'minion' || (cfg && cfg[id]); return h('div', { class: `panel rolerow team-${info.team} ${cfg && !on ? 'out' : ''}` }, h('span', { class: 'sigil' }, icon(id)), h('div', {}, h('b', {}, info.name), cfg && !on ? h('small', { class: 'outtag' }, 'not in this game') : null, h('p', { class: 'muted small' }, info.blurb), h('ul', { class: 'small' }, ROLE_TIPS[id].map((t) => h('li', {}, t))))); };
    const all = Object.entries(ROLE_INFO);
    content.push(h('h2', {}, 'Roles'), h('h3', { class: 'team-good' }, 'Loyal Servants of Arthur (Good)'), ...all.filter(([, r]) => r.team === 'good').map(row), h('h3', { class: 'team-evil' }, 'Minions of Mordred (Evil)'), ...all.filter(([, r]) => r.team === 'evil').map(row));
  }
  sheetBody.replaceChildren(
    h('div', { class: 'sheethead' }, h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(k === sheetTab), class: k === sheetTab ? 'on' : '', onclick: () => { sheetTab = k; drawSheet(); } }, l))),
      h('button', { class: 'close', 'aria-label': 'Close help', onclick: closeSheet }, icon('cross'))),
    h('div', { class: 'sheetscroll' }, content));
}
$('helpbtn').replaceChildren(icon('help'));
$('helpbtn').addEventListener('click', () => openSheet('now'));
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// debug handle for browser tests and the screenshot harness (inject() draws a state without a server)
window.__sq = { get state() { return state; }, inject(s) { state = s; joined = true; roomCode = s.pub.room || roomCode; render(); if (!sheet.hidden) drawSheet(); }, openSheet, showSecret, hideSecret };
render();
connect();
