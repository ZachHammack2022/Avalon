// Bot decisions (goals §10). Every function takes `ctx` (what a bot may know) and an rng.
// Bots never peek at hidden info beyond their own role knowledge.

const NAMES = ['Barnaby', 'Mabel', 'Gruff', 'Pip', 'Dorothea', 'Wilfred', 'Tansy', 'Ox', 'Fennel', 'Bramble', 'Nettle', 'Quill'];
export const botNames = () => NAMES.slice();

/**
 * How much a good bot distrusts a player, from what it may know: the record (every failed quest they went on) and,
 * for Merlin, who is evil. 0 = nothing against them.
 */
export function distrust(ctx, id) {
  if (id === ctx.selfId) return 0;
  const failed = (ctx.failedWith && ctx.failedWith[id]) || 0;
  const seen = ctx.evilSeen && ctx.evilSeen.includes(id) ? 3 : 0;
  return failed + seen;
}

/**
 * Distrust for picking a team: the above, plus half a point for every failed quest a player voted to send without
 * going on it (evil players wave their allies' teams through). Votes still go by distrust alone. In bot-only games
 * this lifts good's win rate by two to four points at every table size.
 */
export function pickDistrust(ctx, id) {
  return distrust(ctx, id) + 0.5 * ((ctx.backedFail && ctx.backedFail[id]) || 0);
}

/** ctx: { selfId, team: 'good'|'evil', allyIds: [], size, playerIds, rng, failedWith?: {id: n}, backedFail?: {id: n}, evilSeen?: [] } */
export function botPropose(ctx) {
  const { selfId, size, playerIds, rng } = ctx;
  const others = playerIds.filter((id) => id !== selfId);
  const team = [selfId];
  if (ctx.team === 'good') {
    // good bots read the record: the people they trust most go first (ties broken at random)
    const ranked = rng.shuffle(others).map((id, i) => ({ id, i, d: pickDistrust(ctx, id) })).sort((a, b) => a.d - b.d || a.i - b.i);
    return team.concat(ranked.slice(0, size - 1).map((x) => x.id));
  }
  const evilKnown = ctx.team === 'evil' ? ctx.allyIds : [];
  if (ctx.team === 'evil' && evilKnown.length && size > 1) {
    // Evil bots prefer including one evil player (here: self counts, plus sometimes an ally).
    // "Including one evil player" is satisfied by self; also try to add exactly one ally half the time.
    if (rng.chance(0.5)) team.push(rng.pick(evilKnown));
  }
  const pool = others.filter((id) => !team.includes(id));
  // Evil bots: avoid stuffing the team with allies beyond the one above.
  const filtered = ctx.team === 'evil' ? pool.filter((id) => !evilKnown.includes(id)) : pool;
  const fillFrom = rng.shuffle(filtered.length >= size - team.length ? filtered : pool);
  while (team.length < size && fillFrom.length) team.push(fillFrom.shift());
  return team.slice(0, size);
}

/** How often an evil bot approves a team: with a known ally on it, clean with someone the record speaks against, clean. */
export const EVIL_VOTE = { ally: 0.85, suspect: 0.1, clean: 0.2 };

/** ctx: { selfId, team, role?, allyIds, proposedTeam, rejectCount, rng, failedWith?, evilSeen? } */
export function botVote(ctx) {
  const { selfId, proposedTeam, rejectCount, rng } = ctx;
  if (rejectCount >= 4) return true; // fifth proposal: everyone approves
  if (proposedTeam.includes(selfId)) return true;
  if (ctx.team === 'evil') {
    // An ally's team is usually waved through, but not always, and a clean team now and then: a bot that rejected
    // every clean team and approved every ally's would be named by the record (the vote board, the clean line).
    if (proposedTeam.some((id) => ctx.allyIds.includes(id))) return rng.chance(EVIL_VOTE.ally);
    const worst = Math.max(0, ...proposedTeam.map((id) => distrust({ ...ctx, evilSeen: null }, id)));
    return rng.chance(worst > 0 ? EVIL_VOTE.suspect : EVIL_VOTE.clean);
  }
  // good: a team with someone the record (or Merlin's sight) speaks against is usually rejected
  const worst = Math.max(0, ...proposedTeam.map((id) => distrust(ctx, id)));
  // Merlin keeps their sight quiet: always voting down a team the record has nothing against is exactly what an
  // Assassin looks for, so against such a team Merlin votes no only half the time
  const onRecord = proposedTeam.some((id) => ctx.failedWith && ctx.failedWith[id]);
  if (ctx.role === 'merlin' && worst >= 3 && !onRecord) return rng.chance(0.5);
  if (worst >= 3) return rng.chance(0.1);
  if (worst > 0) return rng.chance(0.3);
  return rng.chance(0.5);
}

/** ctx: { selfId, team, teamIds, lastTeamFailed, rng } -> 'success' | 'fail' */
export function botCard(ctx) {
  if (ctx.team !== 'evil') return 'success';
  const p = ctx.lastTeamFailed ? 0.35 : 0.7;
  return ctx.rng.chance(p) ? 'fail' : 'success';
}

/** Framing target (Fail) or hero nomination (Success): a random good-looking teammate, else anyone. */
export function botPick(ctx) {
  const { selfId, teamIds, card, rng } = ctx;
  if (card === 'fail') {
    const goodish = teamIds.filter((id) => id !== selfId && !ctx.allyIds.includes(id));
    return rng.pick(goodish.length ? goodish : teamIds);
  }
  return rng.pick(teamIds);
}

/**
 * How much a player played like Merlin, read the way a human Assassin would: from the public vote record and who the
 * Assassin knows is evil. Merlin sees evil, so Merlin tends to vote down teams with evil on them, wave through clean
 * ones and propose clean teams. Each such call scores +1, each call the other way -1. Votes a player cast on a team they
 * were on (everyone approves those) and votes a stand-in cast while they were away say nothing, so they are skipped.
 */
export function merlinScore(ctx, id) {
  const evil = new Set([ctx.selfId, ...ctx.allyIds]);
  const dirty = (team) => team.some((x) => evil.has(x));
  let score = 0;
  for (const h of ctx.history || []) {
    const isDirty = dirty(h.team);
    if (h.leader === id) score += isDirty ? -1 : 1;
    if (h.team.includes(id) || (h.standIn && h.standIn.includes(id)) || !(id in h.votes)) continue;
    score += h.votes[id] === !isDirty ? 1 : -1;
  }
  return score;
}

/**
 * Assassin bot: the player who played most like Merlin (ties broken at random), never itself or a known ally. With no
 * votes to read, a random guess among the rest.
 */
export function botAssassinate(ctx) {
  const { selfId, playerIds, allyIds, rng } = ctx;
  let pool = playerIds.filter((id) => id !== selfId && !allyIds.includes(id));
  if (!pool.length) pool = playerIds.filter((id) => id !== selfId);
  const scored = rng.shuffle(pool).map((id) => ({ id, s: merlinScore(ctx, id) }));
  const best = Math.max(...scored.map((x) => x.s));
  return scored.find((x) => x.s === best).id;
}
