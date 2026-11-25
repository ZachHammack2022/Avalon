// The Record: every proposal, every vote and every quest outcome so far, laid out as one board (players down the
// side, proposals across, grouped by quest). It is the table's shared memory, so the TV keeps it on screen and every
// phone shows it while people argue. Pure and shared by both. Public knowledge only: proposals once their votes are
// revealed, quest results once their cutscene has ended, and roles only after the game (pub.reveal).
import { MAX_REJECTS, QUEST_COUNT, failsRequired, teamSize } from './avalon.js';

/**
 * @typedef {{ vote: 'yes'|'no'|'in'|null, onTeam: boolean, leader: boolean, standIn: boolean }} Cell
 *   vote: 'yes'/'no' once revealed, 'in' = has voted but the vote is still face-down, null = nothing yet;
 *   standIn: the player was away and a stand-in cast this vote for them (so it says nothing about the player)
 * @typedef {{ key: string, questIndex: number, attempt: number, leader: string, team: string[], approved: boolean|null,
 *   live: boolean, yes: number, no: number, voted: number, outcome: 'success'|'fail'|null, failCount: number|null, standIn: string[] }} Column
 *   live = the proposal being voted on right now; voted = how many have voted (for the live column: face-down); outcome = how the quest went, for the proposal that was sent;
 *   failCount = Fail cards in that quest, only in Classic mode (otherwise the count stays secret)
 */

/** Build the board from a public state. Returns null before the game starts. */
export function recordFor(pub) {
  const g = pub && pub.game;
  if (!g || !Array.isArray(pub.players)) return null;
  const n = pub.players.length;
  const results = g.results || [];
  const resultOf = (qi) => results.find((r) => r.questIndex === qi) || null;

  const cols = (g.history || []).map((h) => ({
    questIndex: h.questIndex, leader: h.leader, team: h.team || [], votes: h.votes || {}, approved: !!h.approved, live: false,
    standIn: h.standIn || [],
  }));
  // the team on the table right now: names are public, votes stay face-down until everyone is in
  if (pub.phase === 'vote' && g.team && g.team.length) {
    cols.push({ questIndex: g.questIndex, leader: g.leader, team: g.team, votes: null, voted: g.voted || [], approved: null, live: true, standIn: [] });
  }
  const attempts = {};
  const columns = cols.map((c, i) => {
    const attempt = (attempts[c.questIndex] = (attempts[c.questIndex] || 0) + 1);
    const yes = c.votes ? pub.players.filter((p) => c.votes[p.id] === true).length : 0;
    const no = c.votes ? pub.players.filter((p) => c.votes[p.id] === false).length : 0;
    const r = c.approved ? resultOf(c.questIndex) : null;
    return {
      key: `c${i}`, questIndex: c.questIndex, attempt, leader: c.leader, team: c.team.slice(), approved: c.approved, live: c.live, yes, no,
      voted: c.live ? (c.voted || []).length : yes + no,
      outcome: r ? r.outcome : null, failCount: r && r.failCount != null ? r.failCount : null, standIn: c.standIn.slice(),
    };
  });

  const finished = pub.phase === 'gameover';
  const quests = Array.from({ length: QUEST_COUNT }, (_, i) => {
    const r = resultOf(i);
    return {
      index: i,
      size: n >= 5 && n <= 10 ? teamSize(n, i) : null,
      fails: n >= 5 && n <= 10 ? failsRequired(n, i) : 1,
      outcome: r ? r.outcome : null,
      current: !r && !finished && i === g.questIndex,
      hero: r ? r.hero || null : null,
      culprit: r ? r.culprit || null : null,
      failCount: r && r.failCount != null ? r.failCount : null,
      team: r ? (r.team || []).slice() : [],
      cols: columns.filter((c) => c.questIndex === i).map((c) => c.key),
    };
  });

  const roles = (pub.reveal && pub.reveal.roles) || null;
  const rows = pub.players.map((p) => {
    const cells = cols.map((c) => ({
      vote: c.votes ? (c.votes[p.id] === true ? 'yes' : c.votes[p.id] === false ? 'no' : null) : (c.voted || []).includes(p.id) ? 'in' : null,
      onTeam: c.team.includes(p.id),
      leader: c.leader === p.id,
      standIn: c.standIn.includes(p.id),
    }));
    const went = results.filter((r) => (r.team || []).includes(p.id)).map((r) => r.outcome);
    return {
      id: p.id, name: p.name, color: p.color, cls: p.cls,
      away: !p.bot && p.connected === false && !finished, // a stand-in is playing this seat right now (or will shortly)
      cells,
      quests: went, // outcome of every quest this player went on, in order
      blamed: results.filter((r) => r.outcome === 'fail' && r.culprit === p.id).length,
      hero: results.filter((r) => r.outcome === 'success' && r.hero === p.id).length,
      role: roles ? roles[p.id] || null : null,
    };
  });

  return { columns, quests, rows, rejectCount: g.rejectCount || 0, empty: columns.length === 0 };
}

