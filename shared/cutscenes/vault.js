// Quest 3: The Vault. At the outcome the team stands single file on the carpet (centre `mid`, facing the door, +X)
// and the lead is at the wheel (`pick`). Guards: g1/g2 hidden off-stage, g3 on his break inside the vault.
// The whole team succeeds or fails together: every outcome shows all of them doing it, nobody singled out.
import { b, cam, cap, chorus, emote, play, rig, say, seq, sfx } from './util.js';

export const vaultSceneIds = ['g1', 'g2', 'g3'];
const DOOR_CAM = { pos: [3.2, 3.1, 6.8], target: [11.5, 2.2, 0], snap: true }; // three-quarter view of the door over the team

/** Alarm. Guards storm in, the team is flung down the hall and lands in a heap at the front gate. */
const tossOut = (t, text, end = 8) => [
  cap(t, text, +Math.min(2.6, end + 0.4 - t).toFixed(2)),
  sfx(t, 'alarm'), rig(t, 'vault', 'alarm'),
  b(t, 'show', { who: 'g1' }), b(t, 'show', { who: 'g2' }),
  cam(t, 'cut', { pos: [1, 5.5, 15], target: [6, 1, 0], snap: true }),
  b(t + 0.02, 'runTo', { who: 'g1', to: { at: 'team:all', offset: [1.6, 0, 2.4] }, dur: 0.5 }),
  b(t + 0.02, 'runTo', { who: 'g2', to: { at: 'team:all', offset: [-1.6, 0, 2.6] }, dur: 0.5 }),
  say(t + 0.4, 'g1', 'OUT!', 0.6, 'shout'),
  sfx(t + 0.55, 'whoosh'),
  b(t + 0.55, 'arc', { id: 'team:all', by: [-10, 0, 0], height: 5, dur: 0.55, stagger: 0.03 }),
  b(t + 0.55, 'tweenTo', { who: 'team:all', rot: [0, 90, 400], dur: 0.6, ease: 'linear', key: 'spin' }),
  // ...and they arrive at the front gate, one thud at a time
  cam(t + 1.0, 'cut', { pos: [-9.2, 2.3, 9.2], target: [-12.6, 1.0, 1.2], snap: true }),
  b(t + 1.25, 'tweenTo', { who: 'team:all', rot: [0, 0, 0], scale: 1, dur: 0.01, key: 'spin' }),
  b(t + 1.3, 'formation', { name: 'line', center: 'gate', facing: 0, spacing: 1.5, y: 9 }),
  b(t + 1.32, 'tweenTo', { who: 'team:all', by: [0, -9, 0], dur: 0.4, ease: 'bounce', stagger: 0.09 }),
  play(t + 1.34, 'team:all', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }),
  sfx(t + 1.5, 'thud'), sfx(t + 1.68, 'thud'),
  b(t + 1.55, 'fx', { kind: 'dust', at: 'gate', count: 20, scale: 1.5 }),
  sfx(t + 1.6, 'wahwah'),
  rig(t + 1.7, 'vault', 'gate', null, 0.5),
  emote(t + 2.0, 'team:all', '…', +Math.min(1.0, end + 0.4 - t - 2.0).toFixed(2), '#ffffff'),
];

