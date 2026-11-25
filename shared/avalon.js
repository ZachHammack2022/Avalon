// Avalon tables and pure rule helpers. Imported by the server AND the TV.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const QUESTS_TO_WIN = 3;
export const MAX_REJECTS = 5;
export const QUEST_COUNT = 5;

/** players -> number of evil players */
export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };

/** players -> team size for each of the five quests */
export const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export const evilCount = (n) => EVIL_COUNT[n];
export const goodCount = (n) => n - EVIL_COUNT[n];
export const teamSize = (n, questIndex) => TEAM_SIZES[n][questIndex];

/** Quest 4 (index 3) needs two Fail cards at 7+ players. Everything else fails on one. */
export function failsRequired(n, questIndex) {
  return questIndex === 3 && n >= 7 ? 2 : 1;
}

export const PHASES = [
  'lobby', 'roleReveal', 'propose', 'vote', 'voteReveal', 'questPlay',
  'cutscene', 'questResult', 'assassination', 'gameover',
];

/** Role id -> metadata. `evil` roles are the ones the Assassin/evil team count. */
export const ROLES = {
  loyal:        { id: 'loyal',        name: 'Loyal Servant', team: 'good', special: false },
  merlin:       { id: 'merlin',       name: 'Merlin',        team: 'good', special: true },
  percival:     { id: 'percival',     name: 'Percival',      team: 'good', special: true },
  goodlancelot: { id: 'goodlancelot', name: 'Good Lancelot', team: 'good', special: true },
  minion:       { id: 'minion',       name: 'Minion',        team: 'evil', special: false },
  assassin:     { id: 'assassin',     name: 'Assassin',      team: 'evil', special: true },
  morgana:      { id: 'morgana',      name: 'Morgana',       team: 'evil', special: true },
  mordred:      { id: 'mordred',      name: 'Mordred',       team: 'evil', special: true },
  oberon:       { id: 'oberon',       name: 'Oberon',        team: 'evil', special: true },
  evillancelot: { id: 'evillancelot', name: 'Evil Lancelot', team: 'evil', special: true },
};

export const isEvilRole = (r) => ROLES[r].team === 'evil';

/**
 * The host's role toggles, and the role cards each one puts in the deck. Lancelot is one toggle for two cards: Good
 * Lancelot takes a good seat and Evil Lancelot an evil one.
 */
export const TOGGLE_ROLES = {
  merlin: ['merlin'], assassin: ['assassin'], percival: ['percival'], morgana: ['morgana'], mordred: ['mordred'],
  oberon: ['oberon'], lancelot: ['goodlancelot', 'evillancelot'],
};

/** Merlin + Assassin is the plain baseline every partial config is read against. */
export const DEFAULT_ROLE_CONFIG = Object.freeze({
  merlin: true, assassin: true, percival: false, morgana: false, mordred: false, oberon: false, lancelot: false,
});
export const ROLE_TOGGLES = Object.keys(DEFAULT_ROLE_CONFIG);

const cfgOf = (on) => Object.freeze({ ...DEFAULT_ROLE_CONFIG, ...Object.fromEntries(on.map((k) => [k, true])) });
/**
 * The roles a new room starts with, by player count, so a host can just press Start: Merlin and Percival against the
 * Assassin and Morgana, then Oberon, a plain Minion, Mordred and finally both as the table grows. Lancelot is left for
 * the host to add.
 */
export const RECOMMENDED_ROLES = {
  5: cfgOf(['percival', 'morgana']),
  6: cfgOf(['percival', 'morgana']),
  7: cfgOf(['percival', 'morgana', 'oberon']),
  8: cfgOf(['percival', 'morgana']),
  9: cfgOf(['percival', 'morgana', 'mordred']),
  10: cfgOf(['percival', 'morgana', 'mordred', 'oberon']),
};
/** The recommended roles for `n` players (the 5-player set below 5, the 10-player set above 10). */
export const recommendedRoles = (n) => RECOMMENDED_ROLES[Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n || 0))];

/** The Assassin is forced on whenever Merlin is on. Unknown keys are dropped. */
export function normalizeRoleConfig(cfg = {}) {
  const out = { ...DEFAULT_ROLE_CONFIG };
  for (const k of ROLE_TOGGLES) if (k in cfg) out[k] = !!cfg[k];
  if (out.merlin) out.assassin = true;
  return out;
}

/** The special role cards a config puts in the deck, good ones first, in the usual order. */
export function specialRoles(cfgIn) {
  const cfg = normalizeRoleConfig(cfgIn);
  const on = ROLE_TOGGLES.filter((k) => cfg[k]).flatMap((k) => TOGGLE_ROLES[k]);
  return [...on.filter((r) => !isEvilRole(r)), ...on.filter(isEvilRole)];
}

export function validateRoleConfig(playerCount, cfgIn) {
  const cfg = normalizeRoleConfig(cfgIn);
  const errors = [];
  const warnings = [];
  const specials = specialRoles(cfg);
  if (!(playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS)) {
    errors.push(`Avalon needs ${MIN_PLAYERS}-${MAX_PLAYERS} players (have ${playerCount}).`);
  } else {
    const specialEvil = specials.filter(isEvilRole).length;
    if (specialEvil > EVIL_COUNT[playerCount]) {
      errors.push(`Too many evil roles: ${specialEvil} selected, but ${playerCount} players have only ${EVIL_COUNT[playerCount]} evil.`);
    }
    const specialGood = specials.filter((r) => !isEvilRole(r)).length;
    if (specialGood > goodCount(playerCount)) errors.push('Too many good roles for this player count.');
    if (cfg.lancelot && playerCount < 7) warnings.push('Lancelot is meant for 7 or more players.');
  }
  if (cfg.percival && !cfg.merlin) errors.push('Percival needs Merlin.');
  if (cfg.morgana && !cfg.merlin) errors.push('Morgana needs Merlin.');
  if (cfg.morgana && !cfg.percival) warnings.push('Morgana without Percival has no one to fool.');
  if (!cfg.merlin && cfg.assassin) warnings.push('The Assassin has no Merlin to hunt, so they act as a plain Minion.');
  if (!cfg.merlin && cfg.mordred) warnings.push('Mordred hides from Merlin, so without Merlin Mordred plays as a plain Minion.');
  return { ok: errors.length === 0, errors, warnings, config: cfg };
}

/**
 * Every role card in a game of `n` players, good first: the special roles, then Loyal Servants and Minions to fill.
 * Public: everyone at the table may know which cards are in the deck. Throws on an invalid config.
 */
export function buildRoleList(n, cfgIn) {
  const v = validateRoleConfig(n, cfgIn);
  if (!v.ok) throw new Error(v.errors.join(' '));
  const specials = specialRoles(v.config);
  const good = specials.filter((r) => !isEvilRole(r));
  while (good.length < n - EVIL_COUNT[n]) good.push('loyal');
  const evil = specials.filter(isEvilRole);
  while (evil.length < EVIL_COUNT[n]) evil.push('minion');
  return [...good, ...evil];
}
