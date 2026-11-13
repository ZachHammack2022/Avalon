// Pure: public state -> plain-text card for the TV HUD. This is the Milestone-1 "no 3D" view: the game is fully
// playable from these cards alone (?no3d). Unit-tested in Node (no DOM here).
import { QUEST_COUNT } from '../../shared/avalon.js';
import { ROLE_INFO } from '../../shared/roles-info.js';
import { QUESTS } from '../../shared/campaign-lost-crown.js';

const name = (pub, id) => { const p = pub.players.find((x) => x.id === id); return p ? p.name : '?'; };
const names = (pub, ids) => ids.map((id) => name(pub, id));
const list = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);

/** @returns {{kind:string, title:string, lines:string[], tone?:'good'|'bad'|'neutral', big?:string}} */
export function cardFor(pub, { joinUrl = '' } = {}) {
  const g = pub.game;
  const quest = g && g.quest;
  const qline = quest ? `Quest ${g.questIndex + 1} of ${QUEST_COUNT}: ${quest.name}` : '';
  switch (pub.phase) {
    case 'lobby':
      return { kind: 'lobby', title: 'Saboteur Quests', big: pub.room, lines: [
        'Join on your phone', joinUrl || 'Open the game URL on your phone and enter the room code',
        `${pub.players.length} player${pub.players.length === 1 ? '' : 's'} at the campfire: ${names(pub, pub.players.map((p) => p.id)).join(', ') || 'nobody yet'}`,
        pub.validation && !pub.validation.ok ? pub.validation.errors[0] : 'Waiting for the VIP to start…',
      ] };
    case 'roleReveal':
      return { kind: 'roleReveal', title: 'Check your phones', lines: ['Keep them secret.', `${pub.players.filter((p) => p.ready).length} of ${pub.players.length} ready`] };
    case 'propose':
      return { kind: 'propose', title: qline, lines: [`${name(pub, g.leader)} is choosing a team of ${g.teamSize}`, `Rejected proposals: ${g.rejectCount} of 5`] };
    case 'vote':
      return { kind: 'vote', title: 'Vote on the team', lines: [`Proposed: ${list(names(pub, g.team))}`, `${g.voted.length} of ${pub.players.length} have voted`, g.voted.length ? `Voted: ${names(pub, g.voted).join(', ')}` : ''].filter(Boolean) };
    case 'voteReveal':
      return { kind: 'voteReveal', title: g.approved ? 'Team approved!' : 'Team rejected!', tone: g.approved ? 'good' : 'bad',
        lines: pub.players.map((p) => `${p.name}: ${g.votes[p.id] ? '✔ Approve' : '✘ Reject'}`).concat(g.approved ? [] : [`Rejected proposals: ${g.rejectCount} of 5`]) };
    case 'questPlay':
      return { kind: 'questPlay', title: 'The team sets out…', lines: [list(names(pub, g.team)), `Waiting on ${g.waitingOn} player${g.waitingOn === 1 ? '' : 's'}`] };
    case 'cutscene': {
      const c = pub.cutscene;
      return c ? resultCard(pub, c, quest) : { kind: 'cutscene', title: '…', lines: [] };
    }
    case 'questResult': {
      const r = g.results[g.results.length - 1];
      return resultCard(pub, r, quest);
    }
    case 'assassination':
      return { kind: 'assassination', title: 'The Assassin steps from the shadows…', tone: 'bad', lines: ['Good has won three quests, but the Assassin gets one guess at Merlin.'] };
    case 'gameover': {
      const rv = pub.reveal;
      const why = { quests: rv.winner === 'good' ? 'Three quests succeeded.' : 'Three quests failed.', rejects: 'Five proposals in a row were rejected.', 'assassination-hit': 'The Assassin found Merlin!', 'assassination-miss': 'The Assassin missed Merlin!' }[rv.reason];
      return { kind: 'gameover', title: rv.winner === 'good' ? 'Good wins!' : 'Evil wins!', tone: rv.winner === 'good' ? 'good' : 'bad',
        lines: [why, ...pub.players.map((p) => `${p.name}: ${ROLE_INFO[rv.roles[p.id]].name}`), ...rv.recap.map((q) => `${QUESTS[q.questIndex].name}: ${q.outcome === 'success' ? `Success. Hero: ${name(pub, q.hero)}` : `Failed. Culprit: ${name(pub, q.culprit)}${q.framed ? ' (framed!)' : ''}`}${q.failCount != null ? ` [${q.failCount} Fail]` : ''}`)] };
    }
    default: return { kind: 'unknown', title: '', lines: [] };
  }
}

function resultCard(pub, r, quest) {
  const ok = r.outcome === 'success';
  const lines = [ok ? `Hero: ${name(pub, r.hero)}` : `${name(pub, r.culprit)} caused the disaster.`];
  if (r.failCount != null) lines.push(`${r.failCount} Fail card${r.failCount === 1 ? '' : 's'}`);
  return { kind: 'result', title: ok ? 'Quest succeeded!' : 'Quest failed!', tone: ok ? 'good' : 'bad', lines, subtitle: quest ? quest.name : '' };
}

/** Quest track: array of 'success' | 'fail' | 'current' | 'pending'. Spoiler-safe (only revealed results). */
export function trackFor(pub) {
  const g = pub.game; if (!g) return [];
  return Array.from({ length: QUEST_COUNT }, (_, i) => (g.results[i] ? g.results[i].outcome : i === g.questIndex ? 'current' : 'pending'));
}