export function vaultBeats(q) {
  const setup = seq(
    cam(0, 'cut', { pos: [-4, 9, 21], target: [3, 1.5, -1], snap: true }),
    cam(0.1, 'cut', { pos: [-12, 3.6, 12], target: [-7, 1.6, 0], lag: 1.6 }),
    cap(0.2, '{intro}', 4.4),
    b(0.3, 'formation', { name: 'column', center: 'start', spacing: 1.5, walk: true, dur: 3.0, anim: 'Walking_B' }),
    sfx(1.2, 'tiptoe'), sfx(2.4, 'tiptoe'),
    b(3.4, 'banner', { who: 'team:all', dur: 1.5 }),
    b(3.6, 'face', { who: 'team:all', at: 0, dur: 0.3 }),
    b(4.4, 'face', { who: 'team:all', at: 90, dur: 0.3 }),
  );

  const approach = seq(
    cam(0, 'frame', { target: 'team:all', height: 2.8, dist: 12, angle: -24, lag: 0.5 }),
    cap(0.2, q.approach, 4.2),
    b(0.2, 'formation', { name: 'column', center: 'mid', spacing: 1.3, walk: true, dur: 3.6, anim: 'Walking_B' }),
    sfx(0.8, 'tiptoe'), sfx(2.0, 'tiptoe'), sfx(3.0, 'tiptoe'),
    cam(3.7, 'cut', DOOR_CAM),
    b(3.9, 'walkTo', { who: 'lead', to: 'pick', dur: 1.4 }),
    b(5.35, 'face', { who: 'lead', at: 'door', dur: 0.2 }),
    play(5.5, 'lead', 'Interact', { loop: true, speed: 0.8 }),
    sfx(5.6, 'tick', 0.7), rig(5.6, 'vault', 'tumble', { turns: 0.12 }, 0.4),
    emote(5.7, 'lead', '♪', 0.9),
    sfx(6.4, 'tick', 0.7), rig(6.4, 'vault', 'tumble', { turns: -0.2 }, 0.4),
  );

  const moment = seq(
    b(0, 'music', { track: 'stop' }),
    sfx(0.05, 'stinger', 0.7),
    cam(0.1, 'cut', { pos: [7.4, 3.0, 4.6], target: [12, 3.2, 0], lag: 1.2, fov: 30 }),
    cap(0.3, q.moment, 2.4),
    sfx(0.7, 'tick'), rig(0.7, 'vault', 'tumble', { turns: 0.15 }, 0.35),
    sfx(1.5, 'tick'), rig(1.5, 'vault', 'tumble', { turns: -0.1 }, 0.35),
    b(1.6, 'tremble', { who: 'team:all', dur: 1.3, amount: 0.02 }),
    sfx(2.3, 'tick'), rig(2.3, 'vault', 'tumble', { turns: 0.22 }, 0.35),
    play(2.8, 'lead', 'Idle'),
  );

  const success = seq(
    sfx(0, 'ding'),
    b(0, 'hide', { who: 'g3' }),
    cam(0, 'cut', DOOR_CAM),
    rig(0, 'vault', 'spin', null, 0.9),
    emote(0.1, 'team:all', '!', 0.7),
    cap(0.3, q.success, 3.8),
    sfx(0.9, 'creak'), sfx(1.0, 'fwoosh', 0.6),
    rig(0.9, 'vault', 'open', null, 1.3),
    b(1.6, 'fx', { kind: 'sparkle', at: [12, 2.5, 0], count: 40, scale: 2.2 }),
    b(1.7, 'flash', { color: '#ffe9a0', dur: 0.5 }),
    // the whole team strides into the glow together, and the map rises over all of them
    b(1.6, 'formation', { name: 'huddle', center: [10.9, 1.0], spacing: 1.0, run: true, dur: 0.8 }),
    b(2.4, 'face', { who: 'team:all', at: [0, 3], dur: 0.2 }),
    b(2.3, 'spawnProp', { id: 'map', model: 'builtin:note', scale: 1.3, text: 'X', at: { at: [10.9, 1.0], offset: [0, 3.1, 0] }, rot: [0, -90, 0] }),
    cam(2.5, 'lowAngle', { target: 'team:all', angle: -18, dist: 6.5, snap: true }),
    play(2.6, 'team:all', 'Cheer'),
    sfx(2.6, 'fanfare'),
    b(2.6, 'banner', { who: 'team:all', dur: 2.4 }),
    b(2.9, 'fx', { kind: 'sparkle', at: 'team:all', count: 30, scale: 1.4 }),
    cam(3.7, 'frame', { target: 'team:all', angle: -30, height: 2.4, lag: 0.4 }),
    play(3.8, 'team:all', 'Cheer'),
    b(3.8, 'hop', { who: 'team:all', count: 2, height: 0.45, stagger: 0.07 }),
  );

  // ---------- fail gags: the whole team does it together ----------
  const knock = seq(
    cam(0, 'cut', DOOR_CAM),
    cap(0.1, 'The whole team steps up to the vault and knocks. Politely.', 2.8),
    b(0.1, 'formation', { name: 'line', center: 'knock', facing: 90, spacing: 1.05, walk: true, dur: 0.8 }),
    play(1.1, 'team:all', 'Interact'),
    sfx(1.2, 'knock'),
    chorus(1.25, 'Hello?', 0.9),
    // ...and someone answers
    sfx(2.3, 'creak'),
    rig(2.3, 'vault', 'open', { glow: false }, 0.7),
    b(2.4, 'walkTo', { who: 'g3', to: [12.6, 0.4], dur: 0.6 }),
    cam(3.0, 'cut', { pos: [9.9, 2.0, 6.4], target: [11.7, 1.4, 0.6], snap: true }),
    emote(3.1, 'g3', '?', 0.8, '#ffffff'),
    play(3.3, 'g3', 'Use_Item'), // sips his tea
    chorus(3.9, 'Is the crown in?', 0.5),
    b(4.3, 'freeze', { dur: 1.2 }),
    emote(5.55, 'g3', '!', 0.5, '#ff5544'),
    play(5.55, 'g3', 'Taunt'),
    tossOut(5.7, q.consequence),
  );

  const note = seq(
    cam(0, 'cut', { pos: [5.2, 3.0, 9.6], target: [11, 1.8, 3], snap: true }),
    cap(0.1, 'The team leaves a thank-you note. It seemed only polite.', 3.0),
    b(0.1, 'formation', { name: 'huddle', center: [10.9, 4.0], spacing: 0.9, run: true, dur: 0.7 }),
    b(0.85, 'face', { who: 'team:all', at: 90, dur: 0.15 }),
    play(0.95, 'team:all', 'Use_Item'),
    sfx(1.3, 'pop'),
    b(1.3, 'spawnProp', { id: 'note', model: 'builtin:note', at: [12.82, 1.7, 4.7], rot: [0, -90, 0], scale: 1.9, text: 'Sorry for the\nrobbery! ♥\n— the team' }),
    b(1.5, 'face', { who: 'team:all', at: 0, dur: 0.2 }),
    play(1.6, 'team:all', 'Cheer'),
    chorus(1.65, 'Manners!', 0.9),
    cam(2.2, 'cut', { pos: [9.3, 2.75, 4.7], target: [12.8, 2.65, 4.7], snap: true, fov: 26 }),
    // two guards wander in, walk straight past the team, and stop to read
    b(2.2, 'place', { who: 'g1', at: [3, 6.0], face: 90 }), b(2.2, 'place', { who: 'g2', at: [1.4, 6.3], face: 90 }),
    b(2.25, 'show', { who: 'g1' }), b(2.25, 'show', { who: 'g2' }),
    b(2.3, 'walkTo', { who: 'g1', to: 'guardA', dur: 1.5, anim: 'Walking_D_Skeletons' }), b(2.3, 'walkTo', { who: 'g2', to: 'guardB', dur: 1.5, anim: 'Walking_D_Skeletons' }),
    b(2.6, 'formation', { name: 'huddle', center: [11.0, 2.6], spacing: 0.9, walk: true, dur: 0.6 }),
    cam(3.4, 'cut', { pos: [4.6, 3.2, 11.5], target: [10.2, 1.6, 3.6], snap: true }),
    b(3.85, 'lookAt', { who: 'g1', at: [12.8, 4.7], dur: 0.2 }), b(3.85, 'lookAt', { who: 'g2', at: [12.8, 4.7], dur: 0.2 }),
    b(3.6, 'tremble', { who: 'team:all', dur: 1.0, amount: 0.03 }),
    say(4.1, 'g1', '"…robbery"?', 0.5),
    b(4.5, 'freeze', { dur: 1.2 }),
    b(5.75, 'lookAt', { who: 'g1', at: 'team:all', dur: 0.2 }), b(5.75, 'lookAt', { who: 'g2', at: 'team:all', dur: 0.2 }),
    emote(5.8, 'g1', '!', 0.4, '#ff5544'), emote(5.8, 'g2', '!', 0.4, '#ff5544'),
    tossOut(5.9, q.consequence),
  );

  const lever = seq(
    cam(0, 'cut', { pos: [7.0, 3.0, 2.2], target: [4.4, 2.2, -6.3], snap: true }),
    cap(0.1, 'The team finds a lever. And a sign.', 2.6),
    b(0.1, 'formation', { name: 'huddle', center: { at: 'lever', offset: [0, 0, 1.4] }, spacing: 0.9, run: true, dur: 0.8 }),
    b(0.95, 'face', { who: 'team:all', at: 180, dur: 0.15 }),
    // they read it out loud, all together, one word at a time
    chorus(1.1, 'Do…', 0.5),
    chorus(1.6, 'not…', 0.5),
    chorus(2.1, 'pull.', 0.6),
    emote(2.2, 'team:all', '?', 0.6, '#ffffff'),
    cam(2.7, 'frame', { target: 'team:all', angle: -30, height: 2.2, snap: true }),
    b(2.7, 'face', { who: 'team:all', at: 0, dur: 0.2 }),
    chorus(2.8, 'So… pull?', 0.5),
    cam(3.3, 'cut', { pos: [6.4, 2.8, -0.6], target: [4.4, 1.9, -6.3], snap: true }),
    b(3.3, 'face', { who: 'team:all', at: 180, dur: 0.1 }),
    play(3.3, 'team:all', 'Interact'),
    sfx(3.5, 'thud'),
    rig(3.5, 'vault', 'pull', null, 0.4),
    b(3.9, 'face', { who: 'team:all', at: 0, dur: 0.2 }),
    play(4.0, 'team:all', 'Cheer'),
    chorus(4.05, 'Pulled it!', 0.4),
    b(4.4, 'freeze', { dur: 1.2 }),
    sfx(5.65, 'bell'),
    b(5.65, 'flash', { color: '#ff3020', dur: 0.4 }),
    tossOut(5.8, q.consequence),
  );

  const outward = seq(
    cam(0, 'cut', { pos: [4.6, 3.6, 10.5], target: [10.6, 1.8, 0.8], snap: true }),
    cap(0.1, 'The team cracks the lock in one go, then everyone crowds in for a look.', 3.0),
    play(0.3, 'team:all', 'Interact'),
    sfx(0.6, 'ding'), rig(0.6, 'vault', 'spin', null, 0.7),
    // everyone crowds in for a look
    b(1.4, 'formation', { name: 'line', center: 'crowd', facing: 90, spacing: 1.05, walk: true, dur: 0.9 }),
    emote(1.7, 'team:all', '!', 0.7),
    chorus(1.8, 'All together: pull!', 0.8),
    play(2.0, 'team:all', 'Interact'),
    sfx(2.4, 'creak'),
    rig(2.6, 'vault', 'fall', null, 0.55),
    emote(2.7, 'team:all', '!', 0.4, '#ff5544'),
    sfx(3.15, 'thud'), sfx(3.17, 'rumble', 0.7),
    cam(3.15, 'shake', { intensity: 0.8, dur: 0.5 }),
    b(3.12, 'tweenTo', { who: 'team:all', scale: [1.35, 0.06, 1.35], dur: 0.04 }),
    b(3.15, 'fx', { kind: 'dust', at: [8.6, 0.3, 0], count: 40, scale: 2.4 }),
    b(3.15, 'flash', { dur: 0.2 }),
    // a tiny voice from under the door
    chorus(3.65, 'Ta-da…', 0.45, 'whisper'),
    b(4, 'freeze', { dur: 1.2 }),
    // the door winches itself back up. The team does not.
    sfx(5.25, 'creak'),
    rig(5.25, 'vault', 'rise', null, 0.5),
    cam(5.3, 'cut', { pos: [5.8, 4.2, 5.2], target: [9.3, 0.1, 0.3], snap: true }),
    emote(5.6, 'team:all', '…', 0.4, '#ffffff'),
    tossOut(5.8, q.consequence),
  );

  return { setup, approach, moment, success, fail: { knock, note, lever, outward } };
}
