// Player guidance for the phone: how to play, role tips, and a one-line "what should I do now" coach.
// Pure data + functions (unit-tested in Node). Only ever uses the viewer's OWN role, so nothing leaks.
import { ROLE_INFO } from '../../shared/roles-info.js';
import { failsRequired, teamSize, MAX_REJECTS } from '../../shared/avalon.js';
import { backedFailures, failedTeamVotes, noToEvil } from '../../shared/record.js';

export const HOW_TO = [
  { h: 'The story', p: 'The Lost Crown has been stolen. Most of you are Loyal Servants of Arthur. Some of you are secret Minions of Mordred. Nobody knows who is who, except the Minions and a few special roles.' },
  { h: 'Winning', p: 'Good wins by completing 3 of 5 quests. Evil wins by sabotaging 3 quests, or if 5 teams in a row get rejected. If good wins, the Assassin still gets one guess at Merlin. A correct guess steals the win.' },
  { h: 'A round', p: 'The leader picks a team. Everyone votes Approve or Reject. If the team is approved, its members secretly play Success or Fail cards. Then watch the TV: the quest plays out as a cutscene.' },
  { h: 'Success and Fail', p: 'Good players can only play Success. Evil players may play Fail. One Fail sinks the quest. (Quest 4 with 7+ players needs two.) The TV shows the outcome, never who played what.' },
  { h: 'Who stood out?', p: 'After playing your card you pick one teammate. On a success, the hero is drawn from the Success players\' picks (more picks, better odds). On a failure, the culprit is drawn from what the Fail players picked, so Evil gets to frame someone!' },
  { h: 'The record', p: 'Every proposal, every vote and every quest result stays on the record, on the TV and on your phone. It is your best evidence: who keeps approving teams that fail, and who was on every failed quest? Beside each name you are asked to pick or vote on, ticks and crosses show the quests that player went on.' },
  { h: 'Talk it out', p: 'Argue, accuse, defend. Say who you trust and why. Lying is part of the game, but only inside the game.' },
];

export const GENERAL_TIPS = {
  good: [
    'Always play Success. You cannot do anything else, and that is the point.',
    'Reject teams that contain someone you do not trust. Include yourself when you can: you know you are good.',
    'Watch who votes to approve risky teams, and who always ends up on failed quests.',
  ],
  evil: [
    'You will usually want to play Fail. A failed quest is how you win.',
    'Hiding matters too: sometimes an early Success buys the trust you need later.',
    'Vote like a good player would. Be a little suspicious of someone else, never too eager.',
    'When you pick who stood out, frame a good player.',
  ],
};

export const ROLE_TIPS = {
  loyal: ['You have no secret info, so your voice and your votes are your power.', 'Trust the team record, not smooth talk.'],
  merlin: ['You know the Minions of Mordred. Steer teams away from them, but not too perfectly.', 'If good wins, the Assassin guesses Merlin. Act a bit clueless.', 'Mordred, if in play, is hidden from you.'],
  percival: ['You see two people: Merlin and Morgana. You do not know which.', 'Watch their votes. Protect the one who acts like the real Merlin.'],
  minion: ['Get yourself or an ally onto teams. Fail when it is safe, or when it wins.', 'Look for the loudest good player: that may be Merlin.'],
  assassin: ['Pay attention all game: the player who steers teams away from your allies is likely Merlin.', 'You get one guess if good wins three quests. Make it count.'],
  morgana: ['Percival sees you as a possible Merlin. Talk like Merlin would.', 'Give Percival reasons to doubt the real one.'],
  mordred: ['Merlin cannot see you, so you can act trustworthy and stay on teams.', 'Be the Minion nobody suspects.'],
  oberon: ['You work alone. Your allies do not know you and you do not know them.', 'Merlin can see you, so be careful. Fail when you can.'],
};

/**
 * Tips for one role as it plays in this game (`cfg` = the room's role toggles; without it, the general tips).
 * The Roles sheet is a public reference, so this depends on the game's roles only, never on anyone's secret.
 */
export function roleTips(role, cfg) {
  if (!cfg) return ROLE_TIPS[role];
  if (role === 'percival' && !cfg.morgana) return ['You see Merlin. Morgana is not in this game, so it really is them.', 'Protect Merlin: back their judgement without making it obvious who they are.'];
  if (role === 'merlin') return ROLE_TIPS.merlin.filter((t) => !t.startsWith('Mordred')).concat(cfg.mordred ? ['Mordred is in this game and hidden from you: one Minion you cannot see.'] : []);
  if (cfg.oberon && ['minion', 'assassin', 'morgana', 'mordred'].includes(role)) return ROLE_TIPS[role].concat(['Oberon is in this game: one of your allies is hidden from you, and does not know you.']);
  return ROLE_TIPS[role];
}

