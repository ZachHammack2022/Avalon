// One game room: players, phases, rules, bots. The server is authoritative; this class is the only
// place that knows who is evil. It never touches sockets directly: clients are `conn` objects with
// a `send(obj)` method (and optional `close()`), so the whole game can be driven from tests.
import {
  MAX_PLAYERS, MAX_REJECTS, MIN_PLAYERS, QUEST_COUNT, QUESTS_TO_WIN, ROLES, isEvilRole,
  normalizeRoleConfig, teamSize, validateRoleConfig,
} from '../shared/avalon.js';
import { QUESTS } from '../shared/campaign-lost-crown.js';
import { cutsceneSeconds } from '../shared/cutscene.js';
import { makeRng } from '../shared/rng.js';
import { AVATAR_CLASSES, AVATAR_COLORS } from '../shared/avatars.js';
import { assignRoles, knowledgeFor, resolveQuest, tally } from './rules.js';
import { botAssassinate, botCard, botNames, botPick, botPropose, botVote } from './bots.js';

export const DEFAULT_TIMING = {
  roleRevealMs: 30000,
  voteRevealMs: 5500,
  questResultMs: 4500,
  assassinationBeatMs: 0, // the beat is TV-side; the Assassin may pick immediately
  disconnectGraceMs: 15000,
  botThinkMs: [900, 3200],
  cutscenePadMs: 800,
};

export const CLASSES = AVATAR_CLASSES.map((c) => c.id);
export const COLORS = AVATAR_COLORS;
const NAME_MAX = 12;

const real = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id), now: () => Date.now() };

export class Room {
  /**
   * @param {object} o
   * @param {string} o.code
   * @param {{next:()=>number}} [o.rng]       makeRng()-style helper (inject a seeded one in tests)
   * @param {object} [o.clock]                { setTimeout, clearTimeout, now }
   * @param {object} [o.timing]               overrides for DEFAULT_TIMING
   * @param {number} [o.timeScale]            >1 speeds every server delay up (dev / integration tests)
   */
  constructor({ code, rng = makeRng(), clock = real, timing = {}, timeScale = 1, onEmpty } = {}) {
    this.code = code;
    this.rng = rng;
    this.clock = clock;
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.timeScale = timeScale;
    this.onEmpty = onEmpty;
    this.tvs = new Set();
    this.players = [];
    this.nextId = 1;
    this.rolesCfg = normalizeRoleConfig();
    this.classic = false;
    this.phase = 'lobby';
    this.version = 0; // bumps on every phase change; stale timers check it
    this.g = null;
    this.phaseTimer = null;
    this.botTimers = new Map();
    this.phaseEndsAt = null;
    this.lastActivity = clock.now();
  }

  // ---------- timers ----------
  ms(x) { return Math.max(0, Math.round(x / this.timeScale)); }
  _after(ms, fn) { return this.destroyed ? null : this.clock.setTimeout(fn, this.ms(ms)); }
  _setPhaseTimer(ms, fn) {
    this._clearPhaseTimer();
    const v = this.version;
    this.phaseEndsAt = this.clock.now() + this.ms(ms);
    this.phaseTimer = this._after(ms, () => { this.phaseTimer = null; if (v === this.version) fn(); });
  }
  _clearPhaseTimer() { if (this.phaseTimer != null) this.clock.clearTimeout(this.phaseTimer); this.phaseTimer = null; this.phaseEndsAt = null; }
  _clearBotTimers() { for (const id of this.botTimers.values()) this.clock.clearTimeout(id); this.botTimers.clear(); }
  _enter(phase) {
    this.phase = phase;
    this.version++;
    this._clearPhaseTimer();
    this._clearBotTimers();
  }

  // ---------- lookup ----------
  player(id) { return this.players.find((p) => p.id === id); }
  humans() { return this.players.filter((p) => !p.isBot); }
  get vip() { return this.players.find((p) => p.vip); }
  isAuto(p) { return p.isBot || p.takeover; }
  playerIds() { return this.players.map((p) => p.id); }
  inGame() { return this.phase !== 'lobby'; }

  // ---------- connections ----------
  attachTv(conn) {
    this.tvs.add(conn);
    this.lastActivity = this.clock.now();
    conn.send({ t: 'room', code: this.code });
    conn.send({ t: 'state', pub: this.tvState() });
  }
  detachTv(conn) { this.tvs.delete(conn); }

