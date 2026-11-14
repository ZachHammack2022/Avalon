// Phone controller. Plain DOM, no framework. All secrets come from the server's `me` block;
// the UI only ever shows another player's role at game over.
import { screenFor, toggleSelection, canConfirm, knownPlayers, leaderName, nameOf, lastResult, startHint } from './model.js';
import { ROLE_INFO, ROLE_TOGGLE_INFO, KNOW_LABELS } from '/shared/roles-info.js';
import { AVATAR_CLASSES, AVATAR_COLORS } from '/shared/avatars.js';
import { QUEST_COUNT, MIN_PLAYERS } from '/shared/avalon.js';

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

const dot = (color) => h('span', { class: 'dot', style: `background:${color}` });

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
      render();
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

// ---------- hold-to-reveal ----------
const peekBtn = $('peek');
const secret = $('secret');
function showSecret() {
  if (!state || !state.me || !state.me.role) return;
  const me = state.me; const info = ROLE_INFO[me.role];
  const known = knownPlayers(state);
  secret.replaceChildren(
    h('div', { class: 'icon' }, info.icon),
    h('div', { class: `rolecard team-${info.team}` }, info.name),
    h('div', { class: `team-${info.team}`, style: 'font-weight:700' }, info.team === 'good' ? 'You are on the side of GOOD' : 'You are a SABOTEUR'),
    h('div', { class: 'muted' }, info.blurb),
    me.note ? h('div', {}, me.note) : null,
    known.length ? h('div', { class: 'card', style: 'width:100%' },
      h('div', { class: 'muted small' }, KNOW_LABELS[me.knowKind] || 'You know'),
      h('div', { class: 'players', style: 'margin-top:8px;justify-content:center' }, known.map((p) => h('span', { class: 'pill' }, dot(p.color), p.name)))) : null,
  );
  secret.hidden = false; peekBtn.classList.add('revealing');
}
function hideSecret() { secret.hidden = true; secret.replaceChildren(); peekBtn.classList.remove('revealing'); }
peekBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { peekBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ } showSecret(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) peekBtn.addEventListener(ev, hideSecret);
window.addEventListener('blur', hideSecret);
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- screens ----------
function render() {
  const screen = screenFor(state);
  $('roomtag').textContent = roomCode ? `Room ${roomCode}` : '';
  $('nametag').textContent = (state && state.me && state.me.name) || name || '';
  const inGame = state && state.pub.phase !== 'lobby' && state.me && state.me.role;
  $('peekbar').hidden = !inGame;
  peekBtn.textContent = screen === 'roleReveal' ? 'Hold to reveal your role' : 'Hold to peek at your role';
  if (!inGame) hideSecret();
  const fn = screen === 'connecting' ? joinScreen : SCREENS[screen];
  main.replaceChildren(...[].concat(fn ? fn() : [h('p', { class: 'muted center' }, 'One moment…')]));
  const phase = state ? state.pub.phase : '';
  if (phase !== lastPhase) {
    if (phase === 'questResult') buzz(HAPTIC.result);
    else if (phase === 'roleReveal') buzz(HAPTIC.confirm);
    lastPhase = phase;
  }
  // a nudge when it becomes *your* turn to act
  if (screen !== lastScreen) {
    if (['propose', 'vote', 'quest-card', 'quest-pick', 'assassinate'].includes(screen)) buzz(HAPTIC.turn);
    main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
    lastScreen = screen;
  }
}
let lastPhase = '';
let lastScreen = '';

