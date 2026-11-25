// Quest 4: The Dragon's Hoard. At the outcome the team stands single file at `mid`, facing the sleeping dragon (+X),
// whose snout rests on the floor a few steps ahead (`nose`). The crown (scene prop `crown`) sits on its head.
// The whole team succeeds or fails together: every outcome shows all of them doing it, nobody singled out.
import { b, cam, cap, chorus, emote, play, rig, seq, sfx } from './util.js';

export const dragonSceneIds = ['crown'];
const TWO_SHOT = { pos: [-0.6, 2.7, 12], target: [1.5, 1.5, 2.0], snap: true }; // team on the left, dragon's face on the right
const zzz = (t, v = 0.6) => [b(t, 'emote', { at: 'head', text: 'Zzz', dur: 1.3, color: '#cfe4ff', height: 1.2 }), sfx(t, 'snore', v)];

/** The dragon is awake. A fireball chases the team back to the cave mouth and leaves them charcoal. */
const flee = (t, text, { end = 8, from = 'maw' } = {}) => [
  cap(t, text, +Math.min(2.6, end + 0.4 - t).toFixed(2)),
  rig(t, 'dragon', 'roar', null, 0.4),
  sfx(t, 'roar'),
  cam(t, 'shake', { intensity: 0.5, dur: 0.5 }),
  b(t + 0.1, 'formation', { name: 'column', center: 'out', spacing: 1.5, facing: -90, run: true, dur: 1.4 }),
  cam(t + 0.1, 'frame', { target: 'team:all', angle: -42, height: 2.3, dist: 12.5, snap: true }),
  b(t + 0.4, 'spawnProp', { id: 'fb', model: 'scene:fireball', at: from }),
  sfx(t + 0.4, 'fwoosh'),
  b(t + 0.42, 'tweenTo', { who: 'fb', pos: { at: 'out', offset: [0.5, 1.2, 0] }, dur: 1.2, ease: 'in' }),
  // caught, right at the exit
  b(t + 1.62, 'removeProp', { id: 'fb' }),
  b(t + 1.62, 'flash', { color: '#ff8a20', dur: 0.4 }),
  sfx(t + 1.62, 'poof'),
  b(t + 1.62, 'fx', { kind: 'firePuff', at: { at: 'out', offset: [0, 1, 0] }, count: 40, scale: 2.2 }),
  rig(t + 1.64, 'dragon', 'soot', { who: 'team:all' }),
  b(t + 1.66, 'face', { who: 'team:all', at: 0, dur: 0.1 }),
  cam(t + 1.66, 'frame', { target: 'team:all', angle: 0, height: 1.9, snap: true }),
  sfx(t + 1.75, 'wahwah'),
  emote(t + 2.0, 'team:all', '…', +Math.min(1.0, end + 0.4 - t - 2.0).toFixed(2), '#ffffff'),
];

