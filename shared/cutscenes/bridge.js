// Quest 1: The Old Bridge. Hand-authored choreography (see docs/CUTSCENES.md for the op reference).
// The team stands in a single-file column centred on `mid` (x=0) when the outcome segment starts.
// The whole team succeeds or fails together: every outcome shows all of them doing it, nobody singled out.
import { b, cam, cap, chorus, emote, play, rig, seq, sfx } from './util.js';

const RIVER_CAM = { pos: [2.5, -6.4, 15.5], target: [0, -9.3, 2], snap: true };

/** Everyone is in the river by now, and they give the camera a sheepish wave together. */
const riverReaction = (t, consequence, end = 8) => [
  cap(t - 0.5, consequence, +Math.min(2.4, end + 0.4 - (t - 0.5)).toFixed(2)),
  cam(t, 'cut', RIVER_CAM),
  sfx(t + 0.5, 'wahwah'),
  play(t + 0.8, 'team:all', 'Cheer'),
  emote(t + 0.9, 'team:all', '…', +Math.min(1.0, end + 0.4 - (t + 0.9)).toFixed(2), '#ffffff'),
];

export const durations = { setup: 5, approach: 7, moment: 3, success: 5 };
export const gagDurations = { sweater: 8, catch: 8, sturdiness: 8, celebration: 8 };