function joinScreen() {
  if (joined) return [h('p', { class: 'muted center' }, 'Connecting…')];
  const codeIn = h('input', { type: 'text', class: 'code', maxlength: 4, placeholder: 'ABCD', value: roomCode, autocapitalize: 'characters', autocomplete: 'off', inputmode: 'text', 'aria-label': 'Room code' });
  const nameIn = h('input', { type: 'text', maxlength: 12, placeholder: 'Your name', value: name, autocomplete: 'nickname', 'aria-label': 'Your name' });
  const go = () => {
    roomCode = codeIn.value.trim().toUpperCase(); name = nameIn.value.trim();
    if (roomCode.length !== 4) return toast('Enter the 4-letter room code from the TV.');
    if (!name) return toast('Enter a name.');
    store.set('sq.name', name); wantJoin = true; joinError = '';
    if (ws && ws.readyState === 1) send({ t: 'join', room: roomCode, name, token: store.get(`sq.token.${roomCode}`) || undefined }); else connect();
  };
  return [
    h('h1', {}, 'Saboteur Quests'),
    h('p', { class: 'muted' }, 'Join the game on the TV.'),
    codeIn, nameIn,
    joinError ? h('p', { class: 'err' }, joinError) : null,
    h('button', { class: 'primary big', onclick: go }, 'Join'),
  ];
}

