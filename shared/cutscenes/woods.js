// Quest 2: The Whispering Woods. The team (single file, facing +X) hides behind the third big tree (mark `mid`)
// when the outcome starts; the patrol sk1..sk3 has stopped on the road beyond it and sk3 is staring their way.
import { b, cam, cap, emote, play, rig, say, seq, sfx } from './util.js';

export const woodsSceneIds = ['sk1', 'sk2', 'sk3'];
const SK = woodsSceneIds;
const ROAD = -3.5;
/** March the patrol so its leader ends at x. */
const march = (t, x, dur) => SK.map((s, i) => b(t, 'walkTo', { who: s, to: [x - i * 2.2, ROAD], dur, anim: 'Walking_D_Skeletons' }));
const all = (t, op, args) => SK.map((s) => b(t, op, { who: s, ...args }));

/** Skeletons give chase; the team legs it down the lane, glaring at the culprit as they go. */
const chase = (t, text, end = 8) => {
  const d = +(end - t + 0.4).toFixed(2);
  return [
    cap(t, text, +Math.min(2.6, d).toFixed(2)),
    sfx(t, 'alarm'),
    b(t, 'formation', { name: 'column', center: 'away', spacing: 1.5, run: true, dur: d }),
    ...SK.map((s, i) => b(t + 0.15 + i * 0.1, 'runTo', { who: s, to: [13 - i * 2, 3.2], dur: +(d - 0.2 - i * 0.1).toFixed(2) })),
    cam(t, 'frame', { target: 'team:all', angle: 38, height: 2.3, dist: 11.5, snap: true }),
    b(t + 0.1, 'fx', { kind: 'dust', at: 'team:all', count: 18, scale: 1.4 }),
    sfx(t + 0.5, 'wahwah'),
    b(t + 1.0, 'lookAt', { who: 'team:others', at: 'culprit', dur: 0.7 }),
    emote(t + 1.1, 'team:others', '…', +Math.min(1.2, end + 0.4 - t - 1.1).toFixed(2), '#ffffff'),
  ];
};