/**
 * Table-safe hint for the screen the player is on: says what to do, never anything that depends on the secret role
 * (anyone glancing at the phone may read it). Returns a string or null.
 */
export function coachFor(screen, state) {
  if (!state || !state.pub) return null;
  const { pub, me } = state; const g = pub.game;
  switch (screen) {
    case 'lobby': return me && me.vip ? 'You are the host. Fill empty seats with bots, choose the roles, then start.' : 'Pick your look. The host starts the game. New here? Tap ? for a one-minute guide.';
    case 'roleReveal': return 'Press and hold the card to look at your role. Shield your screen. Later, hold your name at the top to look again.';
    case 'waitLeader': return 'Talk it over. Tell the leader who you trust.';
    case 'propose': return 'Choose who goes on the quest. Everyone votes on your team next.';
    case 'vote': {
      const left = g ? MAX_REJECTS - g.rejectCount : MAX_REJECTS;
      return left <= 1 ? 'Last chance: if this team is rejected, Evil wins the game.' : 'Approve to send this team. Reject to pass the crown to the next leader.';
    }
    case 'voted': return 'Votes are revealed together once everyone is in.';
    case 'quest-card': return 'Play one card face-down. Good always plays Success, whichever card is tapped. Only Evil can truly Fail.';
    case 'quest-pick': return 'Pick one teammate (or yourself). The story on the TV singles out one of the players who got picked.';
    case 'quest-done': case 'watchQuest': return 'The cards are being played in secret.';
    case 'assassinate': return 'One guess. Name Merlin and Evil steals the win.';
    case 'waitAssassin': return 'Evil gets one guess at Merlin. Good wins only if they miss.';
    default: return null;
  }
}

/**
 * Secret advice for the same moment, based on the player's own role. Only ever shown behind hold-to-reveal.
 */
export function counselFor(screen, state) {
  if (!state || !state.pub || !state.me || !state.me.role) return null;
  const { pub, me } = state;
  const role = me.role; const team = ROLE_INFO[role].team; const evil = team === 'evil';
  const g = pub.game; const n = pub.players.length;
  switch (screen) {
    case 'roleReveal': return evil ? 'Remember your allies. From now on, act like a loyal servant.' : role === 'merlin' ? 'Remember these faces. Guide the others without giving yourself away.' : 'You are loyal. Trust has to be earned: watch the votes and the quests.';
    case 'waitLeader': return evil ? 'Hope for a Minion on the team, but do not look hopeful.' : 'Watch who the leader picks, and who they leave out.';
    case 'propose': return evil ? 'Put at least one Minion of Mordred on the team (maybe you), without making it obvious.' : role === 'merlin' ? 'Pick players you know are good, but do not be too perfect or the Assassin will notice.' : 'Pick yourself and the players you trust most. You know you are loyal.';
    case 'vote': return evil ? 'Approve if a Minion is on the team, but not every time: the record counts who voted to send failed teams.' : role === 'merlin' ? 'Reject teams with a Minion on them, but have a reason ready.' : 'Approve teams you trust. Reject if anyone on it worries you.';
    case 'quest-card': {
      if (!evil) return 'You are Good: your card is always played as Success, whichever one you tap.';
      const need = g ? failsRequired(n, g.questIndex) : 1;
      return `You usually want to play Fail. ${need > 1 ? 'This quest needs TWO Fails, so it only sinks if another Minion fails too. ' : ''}If you are the only Minion here, a Success now can buy trust for later.`;
    }
    case 'quest-pick': return evil ? 'If the quest fails, a Fail player\'s pick decides who is framed. Pick a Good player.' : 'Pick whoever impressed you. On a success the hero is drawn from the Success players\' picks.';
    case 'assassinate': return 'Who steered teams away from your allies? Who seemed to know too much? That is Merlin.';
    case 'waitAssassin': return role === 'merlin' ? 'Hold your breath and keep a straight face.' : evil ? 'Help the Assassin: who seemed to know too much?' : 'Do not look at Merlin!';
    default: return evil ? GENERAL_TIPS.evil[2] : GENERAL_TIPS.good[2];
  }
}

/**
 * Percival's private read of the record, for the held role card: how each of the two players Percival sees (Merlin
 * and Morgana) voted on the teams that went and failed. Merlin sees evil and tends to vote those teams down; Morgana
 * tends to wave them through. Null unless the viewer is Percival with Morgana in play and the record has something.
 */
