// Beat scripts for the non-quest scenes: assassination reveal and the two victory scenes.
// They use the same ops as quest cutscenes. Player ids are valid actor refs (custom ids).
import { ROLE_INFO } from '/shared/roles-info.js';

const B = (t, op, rest = {}) => ({ t, op, ...rest });

/** Night campfire: arrow flies from the Assassin. hit => Merlin struck by a (comedic) rubber arrow; miss => it hits a log. */
export function assassinationScript(reveal, ids) {
  const a = reveal.assassination;
  const hit = a.hit;
  const others = ids.filter((id) => id !== a.target && id !== a.assassin);
  const flat = [
    B(0, 'camera', { shot: 'wide', dur: 2 }),
    B(0.2, 'caption', { text: 'The Assassin has made their choice…', dur: 2.2 }),
    B(0.2, 'music', { track: 'night' }),
    B(2, 'camera', { shot: 'pushIn', target: a.target, dur: 2 }),
    B(2.2, 'sfx', { name: 'stinger' }),
    B(3.6, 'spawnProp', { id: 'arrow', model: 'prop:arrow', at: { at: a.assassin, offset: [0, 1.4, 0] }, scale: 2.2 }),
    B(3.8, 'arc', { id: 'arrow', to: hit ? { at: a.target, offset: [0, 1.2, 0] } : [3.5, 0.4, -3.5], dur: 0.9, height: 1.2 }),
    B(3.8, 'sfx', { name: 'whoosh' }),
    B(4.7, 'sfx', { name: hit ? 'bonk' : 'thud' }),
    B(4.7, 'fx', { kind: 'dust', at: hit ? a.target : [3.5, 0, -3.5], count: 14 }),
    hit ? B(4.7, 'play', { who: a.target, anim: 'Hit_B' }) : B(4.7, 'play', { who: a.target, anim: 'Cheer' }),
    ...(hit ? [B(5.4, 'play', { who: a.target, anim: 'Death_A' })] : others.slice(0, 2).map((id) => B(5, 'play', { who: id, anim: 'Cheer' }))),
    B(5.2, 'caption', { text: hit ? 'A rubber arrow! Merlin is struck down!' : 'The arrow misses and hits a log!', dur: 2.6 }),
    B(5.2, 'banner', { who: a.target, dur: 3 }),
  ];
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