/** One plain sentence per column, for screen readers and tooltips. `nameOf(id)` -> display name. */
export function describeColumn(col, nameOf) {
  const team = list(col.team.map(nameOf));
  const head = `Quest ${col.questIndex + 1}, proposal ${col.attempt}: ${nameOf(col.leader)} proposed ${team}.`;
  if (col.live) return `${head} Voting now.`;
  const stand = col.standIn && col.standIn.length ? ` A stand-in voted for ${list(col.standIn.map(nameOf))}.` : '';
  const verdict = `${col.approved ? 'Approved' : 'Rejected'} ${col.yes} to ${col.no}.${stand}`;
  const fails = col.failCount ? ` with ${failText(col.failCount)}` : '';
  const outcome = col.outcome === 'success' ? ` The quest succeeded${fails}.` : col.outcome === 'fail' ? ` The quest failed${fails}.` : '';
  return `${head} ${verdict}${outcome}`;
}

/**
 * Why the game ended, in one sentence, for the TV and every phone. `reveal` is pub.reveal; `nameOf(id)` -> display name.
 * An assassination names who was struck and, on a miss, who Merlin really was (roles are public once the game is over).
 */
export function endReason(reveal, nameOf) {
  if (!reveal) return '';
  const a = reveal.assassination;
  const merlin = Object.keys(reveal.roles || {}).find((id) => reveal.roles[id] === 'merlin');
  switch (reveal.reason) {
    case 'quests': return reveal.winner === 'good' ? 'Three quests succeeded.' : 'Three quests failed.';
    case 'rejects': return 'Five proposals in a row were rejected.';
    case 'assassination-hit': return a && a.target ? `The Assassin struck ${nameOf(a.target)}, who was Merlin.` : 'The Assassin found Merlin.';
    case 'assassination-miss':
      if (!a || !a.target) return 'The Assassin missed Merlin.';
      return `The Assassin struck ${nameOf(a.target)}, but Merlin was ${merlin ? nameOf(merlin) : 'someone else'}.`;
    default: return '';
  }
}

/** The short tally under a column: "4–3" once revealed, "2/7" (voted so far) while the votes are face-down. */
export function tallyText(col, playerCount) {
  return col.live ? `${col.voted}/${playerCount}` : `${col.yes}–${col.no}`;
}

/** "1 Fail card" / "2 Fail cards" */
export const failText = (n) => `${n} Fail card${n === 1 ? '' : 's'}`;

