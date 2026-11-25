// Server-side Avalon rules: role assignment, knowledge, quest resolution.
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
  const inPlay = (r) => [...assignment.values()].includes(r);
  let kind = 'none';
  let knows = [];
  let note = '';
  if (role === 'merlin') {
    kind = 'evil';
    knows = ids.filter((id) => isEvilRole(roleOf(id)) && roleOf(id) !== 'mordred');
    note = `These players are evil.${inPlay('mordred') ? ' Mordred is evil too, but hidden from you.' : ''} Guide your team without being found out.`;
  } else if (role === 'percival') {
    kind = 'merlins';
    knows = ids.filter((id) => roleOf(id) === 'merlin' || roleOf(id) === 'morgana');
    note = inPlay('morgana')
      ? 'One of these is Merlin and one is Morgana. You do not know which is which.'
      : 'This is Merlin.';
  } else if (team === 'evil' && role !== 'oberon') {
    kind = 'allies';
    knows = ids.filter((id) => isEvilRole(roleOf(id)) && roleOf(id) !== 'oberon');
    note = knows.length ? 'These are your fellow Minions of Mordred.' : 'You have no known allies.';
    if (inPlay('oberon')) note += ' Oberon is evil too, but hidden from you.';
  } else if (role === 'oberon') {
    note = 'You work alone. The other Minions do not know you, and you do not know them.';
  } else if (role === 'loyal') {
    note = 'You know nothing. Trust your instincts.';
  }
  return { role, team, kind, knows, note };
}

/**
 * Resolve a finished quest. cards: Map id -> 'success' | 'fail'.
 * The whole team succeeds or fails together: nobody on it is singled out. The fail count is returned but is only
 * ever shown publicly in Classic mode.
 */
export function resolveQuest({ playerCount, questIndex, cards }) {
  const failCount = [...cards.values()].filter((c) => c === 'fail').length;
  const outcome = failCount >= failsRequired(playerCount, questIndex) ? 'fail' : 'success';
  return { outcome, failCount };
}

/** Who wins once quests are tallied. Returns null while undecided. */
export function tally(results, assassinationEnabled) {
  const s = results.filter((r) => r.outcome === 'success').length;
  const f = results.filter((r) => r.outcome === 'fail').length;
  if (f >= 3) return { winner: 'evil', reason: 'quests' };
  if (s >= 3) return assassinationEnabled ? { pending: 'assassination' } : { winner: 'good', reason: 'quests' };
  return null;
}