export function percivalRead(state) {
  const me = state && state.me; const pub = state && state.pub;
  if (!me || me.role !== 'percival' || !Array.isArray(me.knows) || me.knows.length < 2 || !pub || !pub.game) return null;
  const votes = failedTeamVotes(pub);
  const nameOf = (id) => { const p = pub.players.find((x) => x.id === id); return p ? p.name : '?'; };
  const parts = me.knows.filter((id) => votes[id]).map((id) => `${nameOf(id)} voted against ${votes[id].against} of ${votes[id].of} failed team${votes[id].of === 1 ? '' : 's'}`);
  if (!parts.length) return null;
  return `${parts.join('; ')}. Merlin sees the Minions, so Merlin tends to vote against teams that go on to fail.`;
}

/**
 * Merlin's private read of the record: how often Merlin voted down a team with a Minion Merlin can see on it, which is
 * the pattern an Assassin hunts for. Votes on Merlin's own teams are left out. Null for anyone else, or before Merlin
 * has voted on such a team.
 */
export function merlinRead(state) {
  const me = state && state.me; const pub = state && state.pub;
  if (!me || me.role !== 'merlin' || !Array.isArray(me.knows) || !me.knows.length || !pub || !pub.game) return null;
  const r = noToEvil(pub, me.knows)[me.id];
  if (!r || !r.of) return null;
  const verdict = r.of < 2 ? 'One vote is not a pattern yet.' : r.no * 4 >= r.of * 3 ? 'That is the pattern the Assassin looks for.' : 'Mixed enough not to stand out.';
  return `You voted down ${r.no} of ${r.of} team${r.of === 1 ? '' : 's'} with a Minion you can see on ${r.of === 1 ? 'it' : 'them'}. ${verdict}`;
}

/**
 * The Minions' private read of the record during the game, the other side of Merlin's: who has voted down the
 * largest share of teams with a known Minion on them (at least two such votes, three in four or more). Every Minion
 * who knows the others gets it, so they can steer their Assassin; Oberon, who knows nobody, does not. Null when
 * nobody's votes stand out yet, or for anyone else. Ties go to the earlier seat.
 */
export function assassinRead(state) {
  const me = state && state.me; const pub = state && state.pub;
  if (!me || !me.role || ROLE_INFO[me.role].team !== 'evil' || me.role === 'oberon') return null;
  if (!pub || !pub.game || pub.phase === 'assassination' || pub.phase === 'gameover') return null;
  const reads = noToEvil(pub, [me.id, ...(me.knows || [])]);
  let best = null;
  for (const p of pub.players) {
    const r = reads[p.id];
    if (!r || r.of < 2 || r.no * 4 < r.of * 3) continue;
    if (!best || r.no * best.of > best.no * r.of || (r.no * best.of === best.no * r.of && r.of > best.of)) best = { name: p.name, ...r };
  }
  return best ? `Votes most like Merlin's so far: ${best.name}, who voted down ${best.no} of ${best.of} teams with a Minion you know on them.` : null;
}

/**
 * A Minion's own exposure on the record, once a quest has failed: the failed quests they went on and the failed teams
 * they voted to send from outside, which a leader sees beside their name. Null for good players, before any failure,
 * and once the game is over.
 */
export function evilRead(state) {
  const me = state && state.me; const pub = state && state.pub; const g = pub && pub.game;
  if (!me || !me.role || ROLE_INFO[me.role].team !== 'evil' || !g || pub.phase === 'gameover') return null;
  const fails = (g.results || []).filter((r) => r.outcome === 'fail');
  if (!fails.length) return null;
  const went = fails.filter((r) => r.team.includes(me.id)).length;
  const backed = backedFailures(pub)[me.id] || 0;
  if (!went && !backed) return 'The record has nothing on you: you went on no failed quest and voted to send none.';
  const parts = [went ? `went on ${went} failed quest${went === 1 ? '' : 's'}` : null, backed ? `voted to send ${backed} failed team${backed === 1 ? '' : 's'} you were not on` : null].filter(Boolean);
  return `The record says you ${parts.join(' and ')}. A leader picking a team sees that beside your name.`;
}

/** The record, read for the viewer's own role, for the held role card: Percival's, Merlin's or a Minion's, else null. */
export function secretRead(state) {
  const evil = [evilRead(state), assassinRead(state)].filter(Boolean).join(' ');
  return percivalRead(state) || merlinRead(state) || evil || null;
}

/** Compact status strip: "Quest 3 of 5 · 3 on the team · needs 1 Fail". */
export function questStrip(pub) {
  const g = pub.game; if (!g) return '';
  const n = pub.players.length;
  const need = failsRequired(n, g.questIndex);
  return `Quest ${g.questIndex + 1} of 5 · team of ${teamSize(n, g.questIndex)} · ${need > 1 ? 'needs 2 Fails to sink' : '1 Fail sinks it'}`;
}
