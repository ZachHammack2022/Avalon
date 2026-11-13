// Pure view-model helpers for the phone UI (unit-tested in Node; no DOM in here).
/** Which screen to show for a server state message. */
export function screenFor(state) {
  if (!state || !state.pub) return 'connecting';
  const { pub, me } = state;
  const phase = pub.phase;
  if (phase === 'lobby') return 'lobby';
  const legal = (me && me.legal) || { action: 'wait' };
  switch (phase) {
    case 'roleReveal': return 'roleReveal';
    case 'propose': return legal.action === 'propose' ? 'propose' : 'waitLeader';
    case 'vote': return legal.action === 'vote' ? 'vote' : 'voted';
    case 'voteReveal': return 'voteReveal';
    case 'questPlay': return me && me.quest && me.quest.onTeam ? `quest-${me.quest.step}` : 'watchQuest';
    case 'cutscene': return 'cutscene';
    case 'questResult': return 'questResult';
    case 'assassination': return legal.action === 'assassinate' ? 'assassinate' : 'waitAssassin';
    case 'gameover': return 'gameover';
    default: return 'connecting';
  }
}

/** Toggle `id` in the selection, never exceeding `size`. Returns a new array. */
export function toggleSelection(selected, id, size) {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.length >= size) return selected; // full: ignore (UI shows count)
  return [...selected, id];
}

export const canConfirm = (selected, size) => selected.length === size;

/** Names to show on the role card: [{id,name,color}] for everything the role knows. */
export function knownPlayers(state) {
  const { pub, me } = state;
  const by = new Map(pub.players.map((p) => [p.id, p]));
  return (me.knows || []).map((id) => by.get(id)).filter(Boolean).map((p) => ({ id: p.id, name: p.name, color: p.color }));
}

export function leaderName(pub) {
  const g = pub.game;
  const p = g && pub.players.find((x) => x.id === g.leader);
  return p ? p.name : 'The leader';
}

export function nameOf(pub, id) {
  const p = pub.players.find((x) => x.id === id);
  return p ? p.name : '?';
}

export function lastResult(pub) {
  const r = pub.game && pub.game.results;
  return r && r.length ? r[r.length - 1] : null;
}

/** Lobby: the message a VIP sees about whether they can start. */
export function startHint(pub) {
  const v = pub.validation;
  if (!v) return '';
  if (v.errors.length) return v.errors[0];
  return v.warnings[0] || '';
}
