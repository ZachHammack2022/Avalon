// Player guidance for the phone: how to play, role tips, and a one-line "what should I do now" coach.
// Pure data + functions (unit-tested in Node). Only ever uses the viewer's OWN role, so nothing leaks.
import { ROLE_INFO } from '../../shared/roles-info.js';
import { failsRequired, teamSize, MAX_REJECTS } from '../../shared/avalon.js';

export const HOW_TO = [
  { h: 'The story', p: 'The Lost Crown has been stolen. Most of you are Loyal Servants of Arthur. Some of you are secret Minions of Mordred. Nobody knows who is who, except the Minions and a few special roles.' },
  { h: 'Winning', p: 'Good wins by completing 3 of 5 quests. Evil wins by sabotaging 3 quests, or if 5 teams in a row get rejected. If good wins, the Assassin still gets one guess at Merlin. A correct guess steals the win.' },
  { h: 'A round', p: '1. The leader picks a team.  2. Everyone votes Approve or Reject.  3. If approved, the team secretly plays Success or Fail cards.  4. Watch the TV: the quest plays out as a cutscene!' },
  { h: 'Success and Fail', p: 'Good players can only play Success. Evil players may play Fail. One Fail sinks the quest. (Quest 4 with 7+ players needs two.) The TV shows the outcome, never who played what.' },
  { h: 'Who stood out?', p: 'After playing your card you pick one teammate. On success, the most-picked player becomes the hero. On a failure, the culprit is drawn from what the Fail players picked, so Evil gets to frame someone!' },
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
  merlin: ['You know the Minions of Mordred. Steer teams away from them, but not too perfectly.', 'If good wins, the Assassin guesses Merlin. Act a bit clueless.', 'Mordred, if he is in play, is hidden from you.'],
  percival: ['You see two people: Merlin and Morgana. You do not know which.', 'Watch their votes. Protect the one who acts like the real Merlin.'],
  minion: ['Get yourself or an ally onto teams. Fail when it is safe, or when it wins.', 'Look for the loudest good player: that may be Merlin.'],
  assassin: ['Pay attention all game: the player who steers teams away from your allies is likely Merlin.', 'You get one guess if good wins three quests. Make it count.'],
  morgana: ['Percival sees you as a possible Merlin. Talk like Merlin would.', 'Give Percival reasons to doubt the real one.'],
  mordred: ['Merlin cannot see you, so you can act trustworthy and stay on teams.', 'Be the Minion nobody suspects.'],
  oberon: ['You work alone. Your allies do not know you and you do not know them.', 'Merlin can see you, so be careful. Fail when you can.'],
};

/** Short advice for the screen the player is on. Returns { icon, text } or null. */
export function coachFor(screen, state) {
  if (!state || !state.pub) return null;
  const { pub, me } = state;
  const role = me && me.role; const team = role ? ROLE_INFO[role].team : null;
  const g = pub.game; const n = pub.players.length;
  switch (screen) {
    case 'lobby':
      return { icon: '🏕️', text: me && me.vip ? 'You are the VIP. Fill empty seats with bots, choose roles, then start. Tap ? any time for help.' : 'Pick your hero and colour. The VIP starts the game. New to this? Tap ? for a 1-minute guide.' };
    case 'roleReveal':
      return { icon: '🤫', text: 'Hold the "Hold to reveal" button to see your role privately. Tap "I\'m ready" once you know who you are.' };
    case 'waitLeader':
      return { icon: '👀', text: team === 'evil' ? 'Hoping the leader picks someone on your side? Do not look too hopeful.' : 'Watch who the leader picks. Do they choose themselves? Friends?' };
    case 'propose': {
      const t = team === 'evil' ? 'Put at least one Minion of Mordred on the team (maybe you!), but not so obvious that everyone rejects it.' : role === 'merlin' ? 'Pick players you know are good, but do not be too perfect or the Assassin will notice.' : 'Pick yourself and players you trust. You know you are loyal; the others you do not.';
      return { icon: '👑', text: t };
    }
    case 'vote': {
      const left = g ? MAX_REJECTS - g.rejectCount : MAX_REJECTS;
      const t = team === 'evil' ? 'Approve if a Minion is on the team. Rejecting too often looks suspicious.' : 'Approve teams you trust. Reject teams with anyone suspicious.';
      return { icon: '🗳️', text: `${t} ${left <= 1 ? 'Careful: one more rejection and evil wins!' : `${left} rejections left before evil wins.`}` };
    }
    case 'voted': return { icon: '⏳', text: 'Your vote is locked. The TV will reveal everyone\'s votes together.' };
    case 'quest-card': {
      if (!me.quest.canFail) return { icon: '🛡️', text: 'You are good, so Success is the only card you can play. Tap it and move on!' };
      const need = g ? failsRequired(n, g.questIndex) : 1;
      return { icon: '🗡️', text: `You are a Minion of Mordred: you usually want to play Fail. ${need > 1 ? 'This quest needs TWO Fails, so coordinate with another Minion on the team. ' : ''}If you are the only Minion here, you could play Success to look trustworthy.` };
    }
    case 'quest-pick':
      return { icon: '🎯', text: team === 'evil' ? 'If this quest fails, one Fail player\'s pick may decide who gets framed. Pick a good player.' : 'Pick the teammate who impressed you. On success, the most-picked player becomes the hero.' };
    case 'quest-done': case 'watchQuest': return { icon: '🎬', text: 'The quest is underway. Nothing to do but watch the TV.' };
    case 'assassinate':
      return { icon: '🔪', text: 'Think back: who steered teams away from your allies? Who seemed to know too much? That is Merlin.' };
    case 'waitAssassin':
      return { icon: '😬', text: role === 'merlin' ? 'Hold your breath. Merlin lives or dies on this guess.' : 'The Assassin gets one guess at Merlin. Good wins only if they miss.' };
    default: return null;
  }
}

/** Compact status strip: "Quest 3 of 5 · 3 on the team · needs 1 Fail". */
export function questStrip(pub) {
  const g = pub.game; if (!g) return '';
  const n = pub.players.length;
  const need = failsRequired(n, g.questIndex);
  return `Quest ${g.questIndex + 1} of 5 · ${teamSize(n, g.questIndex)} on the team · ${need} Fail${need > 1 ? 's' : ''} sinks it`;
}
