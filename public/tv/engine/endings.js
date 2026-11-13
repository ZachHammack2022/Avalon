// Beat scripts for the non-quest scenes: assassination reveal and the two victory scenes.
// They use the same ops as quest cutscenes. Player ids are valid actor refs (custom ids).
import { ROLE_INFO } from '/shared/roles-info.js';
import { seatSlots } from '../scenes/campfire.js';

const B = (t, op, rest = {}) => ({ t, op, ...rest });

/** Night campfire. The Assassin stands, takes aim across the fire and looses a (rubber) arrow: it bonks Merlin, or thuds into a log. */
export function assassinationScript(reveal, ids) {
  const a = reveal.assassination; const hit = a.hit;
  const seats = seatSlots(ids.length); const seat = (id) => seats[ids.indexOf(id)];
  /** A camera by the fire looking out at one seat: we see that player's face, lit by the flames. */
  const face = (t, id, extra = {}) => { const s = seat(id); return B(t, 'camera', { shot: 'cut', pos: [s.x * 0.08, 2.1, s.z * 0.08 + 0.5], target: [s.x, 0, s.z], height: 1.75, snap: true, fov: 40, ...extra }); };
  const merlin = ids.find((id) => reveal.roles[id] === 'merlin');
  const evil = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'evil' && id !== a.assassin);
  const good = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'good');
  const others = ids.filter((id) => id !== a.assassin);
  const ts = seat(a.target); const as = seat(a.assassin);
  const miss = [ts.x * 1.9 + 1.2, 1.0, ts.z * 1.9 - 0.5]; // somewhere in the dark behind the target
  const flat = [
    B(0, 'camera', { shot: 'cut', pos: [0, 6.5, 15], target: [0, 1, -1], snap: true }),
    B(0, 'music', { track: 'night' }),
    B(0.1, 'rig', { name: 'fire', action: 'low', dur: 0.9 }),
    B(0.2, 'caption', { text: 'Three quests won. But the Assassin gets one shot at Merlin…', dur: 2.8 }),
    // the Assassin rises
    face(1.0, a.assassin),
    B(1.0, 'music', { track: 'stop' }), B(1.05, 'sfx', { name: 'stinger' }),
    B(1.1, 'play', { who: a.assassin, anim: 'Sit_Floor_StandUp', speed: 1.6, then: '1H_Ranged_Aiming' }),
    B(1.3, 'banner', { who: a.assassin, text: 'The Assassin', dur: 2.2 }),
    B(1.9, 'face', { who: a.assassin, at: [ts.x, ts.z], dur: 0.4 }),
    ...others.map((id) => B(1.6, 'lookAt', { who: id, at: [as.x, as.z], dur: 0.4 })),
    // ...and picks a target
    face(2.9, a.target),
    B(3.0, 'emote', { who: a.target, text: '?', dur: 0.9, color: '#ffffff' }),
    B(3.1, 'tremble', { who: a.target, dur: 0.9, amount: 0.03 }),
    B(3.9, 'camera', { shot: 'cut', pos: [(as.x + ts.x) / 2, 2.6, 12.5], target: [(as.x + ts.x) / 2, 1.2, (as.z + ts.z) / 2], snap: true }),
    B(3.9, 'spawnProp', { id: 'arrow', model: 'prop:arrow', at: [as.x, 1.5, as.z], scale: 2.4 }),
    B(3.95, 'play', { who: a.assassin, anim: '1H_Ranged_Shoot', then: 'Idle' }),
    B(4.0, 'slowmo', { scale: 0.45, dur: 0.7 }),
    B(4.0, 'sfx', { name: 'whoosh' }),
    B(4.0, 'arc', { id: 'arrow', to: hit ? [ts.x, 1.5, ts.z] : miss, dur: hit ? 0.42 : 0.6, height: 1.0, spin: 20 }),
  ];
  if (hit) {
    flat.push(
      face(4.95, a.target), B(4.95, 'sfx', { name: 'bonk' }), B(4.95, 'flash', { dur: 0.25 }), B(4.95, 'removeProp', { id: 'arrow' }),
      B(4.95, 'fx', { kind: 'stars', at: [ts.x, 1.7, ts.z], count: 14 }), B(4.95, 'play', { who: a.target, anim: 'Hit_B' }), B(5.0, 'emote', { who: a.target, text: '★', dur: 0.8 }),
      B(5.3, 'caption', { text: 'A rubber arrow, right between the eyes. {culprit} WAS Merlin!', dur: 2.9 }),
      B(5.5, 'banner', { who: a.target, text: 'Merlin', dur: 2.6 }),
      B(5.9, 'camera', { shot: 'cut', pos: [0, 5.5, 14.5], target: [0, 1, -1], snap: true }),
      B(5.9, 'play', { who: a.target, anim: 'Lie_Down', speed: 2.4, then: 'Lie_Idle' }), B(6.0, 'sfx', { name: 'wahwah' }),
      B(6.0, 'play', { who: a.assassin, anim: 'Cheer' }),
      ...evil.map((id, i) => [B(6.1 + i * 0.15, 'play', { who: id, anim: 'Sit_Floor_StandUp', speed: 2, then: 'Cheer' }), B(6.3 + i * 0.15, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 1.8 })]).flat(),
      ...good.filter((id) => id !== a.target).map((id) => B(6.2, 'emote', { who: id, text: '!', dur: 0.9, color: '#ff5544' })),
    );
  } else {
    flat.push(
      B(4.9, 'sfx', { name: 'thud' }), B(4.9, 'fx', { kind: 'dust', at: miss, count: 12 }),
      face(4.95, a.target), B(5.0, 'emote', { who: a.target, text: '…', dur: 0.8, color: '#ffffff' }),
      B(5.3, 'caption', { text: 'Thunk. Into a tree. {culprit} was never Merlin!', dur: 2.9 }),
      B(5.5, 'banner', { who: a.target, text: ROLE_INFO[reveal.roles[a.target]].name, dur: 2.6 }),
      B(5.9, 'camera', { shot: 'cut', pos: [0, 5.5, 14.5], target: [0, 1, -1], snap: true }),
      B(5.9, 'rig', { name: 'fire', action: 'high' }), B(5.95, 'sfx', { name: 'fanfare' }),
      B(6.0, 'play', { who: a.assassin, anim: 'Hit_A', then: 'Sit_Floor_Down' }), B(6.0, 'emote', { who: a.assassin, text: '!', dur: 0.8, color: '#ff5544' }),
      ...good.map((id, i) => B(6.1 + i * 0.08, 'play', { who: id, anim: 'Sit_Floor_StandUp', speed: 2.2, then: 'Cheer' })),
      ...(merlin ? [B(6.4, 'banner', { who: merlin, text: 'Merlin', dur: 1.8 }), B(6.5, 'fx', { kind: 'sparkle', at: [seat(merlin).x, 1.8, seat(merlin).z], count: 22 })] : []),
    );
  }
  return { scene: 'night', flat: flat.sort((x, y) => x.t - y.t), duration: 8, payload: { team: ids, culprit: a.target, hero: null, seed: 7 }, cast: ids };
}

