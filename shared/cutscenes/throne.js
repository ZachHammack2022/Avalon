// Quest 5: The Throne Room. At the outcome the team stands single file on the carpet (centre `mid`, facing the dais),
// the lead is at `spot` holding the crown up over the heir's head (prop `crown` hovers at `crownUp`), the usurper
// glowers from the dais with his guards (tg1, tg2) and the crowd (c1..c8) watches from the back of the hall.
import { b, cam, cap, emote, play, rig, say, seq, sfx } from './util.js';

const CROWD = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
export const throneSceneIds = ['usurper', 'heir', 'tg1', 'tg2', ...CROWD];
const crowd = (t, op, args = {}, stagger = 0) => CROWD.map((c, i) => b(+(t + i * stagger).toFixed(2), op, { who: c, ...args }));
const CEREMONY = { pos: [5.2, 3.1, 9.6], target: [10.6, 1.9, 0.2], snap: true }; // heir, crown, lead; usurper behind
const HALL = { pos: [2, 6.5, 19], target: [5, 1.5, -1], snap: true };

/** The usurper ends up wearing the crown and the team is marched back down the carpet. */
const ousted = (t, text, { end = 8, crowned = false } = {}) => [
  cap(t, text, +Math.min(2.6, end + 0.4 - t).toFixed(2)),
  cam(t, 'cut', { pos: [8.5, 3.2, 8.5], target: [13.6, 2.6, -0.2], snap: true }),
  ...(crowned ? [] : [
    b(t, 'detach', { prop: 'crown' }),
    b(t + 0.02, 'arc', { id: 'crown', to: { at: 'usurper', offset: [0, 3.3, 0] }, dur: 0.4, height: 1.6, spin: 300 }),
    b(t + 0.45, 'attach', { prop: 'crown', who: 'usurper', slot: 'head', offset: [0, 0.95, 0] }),
  ]),
  play(t + 0.5, 'usurper', 'Cheer'),
  say(t + 0.5, 'usurper', 'MINE!', 0.7, 'shout'),
  sfx(t + 0.5, 'wahwah'),
  // guards walk the team out
  b(t + 0.3, 'runTo', { who: 'tg1', to: [9.2, -1.0], dur: 0.6 }), b(t + 0.3, 'runTo', { who: 'tg2', to: [9.4, 1.2], dur: 0.6 }),
  b(t + 0.9, 'formation', { name: 'column', center: 'exit', facing: -90, spacing: 1.4, walk: true, dur: +(end + 0.4 - t - 0.9).toFixed(2) }),
  b(t + 0.95, 'walkTo', { who: 'tg1', to: [5.2, -0.9], dur: +(end + 0.3 - t - 0.95).toFixed(2), anim: 'Walking_D_Skeletons' }), b(t + 0.95, 'walkTo', { who: 'tg2', to: [5.4, 1.0], dur: +(end + 0.3 - t - 0.95).toFixed(2), anim: 'Walking_D_Skeletons' }),
  cam(t + 1.1, 'frame', { target: 'team:all', angle: -32, height: 2.3, dist: 11, snap: true }),
  b(t + 1.5, 'lookAt', { who: 'team:others', at: 'culprit', dur: 0.6 }),
  emote(t + 1.6, 'team:others', '…', +Math.min(1.0, end + 0.4 - t - 1.6).toFixed(2), '#ffffff'),
];