const list = (who) => (who.length <= 1 ? who.join('') : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`);

/**
 * Who holds the crown for the rest of this quest: [the leader now, the next leader, …, the leader of the fifth
 * proposal]. The fifth proposal must pass, or Evil wins. Only while a team is being chosen or voted on; null otherwise.
 * Seat order comes from `game.order` (older servers: the player list, which is the same order).
 */
export function crownOrder(pub) {
  const g = pub && pub.game;
  if (!g || (pub.phase !== 'propose' && pub.phase !== 'vote')) return null;
  const order = Array.isArray(g.order) && g.order.length ? g.order : (pub.players || []).map((p) => p.id);
  const at = order.indexOf(g.leader);
  if (at < 0) return null;
  const left = Math.max(1, MAX_REJECTS - (g.rejectCount || 0)); // proposals this quest can still have, this one included
  return Array.from({ length: Math.min(left, order.length) }, (_, k) => order[(at + k) % order.length]);
}

/**
 * What a rejected team means, for the vote reveal. `rejectCount` already counts this rejection. The fifth rejection in
 * a row ends the game, so the crown does not pass on then.
 */
export function rejectText(rejectCount) {
  if (rejectCount >= MAX_REJECTS) return `${MAX_REJECTS} teams in a row were rejected. Evil wins.`;
  if (rejectCount === MAX_REJECTS - 1) return `The crown passes on. ${rejectCount} of ${MAX_REJECTS} teams rejected: one more and Evil wins.`;
  return `The crown passes on. ${rejectCount} of ${MAX_REJECTS} teams rejected.`;
}

/** One sentence on where the crown goes if this team is rejected. `nameOf(id)` -> display name. */
export function crownText(pub, nameOf) {
  const order = crownOrder(pub);
  if (!order) return '';
  const next = order.slice(1).map(nameOf);
  if (!next.length) return 'Fifth proposal: if this team is rejected, Evil wins.';
  if (next.length === 1) return `If rejected, ${next[0]} leads the fifth and final proposal.`;
  return `Next to lead: ${next.slice(0, -1).join(', ')}, then ${next[next.length - 1]} for the fifth proposal.`;
}

/**
 * At game over, how well each player's votes read the table. A vote is right when it approved a team with no evil on
 * it or voted down a team with evil on it. Votes on a team the player was on (everyone approves those) and votes a
 * stand-in cast while they were away say nothing about them, so they are left out. Returns {id: {right, of}}.
 * Roles are public once the game is over, so this is public knowledge then (and null before).
 */
export function voteReads(pub) {
  const roles = pub && pub.reveal && pub.reveal.roles;
  const history = pub && pub.game && pub.game.history;
  if (!roles || !Array.isArray(history)) return null;
  const evil = new Set(Object.keys(roles).filter((id) => EVIL_ROLES.has(roles[id])));
  const reads = {};
  for (const h of history) {
    const clean = !h.team.some((id) => evil.has(id));
    for (const [id, approve] of Object.entries(h.votes || {})) {
      if (h.team.includes(id) || (h.standIn && h.standIn.includes(id))) continue;
      const r = reads[id] || (reads[id] = { right: 0, of: 0 });
      r.of++;
      if (approve === clean) r.right++;
    }
  }
  return reads;
}
const EVIL_ROLES = new Set(['minion', 'assassin', 'morgana', 'mordred', 'oberon']);

/**
 * How many failed teams each player voted to send without going on them: {id: n}. Evil players wave their allies'
 * teams through, so this is evidence the table can use when picking a team. Only quests whose result is public count,
 * and a vote a stand-in cast for an absent player is left out.
 */
export function backedFailures(pub) {
  const g = pub && pub.game;
  const out = {};
  if (!g || !Array.isArray(g.history)) return out;
  for (const r of g.results || []) {
    if (r.outcome !== 'fail') continue;
    const sent = g.history.filter((h) => h.questIndex === r.questIndex && h.approved).pop();
    if (!sent) continue;
    for (const [id, yes] of Object.entries(sent.votes || {})) {
      if (yes && !sent.team.includes(id) && !(sent.standIn && sent.standIn.includes(id))) out[id] = (out[id] || 0) + 1;
    }
  }
  return out;
}

/**
 * For the Assassin's choice: how often each player voted down a team that had someone on it the asker knows is evil
 * (`evilIds`: the Assassin and the allies they can see). Merlin, who sees evil, tends to say no to those. Votes on a
 * player's own team and votes a stand-in cast for them are left out. Returns {id: {no, of}}. Uses only the public
 * record and what the asker already knows.
 */
export function noToEvil(pub, evilIds) {
  const history = (pub && pub.game && pub.game.history) || [];
  const evil = new Set(evilIds);
  const out = {};
  for (const h of history) {
    if (!h.team.some((id) => evil.has(id))) continue;
    for (const [id, approve] of Object.entries(h.votes || {})) {
      if (evil.has(id) || h.team.includes(id) || (h.standIn && h.standIn.includes(id))) continue;
      const r = out[id] || (out[id] = { no: 0, of: 0 });
      r.of++;
      if (approve === false) r.no++;
    }
  }
  return out;
}

/**
 * The good player whose votes read the table best, for a game-over award: {id, right, of}, or null when nobody stood
 * out (fewer than three counted votes, or under three in four right). Merlin is left out: Merlin could see evil.
 * Ties go to the player earlier in seat order, so the TV and every phone name the same person.
 */
export function sharpestEye(pub) {
  const reads = voteReads(pub);
  if (!reads) return null;
  let best = null;
  for (const p of pub.players) {
    const role = pub.reveal.roles[p.id]; const r = reads[p.id];
    if (!r || !role || role === 'merlin' || EVIL_ROLES.has(role) || r.of < 3 || r.right * 4 < r.of * 3) continue;
    if (!best || r.right > best.right || (r.right === best.right && r.of < best.of)) best = { id: p.id, ...r };
  }
  return best;
}

/**
 * End-of-game superlatives, for the TV card and every phone: the hero, the scapegoat (framed and innocent), the walking
 * disaster (most blamed) and the sharpest eye (best votes among good players who could not see evil).
 */
export function awards(pub, recap) {
  const nameOf = (id) => { const p = pub.players.find((x) => x.id === id); return p ? p.name : '?'; };
  const tally = (pick) => { const m = new Map(); for (const q of recap) { const id = pick(q); if (id) m.set(id, (m.get(id) || 0) + 1); } return [...m].sort((x, y) => y[1] - x[1])[0]; };
  const out = [];
  const blamed = tally((q) => (q.outcome === 'fail' ? q.culprit : null));
  const framed = tally((q) => (q.outcome === 'fail' && q.framed ? q.culprit : null));
  const hero = tally((q) => (q.outcome === 'success' ? q.hero : null));
  if (hero) out.push(`★ Hero of the realm: ${nameOf(hero[0])}${hero[1] > 1 ? ` (${hero[1]} quests)` : ''}`);
  if (framed) out.push(`★ Scapegoat: ${nameOf(framed[0])}, framed ${framed[1] === 1 ? 'once' : `${framed[1]} times`} and completely innocent`);
  if (blamed && !(framed && framed[0] === blamed[0] && framed[1] === blamed[1])) out.push(`★ Walking disaster: ${nameOf(blamed[0])} (${blamed[1]} ${blamed[1] === 1 ? 'catastrophe' : 'catastrophes'})`);
  const eye = sharpestEye(pub);
  if (eye) out.push(`★ Sharpest eye: ${nameOf(eye.id)}, who read ${eye.right} of ${eye.of} teams right`);
  return out;
}
