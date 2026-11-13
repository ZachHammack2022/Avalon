// Player-facing role descriptions (phone role card, TV game-over reveal).
export const ROLE_INFO = {
  loyal:    { name: 'Loyal Servant', team: 'good', icon: '🛡️', blurb: 'You are loyal to the crown. Find the saboteurs.' },
  merlin:   { name: 'Merlin', team: 'good', icon: '🧙', blurb: 'You see the saboteurs. Guide your team without being found out, or the Assassin will end you.' },
  percival: { name: 'Percival', team: 'good', icon: '🗡️', blurb: 'You can see Merlin and Morgana, but not which is which.' },
  minion:   { name: 'Minion', team: 'evil', icon: '😈', blurb: 'You serve the usurper. Sabotage quests without being caught.' },
  assassin: { name: 'Assassin', team: 'evil', icon: '🔪', blurb: 'If good wins three quests, you get one guess at who Merlin is.' },
  morgana:  { name: 'Morgana', team: 'evil', icon: '🧛', blurb: 'You appear to Percival as a possible Merlin. Make him doubt.' },
  mordred:  { name: 'Mordred', team: 'evil', icon: '👿', blurb: 'Merlin cannot see you. Stay hidden in plain sight.' },
  oberon:   { name: 'Oberon', team: 'evil', icon: '👻', blurb: 'You work alone. The saboteurs do not know you, and you do not know them. Merlin sees you.' },
};

export const ROLE_TOGGLE_INFO = {
  merlin: 'Merlin knows the saboteurs (but not Mordred).',
  assassin: 'Required with Merlin. Guesses Merlin if good wins.',
  percival: 'Sees Merlin and Morgana, unlabeled.',
  morgana: 'Evil. Looks like Merlin to Percival.',
  mordred: 'Evil. Hidden from Merlin.',
  oberon: 'Evil loner. Unknown to the other evil players.',
};

export const KNOW_LABELS = {
  evil: 'The saboteurs you can see',
  allies: 'Your fellow saboteurs',
  merlins: 'Merlin and Morgana',
};