export function throneBeats(q) {
  const setup = seq(
    cam(0, 'cut', { pos: [-6, 10, 26], target: [6, 2.5, -1], snap: true }),
    cam(0.1, 'cut', { pos: [-14, 4.2, 14], target: [-9, 2, 0], lag: 1.7 }),
    cap(0.2, '{intro}', 4.4),
    b(0.1, 'spawnProp', { id: 'crown', model: 'builtin:crown', scale: 1.5 }),
    b(0.15, 'attach', { prop: 'crown', who: 'lead', slot: 'handslot.r', offset: [0, 0.12, 0] }),
    play(0.2, 'usurper', 'Spellcasting'),
    b(0.3, 'formation', { name: 'column', center: 'start', spacing: 1.5, walk: true, dur: 3.0 }),
    b(3.4, 'banner', { who: 'team:all', dur: 1.5 }),
    b(4.2, 'fx', { kind: 'sparkle', at: { at: 'lead', offset: [0, 1.4, 0] }, count: 10 }),
  );

  const approach = seq(
    cam(0, 'frame', { target: 'team:all', height: 2.8, dist: 12.5, angle: -22, lag: 0.5 }),
    cap(0.2, q.approach, 4.2),
    b(0.2, 'formation', { name: 'column', center: 'mid', spacing: 1.4, walk: true, dur: 5.0 }),
    // the crowd gasps
    sfx(1.4, 'crowd'),
    crowd(1.4, 'lookAt', { at: 'team:all', dur: 0.3 }, 0.04),
    crowd(1.5, 'hop', { height: 0.3, count: 1, dur: 0.3 }, 0.05),
    emote(1.5, 'c2', '!', 0.7), emote(1.6, 'c5', '!', 0.7), emote(1.7, 'c7', '!', 0.7),
    cam(2.6, 'cut', { pos: [9.2, 3.2, 7.5], target: [13.8, 2.6, -0.3], snap: true }),
    play(2.7, 'usurper', 'Idle'),
    emote(2.8, 'usurper', '!', 0.8, '#ff5544'),
    play(3.0, 'usurper', 'Taunt'),
    emote(3.3, 'heir', '♥', 0.9, '#ff6a8a'),
    cam(4.0, 'cut', HALL),
    crowd(4.4, 'lookAt', { at: 'heir', dur: 0.4 }, 0.03),
    b(5.3, 'walkTo', { who: 'lead', to: 'spot', dur: 1.2 }),
    b(6.55, 'face', { who: 'lead', at: 'heir', dur: 0.2 }),
  );

  const moment = seq(
    b(0, 'music', { track: 'stop' }),
    sfx(0.05, 'stinger', 0.7),
    cam(0, 'cut', CEREMONY),
    cam(0.1, 'cut', { pos: [6.4, 2.9, 7.4], target: [10.5, 2.4, 0.4], lag: 1.3, fov: 34 }),
    cap(0.3, q.moment, 2.4),
    play(0.3, 'lead', 'Spellcast_Raise', { then: 'hold', speed: 0.7 }),
    b(0.4, 'detach', { prop: 'crown' }),
    b(0.45, 'tweenTo', { who: 'crown', pos: 'crownUp', rot: [0, 360, 0], scale: 1.5, dur: 1.6, ease: 'out' }),
    sfx(0.6, 'tick', 0.6), sfx(1.2, 'tick', 0.6), sfx(1.8, 'tick', 0.6), sfx(2.4, 'tick', 0.6),
    crowd(1.0, 'tremble', { dur: 1.8, amount: 0.02 }),
    b(2.2, 'fx', { kind: 'sparkle', at: 'crownUp', count: 8 }),
  );

  const success = seq(
    cam(0, 'cut', CEREMONY),
    b(0, 'runTo', { who: 'hero', to: [9.3, 2.0], dur: 0.5 }),
    b(0.55, 'face', { who: 'hero', at: 'heir', dur: 0.15 }),
    cap(0.3, q.success, 3.8),
    play(0.7, 'hero', 'Interact'),
    b(0.9, 'tweenTo', { who: 'crown', by: [0, -0.6, 0], dur: 0.3, ease: 'in' }),
    b(1.22, 'attach', { prop: 'crown', who: 'heir', slot: 'head', offset: [0, 0.85, 0] }),
    sfx(1.22, 'ding'),
    b(1.25, 'flash', { color: '#ffe9a0', dur: 0.5 }),
    b(1.25, 'fx', { kind: 'sparkle', at: 'crownUp', count: 40, scale: 1.8 }),
    play(1.3, 'heir', 'Cheer'),
    play(1.3, 'lead', 'Cheer'),
    sfx(1.4, 'fanfare'), sfx(1.5, 'cheer'),
    crowd(1.5, 'play', { anim: 'Cheer' }, 0.04), crowd(1.5, 'hop', { height: 0.45, count: 3 }, 0.06),
    play(1.5, 'usurper', 'Hit_B'),
    play(2.1, 'usurper', 'Death_A', { then: 'hold' }),
    cam(2.0, 'lowAngle', { target: 'hero', angle: -10, dist: 4.2, snap: true }),
    b(2.0, 'face', { who: 'hero', at: 0, dur: 0.2 }),
    play(2.2, 'hero', 'Cheer'),
    b(2.2, 'banner', { who: 'hero', dur: 2.6 }),
    b(2.4, 'fx', { kind: 'confetti', at: [8, 6, 1], count: 60, scale: 3 }),
    // the camera slowly cranes up over the cheering hall
    cam(3.2, 'cut', { pos: [3.5, 4.5, 14], target: [8.5, 1.8, 0], snap: true }),
    cam(3.3, 'cut', { pos: [0, 10, 22], target: [7, 1.5, -1], lag: 1.6 }),
    play(3.3, 'team:others', 'Cheer'),
    b(3.3, 'hop', { who: 'team:others', count: 2, height: 0.45, stagger: 0.07 }),
    b(3.6, 'fx', { kind: 'confetti', at: [4, 7, 0], count: 60, scale: 3 }),
  );

  // ---------- fail gags ----------
  const selfcrown = seq(
    cam(0, 'cut', CEREMONY),
    cap(0.1, '{culprit} crowns… themselves.', 2.6),
    b(0.05, 'runTo', { who: 'culprit', to: 'selfSpot', dur: 0.5 }),
    b(0.6, 'arc', { id: 'crown', to: { at: 'culprit', offset: [0, 2.6, 0] }, dur: 0.4, height: 0.8 }),
    b(1.02, 'attach', { prop: 'crown', who: 'culprit', slot: 'head', offset: [0, 0.85, 0] }),
    sfx(1.02, 'ding'),
    play(1.0, 'lead', 'Idle'),
    b(1.05, 'fx', { kind: 'sparkle', at: { at: 'culprit', offset: [0, 2, 0] }, count: 16 }),
    b(1.1, 'face', { who: 'culprit', at: 0, dur: 0.2 }),
    cam(1.3, 'closeUp', { target: 'culprit', dist: 4.4, height: 2.0, snap: true }),
    play(1.3, 'culprit', 'Cheer'),
    say(1.35, 'culprit', 'I accept!', 1.0),
    sfx(1.9, 'crowd'),
    emote(2.0, 'heir', '?', 0.8, '#ffffff'),
    // a gracious bow to the crowd...
    cam(2.5, 'cut', { pos: [5.5, 3.4, 10.5], target: [10.4, 1.7, 0.3], snap: true }),
    play(2.5, 'culprit', 'PickUp'),
    b(2.6, 'walkTo', { who: 'tg1', to: [10.4, 2.2], dur: 1.0, anim: 'Walking_D_Skeletons' }), b(2.6, 'walkTo', { who: 'tg2', to: [8.0, 2.9], dur: 1.1, anim: 'Walking_D_Skeletons' }),
    b(3.7, 'face', { who: 'tg1', at: 'culprit', dur: 0.2 }), b(3.75, 'face', { who: 'tg2', at: 'culprit', dur: 0.2 }),
    // ...then notices the guards
    emote(4.0, 'culprit', '!', 0.3),
    b(4.3, 'freeze', { dur: 1.2 }),
    say(5.55, 'culprit', '…oh.', 0.5, 'whisper'),
    ousted(5.8, q.consequence),
  );

  const roll = seq(
    cam(0, 'cut', CEREMONY),
    cap(0.1, '{culprit} trips. The crown rolls away…', 2.8),
    b(0.05, 'runTo', { who: 'culprit', to: { at: 'lead', offset: [-0.8, 0, 0.5] }, dur: 0.45 }),
    say(0.1, 'culprit', "I'll help!", 0.5),
    sfx(0.5, 'bonk'),
    play(0.5, 'culprit', 'Death_A', { then: 'hold', speed: 1.3 }),
    play(0.5, 'lead', 'Hit_A'),
    b(0.5, 'fx', { kind: 'stars', at: { at: 'lead', offset: [0, 1.6, 0] }, count: 10 }),
    b(0.55, 'arc', { id: 'crown', to: [7.4, 0.45, 0], dur: 0.35, height: 0.4 }),
    b(0.9, 'tweenTo', { who: 'crown', rot: [90, 0, 0], dur: 0.01, key: 'tip' }),
    sfx(0.9, 'clink'),
    // ...the full length of the hall, like a wheel
    cam(0.95, 'cut', HALL),
    b(0.95, 'tweenTo', { who: 'crown', pos: 'far', rot: [90, -3000, 0], dur: 1.5, ease: 'out' }),
    b(1.0, 'hop', { who: 'team:others', count: 1, height: 0.7, dur: 0.4, stagger: 0.07 }),
    b(1.0, 'lookAt', { who: 'team:all', at: 'far', dur: 0.4 }),
    crowd(1.1, 'lookAt', { at: 'far', dur: 0.5 }, 0.05),
    cam(1.3, 'follow', { target: 'crown', dist: 10, height: 2.4, angle: -30, lag: 0.3 }),
    sfx(2.45, 'bonk', 0.6),
    b(2.5, 'tweenTo', { who: 'crown', pos: [12.3, 0.45, 0], rot: [90, 3500, 0], dur: 1.45, ease: 'linear' }),
    crowd(2.6, 'lookAt', { at: 'dais', dur: 1.2 }, 0.03),
    b(3.45, 'hop', { who: 'team:all', count: 1, height: 0.7, dur: 0.4, stagger: -0.06 }),
    cam(3.7, 'cut', { pos: [8.2, 3.0, 8.0], target: [13.4, 2.4, -0.2], snap: true }),
    b(3.96, 'arc', { id: 'crown', to: { at: 'usurper', offset: [-0.6, 1.7, 0.3] }, dur: 0.35, height: 1.2 }),
    b(4.32, 'attach', { prop: 'crown', who: 'usurper', slot: 'handslot.r', offset: [0, 0.1, 0] }),
    sfx(4.32, 'ding'),
    emote(4.35, 'usurper', '!', 0.3),
    say(4.5, 'usurper', 'Oh! Thank you.', 0.3),
    b(4.75, 'freeze', { dur: 1.2 }),
    ousted(6.0, q.consequence),
  );

  const mug = seq(
    cam(0, 'cut', CEREMONY),
    cap(0.1, '{culprit} solemnly crowns the heir. With a tavern mug.', 3.0),
    say(0.1, 'culprit', 'Allow me.', 0.7),
    b(0.05, 'runTo', { who: 'culprit', to: 'selfSpot', dur: 0.5 }),
    // the real crown quietly ends up on the culprit's belt
    b(0.6, 'arc', { id: 'crown', to: { at: 'culprit', offset: [0.2, 0.9, 0.4] }, dur: 0.3, height: 0.3 }),
    b(0.92, 'attach', { prop: 'crown', who: 'culprit', slot: 'body', offset: [0.0, 0.8, 0.45] }),
    b(0.94, 'tweenTo', { who: 'crown', scale: 0.85, rot: [80, 0, 0], dur: 0.01 }),
    play(0.9, 'lead', 'Idle'),
    b(0.95, 'face', { who: 'culprit', at: 'heir', dur: 0.15 }),
    b(1.0, 'spawnProp', { id: 'mug', model: 'prop:mug_full', scale: 1.5 }),
    b(1.02, 'attach', { prop: 'mug', who: 'culprit', slot: 'handslot.r' }),
    play(1.1, 'culprit', 'Use_Item'),
    b(1.7, 'attach', { prop: 'mug', who: 'heir', slot: 'head', offset: [0, 1.35, 0] }),
    b(1.72, 'tweenTo', { who: 'mug', rot: [180, 0, 0], dur: 0.01 }),
    sfx(1.7, 'clink'),
    cam(1.75, 'closeUp', { target: 'heir', angle: 28, dist: 4.6, height: 2.1, snap: true }),
    b(1.9, 'face', { who: 'culprit', at: 0, dur: 0.2 }),
    play(2.0, 'culprit', 'Cheer'),
    say(2.05, 'culprit', 'All hail!', 1.0, 'shout'),
    // silence in the hall
    cam(2.7, 'cut', HALL),
    emote(2.9, 'heir', '?', 0.8, '#ffffff'),
    emote(3.0, 'c3', '…', 0.8, '#ffffff'), emote(3.1, 'c6', '…', 0.8, '#ffffff'),
    // ...and the camera finds the real crown
    cam(3.5, 'cut', { pos: { at: 'culprit', offset: [0.5, 1.15, 3.0] }, target: 'culprit', height: 0.95, snap: true, fov: 24 }),
    b(3.7, 'fx', { kind: 'sparkle', at: { at: 'culprit', offset: [0, 0.9, 0.5] }, count: 8, scale: 0.6 }),
    sfx(3.7, 'ding', 0.7),
    b(4.2, 'freeze', { dur: 1.2 }),
    ousted(5.7, q.consequence),
  );

  const speech = seq(
    cam(0, 'cut', { pos: [4.4, 3.0, 11], target: [9, 1.8, 0.8], snap: true }),
    cap(0.1, '{culprit}: "Before we begin, I\'d just like to say a few words…"', 3.0),
    b(0.05, 'walkTo', { who: 'culprit', to: 'speech', dur: 0.6 }),
    b(0.7, 'face', { who: 'culprit', at: 0, dur: 0.2 }),
    play(0.9, 'culprit', 'Spellcasting'),
    say(0.95, 'culprit', 'Friends! Royals! Skeletons!', 0.9),
    // time-lapse
    b(1.9, 'title', { text: 'Three hours later…', dur: 1.1 }),
    rig(1.9, 'throne', 'melt', null, 1.2),
    b(1.9, 'lights', { level: 0.5, dur: 1.2 }),
    crowd(2.0, 'play', { anim: 'Sit_Floor_Down', then: 'Sit_Floor_Idle' }, 0.06),
    play(2.1, 'tg1', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }), play(2.3, 'tg2', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }),
    play(2.2, 'team:others', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }),
    play(2.25, 'culprit', 'Spellcasting'),
    play(2.4, 'heir', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }),
    cam(3.0, 'cut', HALL),
    say(3.1, 'culprit', '…which brings me to part nine.', 1.3),
    emote(3.1, 'tg1', 'Zzz', 1.2, '#cfe4ff'), emote(3.3, 'c4', 'Zzz', 1.2, '#cfe4ff'), emote(3.5, 'c7', 'Zzz', 1.2, '#cfe4ff'),
    // meanwhile, in the background
    sfx(3.4, 'tiptoe'),
    b(3.4, 'walkTo', { who: 'usurper', to: 'steal', dur: 0.8 }),
    cam(4.1, 'cut', { pos: [6.5, 3.0, 8.5], target: [10.4, 2.2, 0.2], snap: true }),
    b(4.25, 'arc', { id: 'crown', to: { at: 'usurper', offset: [0, 3.3, 0] }, dur: 0.3, height: 0.5 }),
    b(4.57, 'attach', { prop: 'crown', who: 'usurper', slot: 'head', offset: [0, 0.95, 0] }),
    sfx(4.57, 'ding', 0.6),
    play(4.6, 'usurper', 'Cheer'),
    play(4.7, 'culprit', 'Cheer'),
    say(4.75, 'culprit', 'Any questions?', 0.3),
    b(5.0, 'freeze', { dur: 1.2 }),
    b(6.2, 'lights', { level: 1, dur: 0.3 }),
    ousted(6.25, q.consequence, { crowned: true }),
  );

  return { setup, approach, moment, success, fail: { selfcrown, roll, mug, speech } };
}
