// Bot decisions (goals §10). Every function takes `ctx` (what a bot may know) and an rng.
// Bots never peek at hidden info beyond their own role knowledge.

const NAMES = ['Barnaby', 'Mabel', 'Gruff', 'Pip', 'Dorothea', 'Wilfred', 'Tansy', 'Ox', 'Fennel', 'Bramble', 'Nettle', 'Quill'];
export const botNames = () => NAMES.slice();

/** ctx: { selfId, team: 'good'|'evil', allyIds: [], size, playerIds, rng } */
export function botPropose(ctx) {
  const { selfId, size, playerIds, rng } = ctx;
  const others = playerIds.filter((id) => id !== selfId);
  const team = [selfId];
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

/** ctx: { selfId, team, allyIds, proposedTeam, rejectCount, rng } */
export function botVote(ctx) {
  const { selfId, proposedTeam, rejectCount, rng } = ctx;
  if (rejectCount >= 4) return true; // fifth proposal: everyone approves
  if (proposedTeam.includes(selfId)) return true;
  if (ctx.team === 'evil') {
    // approve if an evil player (known to this bot, or itself) is on the team
    return proposedTeam.some((id) => ctx.allyIds.includes(id));
  }
  return rng.chance(0.65);
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

/** Assassin bot: random among players it doesn't know are evil (and not itself). */
export function botAssassinate(ctx) {
  const { selfId, playerIds, allyIds, rng } = ctx;
  const pool = playerIds.filter((id) => id !== selfId && !allyIds.includes(id));
  return rng.pick(pool.length ? pool : playerIds.filter((id) => id !== selfId));
}