  /** Returns {ok, player, token} or {ok:false, error}. */
  join({ name, token, cls, color }, conn) {
    this.lastActivity = this.clock.now();
    const existing = token && this.players.find((p) => p.token === token && !p.isBot);
    if (existing) {
      if (existing.conn && existing.conn !== conn) { try { existing.conn.close && existing.conn.close(); } catch { /* ignore */ } }
      existing.conn = conn;
      existing.connected = true;
      existing.takeover = false;
      if (existing.dcTimer != null) { this.clock.clearTimeout(existing.dcTimer); existing.dcTimer = null; }
      this._ensureVip();
      this.broadcast();
      return { ok: true, player: existing, token: existing.token, resumed: true };
    }
    if (this.inGame()) return { ok: false, error: 'This game is already in progress.' };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: 'This room is full.' };
    const clean = this._cleanName(name);
    if (!clean) return { ok: false, error: 'Please enter a name.' };
    const p = this._addPlayer({ name: clean, isBot: false, cls, color });
    p.conn = conn;
    p.connected = true;
    p.token = this._newToken();
    if (!this.vip) p.vip = true;
    this.broadcast();
    return { ok: true, player: p, token: p.token };
  }

  detachPhone(playerId, conn) {
    const p = this.player(playerId);
    if (!p || p.conn !== conn || this.destroyed) return;
    p.conn = null;
    p.connected = false;
    if (p.dcTimer != null) this.clock.clearTimeout(p.dcTimer);
    p.dcTimer = this._after(this.timing.disconnectGraceMs, () => {
      p.dcTimer = null;
      if (p.connected) return;
      if (this.inGame()) p.takeover = true;
      this._ensureVip();
      this._maybeAdvanceReveal();
      this._scheduleBots();
      this.broadcast();
      this._checkEmpty();
    });
    this.broadcast();
  }

  _checkEmpty() {
    if (this.tvs.size === 0 && this.humans().every((p) => !p.connected) && this.onEmpty) this.onEmpty(this);
  }

  _newToken() { return Array.from({ length: 4 }, () => Math.floor(this.rng.next() * 2 ** 32).toString(36)).join(''); }
  _cleanName(name) { return String(name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX); }
  _uniqueName(base) {
    const taken = new Set(this.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) {
      const cand = `${base.slice(0, NAME_MAX - String(i).length - 1)} ${i}`;
      if (!taken.has(cand.toLowerCase())) return cand;
    }
  }
  _addPlayer({ name, isBot, cls, color }) {
    const usedColors = new Set(this.players.map((p) => p.color));
    const p = {
      id: `p${this.nextId++}`,
      name: this._uniqueName(name),
      isBot,
      cls: CLASSES.includes(cls) ? cls : this.rng.pick(CLASSES),
      color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : (COLORS.find((c) => !usedColors.has(c)) || this.rng.pick(COLORS)),
      conn: null, connected: isBot, takeover: false, vip: false, ready: false, token: null, dcTimer: null,
    };
    this.players.push(p);
    return p;
  }
  _ensureVip() {
    const v = this.vip;
    if (v && (v.connected || !this.humans().some((p) => p.connected))) return;
    const next = this.humans().find((p) => p.connected);
    if (next) { for (const p of this.players) p.vip = false; next.vip = true; }
  }

  // ---------- state for clients ----------
  _questInfo(i) { return QUESTS[i] ? { id: QUESTS[i].id, name: QUESTS[i].name } : null; }

  publicState() {
    const g = this.g;
    const pub = {
      room: this.code,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, cls: p.cls, color: p.color, bot: p.isBot, vip: p.vip,
        connected: p.connected, takeover: p.takeover, ready: p.ready,
      })),
      config: { roles: this.rolesCfg, classic: this.classic },
    };
    if (this.phase === 'lobby') {
      pub.validation = validateRoleConfig(this.players.length, this.rolesCfg);
      delete pub.validation.config;
      return pub;
    }
    const n = this.players.length;
    pub.game = {
      n,
      questIndex: g.questIndex,
      quest: this._questInfo(g.questIndex),
      teamSize: g.questIndex < QUEST_COUNT ? teamSize(n, g.questIndex) : null,
      leader: g.order[g.leader],
      rejectCount: g.rejectCount,
      team: g.team,
      results: g.results.slice(0, g.shown).map((r) => this._publicResult(r)),
      assassinationEnabled: g.config.merlin,
      history: g.proposals, // every revealed proposal: public table knowledge, shown as the phone's Record
    };
    if (this.phase === 'vote') pub.game.voted = [...g.votes.keys()];
    if (this.phase === 'voteReveal') pub.game.votes = Object.fromEntries(g.votes);
    if (this.phase === 'voteReveal') pub.game.approved = g.lastApproved;
    if (this.phase === 'questPlay') pub.game.waitingOn = g.quest.teamIds.filter((id) => !g.quest.picks.has(id)).length;
    if (this.phase === 'gameover') pub.reveal = g.reveal;
    return pub;
  }

  _publicResult(r) {
    const out = { questIndex: r.questIndex, outcome: r.outcome, team: r.team, culprit: r.culprit, hero: r.hero };
    if (this.classic) out.failCount = r.failCount;
    return out;
  }

  /** TV state = public + (only while a cutscene is current) the cutscene payload. */
  tvState() {
    const pub = this.publicState();
    if (this.g && (this.phase === 'cutscene') && this.g.cutscene) pub.cutscene = this.g.cutscene;
    return pub;
  }

  meState(p) {
    const me = { id: p.id, name: p.name, vip: p.vip, takeover: p.takeover };
    const g = this.g;
    if (!g) return me;
    const k = knowledgeFor(p.id, g.roles, this.playerIds());
    me.role = k.role;
    me.roleName = ROLES[k.role].name;
    me.team = k.team;
    me.knowKind = k.kind;
    me.knows = k.knows;
    me.note = k.note;
    me.legal = this._legalFor(p, k);
    if (this.phase === 'questPlay') {
      const onTeam = g.quest.teamIds.includes(p.id);
      me.quest = {
        onTeam,
        step: !onTeam ? null : !g.quest.cards.has(p.id) ? 'card' : !g.quest.picks.has(p.id) ? 'pick' : 'done',
        canFail: k.team === 'evil', // button is shown to everyone; disabled for good
        options: g.quest.teamIds,
      };
    }
    return me;
  }

  _legalFor(p, k) {
    const g = this.g;
    switch (this.phase) {
      case 'roleReveal': return { action: 'ready', done: p.ready };
      case 'propose': return g.order[g.leader] === p.id ? { action: 'propose', size: teamSize(this.players.length, g.questIndex) } : { action: 'wait' };
      case 'vote': return g.votes.has(p.id) ? { action: 'wait' } : { action: 'vote' };
      case 'assassination': return k.role === 'assassin' ? { action: 'assassinate', options: this.playerIds().filter((id) => id !== p.id) } : { action: 'wait' };
      case 'gameover': return p.vip ? { action: 'again' } : { action: 'wait' };
      default: return { action: 'wait' };
    }
  }

  broadcast() {
    const pub = this.publicState();
    const tvPub = this.tvState();
    for (const tv of this.tvs) tv.send({ t: 'state', pub: tvPub });
    for (const p of this.players) if (p.conn) p.conn.send({ t: 'state', pub, me: this.meState(p) });
  }

  // ---------- message handling ----------
  /** Handle a phone message. Returns undefined or {error}. */
  handle(playerId, msg) {
    const p = this.player(playerId);
    if (!p || !msg || typeof msg !== 'object') return { error: 'bad message' };
    this.lastActivity = this.clock.now();
    const fn = this._actions[msg.t];
    if (!fn) return { error: `unknown action ${msg.t}` };
    const res = fn.call(this, p, msg) || {};
    if (!res.error) this.broadcast();
    return res.error ? res : undefined;
  }

  get _actions() {
    return {
      setAvatar: this._setAvatar, setRoles: this._setRoles, setClassic: this._setClassic, addBot: this._addBot,
      removeBot: this._removeBot, kick: this._kick, leave: this._leave, start: this._start, ready: this._ready,
      propose: this._propose, vote: this._vote, play: this._play, pick: this._pick, assassinate: this._assassinate, again: this._again,
    };
  }

  _needLobby(p, vipOnly = true) {
    if (this.phase !== 'lobby') return { error: 'Only possible in the lobby.' };
    if (vipOnly && !p.vip) return { error: 'Only the VIP can do that.' };
    return null;
  }

  _setAvatar(p, m) {
    if (this.phase !== 'lobby') return { error: 'Avatars are locked once the game starts.' };
    if (m.cls !== undefined) { if (!CLASSES.includes(m.cls)) return { error: 'bad class' }; p.cls = m.cls; }
    if (m.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(m.color)) return { error: 'bad color' }; p.color = m.color; }
  }
  _setRoles(p, m) {
    const bad = this._needLobby(p); if (bad) return bad;
    const src = m.roles && typeof m.roles === 'object' ? m.roles : m;
    this.rolesCfg = normalizeRoleConfig({ ...this.rolesCfg, ...src });
    if ('classic' in m) this.classic = !!m.classic;
  }
  _setClassic(p, m) { const bad = this._needLobby(p); if (bad) return bad; this.classic = !!m.on; }
  _addBot(p) {
    const bad = this._needLobby(p); if (bad) return bad;
    if (this.players.length >= MAX_PLAYERS) return { error: 'Room is full.' };
    const used = new Set(this.players.map((x) => x.name));
    const name = botNames().find((n) => !used.has(n)) || 'Bot';
    this._addPlayer({ name, isBot: true });
  }
  _removeBot(p, m) {
    const bad = this._needLobby(p); if (bad) return bad;
    const bots = this.players.filter((x) => x.isBot);
    const target = m.id ? bots.find((b) => b.id === m.id) : bots[bots.length - 1];
    if (!target) return { error: 'No bot to remove.' };
    this.players.splice(this.players.indexOf(target), 1);
  }
  _kick(p, m) {
    const bad = this._needLobby(p); if (bad) return bad;
    const t = this.player(m.id);
    if (!t || t.id === p.id) return { error: 'Cannot remove that player.' };
    this._dropPlayer(t);
  }
  _leave(p) {
    if (this.phase !== 'lobby') return { error: 'Cannot leave mid-game.' };
    this._dropPlayer(p);
  }
  _dropPlayer(t) {
    this.players.splice(this.players.indexOf(t), 1);
    if (t.dcTimer != null) this.clock.clearTimeout(t.dcTimer);
    if (t.conn) { try { t.conn.send({ t: 'kicked' }); t.conn.close && t.conn.close(); } catch { /* ignore */ } }
    if (t.vip) { t.vip = false; this._ensureVip(); }
  }

  _start(p) {
    const bad = this._needLobby(p); if (bad) return bad;
    const v = validateRoleConfig(this.players.length, this.rolesCfg);
    if (!v.ok) return { error: v.errors[0] };
    const ids = this.playerIds();
    const roles = assignRoles(ids, v.config, this.rng);
    this.g = {
      config: v.config, roles, order: ids, leader: this.rng.int(ids.length), questIndex: 0, results: [], shown: 0,
      rejectCount: 0, team: [], votes: new Map(), proposals: [], quest: null, cutscene: null, reveal: null, lastApproved: null,
    };
    for (const pl of this.players) pl.ready = pl.isBot;
    this._enter('roleReveal');
    this._setPhaseTimer(this.timing.roleRevealMs, () => this._beginProposal());
    this._scheduleBots();
  }

  _ready(p) {
    if (this.phase !== 'roleReveal') return { error: 'Not now.' };
    p.ready = true;
    this._maybeAdvanceReveal();
  }
  _maybeAdvanceReveal() {
    if (this.phase === 'roleReveal' && this.players.every((p) => p.ready || this.isAuto(p))) this._beginProposal();
  }

  _beginProposal() {
    const g = this.g;
    g.team = [];
    g.votes = new Map();
    this._enter('propose');
    this._scheduleBots();
    this.broadcast();
  }

  _propose(p, m) {
    if (this.phase !== 'propose') return { error: 'Not now.' };
    const g = this.g;
    if (g.order[g.leader] !== p.id) return { error: 'You are not the leader.' };
    const size = teamSize(this.players.length, g.questIndex);
    const team = Array.isArray(m.team) ? m.team : null;
    if (!team || team.length !== size || new Set(team).size !== size || team.some((id) => !this.player(id))) {
      return { error: `Pick exactly ${size} different players.` };
    }
    g.team = this.playerIds().filter((id) => team.includes(id)); // stable seat order
    g.votes = new Map();
    this._enter('vote');
    this._scheduleBots();
  }

  _vote(p, m) {
    if (this.phase !== 'vote') return { error: 'Not now.' };
    const g = this.g;
    if (g.votes.has(p.id)) return { error: 'Already voted.' };
    if (typeof m.approve !== 'boolean') return { error: 'bad vote' };
    g.votes.set(p.id, m.approve);
    if (g.votes.size === this.players.length) this._revealVotes();
  }

  _revealVotes() {
    const g = this.g;
    const approvals = [...g.votes.values()].filter(Boolean).length;
    const approved = approvals * 2 > this.players.length; // ties reject
    g.lastApproved = approved;
    g.proposals.push({ questIndex: g.questIndex, leader: g.order[g.leader], team: g.team.slice(), votes: Object.fromEntries(g.votes), approved });
    if (!approved) g.rejectCount++;
    this._enter('voteReveal');
    this._setPhaseTimer(this.timing.voteRevealMs, () => this._afterVoteReveal());
  }

  _afterVoteReveal() {
    const g = this.g;
    const approved = g.lastApproved;
    g.leader = (g.leader + 1) % g.order.length; // rotates after every proposal
    if (approved) {
      g.rejectCount = 0;
      this._beginQuest();
    } else if (g.rejectCount >= MAX_REJECTS) {
      this._gameOver('evil', 'rejects');
    } else {
      this._beginProposal();
    }
    this.broadcast();
  }

  _beginQuest() {
    const g = this.g;
    g.quest = { teamIds: g.team.slice(), cards: new Map(), picks: new Map() };
    this._enter('questPlay');
    this._scheduleBots();
  }

  _play(p, m) {
    if (this.phase !== 'questPlay') return { error: 'Not now.' };
    const q = this.g.quest;
    if (!q.teamIds.includes(p.id)) return { error: 'You are not on the quest.' };
    if (q.cards.has(p.id)) return { error: 'Card already played.' };
    if (m.card !== 'success' && m.card !== 'fail') return { error: 'bad card' };
    if (m.card === 'fail' && ROLES[this.g.roles.get(p.id)].team === 'good') return { error: 'Good players can only play Success.' };
    q.cards.set(p.id, m.card);
  }

  _pick(p, m) {
    if (this.phase !== 'questPlay') return { error: 'Not now.' };
    const q = this.g.quest;
    if (!q.teamIds.includes(p.id)) return { error: 'You are not on the quest.' };
    if (!q.cards.has(p.id)) return { error: 'Play a card first.' };
    if (q.picks.has(p.id)) return { error: 'Already picked.' };
    if (!q.teamIds.includes(m.id)) return { error: 'Pick someone on the team.' };
    q.picks.set(p.id, m.id);
    if (q.picks.size === q.teamIds.length) this._resolveQuest();
  }

  _resolveQuest() {
    const g = this.g;
    const q = g.quest;
    const quest = QUESTS[g.questIndex];
    const r = resolveQuest({ playerCount: this.players.length, questIndex: g.questIndex, cards: q.cards, picks: q.picks, rng: this.rng });
    const gag = r.outcome === 'fail' ? this.rng.pick(quest.gags).id : null;
    const prev = g.results[g.results.length - 1];
    const payload = {
      questId: quest.id, questIndex: g.questIndex, outcome: r.outcome, team: q.teamIds.slice(),
      culprit: r.culprit, hero: r.hero, gag, seed: this.rng.int(2 ** 32), prevOutcome: prev ? prev.outcome : null,
    };
    if (this.classic) payload.failCount = r.failCount;
    g.results.push({
      questIndex: g.questIndex, outcome: r.outcome, team: q.teamIds.slice(), culprit: r.culprit, hero: r.hero,
      gag, failCount: r.failCount, failers: r.failers, picks: Object.fromEntries(q.picks),
    });
    g.cutscene = payload;
    this._enter('cutscene');
    const secs = cutsceneSeconds(quest, r.outcome, gag);
    this._setPhaseTimer(secs * 1000 + this.timing.cutscenePadMs, () => this._showResult());
    for (const tv of this.tvs) tv.send({ t: 'cutscene', ...payload });
  }

  _showResult() {
    const g = this.g;
    g.shown = g.results.length;
    g.cutscene = null;
    this._enter('questResult');
    this._setPhaseTimer(this.timing.questResultMs, () => this._afterResult());
    this.broadcast();
  }

  _afterResult() {
    const g = this.g;
    const t = tally(g.results, g.config.merlin);
    if (t && t.winner) this._gameOver(t.winner, t.reason);
    else if (t && t.pending === 'assassination') {
      this._enter('assassination');
      this._scheduleBots();
    } else {
      g.questIndex++;
      this._beginProposal();
    }
    this.broadcast();
  }

  _assassinId() { for (const [id, r] of this.g.roles) if (r === 'assassin') return id; return null; }

  _assassinate(p, m) {
    if (this.phase !== 'assassination') return { error: 'Not now.' };
    if (this.g.roles.get(p.id) !== 'assassin') return { error: 'You are not the Assassin.' };
    if (!this.player(m.id) || m.id === p.id) return { error: 'Pick another player.' };
    const hit = this.g.roles.get(m.id) === 'merlin';
    this.g.assassination = { assassin: p.id, target: m.id, hit };
    this._gameOver(hit ? 'evil' : 'good', hit ? 'assassination-hit' : 'assassination-miss');
  }

  _gameOver(winner, reason) {
    const g = this.g;
    g.shown = g.results.length;
    g.reveal = {
      winner, reason,
      roles: Object.fromEntries(g.roles),
      assassination: g.assassination || null,
      recap: g.results.map((r) => ({
        questIndex: r.questIndex, outcome: r.outcome, team: r.team, culprit: r.culprit, hero: r.hero, gag: r.gag,
        failCount: r.failCount, framed: r.outcome === 'fail' ? !r.failers.includes(r.culprit) : false,
      })),
    };
    this._enter('gameover');
  }

  _again(p) {
    if (this.phase !== 'gameover') return { error: 'Not now.' };
    if (!p.vip) return { error: 'Only the VIP can do that.' };
    this.g = null;
    for (const pl of this.players) { pl.ready = false; pl.takeover = false; }
    // seats of humans who dropped out during the game are removed so they do not block the lobby
    this.players = this.players.filter((pl) => pl.isBot || pl.connected);
    this._enter('lobby');
  }

  // ---------- bots (and stand-ins for disconnected players) ----------
  _pending() {
    const g = this.g;
    if (!g) return [];
    switch (this.phase) {
      case 'roleReveal': return this.players.filter((p) => !p.ready).map((p) => p.id);
      case 'propose': return [g.order[g.leader]];
      case 'vote': return this.players.filter((p) => !g.votes.has(p.id)).map((p) => p.id);
      case 'questPlay': return g.quest.teamIds.filter((id) => !g.quest.picks.has(id));
      case 'assassination': return [this._assassinId()];
      default: return [];
    }
  }

  _scheduleBots() {
    for (const id of this._pending()) {
      const p = this.player(id);
      if (!p || !this.isAuto(p) || this.botTimers.has(id)) continue;
      const [lo, hi] = this.timing.botThinkMs;
      const delay = lo + this.rng.next() * (hi - lo);
      const v = this.version;
      const tid = this._after(delay, () => {
        this.botTimers.delete(id);
        if (v !== this.version) return;
        this._botAct(p);
      });
      this.botTimers.set(id, tid);
    }
  }

  _botCtx(p) {
    const g = this.g;
    const k = knowledgeFor(p.id, g.roles, this.playerIds());
    const last = g.results[g.results.length - 1];
    const allyIds = k.team === 'evil' ? k.knows : [];
    return {
      selfId: p.id, team: k.team, role: k.role, allyIds, rng: this.rng, playerIds: this.playerIds(), size: g.questIndex < QUEST_COUNT ? teamSize(this.players.length, g.questIndex) : 0,
      proposedTeam: g.team, rejectCount: g.rejectCount,
      teamIds: g.quest ? g.quest.teamIds : [],
      lastTeamFailed: !!(last && last.outcome === 'fail' && last.team.includes(p.id)),
    };
  }

  _botAct(p) {
    if (!this._pending().includes(p.id) || !this.isAuto(p)) return;
    const ctx = this._botCtx(p);
    let res;
    switch (this.phase) {
      case 'roleReveal': res = this._ready(p); break;
      case 'propose': res = this._propose(p, { team: botPropose(ctx) }); break;
      case 'vote': res = this._vote(p, { approve: botVote(ctx) }); break;
      case 'questPlay': {
        const q = this.g.quest;
        let card = q.cards.get(p.id);
        if (!card) { card = botCard(ctx); res = this._play(p, { card }); }
        if (!res || !res.error) res = this._pick(p, { id: botPick({ ...ctx, card }) });
        break;
      }
      case 'assassination': res = this._assassinate(p, { id: botAssassinate(ctx) }); break;
      default: return;
    }
    if (res && res.error) throw new Error(`bot ${p.id} made an illegal move in ${this.phase}: ${res.error}`);
    this.broadcast();
    this._scheduleBots();
  }

  destroy() {
    this.destroyed = true;
    this._clearPhaseTimer();
    this._clearBotTimers();
    for (const p of this.players) if (p.dcTimer != null) this.clock.clearTimeout(p.dcTimer);
  }
}
