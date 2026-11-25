// The Record: every proposal, every vote and every quest outcome so far, laid out as one board (players down the
// side, proposals across, grouped by quest). It is the table's shared memory, so the TV keeps it on screen and every
// phone shows it while people argue. Pure and shared by both. Public knowledge only: proposals once their votes are
// revealed, quest results once their cutscene has ended, and roles only after the game (pub.reveal).
import { QUEST_COUNT, failsRequired, teamSize } from './avalon.js';

/**
 * @typedef {{ vote: 'yes'|'no'|'in'|null, onTeam: boolean, leader: boolean }} Cell
 *   vote: 'yes'/'no' once revealed, 'in' = has voted but the vote is still face-down, null = nothing yet
 * @typedef {{ key: string, questIndex: number, attempt: number, leader: string, team: string[], approved: boolean|null,
 *   live: boolean, yes: number, no: number, outcome: 'success'|'fail'|null }} Column
 *   live = the proposal being voted on right now; outcome = how the quest went, for the proposal that was sent
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
  }));
  // the team on the table right now: names are public, votes stay face-down until everyone is in
  if (pub.phase === 'vote' && g.team && g.team.length) {
    cols.push({ questIndex: g.questIndex, leader: g.leader, team: g.team, votes: null, voted: g.voted || [], approved: null, live: true });
  }
  const attempts = {};
  const columns = cols.map((c, i) => {
    const attempt = (attempts[c.questIndex] = (attempts[c.questIndex] || 0) + 1);
    const yes = c.votes ? pub.players.filter((p) => c.votes[p.id] === true).length : 0;
    const no = c.votes ? pub.players.filter((p) => c.votes[p.id] === false).length : 0;
    const r = c.approved ? resultOf(c.questIndex) : null;
    return { key: `c${i}`, questIndex: c.questIndex, attempt, leader: c.leader, team: c.team.slice(), approved: c.approved, live: c.live, yes, no, outcome: r ? r.outcome : null };
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
    }));
    const went = results.filter((r) => (r.team || []).includes(p.id)).map((r) => r.outcome);
    return {
      id: p.id, name: p.name, color: p.color, cls: p.cls,
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
  const who = col.team.map(nameOf);
  const team = who.length <= 1 ? who.join('') : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;
  const head = `Quest ${col.questIndex + 1}, proposal ${col.attempt}: ${nameOf(col.leader)} proposed ${team}.`;
  if (col.live) return `${head} Voting now.`;
  const verdict = `${col.approved ? 'Approved' : 'Rejected'} ${col.yes} to ${col.no}.`;
  const outcome = col.outcome === 'success' ? ' The quest succeeded.' : col.outcome === 'fail' ? ' The quest failed.' : '';
  return `${head} ${verdict}${outcome}`;
}
