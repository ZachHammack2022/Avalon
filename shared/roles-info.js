// Player-facing role descriptions (phone role card, TV game-over reveal) and the public view of the deck.
import { EVIL_COUNT, MIN_PLAYERS, MAX_PLAYERS, ROLES, TOGGLE_ROLES, isEvilRole } from './avalon.js';

export const ROLE_INFO = {
  loyal:        { name: 'Loyal Servant', team: 'good', icon: '🛡️', blurb: 'You are loyal to the crown. Find the Minions of Mordred.' },
  merlin:       { name: 'Merlin', team: 'good', icon: '🧙', blurb: 'You see the Minions of Mordred. Guide your team without being found out, or the Assassin will end you.' },
  percival:     { name: 'Percival', team: 'good', icon: '🗡️', blurb: 'You can see Merlin and Morgana, but not which is which.' },
  goodlancelot: { name: 'Good Lancelot', team: 'good', icon: '🐎', blurb: 'You know who Evil Lancelot is, and Evil Lancelot knows you. Keep your rival off the quests.' },
  minion:       { name: 'Minion', team: 'evil', icon: '😈', blurb: 'You serve Mordred. Fail quests without being caught.' },
  assassin:     { name: 'Assassin', team: 'evil', icon: '🔪', blurb: 'If good wins three quests, you get one guess at who Merlin is.' },
  morgana:      { name: 'Morgana', team: 'evil', icon: '🧛', blurb: 'You appear to Percival as a possible Merlin. Make Percival doubt.' },
  mordred:      { name: 'Mordred', team: 'evil', icon: '👿', blurb: 'Merlin cannot see you. Stay hidden in plain sight.' },
  oberon:       { name: 'Oberon', team: 'evil', icon: '👻', blurb: 'You work alone. The other Minions do not know you, and you do not know them. Merlin sees you.' },
  evillancelot: { name: 'Evil Lancelot', team: 'evil', icon: '🏴', blurb: 'The other Minions know you are evil, but you do not know them. Good Lancelot knows exactly who you are.' },
};

/** The special role cards, in the order they are listed everywhere. */
export const SPECIAL_ROLES = ['merlin', 'percival', 'goodlancelot', 'assassin', 'morgana', 'mordred', 'oberon', 'evillancelot'];

/** The host's toggles, in the order the setup screen lists them, with a name and the role whose glyph stands for it. */
export const ROLE_TOGGLE_LIST = [
  { key: 'merlin', name: 'Merlin', icon: 'merlin', team: 'good' },
  { key: 'assassin', name: 'Assassin', icon: 'assassin', team: 'evil' },
  { key: 'percival', name: 'Percival', icon: 'percival', team: 'good' },
  { key: 'morgana', name: 'Morgana', icon: 'morgana', team: 'evil' },
  { key: 'mordred', name: 'Mordred', icon: 'mordred', team: 'evil' },
  { key: 'oberon', name: 'Oberon', icon: 'oberon', team: 'evil' },
  { key: 'lancelot', name: 'Lancelot (Good and Evil)', icon: 'goodlancelot', team: 'good' },
];

/** The special role cards switched on in a role config, in the usual order. */
export const rolesInPlay = (roles) => {
  const on = new Set(roles ? Object.keys(TOGGLE_ROLES).filter((k) => roles[k]).flatMap((k) => TOGGLE_ROLES[k]) : []);
  return SPECIAL_ROLES.filter((r) => on.has(r));
};

const andList = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);

/** "Merlin, Assassin and Percival" / "No special roles" for a role config. */
export function rolesText(roles) {
  const on = rolesInPlay(roles).map((k) => ROLE_INFO[k].name);
  return on.length ? andList(on) : 'No special roles';
}

/**
 * The whole deck for `n` players, split by side: { good: [{role, count}], evil: [...], goodCount, evilCount }. The
 * special roles come first, then the Loyal Servants or Minions that fill the side. Null outside 5-10 players. Public
 * knowledge: everyone may know which cards are in the deck, never who holds them.
 */
export function deckFor(n, roles) {
  if (!(n >= MIN_PLAYERS && n <= MAX_PLAYERS)) return null;
  const specials = rolesInPlay(roles);
  const side = (evil) => {
    const sp = specials.filter((r) => isEvilRole(r) === evil);
    const total = evil ? EVIL_COUNT[n] : n - EVIL_COUNT[n];
    const out = sp.map((role) => ({ role, count: 1 }));
    const filler = total - sp.length;
    if (filler > 0) out.push({ role: evil ? 'minion' : 'loyal', count: filler });
    return out;
  };
  return { good: side(false), evil: side(true), goodCount: n - EVIL_COUNT[n], evilCount: EVIL_COUNT[n] };
}

/** "Merlin, Percival and 2 Loyal Servants" for one side of a deck. */
export function sideText(entries) {
  return andList(entries.map(({ role, count }) => {
    if (ROLES[role].special) return ROLE_INFO[role].name;
    const base = role === 'loyal' ? 'Loyal Servant' : 'Minion';
    return `${count} ${base}${count === 1 ? '' : 's'}`;
  }));
}

/** Two lines for the TV and phones: "Good (4): Merlin, Percival and 2 Loyal Servants", "Evil (3): ...". */
export function deckLines(n, roles) {
  const d = deckFor(n, roles);
  if (!d) return [`Roles: ${rolesText(roles)}`];
  return [`Good (${d.goodCount}): ${sideText(d.good)}`, `Evil (${d.evilCount}): ${sideText(d.evil)}`];
}

export const ROLE_TOGGLE_INFO = {
  merlin: 'Merlin knows the Minions of Mordred (but not Mordred).',
  assassin: 'Required with Merlin. Guesses Merlin if good wins.',
  percival: 'Sees Merlin and Morgana, unlabeled.',
  morgana: 'Evil. Looks like Merlin to Percival.',
  mordred: 'Evil. Hidden from Merlin.',
  oberon: 'Evil loner. Unknown to the other evil players.',
  lancelot: 'One Good and one Evil Lancelot who know each other. Best with 7 or more.',
};

export const KNOW_LABELS = {
  evil: 'The Minions of Mordred you can see',
  allies: 'Your fellow Minions of Mordred',
  merlins: 'Merlin and Morgana',
  lancelot: 'The other Lancelot',
};