/** Throne room (scene cast: usurper, heir, crowd c1..c8). Good: the heir is crowned and everybody cheers. Evil: the usurper is crowned and the evil players are revealed one by one beside the throne. */
export function victoryScript(reveal, ids) {
  const good = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'good');
  const evil = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'evil');
  const crowd = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
  const flat = [B(0, 'music', { track: 'scene' }), B(0, 'spawnProp', { id: 'crown', model: 'builtin:crown', scale: 1.5 })];
  if (reveal.winner === 'good') {
    flat.push(B(0, 'camera', { shot: 'cut', pos: [3, 5, 16], target: [8, 1.6, 0], snap: true }), B(0.05, 'attach', { prop: 'crown', who: 'heir', slot: 'head', offset: [0, 0.85, 0] }), B(0.3, 'play', { who: 'heir', anim: 'Cheer' }), B(0.3, 'play', { who: 'usurper', anim: 'Death_A', then: 'hold' }));
    good.forEach((id, i) => flat.push(B(0.1, 'place', { who: id, at: [8.2 - (i % 4) * 1.9, 0, 1.8 + Math.floor(i / 4) * 2.0 - (i % 4) * 0.25], face: 0 }), B(1 + i * 0.15, 'play', { who: id, anim: 'Cheer' }), B(1 + i * 0.12, 'hop', { who: id, count: 3, height: 0.4 }), B(1 + i * 0.1, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 9 })));
    evil.forEach((id, i) => flat.push(B(0.1, 'place', { who: id, at: [-1.5 - i * 1.7, 0, 3.2], face: 60 }), B(0.3, 'play', { who: id, anim: 'Sit_Floor_Down', then: 'Sit_Floor_Idle' }), B(2.5 + i * 0.3, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 8 })));
    crowd.forEach((c, i) => flat.push(B(0.6 + i * 0.05, 'play', { who: c, anim: 'Cheer' }), B(0.6 + i * 0.07, 'hop', { who: c, count: 4, height: 0.4 })));
    flat.push(B(0.3, 'caption', { text: 'The rightful heir is crowned. Good wins!', dur: 5 }), B(0.4, 'sfx', { name: 'fanfare' }), B(0.6, 'sfx', { name: 'cheer' }), B(1, 'fx', { kind: 'confetti', at: [6, 7, 1], count: 70, scale: 3 }), B(3, 'fx', { kind: 'confetti', at: [2, 7, 0], count: 70, scale: 3 }), B(5, 'fx', { kind: 'confetti', at: [8, 7, 1], count: 70, scale: 3 }),
      B(3, 'camera', { shot: 'cut', pos: [-2, 10, 23], target: [6, 1.5, -1], lag: 2.2 }), B(7, 'fx', { kind: 'sparkle', at: [10.5, 2.6, 0.5], count: 30, scale: 2 }));
  } else {
    flat.push(B(0, 'camera', { shot: 'cut', pos: [7, 4, 11], target: [14.3, 2.6, -0.3], snap: true }), B(0.05, 'attach', { prop: 'crown', who: 'usurper', slot: 'head', offset: [0, 0.95, 0] }), B(0.4, 'play', { who: 'usurper', anim: 'Cheer' }),
      B(0.3, 'caption', { text: 'The usurper is crowned. Evil wins!', dur: 3 }), B(0.4, 'sfx', { name: 'wahwah' }), B(0.5, 'play', { who: 'heir', anim: 'Sit_Floor_Down', then: 'Sit_Floor_Idle' }), B(1.0, 'say', { who: 'usurper', text: 'MINE!', dur: 1.2, style: 'shout' }));
    good.forEach((id, i) => flat.push(B(0.1, 'place', { who: id, at: [7.5 - (i % 4) * 1.8, 0, 2.0 + Math.floor(i / 4) * 2], face: 90 }), B(0.3 + i * 0.1, 'play', { who: id, anim: 'Sit_Floor_Down', then: 'Sit_Floor_Idle' })));
    const zs = [-3.0, 3.0, -4.6, 4.6];
    evil.forEach((id, i) => flat.push(B(0.1, 'place', { who: id, at: [16.0, 0.7, zs[i % 4]], face: -90 }), B(0.12, 'hide', { who: id }), B(3 + i * 1.3, 'show', { who: id }), B(3 + i * 1.3, 'fx', { kind: 'smoke', at: [16.0, 1.6, zs[i % 4]], count: 12 }), B(3 + i * 1.3, 'play', { who: id, anim: 'Cheer' }), B(3 + i * 1.3, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 9 }), B(3 + i * 1.3, 'sfx', { name: 'ding' })));
    flat.push(B(2.6, 'camera', { shot: 'cut', pos: [6, 4.6, 13], target: [15, 2.2, 0], lag: 1.0 }));
  }
  return { scene: 'throne', flat: flat.sort((x, y) => x.t - y.t), duration: 12, payload: { team: ids, culprit: null, hero: null, seed: 9 }, cast: ids };
}