export function dragonBeats(q) {
  const setup = seq(
    cam(0, 'cut', { pos: [-7, 9, 26], target: [4, 2.5, -1], snap: true }),
    cam(0.1, 'cut', { pos: [-10, 4, 15], target: [-2, 2.2, 0], lag: 1.7 }),
    cap(0.2, '{intro}', 4.4),
    zzz(0.5), zzz(2.6),
    b(0.3, 'formation', { name: 'column', center: 'start', spacing: 1.4, walk: true, dur: 3.0, anim: 'Walking_B' }),
    sfx(1.5, 'tiptoe', 0.7),
    b(3.4, 'banner', { who: 'team:all', dur: 1.5 }),
    b(4.4, 'fx', { kind: 'sparkle', at: 'head', count: 10 }),
  );

  const approach = seq(
    cam(0, 'frame', { target: 'team:all', height: 2.8, dist: 12, angle: -16, lag: 0.5 }),
    cap(0.2, q.approach, 4.2),
    b(0.2, 'formation', { name: 'column', center: 'mid', spacing: 1.3, walk: true, dur: 5.2, anim: 'Walking_B' }),
    zzz(0.4, 0.5),
    sfx(1.0, 'tiptoe'), sfx(2.2, 'tiptoe'),
    sfx(1.4, 'clink', 0.5), b(1.4, 'fx', { kind: 'coinBurst', at: 'team:all', count: 5, scale: 0.8 }),
    zzz(2.6, 0.5),
    // a coin stack goes over. Everybody stops breathing.
    sfx(3.6, 'clink'), sfx(3.75, 'clink', 0.7), sfx(3.9, 'clink', 0.4),
    rig(3.6, 'dragon', 'topple', null, 0.6),
    emote(3.7, 'team:all', '!', 0.7),
    cam(4.3, 'cut', TWO_SHOT),
    rig(4.5, 'dragon', 'sniff', null, 0.9),
    sfx(4.5, 'snore', 0.8),
    b(4.6, 'tremble', { who: 'team:all', dur: 1.0, amount: 0.025 }),
    zzz(6.0, 0.5),
  );

  const moment = seq(
    b(0, 'music', { track: 'stop' }),
    sfx(0.05, 'stinger', 0.8),
    cam(0, 'cut', { pos: [8.2, 2.5, 6.6], target: 'eye', snap: true, fov: 30 }),
    cam(0.1, 'cut', { pos: [6.9, 2.3, 4.6], target: 'eye', lag: 1.1, fov: 24 }),
    cap(0.3, q.moment, 2.4),
    rig(1.4, 'dragon', 'twitch', null, 1.2),
  );

  const success = seq(
    cam(0, 'cut', TWO_SHOT),
    zzz(0.2), zzz(4.1, 0.4),
    cap(0.3, q.success, 3.8),
    sfx(0.3, 'tiptoe'),
    // the whole team tiptoes up together and lifts the crown off as one
    b(0.3, 'formation', { name: 'huddle', center: 'crownSpot', spacing: 0.9, walk: true, dur: 1.0, anim: 'Walking_B' }),
    b(1.35, 'face', { who: 'team:all', at: 'head', dur: 0.2 }),
    play(1.5, 'team:all', 'Interact'),
    b(1.9, 'arc', { id: 'crown', to: { at: 'crownSpot', offset: [0, 3.0, 0] }, dur: 0.5, height: 0.8 }),
    sfx(1.9, 'ding', 0.6),
    b(2.2, 'face', { who: 'team:all', at: 0, dur: 0.25 }),
    cam(2.4, 'lowAngle', { target: 'team:all', angle: 12, dist: 6, height: 0.7, snap: true }),
    play(2.5, 'team:all', 'Cheer'),
    sfx(2.6, 'fanfare', 0.5),
    b(2.6, 'banner', { who: 'team:all', dur: 2.4 }),
    b(2.7, 'fx', { kind: 'sparkle', at: { at: 'team:all', offset: [0, 1.6, 0] }, count: 30, scale: 1.4 }),
    cam(3.7, 'cut', { pos: [-1.5, 2.6, 13], target: [0.2, 1.5, 2.5], snap: true }),
    b(3.8, 'hop', { who: 'team:all', count: 2, height: 0.35, stagger: 0.07 }),
    emote(3.8, 'team:all', '♪', 1.2),
  );

  // ---------- fail gags: the whole team does it together ----------
  const counting = seq(
    cam(0, 'frame', { target: 'team:all', angle: 14, height: 2, snap: true }),
    cap(0.1, 'The team decides to count the gold. Out loud. Together.', 2.4),
    play(0.15, 'team:all', 'PickUp'),
    chorus(0.4, 'One…', 0.5),
    sfx(0.45, 'clink', 0.5),
    chorus(1.0, 'two…', 0.5),
    sfx(1.05, 'clink', 0.5),
    play(1.0, 'team:all', 'PickUp'),
    chorus(1.6, 'three…', 0.5),
    sfx(1.65, 'clink', 0.5),
    b(2.2, 'title', { text: '46 coins later…', dur: 1.1 }),
    b(2.3, 'formation', { name: 'column', center: 'mid', spacing: 1.3 }),
    play(2.4, 'team:all', 'Sit_Floor_Down', { then: 'Sit_Floor_Idle' }),
    cam(3.3, 'cut', TWO_SHOT),
    chorus(3.4, '…forty-seven.', 0.7),
    sfx(3.5, 'clink'),
    // the eye opens
    cam(3.8, 'cut', { pos: [6.9, 2.3, 4.6], target: 'eye', snap: true, fov: 24 }),
    sfx(3.9, 'pop'),
    rig(3.9, 'dragon', 'openEye', null, 0.1),
    cam(4.1, 'cut', TWO_SHOT),
    chorus(4.15, 'Forty-eight!', 0.3, 'shout'),
    b(4.35, 'freeze', { dur: 1.2 }),
    play(5.55, 'team:all', 'Sit_Floor_StandUp', { speed: 3 }),
    flee(5.6, q.consequence),
  );

  const goodboy = seq(
    cam(0, 'cut', TWO_SHOT),
    cap(0.1, 'The team pets the dragon. "Who\'s a good boy?"', 2.8),
    b(0.1, 'formation', { name: 'huddle', center: 'petSpot', spacing: 0.9, walk: true, dur: 0.8 }),
    b(0.95, 'face', { who: 'team:all', at: 'head', dur: 0.15 }),
    play(1.0, 'team:all', 'Interact', { loop: true, speed: 1.3 }),
    chorus(1.05, 'Good boy!', 1.0),
    sfx(1.3, 'purr'),
    rig(1.3, 'dragon', 'purr', null, 1.2),
    b(1.5, 'emote', { at: 'head', text: '♥', dur: 1.0, color: '#ff6a8a', height: 1.2 }),
    // nose twitches... the beat of silence...
    rig(2.5, 'dragon', 'sniff', null, 0.5),
    emote(2.6, 'team:all', '?', 0.5, '#ffffff'),
    rig(3.0, 'dragon', 'inhale', null, 0.3),
    cam(3.25, 'cut', { pos: [-6.5, 3.2, 10.5], target: [0.5, 1.6, 2], snap: true }),
    rig(3.3, 'dragon', 'sneeze', null, 0.5),
    b(3.4, 'flash', { color: '#ff8a20', dur: 0.4 }),
    cam(3.4, 'shake', { intensity: 0.7, dur: 0.5 }),
    rig(3.55, 'dragon', 'soot', { who: 'team:all' }),
    play(3.6, 'team:all', 'Idle'),
    b(3.6, 'face', { who: 'team:all', at: 0, dur: 0.15 }),
    // everyone is charcoal. Blink. Blink.
    cam(3.95, 'frame', { target: 'team:all', angle: 0, height: 1.9, snap: true }),
    play(4.0, 'team:all', 'Cheer'),
    chorus(4.05, 'He likes us!', 0.3),
    b(4.3, 'freeze', { dur: 1.2 }),
    flee(5.6, q.consequence),
  );

  const plume = seq(
    cam(0, 'cut', TWO_SHOT),
    cap(0.1, 'The team checks the dragon is asleep. With a feather.', 3.0),
    b(0.1, 'formation', { name: 'huddle', center: 'nose', spacing: 0.9, walk: true, dur: 0.8 }),
    b(0.95, 'face', { who: 'team:all', at: 'snout', dur: 0.2 }),
    // everyone holds the one feather to its nose
    b(1.0, 'spawnProp', { id: 'plume', model: 'builtin:feather', scale: 1.5, at: { at: 'snout', offset: [-0.5, 0.1, 0] } }),
    play(1.0, 'team:all', 'Interact', { loop: true }),
    chorus(1.2, 'All clear!', 0.9, 'whisper'),
    rig(1.5, 'dragon', 'sniff', null, 0.5),
    b(1.5, 'tweenTo', { who: 'plume', rot: [0, 0, 25], dur: 0.25 }), b(1.75, 'tweenTo', { who: 'plume', rot: [0, 0, -20], dur: 0.25 }), b(2.0, 'tweenTo', { who: 'plume', rot: [0, 0, 20], dur: 0.25 }),
    emote(1.7, 'team:all', '!', 0.6),
    // slow-motion sneeze build-up
    cam(2.2, 'cut', { pos: [-0.5, 2.3, 9.5], target: [2.6, 2.2, 2.2], snap: true }),
    b(2.2, 'slowmo', { scale: 0.3, dur: 1.2 }),
    rig(2.2, 'dragon', 'inhale', null, 0.34),
    sfx(2.3, 'snore', 0.9),
    play(2.25, 'team:all', 'Cheer'),
    b(3.4, 'freeze', { dur: 1.2 }),
    rig(4.65, 'dragon', 'sneeze', null, 0.5),
    b(4.75, 'flash', { color: '#ff8a20', dur: 0.4 }),
    cam(4.75, 'shake', { intensity: 0.8, dur: 0.5 }),
    rig(4.9, 'dragon', 'soot', { who: 'team:all' }),
    cam(4.95, 'cut', TWO_SHOT),
    b(5.02, 'tweenTo', { who: 'plume', by: [-0.6, -1.4, 0.4], rot: [0, 0, 200], scale: 0.9, dur: 0.55, ease: 'out' }),
    play(5.0, 'team:all', 'Hit_B'),
    flee(5.6, q.consequence),
  );

  const angle = seq(
    cam(0, 'cut', { pos: [-4.5, 4.2, 15], target: [5, 3.2, 0], snap: true }),
    cap(0.1, 'The whole team climbs onto the dragon. "For a better angle."', 2.8),
    b(0.1, 'runTo', { who: 'team:all', to: 'climb', dur: 0.75 }),
    sfx(0.85, 'boing'),
    b(0.87, 'arc', { id: 'team:all', to: 'back', dur: 0.7, height: 2.6, stagger: 0.04 }),
    // everyone shuffles into a row along its back
    b(1.75, 'formation', { name: 'arc', center: 'back', facing: 0, spacing: 0.75, y: 6.25 }),
    b(1.76, 'face', { who: 'team:all', at: 0, dur: 0.15 }),
    play(1.8, 'team:all', 'Cheer'),
    chorus(1.85, 'Great view!', 0.9),
    b(1.9, 'hop', { who: 'team:all', count: 3, height: 0.3, dur: 0.8, stagger: 0.05 }),
    // one eye opens
    cam(2.6, 'cut', { pos: [6.9, 2.3, 4.6], target: 'eye', snap: true, fov: 24 }),
    sfx(2.9, 'pop'),
    rig(2.9, 'dragon', 'openEye', null, 0.1),
    cam(3.35, 'cut', { pos: [-5.5, 3.6, 16], target: [4.5, 4.6, 0], snap: true }),
    rig(3.35, 'dragon', 'roar', null, 0.45),
    sfx(3.4, 'roar', 0.8),
    cam(3.4, 'shake', { intensity: 0.4, dur: 0.4 }),
    play(3.5, 'team:all', 'Cheer'),
    b(4.0, 'freeze', { dur: 1.2 }),
    // it shrugs, and the whole team slides off together
    cam(5.22, 'shake', { intensity: 0.5, dur: 0.4 }),
    sfx(5.25, 'whoosh'),
    chorus(5.3, 'Wheee!', 0.6, 'shout'),
    b(5.25, 'arc', { id: 'team:all', by: [-8, -6.25, 3.5], dur: 0.45, height: 1.5, stagger: 0.03 }),
    sfx(5.72, 'thud'),
    flee(5.75, q.consequence),
  );

  return { setup, approach, moment, success, fail: { counting, goodboy, plume, angle } };
}
