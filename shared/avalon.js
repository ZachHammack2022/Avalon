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
  loyal:    { id: 'loyal',    name: 'Loyal Servant', team: 'good', special: false },
  merlin:   { id: 'merlin',   name: 'Merlin',        team: 'good', special: true },
  percival: { id: 'percival', name: 'Percival',      team: 'good', special: true },
  minion:   { id: 'minion',   name: 'Minion',        team: 'evil', special: false },
  assassin: { id: 'assassin', name: 'Assassin',      team: 'evil', special: true },
  morgana:  { id: 'morgana',  name: 'Morgana',       team: 'evil', special: true },
  mordred:  { id: 'mordred',  name: 'Mordred',       team: 'evil', special: true },
  oberon:   { id: 'oberon',   name: 'Oberon',        team: 'evil', special: true },
};

export const isEvilRole = (r) => ROLES[r].team === 'evil';

/** Lobby role toggles. Merlin + Assassin default on. */
export const DEFAULT_ROLE_CONFIG = Object.freeze({
  merlin: true, assassin: true, percival: false, morgana: false, mordred: false, oberon: false,
});
export const ROLE_TOGGLES = Object.keys(DEFAULT_ROLE_CONFIG);

/** The Assassin is forced on whenever Merlin is on. Unknown keys are dropped. */
export function normalizeRoleConfig(cfg = {}) {
  const out = { ...DEFAULT_ROLE_CONFIG };
  for (const k of ROLE_TOGGLES) if (k in cfg) out[k] = !!cfg[k];
  if (out.merlin) out.assassin = true;
  return out;
}

export function validateRoleConfig(playerCount, cfgIn) {
  const cfg = normalizeRoleConfig(cfgIn);
  const errors = [];
  const warnings = [];
  if (!(playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS)) {
    errors.push(`Avalon needs ${MIN_PLAYERS}-${MAX_PLAYERS} players (have ${playerCount}).`);
  } else {
    const specialEvil = ['assassin', 'morgana', 'mordred', 'oberon'].filter((r) => cfg[r]).length;
    if (specialEvil > EVIL_COUNT[playerCount]) {
      errors.push(`Too many evil roles: ${specialEvil} selected, but ${playerCount} players have only ${EVIL_COUNT[playerCount]} evil.`);
    }
    const specialGood = ['merlin', 'percival'].filter((r) => cfg[r]).length;
    if (specialGood > goodCount(playerCount)) errors.push('Too many good roles for this player count.');
  }
  if (cfg.percival && !cfg.merlin) errors.push('Percival needs Merlin.');
  if (cfg.morgana && !cfg.merlin) errors.push('Morgana needs Merlin.');
  if (cfg.morgana && !cfg.percival) warnings.push('Morgana without Percival has no one to fool.');
  if (!cfg.merlin && cfg.assassin) warnings.push('The Assassin has no Merlin to hunt, so they act as a plain Minion.');
  return { ok: errors.length === 0, errors, warnings, config: cfg };
}
