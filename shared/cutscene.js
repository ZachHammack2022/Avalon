// Pure helpers around cutscene data: duration, flat timeline, slot filling. Used by the server
// (durations only), the TV player, the preview harness and tests. No three.js in here.
import { seeded } from './rng.js';

export const SEGMENTS_SHARED = ['setup', 'approach', 'moment'];

/** Seconds of a full cutscene. */
export function cutsceneSeconds(quest, outcome, gagId) {
  const D = quest.durations;
  const head = D.setup + D.approach + D.moment;
  if (outcome === 'success') return head + D.success;
  const gag = quest.gags.find((g) => g.id === gagId);
  if (!gag) throw new Error(`unknown gag ${gagId} for ${quest.id}`);
  return head + gag.duration;
}

/** Ordered segments with absolute start/end: [{name, start, end, beats}] */
export function segmentsFor(quest, outcome, gagId) {
  const D = quest.durations;
  const out = [];
  let t = 0;
  for (const name of SEGMENTS_SHARED) {
    out.push({ name, start: t, end: t + D[name], beats: quest.beats[name] });
    t += D[name];
  }
  if (outcome === 'success') out.push({ name: 'success', start: t, end: t + D.success, beats: quest.beats.success });
  else {
    const gag = quest.gags.find((g) => g.id === gagId);
    out.push({ name: 'fail', start: t, end: t + gag.duration, beats: quest.beats.fail[gagId] });
  }
  return out;
}

/** Flat, time-sorted list of {t (absolute seconds), op, ...args}. */
export function buildTimeline(quest, outcome, gagId) {
  const flat = [];
  for (const seg of segmentsFor(quest, outcome, gagId)) {
    seg.beats.forEach((b, i) => flat.push({ ...b, t: seg.start + b.t, seg: seg.name, _i: i }));
  }
  return flat.sort((a, b) => a.t - b.t || a._i - b._i);
}

/** Resolve actor refs against a cutscene payload. `team` is an array of player ids. */
export function makeResolver(payload) {
  const rng = seeded(payload.seed >>> 0);
  const team = payload.team;
  const lead = team[Math.floor(rng.next() * team.length)];
  const others = team.filter((id) => id !== payload.culprit && id !== payload.hero);
  return {
    lead,
    /** returns an array of player ids (possibly empty), or null if `ref` is not a player ref (custom id). */
    players(ref) {
      if (ref === 'culprit') return payload.culprit ? [payload.culprit] : [];
      if (ref === 'hero') return payload.hero ? [payload.hero] : [];
      if (ref === 'lead') return [lead];
      if (ref === 'team:all') return team.slice();
      if (ref === 'team:others') return others;
      const m = /^team:([0-4])$/.exec(ref);
      if (m) return team[+m[1]] ? [team[+m[1]]] : [];
      return null;
    },
  };
}

/** Fill {culprit} {hero} {team} {lead} in captions. `nameOf(id)`. */
export function fillSlots(text, payload, nameOf, lead, intro = '') {
  const names = (ids) => ids.map(nameOf);
  const list = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
  return String(text)
    .replace(/\{culprit\}/g, payload.culprit ? nameOf(payload.culprit) : 'Someone')
    .replace(/\{hero\}/g, payload.hero ? nameOf(payload.hero) : 'Someone')
    .replace(/\{intro\}/g, intro)
    .replace(/\{lead\}/g, lead ? nameOf(lead) : 'Someone')
    .replace(/\{team\}/g, list(names(payload.team)));
}

/** Opening caption with the one carry-over between quests (goals §7). */
export function introCaption(quest, prevOutcome) {
  const prefix = prevOutcome === 'success' ? 'Fresh from their triumph… ' : prevOutcome === 'fail' ? 'Still smelling of smoke… ' : '';
  return prefix + quest.tagline;
}
