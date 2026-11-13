// Server-side Avalon rules: role assignment, knowledge, quest resolution (incl. framing).
// Everything here is pure (state in, state out); randomness comes from an injected rng.
import {
  EVIL_COUNT, ROLES, failsRequired, isEvilRole, normalizeRoleConfig, validateRoleConfig,
} from '../shared/avalon.js';

export { validateRoleConfig, normalizeRoleConfig };

/** The multiset of roles for a game of `n` players. */
export function buildRoleList(n, cfgIn) {
  const v = validateRoleConfig(n, cfgIn);
  if (!v.ok) throw new Error(v.errors.join(' '));
  const cfg = v.config;
  const evil = ['assassin', 'morgana', 'mordred', 'oberon'].filter((r) => cfg[r]);
  while (evil.length < EVIL_COUNT[n]) evil.push('minion');
  const good = ['merlin', 'percival'].filter((r) => cfg[r]);
  while (good.length < n - EVIL_COUNT[n]) good.push('loyal');
  return [...good, ...evil];
}

/** Randomly deal roles to player ids. Returns Map id -> role id. */
export function assignRoles(playerIds, cfg, rng) {
  const roles = rng.shuffle(buildRoleList(playerIds.length, cfg));
  return new Map(playerIds.map((id, i) => [id, roles[i]]));
}

/**
 * What a player is allowed to know at the role reveal (see goals §4).
 * Returns { role, team, kind, knows: [id...], note }.
 *  kind: 'none' | 'evil' (Merlin's view) | 'allies' (evil view) | 'merlins' (Percival's view)
 * `knows` is sorted by player id order given by `order` so it can't leak role order.
 */
export function knowledgeFor(selfId, assignment, order = [...assignment.keys()]) {
  const role = assignment.get(selfId);
  const team = ROLES[role].team;
  const ids = order.filter((id) => id !== selfId);
  const roleOf = (id) => assignment.get(id);
  let kind = 'none';
  let knows = [];
  let note = '';
  if (role === 'merlin') {
    kind = 'evil';
    knows = ids.filter((id) => isEvilRole(roleOf(id)) && roleOf(id) !== 'mordred');
    note = 'These players are evil. Guide your team without being found out.';
  } else if (role === 'percival') {
    kind = 'merlins';
    knows = ids.filter((id) => roleOf(id) === 'merlin' || roleOf(id) === 'morgana');
    const hasMorgana = [...assignment.values()].includes('morgana');
    note = hasMorgana
      ? 'One of these is Merlin and one is Morgana. You do not know which is which.'
      : 'This is Merlin.';
  } else if (team === 'evil' && role !== 'oberon') {
    kind = 'allies';
    knows = ids.filter((id) => isEvilRole(roleOf(id)) && roleOf(id) !== 'oberon');
    note = knows.length ? 'These are your fellow saboteurs.' : 'You have no known allies.';
  } else if (role === 'oberon') {
    note = 'You work alone. The other saboteurs do not know you, and you do not know them.';
  } else if (role === 'loyal') {
    note = 'You know nothing. Trust your instincts.';
  }
  return { role, team, kind, knows, note };
}

/**
 * Resolve a finished quest.
 *  cards: Map id -> 'success' | 'fail'; picks: Map id -> id of the "who stood out" nominee.
 *  Failed quest: exactly one culprit, drawn from the framing picks of players who played Fail.
 *  Successful quest: one hero, drawn from the nominations of players who played Success.
 * The fail count is returned but is only ever shown publicly in Classic mode.
 */
export function resolveQuest({ playerCount, questIndex, cards, picks, rng }) {
  const failers = [...cards].filter(([, c]) => c === 'fail').map(([id]) => id);
  const successers = [...cards].filter(([, c]) => c !== 'fail').map(([id]) => id);
  const failCount = failers.length;
  const outcome = failCount >= failsRequired(playerCount, questIndex) ? 'fail' : 'success';
  let culprit = null;
  let hero = null;
  if (outcome === 'fail') {
    // Fail-players' picks are framing targets. Duplicates stay in the pool (a pick named twice is likelier).
    culprit = rng.pick(failers.map((id) => picks.get(id)));
  } else {
    // Success-players' picks are hero nominations. (A lone hidden Fail on a two-fail quest is excluded.)
    hero = rng.pick(successers.map((id) => picks.get(id)));
  }
  return { outcome, failCount, culprit, hero, failers, successers };
}

/** Who wins once quests are tallied. Returns null while undecided. */
export function tally(results, assassinationEnabled) {
  const s = results.filter((r) => r.outcome === 'success').length;
  const f = results.filter((r) => r.outcome === 'fail').length;
  if (f >= 3) return { winner: 'evil', reason: 'quests' };
  if (s >= 3) return assassinationEnabled ? { pending: 'assassination' } : { winner: 'good', reason: 'quests' };
  return null;
}