export function bridgeBeats(q) {
  const setup = seq(
    cam(0, 'cut', { pos: [-1, 7, 34], target: [-2, -2, 0], snap: true }),
    cam(0.1, 'cut', { pos: [-5, 4, 23], target: [-5, -0.5, 0], lag: 1.6 }),
    cap(0.2, '{intro}', 4.4),
    b(0.2, 'spawnProp', { id: 'lantern', model: 'builtin:lantern' }),
    b(0.25, 'attach', { prop: 'lantern', who: 'lead', slot: 'handslot.r', offset: [0, 0.1, 0] }),
    b(0.3, 'formation', { name: 'line', center: 'start', facing: 0, spacing: 2.1, walk: true, dur: 3.0 }),
    cam(3.2, 'frame', { target: 'team:all', height: 2.2, lag: 0.5 }),
    b(3.4, 'banner', { who: 'team:all', dur: 1.5 }),
    sfx(3.9, 'creak'),
    rig(3.9, 'bridge', 'creak', null, 1.0),
    b(4.1, 'lookAt', { who: 'team:all', at: 'mid', dur: 0.5 }),
    emote(4.3, 'lead', '…', 0.7, '#ffffff'),
  );

  const approach = seq(
    cam(0, 'follow', { target: 'team:all', dist: 11, height: 2.6, angle: -10 }),
    cap(0.2, q.approach, 4.2),
    b(0.2, 'formation', { name: 'column', center: 'mid', spacing: 1.6, walk: true, dur: 5.6, anim: 'Walking_B' }),
    sfx(1.4, 'creak', 0.7), rig(1.4, 'bridge', 'creak', null, 1.2),
    sfx(3.0, 'creak', 0.8), rig(3.0, 'bridge', 'creak', null, 1.2),
    // a plank quietly lets go behind them (same in every outcome)
    cam(4.2, 'cut', { pos: [-12.5, 2.4, 9], target: [-7, -0.4, 0], snap: true }),
    sfx(4.4, 'snap'), rig(4.4, 'bridge', 'shed', { n: 1 }),
    sfx(4.7, 'slide', 0.5),
    cam(5.3, 'frame', { target: 'team:all', height: 2.2, angle: 12, snap: true }),
    sfx(5.5, 'splash', 0.3),
    emote(5.9, 'team:all', '?', 0.8, '#ffffff'),
    b(6.0, 'lookAt', { who: 'team:all', at: 'edge', dur: 0.5 }),
  );

  const moment = seq(
    b(0, 'music', { track: 'stop' }),
    sfx(0.05, 'stinger'),
    cam(0.1, 'pushIn', { target: 'team:all', dist: 13, angle: 14, dur: 2.8 }),
    cap(0.3, q.moment, 2.4),
    b(0.3, 'face', { who: 'team:all', at: 90, dur: 0.4 }),
    sfx(0.8, 'creak'), rig(0.8, 'bridge', 'creak', null, 1.6),
    b(1.0, 'tremble', { who: 'team:all', dur: 1.8, amount: 0.025 }),
  );

  const success = seq(
    sfx(0, 'snap'),
    cam(0, 'cut', { pos: [5, 4.5, 21], target: [5.5, -0.5, 0], snap: true }),
    emote(0.05, 'team:all', '!', 0.6),
    cap(0.3, q.success, 3.6),
    b(0.3, 'formation', { name: 'line', center: 'far', facing: 0, spacing: 1.7, run: true, dur: 1.9 }),
    sfx(0.5, 'rumble'), rig(0.5, 'bridge', 'collapse', null, 1.7),
    cam(0.6, 'shake', { intensity: 0.25, dur: 1.5 }),
    b(2.2, 'fx', { kind: 'dust', at: 'far', count: 22, scale: 1.6 }),
    sfx(2.3, 'splash', 0.5),
    // the whole team, from low down, dusting off their hands as one
    cam(2.3, 'frame', { target: 'team:all', height: 0.8, angle: 6, snap: true }),
    play(2.5, 'team:all', 'Interact'),
    sfx(2.6, 'fanfare'),
    b(2.6, 'banner', { who: 'team:all', dur: 2.4 }),
    b(2.9, 'fx', { kind: 'sparkle', at: 'team:all', count: 30, scale: 1.4 }),
    cam(3.6, 'frame', { target: 'team:all', height: 2, lag: 0.4 }),
    play(3.7, 'team:all', 'Cheer'),
    b(3.7, 'hop', { who: 'team:all', count: 2, height: 0.5, stagger: 0.08 }),
    b(3.8, 'fx', { kind: 'confetti', at: { at: 'far', offset: [0, 2.5, 0] }, count: 40, scale: 1.4 }),
  );

  // ---------- fail gags: the whole team does it together ----------
  const sweater = seq(
    cam(0, 'frame', { target: 'team:all', angle: -24, height: 1.8, snap: true }),
    cap(0.1, '{team} spot a loose rope. "We\'ll just tidy that up."', 2.8),
    b(0.2, 'face', { who: 'team:all', at: 0, dur: 0.3 }),
    emote(0.3, 'team:all', '!', 0.7),
    play(0.7, 'team:all', 'Interact', { loop: true, speed: 1.5 }),
    // every tug winds the rope onto one shared ball
    b(1.0, 'spawnProp', { id: 'yarn', model: 'builtin:sphere', color: '#c9ab72', scale: 0.25, at: { at: 'team:all', offset: [0, 1.0, 1.3] } }),
    sfx(1.2, 'snap'),
    rig(1.2, 'bridge', 'unravel', { spare: 'team:all' }, 2.6),
    b(1.2, 'tweenTo', { who: 'yarn', scale: 1.7, dur: 2.7, ease: 'linear' }),
    cam(1.5, 'cut', { pos: [0, 3.6, 19], target: [0, -2.2, 0], snap: true }),
    sfx(1.6, 'rattle'), sfx(2.3, 'rattle'), sfx(3.0, 'rattle'),
    emote(1.7, 'team:all', '!', 0.7),
    // nothing left but the team, standing on air with a ball of rope
    cam(3.9, 'frame', { target: 'team:all', height: 1.6, snap: true }),
    play(3.95, 'team:all', 'Cheer'),
    chorus(4.0, 'All tidy!', 1.6),
    b(4.5, 'freeze', { dur: 1.2 }),
    emote(5.8, 'team:all', '…', 0.5, '#ffffff'),
    sfx(6.1, 'slide'),
    rig(6.1, 'bridge', 'fall', { who: 'team:all', stagger: 0.06 }),
    b(6.1, 'tweenTo', { who: 'yarn', by: [0, -9, 0], scale: 0.4, dur: 0.6, ease: 'in' }),
    b(6.75, 'removeProp', { id: 'yarn' }),
    riverReaction(6.6, q.consequence),
  );

  const catchGag = seq(
    cam(0, 'frame', { target: 'team:all', angle: 18, height: 2.2, snap: true }),
    cap(0.1, 'A gust! The lantern swings loose. {team} all lunge for it.', 2.6),
    sfx(0.1, 'whoosh'),
    b(0.1, 'detach', { prop: 'lantern' }),
    b(0.12, 'arc', { id: 'lantern', to: { at: 'team:all', offset: [0, 2.7, 0.3] }, dur: 0.55, height: 1.2, spin: 120 }),
    emote(0.3, 'team:all', '!', 0.6),
    // everyone jumps for it at the same moment...
    play(0.7, 'team:all', 'Jump_Full_Short'),
    chorus(0.75, "I'VE GOT IT!", 1.0, 'shout'),
    // ...and they bonk heads; the lantern bounces off the lot of them and over the side
    sfx(1.15, 'bonk'),
    b(1.15, 'fx', { kind: 'stars', at: { at: 'team:all', offset: [0, 2.1, 0] }, count: 14 }),
    b(1.2, 'arc', { id: 'lantern', to: [7, -8.6, 9], dur: 1.6, height: 6, spin: 260 }),
    sfx(1.2, 'whoosh'),
    cam(1.3, 'cut', { pos: [-6, 5, 17], target: [1, 0.5, 2], snap: true }),
    emote(1.5, 'team:all', '!', 0.8),
    // ...and a long, long silence
    b(2.3, 'face', { who: 'team:all', at: 0, dur: 0.5 }),
    cam(2.9, 'frame', { target: 'team:all', height: 1.9, angle: 0, snap: true }),
    sfx(3.8, 'clink', 0.35),
    b(4.0, 'lights', { level: 0.03, dur: 0.2 }),
    b(4.0, 'removeProp', { id: 'lantern' }),
    chorus(4.3, '…oops.', 1.4, 'whisper'),
    b(4.5, 'freeze', { dur: 1.2 }),
    sfx(5.8, 'creak'),
    sfx(6.0, 'snap'),
    chorus(6.05, 'AAAAH!', 0.7, 'shout'),
    rig(6.05, 'bridge', 'collapse', null, 0.3),
    rig(6.05, 'bridge', 'fall', { who: 'team:all', stagger: 0.06 }),
    sfx(6.1, 'slide'),
    b(6.8, 'lights', { level: 0.7, dur: 0.5 }),
    riverReaction(6.8, q.consequence),
  );

  const sturdiness = seq(
    cam(0, 'frame', { target: 'team:all', angle: -30, height: 2.2, snap: true }),
    cap(0.1, '{team}: "Is this even safe? Let\'s all test it."', 2.6),
    b(0.5, 'hop', { who: 'team:all', count: 2, height: 1.0, dur: 1.1 }),
    sfx(0.5, 'boing'), sfx(1.05, 'boing'),
    sfx(1.0, 'thud'), rig(1.0, 'bridge', 'bounce', { who: 'team:all', amount: 0.3 }),
    b(1.0, 'fx', { kind: 'dust', at: 'team:all', count: 12, scale: 1.4 }),
    sfx(1.55, 'thud'), rig(1.55, 'bridge', 'bounce', { who: 'team:all', amount: 0.45 }),
    b(1.55, 'fx', { kind: 'dust', at: 'team:all', count: 14, scale: 1.4 }),
    play(1.8, 'team:all', 'Cheer'),
    chorus(1.85, 'Solid!', 1.0),
    // the beat of silence... then the planks under all of them let go at once
    sfx(2.9, 'snap'),
    rig(2.9, 'bridge', 'collapse', null, 0.3),
    rig(2.95, 'bridge', 'fall', { who: 'team:all', stagger: 0.05 }),
    sfx(2.95, 'slide'),
    cam(3.0, 'frame', { target: 'team:all', height: 7, dist: 6, angle: 0, snap: true }),
    b(3.6, 'freeze', { dur: 1.2 }),
    // from the river, a small voice
    cam(4.9, 'cut', RIVER_CAM),
    emote(5.1, 'team:all', '?', 0.9, '#ffffff'),
    chorus(5.4, "We're okay!", 1.0, 'whisper'),
    sfx(5.9, 'creak'),
    sfx(6.2, 'snap'),
    rig(6.2, 'bridge', 'swing', null, 0.9),
    riverReaction(6.9, q.consequence),
  );

  const celebration = seq(
    cam(0, 'frame', { target: 'team:all', angle: -20, height: 1.2, snap: true }),
    cap(0.1, '{team}: "WE MADE IT!" (They were halfway.)', 2.8),
    play(0.1, 'team:all', 'Cheer'),
    chorus(0.15, 'WE MADE IT!', 1.2, 'shout'),
    cam(1.4, 'frame', { target: 'team:all', angle: 10, height: 3.2, dist: 15, snap: true }),
    // a victory dance: every landing costs the bridge a few planks
    b(1.5, 'hop', { who: 'team:all', count: 3, height: 1.1, dur: 1.65 }),
    b(1.5, 'tweenTo', { who: 'team:all', rot: [0, 810, 0], dur: 1.65, ease: 'linear' }),
    play(1.5, 'team:all', 'Cheer', { loop: true, speed: 1.4 }),
    ...[2.05, 2.6, 3.15].map((t, i) => [
      sfx(t, 'thud'), sfx(t + 0.02, 'snap'),
      rig(t, 'bridge', 'bounce', { who: 'team:all', amount: 0.35 }),
      rig(t, 'bridge', 'shed', { n: 2 + i }, 0.3),
      cam(t, 'shake', { intensity: 0.2 + i * 0.1, dur: 0.3 }),
      b(t, 'fx', { kind: 'dust', at: 'team:all', count: 10, scale: 1.4 }),
    ]),
    emote(2.2, 'team:all', '♪', 0.8),
    play(3.2, 'team:all', 'Cheer'),
    chorus(3.25, 'Ta-da!', 1.2),
    b(3.7, 'freeze', { dur: 1.2 }),
    emote(5.0, 'team:all', '…', 0.5, '#ffffff'),
    sfx(5.4, 'snap'),
    rig(5.4, 'bridge', 'collapse', null, 0.2),
    rig(5.45, 'bridge', 'fall', { who: 'team:all', stagger: 0.07 }),
    sfx(5.5, 'slide'),
    riverReaction(6.3, q.consequence),
  );

  return { setup, approach, moment, success, fail: { sweater, catch: catchGag, sturdiness, celebration } };
}