export function woodsBeats(q) {
  const setup = seq(
    cam(0, 'cut', { pos: [-8, 8, 21], target: [-9, 0.5, -1], snap: true }),
    cam(0.1, 'cut', { pos: [-10, 3.6, 12.5], target: [-10, 1.2, 0], lag: 1.5 }),
    cap(0.2, '{intro}', 4.4),
    march(0, -5.4, 4.9),
    sfx(0.6, 'rattle', 0.5), sfx(2.4, 'rattle', 0.5),
    b(0.3, 'formation', { name: 'column', center: 'start', spacing: 1.25, walk: true, dur: 2.9, anim: 'Walking_B' }),
    b(3.4, 'banner', { who: 'team:all', dur: 1.5 }),
    sfx(3.3, 'tiptoe'),
  );

  const approach = seq(
    cam(0, 'frame', { target: 'team:all', height: 3.0, dist: 11.5, angle: 6, lag: 0.5 }),
    cap(0.2, q.approach, 4.2),
    march(0, 5.6, 6.3),
    // dash 1
    sfx(0.6, 'tiptoe'),
    b(0.6, 'formation', { name: 'column', center: 'tree2', spacing: 1.25, run: true, dur: 0.95 }),
    b(1.6, 'fx', { kind: 'dust', at: 'team:all', count: 6 }),
    // the rear skeleton glances back
    b(2.1, 'face', { who: 'sk3', at: 0, dur: 0.3 }),
    emote(2.2, 'sk3', '?', 0.8, '#ffffff'),
    b(2.2, 'tremble', { who: 'team:all', dur: 0.9, amount: 0.03 }),
    emote(2.25, 'team:all', '!', 0.7),
    b(3.1, 'face', { who: 'sk3', at: 90, dur: 0.3 }),
    // dash 2
    sfx(3.7, 'tiptoe'),
    b(3.7, 'formation', { name: 'column', center: 'mid', spacing: 1.25, run: true, dur: 0.95 }),
    b(4.7, 'fx', { kind: 'dust', at: 'team:all', count: 6 }),
    sfx(5.6, 'snap', 0.7), // a twig
    emote(5.7, 'team:all', '…', 0.9, '#ffffff'),
  );

  const moment = seq(
    b(0, 'music', { track: 'stop' }),
    sfx(0.05, 'stinger'),
    all(0, 'play', { anim: 'Idle' }),
    cam(0.1, 'pushIn', { target: 'sk3', dist: 12, angle: -28, dur: 2.8 }),
    cap(0.3, q.moment, 2.4),
    b(0.5, 'face', { who: 'sk3', at: 0, dur: 1.7, }),
    sfx(0.9, 'rattle', 0.6),
    b(0.6, 'tremble', { who: 'team:all', dur: 2.2, amount: 0.025 }),
  );

  const success = seq(
    cam(0, 'cut', { pos: [9.5, 3.2, 9], target: [2.5, 1.1, -1.5], snap: true }),
    emote(0.2, 'sk3', '?', 0.9, '#ffffff'),
    cap(0.3, q.success, 3.8),
    play(0.6, 'sk3', 'Idle_B'),
    b(1.2, 'face', { who: 'sk3', at: 90, dur: 0.35 }),
    sfx(1.3, 'rattle', 0.5),
    march(1.5, 19, 3.8),
    // the hero's silent thumbs-up from the shadows
    cam(2.3, 'closeUp', { target: 'hero', dist: 4.4, snap: true }),
    b(2.2, 'face', { who: 'hero', at: 0, dur: 0.25 }),
    play(2.5, 'hero', 'Cheer'),
    sfx(2.5, 'fanfare', 0.6),
    b(2.5, 'banner', { who: 'hero', dur: 2.4 }),
    b(2.7, 'fx', { kind: 'sparkle', at: 'hero', count: 18 }),
    cam(3.6, 'frame', { target: 'team:all', height: 2.1, lag: 0.4 }),
    b(3.6, 'face', { who: 'team:others', at: 0, dur: 0.25 }),
    b(3.8, 'hop', { who: 'team:others', count: 2, height: 0.35, stagger: 0.07 }),
    emote(3.8, 'team:others', '♪', 1.2),
  );

  // ---------- fail gags ----------
  const thintree = seq(
    cam(0, 'frame', { target: 'team:all', height: 2.4, angle: 10, snap: true }),
    cap(0.1, '{culprit} spots a MUCH better hiding place.', 2.8),
    emote(0.1, 'culprit', '!', 0.6),
    sfx(0.3, 'tiptoe'),
    b(0.3, 'runTo', { who: 'culprit', to: 'thin', dur: 0.8 }),
    cam(0.5, 'follow', { target: 'culprit', dist: 6.5, height: 2.2, angle: -30, lag: 0.25 }),
    b(1.15, 'face', { who: 'culprit', at: 180, dur: 0.2 }),
    // sucks it in
    sfx(1.4, 'pop'),
    b(1.4, 'tweenTo', { who: 'culprit', scale: [0.6, 1.14, 0.6], dur: 0.25, ease: 'back' }),
    rig(1.4, 'woods', 'twang', null, 0.8),
    say(1.7, 'culprit', 'Perfect.', 1.1, 'whisper'),
    all(1.9, 'lookAt', { at: 'culprit', dur: 0.5 }),
    cam(2.5, 'overShoulder', { target: 'sk1', target2: 'culprit', snap: true }),
    // ...the beat of silence, then three heads tilt as one
    sfx(3.3, 'rattle'),
    all(3.3, 'tilt', { deg: 22, dur: 0.35 }),
    emote(3.35, 'sk1', '?', 1.0, '#ffffff'), emote(3.4, 'sk2', '?', 1.0, '#ffffff'), emote(3.45, 'sk3', '?', 1.0, '#ffffff'),
    cam(3.9, 'closeUp', { target: 'culprit', angle: 180, dist: 4.2, height: 1.7, snap: true }),
    say(3.95, 'culprit', "They can't see me.", 0.45, 'whisper'),
    b(4.3, 'freeze', { dur: 1.2 }),
    all(5.5, 'tilt', { deg: 0, dur: 0.15 }),
    all(5.5, 'play', { anim: 'Taunt' }),
    b(5.55, 'tweenTo', { who: 'culprit', scale: 1, dur: 0.15 }),
    emote(5.55, 'culprit', '!', 0.5),
    chase(5.8, q.consequence),
  );

  const distraction = seq(
    cam(0, 'closeUp', { target: 'culprit', angle: 14, dist: 4.4, snap: true }),
    cap(0.1, '{culprit}: "Watch this. The oldest trick in the book."', 2.8),
    play(0.2, 'culprit', 'PickUp'),
    b(0.8, 'spawnProp', { id: 'rock', model: 'builtin:rock', scale: 1.5 }),
    b(0.85, 'attach', { prop: 'rock', who: 'culprit', slot: 'handslot.r' }),
    b(1.1, 'face', { who: 'culprit', at: 'sk3', dur: 0.2 }),
    play(1.3, 'culprit', 'Throw'),
    say(1.3, 'culprit', 'Distraction!', 1.0, 'whisper'),
    b(1.75, 'detach', { prop: 'rock' }),
    b(1.77, 'arc', { id: 'rock', to: { at: 'sk3', offset: [0, 1.75, 0.2] }, dur: 0.75, height: 2.6, spin: 500 }),
    sfx(1.75, 'whoosh', 0.6),
    cam(1.8, 'cut', { pos: [-5, 2.6, 6.5], target: [1.2, 1.4, -1.5], snap: true }),
    // BONK. Right between the eye sockets.
    sfx(2.52, 'bonk'),
    b(2.52, 'flash', { dur: 0.2 }),
    cam(2.52, 'closeUp', { target: 'sk3', dist: 3.6, snap: true }),
    b(2.52, 'fx', { kind: 'stars', at: { at: 'sk3', offset: [0, 1.6, 0] }, count: 12 }),
    play(2.52, 'sk3', 'Hit_A'),
    b(2.54, 'arc', { id: 'rock', by: [1.5, -1.75, 1.5], dur: 0.6, height: 1.2 }),
    b(2.6, 'tilt', { who: 'sk3', deg: -25, dur: 0.2 }),
    emote(2.7, 'sk3', '★', 1.0),
    cam(3.3, 'closeUp', { target: 'culprit', angle: 14, dist: 4.4, snap: true }),
    b(3.3, 'face', { who: 'culprit', at: 0, dur: 0.2 }),
    play(3.3, 'culprit', 'Cheer'),
    say(3.35, 'culprit', 'Bullseye!', 0.7),
    emote(3.6, 'team:others', '…', 0.8, '#ffffff'),
    b(4.0, 'freeze', { dur: 1.2 }),
    cam(5.25, 'overShoulder', { target: 'sk1', target2: 'team:all', snap: true }),
    b(5.25, 'tilt', { who: 'sk3', deg: 0, dur: 0.15 }),
    all(5.25, 'lookAt', { at: 'team:all', dur: 0.25 }),
    all(5.4, 'play', { anim: 'Taunt' }),
    emote(5.4, 'sk3', '!', 0.5, '#ff5544'),
    chase(5.9, q.consequence),
  );

  const bush = seq(
    cam(0, 'closeUp', { target: 'culprit', angle: 12, dist: 5.2, height: 1.6, snap: true }),
    cap(0.1, "{culprit}'s bush disguise is flawless. Except for the legs.", 3.0),
    sfx(0.2, 'poof'),
    b(0.2, 'fx', { kind: 'leaves', at: { at: 'culprit', offset: [0, 1, 0] }, count: 22 }),
    b(0.2, 'spawnProp', { id: 'bush', model: 'builtin:bush', scale: 0.95 }),
    b(0.22, 'attach', { prop: 'bush', who: 'culprit', slot: 'body', offset: [0, 0.5, 0] }),
    // waddles out into the open
    sfx(0.7, 'tiptoe'),
    b(0.7, 'walkTo', { who: 'culprit', to: 'open', dur: 1.3 }),
    b(0.7, 'hop', { who: 'culprit', count: 4, height: 0.14, dur: 1.3 }),
    cam(0.9, 'cut', { pos: [9.5, 2.3, 6.2], target: [5.2, 0.9, -1.8], snap: true }),
    all(1.9, 'lookAt', { at: 'culprit', dur: 0.3 }),
    emote(2.0, 'sk2', '?', 0.7, '#ffffff'),
    all(2.6, 'face', { at: 90, dur: 0.3 }),
    // red light, green light
    sfx(3.0, 'tiptoe'),
    b(3.0, 'walkTo', { who: 'culprit', to: 'open2', dur: 0.7 }),
    b(3.0, 'hop', { who: 'culprit', count: 3, height: 0.16, dur: 0.7 }),
    sfx(3.7, 'rattle'),
    all(3.7, 'lookAt', { at: 'culprit', dur: 0.12 }),
    emote(3.75, 'sk1', '!', 0.6), emote(3.75, 'sk2', '!', 0.6), emote(3.75, 'sk3', '!', 0.6),
    cam(4.0, 'closeUp', { target: 'culprit', angle: 25, dist: 4.6, height: 1.0, snap: true }),
    say(4.1, 'culprit', "…I'm a bush.", 0.45, 'whisper'),
    b(4.5, 'freeze', { dur: 1.2 }),
    all(5.75, 'play', { anim: 'Taunt' }),
    b(5.75, 'hop', { who: 'culprit', count: 1, height: 0.7, dur: 0.3 }),
    chase(6.0, q.consequence),
  );

  const sneeze = seq(
    cam(0, 'closeUp', { target: 'culprit', angle: 12, dist: 4.2, snap: true }),
    cap(0.1, '{culprit} feels a sneeze coming on.', 2.6),
    b(0.2, 'tremble', { who: 'culprit', dur: 1.9, amount: 0.05 }),
    say(0.3, 'culprit', 'Ah…', 0.6),
    b(0.5, 'lookAt', { who: 'team:others', at: 'culprit', dur: 0.3 }),
    emote(0.7, 'team:others', '!', 0.7),
    say(1.0, 'culprit', 'AH…', 0.7),
    b(1.0, 'tweenTo', { who: 'culprit', scale: [1.12, 1.2, 1.12], dur: 1.0, ease: 'in' }),
    say(1.3, 'team:others', "Don't.", 0.7, 'whisper'),
    // beat of silence... it passes... no it doesn't
    cam(2.2, 'cut', { pos: [-4.5, 3.4, 11], target: [2, 1.4, -1], snap: true }),
    say(2.3, 'culprit', 'CHOO!', 0.9, 'shout'),
    sfx(2.3, 'sneeze'),
    b(2.3, 'flash', { dur: 0.25 }),
    cam(2.3, 'shake', { intensity: 0.6, dur: 0.5 }),
    b(2.3, 'tweenTo', { who: 'culprit', scale: 1, dur: 0.12 }),
    play(2.3, 'culprit', 'Hit_B'),
    rig(2.3, 'woods', 'bare', null, 0.5),
    b(2.3, 'tweenTo', { who: 'team:others', by: [-0.6, 0, 0], dur: 0.25, ease: 'out', stagger: 0.03 }),
    // one skeleton simply falls apart
    cam(2.6, 'closeUp', { target: 'sk3', angle: -28, dist: 4.8, height: 1.6, snap: true }),
    play(2.5, 'sk3', 'Death_C_Skeletons', { speed: 2.2, then: 'hold' }),
    sfx(2.6, 'rattle'), sfx(2.9, 'rattle', 0.7),
    b(2.7, 'fx', { kind: 'bones', at: { at: 'sk3', offset: [0, 1, 0] }, count: 16 }),
    b(2.9, 'lookAt', { who: 'sk1', at: 'sk3', dur: 0.3 }), b(2.9, 'lookAt', { who: 'sk2', at: 'sk3', dur: 0.3 }),
    cam(3.5, 'closeUp', { target: 'culprit', angle: 12, dist: 4.2, snap: true }),
    b(3.5, 'face', { who: 'culprit', at: 0, dur: 0.2 }),
    play(3.55, 'culprit', 'Cheer'),
    say(3.6, 'culprit', 'Much better!', 0.45),
    b(4.0, 'freeze', { dur: 1.2 }),
    // it pulls itself together. Angrily.
    cam(5.25, 'closeUp', { target: 'sk3', angle: -28, dist: 4.8, height: 1.6, snap: true }),
    play(5.25, 'sk3', 'Death_C_Skeletons_Resurrect', { speed: 3.4, then: 'Taunt' }),
    sfx(5.3, 'rattle'),
    emote(5.9, 'sk3', '!', 0.6, '#ff5544'),
    b(5.8, 'lookAt', { who: 'sk1', at: 'team:all', dur: 0.2 }), b(5.8, 'lookAt', { who: 'sk2', at: 'team:all', dur: 0.2 }),
    chase(6.1, q.consequence),
  );

  return { setup, approach, moment, success, fail: { thintree, distraction, bush, sneeze } };
}