const SCREENS = {
  lobby() {
    const { pub, me } = state;
    const mine = pub.players.find((p) => p.id === me.id);
    const vip = me.vip;
    const cfg = pub.config.roles;
    const out = [
      h('h2', {}, vip ? "You're the VIP" : 'You are in!'),
      h('div', { class: 'card' },
        h('div', { class: 'muted small' }, 'Pick your hero'),
        h('div', { class: 'classes', style: 'margin:8px 0 12px' }, AVATAR_CLASSES.map((c) => h('button', { class: c.id === mine.cls ? 'sel' : '', onclick: () => send({ t: 'setAvatar', cls: c.id }), 'aria-label': c.name }, c.icon, h('small', {}, c.name.split(' ')[0])))),
        h('div', { class: 'swatches' }, AVATAR_COLORS.map((c) => h('button', { class: `swatch ${c === mine.color ? 'sel' : ''}`, style: `background:${c}`, onclick: () => send({ t: 'setAvatar', color: c }), 'aria-label': `Color ${c}` })))),
      h('div', { class: 'card' },
        h('div', { class: 'muted small' }, `${pub.players.length} at the campfire`),
        h('div', { class: 'players', style: 'margin-top:8px' }, pub.players.map((p) => h('span', { class: `pill ${p.connected ? '' : 'off'}` }, dot(p.color), p.name + (p.vip ? ' ★' : '') + (p.bot ? ' (bot)' : ''),
          vip && p.id !== me.id ? h('button', { class: 'ghost', style: 'min-height:44px;min-width:44px;padding:0 8px;border-radius:14px', onclick: () => send({ t: 'kick', id: p.id }), 'aria-label': `Remove ${p.name}` }, '✕') : null)))),
    ];
    if (vip) {
      const v = pub.validation;
      const toggle = (key, label, locked) => h('button', { class: `toggle ${cfg[key] ? 'on' : ''}`, disabled: locked, onclick: () => send({ t: 'setRoles', roles: { [key]: !cfg[key] } }) },
        h('span', {}, label, h('small', {}, ROLE_TOGGLE_INFO[key])), h('span', { class: 'sw' }));
      out.push(
        h('div', { class: 'row' },
          h('button', { class: 'grow', onclick: () => send({ t: 'addBot' }), disabled: pub.players.length >= 10 }, '+ Bot'),
          h('button', { class: 'grow', onclick: () => send({ t: 'removeBot' }), disabled: !pub.players.some((p) => p.bot) }, '− Bot')),
        h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:8px' },
          h('div', { class: 'muted small' }, 'Roles'),
          toggle('merlin', 'Merlin'), toggle('assassin', 'Assassin', cfg.merlin), toggle('percival', 'Percival'), toggle('morgana', 'Morgana'), toggle('mordred', 'Mordred'), toggle('oberon', 'Oberon'),
          h('button', { class: `toggle ${pub.config.classic ? 'on' : ''}`, onclick: () => send({ t: 'setClassic', on: !pub.config.classic }) },
            h('span', {}, 'Classic: show fail count', h('small', {}, 'Off by default so evil teams stay hidden.')), h('span', { class: 'sw' }))),
        v.errors.length || v.warnings.length ? h('p', { class: v.errors.length ? 'err' : 'warn' }, startHint(pub)) : null,
        h('button', { class: 'primary big', disabled: !v.ok, onclick: () => send({ t: 'start' }) },
          pub.players.length < MIN_PLAYERS ? `Need ${MIN_PLAYERS - pub.players.length} more (add bots)` : 'Start game'));
    } else {
      out.push(h('p', { class: 'muted center' }, 'Waiting for the VIP to start the game…'));
    }
    return out;
  },

  roleReveal() {
    const { me } = state;
    return [
      h('h1', {}, 'Your role'),
      h('p', { class: 'muted' }, 'Keep it secret! Press and hold the button at the bottom to see your role. Let go to hide it.'),
      h('button', { class: 'primary big', disabled: me.legal.done, onclick: () => send({ t: 'ready' }) }, me.legal.done ? 'Waiting for the others…' : "I'm ready"),
    ];
  },

  waitLeader() { return [header(), h('div', { class: 'bigtext' }, `${leaderName(state.pub)} is choosing a team…`)]; },

  propose() {
    const { pub, me } = state;
    const size = me.legal.size;
    return [
      header(),
      h('h2', {}, `You are the leader. Pick ${size} players.`),
      h('div', { class: 'chips' }, pub.players.map((p) => h('button', { class: `chip ${selected.includes(p.id) ? 'sel' : ''}`, onclick: () => { selected = toggleSelection(selected, p.id, size); render(); } }, dot(p.color), p.name + (p.id === me.id ? ' (you)' : '')))),
      h('button', { class: 'primary big', disabled: !canConfirm(selected, size), onclick: () => send({ t: 'propose', team: selected }) }, `Send ${selected.length}/${size}`),
    ];
  },

  vote() {
    const { pub } = state;
    return [
      header(),
      h('h2', {}, 'Approve this team?'),
      teamCard(pub),
      h('div', { class: 'row' },
        h('button', { class: 'ok big grow', 'data-buzz': 'confirm', onclick: () => send({ t: 'vote', approve: true }) }, '✔ Approve'),
        h('button', { class: 'no big grow', 'data-buzz': 'confirm', onclick: () => send({ t: 'vote', approve: false }) }, '✖ Reject')),
    ];
  },
  voted() { return [header(), teamCard(state.pub), h('div', { class: 'bigtext' }, 'Vote locked in. Waiting for the others…')]; },

  voteReveal() {
    const { pub } = state; const g = pub.game;
    return [
      header(),
      h('div', { class: `banner ${g.approved ? 'good' : 'bad'}` }, g.approved ? '✔ Team approved' : '✖ Team rejected'),
      h('div', { class: 'card recap' }, pub.players.map((p) => h('div', {}, h('span', {}, dot(p.color), ' ', p.name), h('span', { class: g.votes[p.id] ? 'tag-good' : 'tag-evil' }, g.votes[p.id] ? '✔ Approve' : '✖ Reject')))),
      !g.approved ? h('p', { class: 'muted center' }, `${g.rejectCount} of 5 rejections`) : null,
    ];
  },

  'quest-card'() {
    const { me } = state;
    return [
      header(),
      h('h2', {}, 'Play your card'),
      h('p', { class: 'muted' }, 'Secretly choose how you help this quest.'),
      h('button', { class: 'ok big', 'data-buzz': 'confirm', onclick: () => send({ t: 'play', card: 'success' }) }, '✔ Success'),
      h('button', { class: 'no big', 'data-buzz': 'bad', disabled: !me.quest.canFail, onclick: () => send({ t: 'play', card: 'fail' }) }, '✖ Fail'),
    ];
  },
  'quest-pick'() {
    const { pub, me } = state;
    return [
      header(),
      h('h2', {}, 'Who stood out on this quest?'),
      h('div', { class: 'chips' }, me.quest.options.map((id) => {
        const p = pub.players.find((x) => x.id === id);
        return h('button', { class: 'chip', onclick: () => send({ t: 'pick', id }) }, dot(p.color), p.name + (id === me.id ? ' (you)' : ''));
      })),
    ];
  },
  'quest-done'() { return [header(), h('div', { class: 'bigtext' }, 'Done. Waiting for the rest of the team…')]; },
  watchQuest() { return [header(), h('div', { class: 'bigtext' }, 'The team has set out. Watch the TV!')]; },
  cutscene() { return [header(), h('div', { class: 'bigtext' }, 'Watch the TV!')]; },

  questResult() {
    const { pub } = state; const r = lastResult(pub);
    if (!r) return [h('div', { class: 'bigtext' }, 'Watch the TV!')];
    const ok = r.outcome === 'success';
    return [
      header(),
      h('div', { class: `banner ${ok ? 'good' : 'bad'}` }, ok ? '✔ Quest succeeded!' : '✖ Quest failed!'),
      h('div', { class: 'bigtext' }, ok ? `Hero: ${nameOf(pub, r.hero)}` : `${nameOf(pub, r.culprit)} did it.`),
      r.failCount != null ? h('p', { class: 'muted center' }, `${r.failCount} Fail card${r.failCount === 1 ? '' : 's'}`) : null,
    ];
  },

  assassinate() {
    const { pub, me } = state;
    return [
      h('h1', {}, 'Find Merlin'),
      h('p', { class: 'muted' }, 'Good won three quests. If you name Merlin, evil wins.'),
      h('div', { class: 'chips' }, me.legal.options.map((id) => { const p = pub.players.find((x) => x.id === id); return h('button', { class: 'chip', onclick: () => { if (confirm(`Strike ${p.name}?`)) send({ t: 'assassinate', id }); } }, dot(p.color), p.name); })),
    ];
  },
  waitAssassin() { return [h('div', { class: 'bigtext' }, 'Someone steps from the shadows… Watch the TV.')]; },

  gameover() {
    const { pub, me } = state; const rv = pub.reveal;
    const iAmGood = ROLE_INFO[rv.roles[me.id]].team === 'good';
    const won = (rv.winner === 'good') === iAmGood;
    return [
      h('div', { class: `banner ${rv.winner === 'good' ? 'good' : 'bad'}` }, rv.winner === 'good' ? 'Good wins!' : 'Evil wins!', h('div', { class: 'small', style: 'font-weight:500;margin-top:6px' }, won ? 'That was you.' : 'Better luck next time.')),
      h('div', { class: 'card recap' }, pub.players.map((p) => { const r = ROLE_INFO[rv.roles[p.id]]; return h('div', {}, h('span', {}, dot(p.color), ' ', p.name), h('span', { class: `tag-${r.team}` }, r.name)); })),
      h('div', { class: 'card recap' }, rv.recap.map((q) => h('div', {}, h('span', {}, `Quest ${q.questIndex + 1}`), h('span', { class: q.outcome === 'success' ? 'tag-good' : 'tag-evil' }, q.outcome === 'success' ? `Hero ${nameOf(pub, q.hero)}` : `Culprit ${nameOf(pub, q.culprit)}${q.framed ? ' (framed!)' : ''}`)))),
      me.vip ? h('button', { class: 'primary big', onclick: () => send({ t: 'again' }) }, 'Play again') : h('p', { class: 'muted center' }, 'Waiting for the VIP…'),
    ];
  },
};

function header() {
  const g = state.pub.game; if (!g) return null;
  return h('div', { class: 'progress', 'aria-label': 'Quest progress' }, Array.from({ length: QUEST_COUNT }, (_, i) => {
    const r = g.results[i];
    return h('i', { class: `${r ? (r.outcome === 'success' ? 's' : 'f') : ''} ${i === g.questIndex ? 'cur' : ''}` });
  }));
}

function teamCard(pub) {
  return h('div', { class: 'card' },
    h('div', { class: 'muted small' }, `${leaderName(pub)} proposes (${pub.game.rejectCount} of 5 rejections)`),
    h('div', { class: 'players', style: 'margin-top:8px' }, pub.game.team.map((id) => { const p = pub.players.find((x) => x.id === id); return h('span', { class: 'pill' }, dot(p.color), p.name); })));
}

window.__sq = { get state() { return state; } }; // tiny debug handle for browser tests
render();
connect();
