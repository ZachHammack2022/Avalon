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
 * At game over, every player's votes read against the roles, in seat order, for the full record: [{id, evil, right,
 * of}]. For a good player `right` is how many teams they read right; for an evil player it is how often they voted the
 * way a good player who knew everything would have (their cover). Players with no counted votes are left out.
 */
export function voteReport(pub) {
  const reads = voteReads(pub);
  if (!reads) return null;
  return pub.players.filter((p) => reads[p.id] && reads[p.id].of)
    .map((p) => ({ id: p.id, evil: EVIL_ROLES.has(pub.reveal.roles[p.id]), right: reads[p.id].right, of: reads[p.id].of }));
}

/**
 * The case against a proposed team, read off the record in one line: who on it went on a failed quest and who voted to
 * send a failed team from outside it. "Bo went on 1 failed quest. Cy voted to send 1 failed team." Says the team is
 * clean when nobody on it has either, and nothing at all before any quest has failed. `nameOf(id)` -> display name.
 */
export function teamCase(pub, team, nameOf) {
  const g = pub && pub.game;
  const fails = ((g && g.results) || []).filter((r) => r.outcome === 'fail');
  if (!fails.length || !Array.isArray(team) || !team.length) return null;
  const backed = backedFailures(pub);
  const n = (k, what) => `${k} failed ${what}${k === 1 ? '' : 's'}`;
  const marked = team.map((id) => ({ id, went: fails.filter((r) => r.team.includes(id)).length, b: backed[id] || 0 })).filter((x) => x.went || x.b);
  if (!marked.length) return 'Nobody on this team went on or voted for a failed quest.';
  // more than two names would not fit a line on the TV: name them, and leave the counts to the record beside it
  if (marked.length > 2) return `${list(marked.map((x) => nameOf(x.id)))} all went on or voted for failed quests.`;
  return marked.map(({ id, went, b }) => `${nameOf(id)} ${[went ? `went on ${n(went, 'quest')}` : null, b ? `voted to send ${n(b, 'team')}` : null].filter(Boolean).join(' and ')}.`).join(' ');
}

/**
 * While a leader picks a team: who the record has nothing against, in one line. "Never on or behind a failed quest:
 * Bo and Dee." A player counts when they went on no failed quest and voted to send no failed team from outside it.
 * Nothing before any quest has failed. `nameOf(id)` -> display name.
 */
export function cleanText(pub, nameOf) {
  const g = pub && pub.game;
  const fails = ((g && g.results) || []).filter((r) => r.outcome === 'fail');
  if (!fails.length) return null;
  const backed = backedFailures(pub);
  const clean = pub.players.filter((p) => !backed[p.id] && !fails.some((r) => r.team.includes(p.id)));
  if (!clean.length) return 'Everyone has gone on or voted for a failed quest.';
  return `Never on or behind a failed quest: ${list(clean.map((p) => nameOf(p.id)))}.`;
}

/**
 * Right after a quest fails, who voted to send that team without being on it, in one line: "Voted to send it from
 * outside the team: Bo and Dee." Stand-in votes are left out. `r` is the quest's result (or cutscene payload) with
 * questIndex and team. Null for a success or when the team's vote is not on the record.
 */
export function sentByText(pub, r, nameOf) {
  const g = pub && pub.game;
  if (!r || r.outcome !== 'fail' || !g || !Array.isArray(g.history)) return null;
  const sent = g.history.filter((h) => h.questIndex === r.questIndex && h.approved).pop();
  if (!sent) return null;
  const ids = pub.players.map((p) => p.id).filter((id) => sent.votes[id] && !sent.team.includes(id) && !(sent.standIn && sent.standIn.includes(id)));
  return ids.length ? `Voted to send it from outside the team: ${list(ids.map(nameOf))}.` : 'Nobody outside the team voted to send it.';
}

/**
 * How each player voted on the teams that went and failed: {id: {against, of}}. Votes on a team the player was on
 * (everyone approves those) and votes a stand-in cast for an absent player are left out, and only quests whose result
 * is public count. Merlin sees evil, so Merlin tends to vote against teams that go on to fail.
 */
export function failedTeamVotes(pub) {
  const g = pub && pub.game;
  const out = {};
  if (!g || !Array.isArray(g.history)) return out;
  for (const r of g.results || []) {
    if (r.outcome !== 'fail') continue;
    const sent = g.history.filter((h) => h.questIndex === r.questIndex && h.approved).pop();
    if (!sent) continue;
    for (const [id, yes] of Object.entries(sent.votes || {})) {
      if (sent.team.includes(id) || (sent.standIn && sent.standIn.includes(id))) continue;
      const v = out[id] || (out[id] = { against: 0, of: 0 });
      v.of++;
      if (!yes) v.against++;
    }
  }
  return out;
}

/**
 * How many failed teams each player voted to send without going on them: {id: n}. Evil players wave their allies'
 * teams through, so this is evidence the table can use when picking a team. Same rules as failedTeamVotes.
 */
export function backedFailures(pub) {
  const out = {};
  for (const [id, v] of Object.entries(failedTeamVotes(pub))) if (v.of > v.against) out[id] = v.of - v.against;
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
 * The evil player whose votes looked most like a good player's, for a game-over award: {id, right, of}, where `right`
 * counts the votes that matched what a good player who knew everything would have cast (so voting down a team with an
 * ally on it counts). At least three counted votes, more than half of them that way (an evil player who backs an ally's
 * team now and then still has good cover); ties go to the earlier seat.
 */
export function bestDisguise(pub) {
  const reads = voteReads(pub);
  if (!reads) return null;
  let best = null;
  for (const p of pub.players) {
    const role = pub.reveal.roles[p.id]; const r = reads[p.id];
    if (!r || !EVIL_ROLES.has(role) || r.of < 3 || r.right * 2 <= r.of) continue;
    if (!best || r.right > best.right || (r.right === best.right && r.of < best.of)) best = { id: p.id, ...r };
  }
  return best;
}

/**
 * End-of-game superlatives, for the TV card and every phone, read from the votes alone (quests are won and lost by
 * the whole team, so no quest result singles anyone out): the sharpest eye (best votes among good players who could
 * not see evil) and the best disguise (the evil player whose votes looked most like Good's).
 */
export function awards(pub) {
  const nameOf = (id) => { const p = pub.players.find((x) => x.id === id); return p ? p.name : '?'; };
  const out = [];
  const eye = sharpestEye(pub);
  if (eye) out.push(`★ Sharpest eye: ${nameOf(eye.id)}, who read ${eye.right} of ${eye.of} teams right`);
  const cover = bestDisguise(pub);
  if (cover) out.push(`★ Best disguise: ${nameOf(cover.id)}, who voted like Good on ${cover.right} of ${cover.of} teams`);
  return out;
}
