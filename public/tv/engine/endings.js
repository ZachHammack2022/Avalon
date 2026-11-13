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

/** Throne room. Good: everybody cheers. Evil: usurper crowned; evil players revealed one by one behind the throne. */
export function victoryScript(reveal, ids) {
  const good = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'good');
  const evil = ids.filter((id) => ROLE_INFO[reveal.roles[id]].team === 'evil');
  const flat = [B(0, 'music', { track: 'scene' }), B(0, 'camera', { shot: 'wide', dur: 2 })];
  if (reveal.winner === 'good') {
    good.forEach((id, i) => flat.push(B(0.2, 'place', { who: id, at: [4 + (i % 4) * 1.8, 0, -3 + Math.floor(i / 4) * 2.4 + (i % 4) * 0.4], face: -90 }), B(1 + i * 0.15, 'play', { who: id, anim: 'Cheer' }), B(1 + i * 0.1, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 6 })));
    evil.forEach((id, i) => flat.push(B(0.2, 'place', { who: id, at: [0, 0, 7 + i * 0.01], face: 180 }), B(0.3, 'play', { who: id, anim: 'Sit_Floor_Pose' })));
    flat.push(B(0.3, 'caption', { text: 'The rightful heir is crowned. Good wins!', dur: 5 }), B(0.4, 'sfx', { name: 'fanfare' }), B(1, 'fx', { kind: 'sparkle', at: [10, 0, 0], count: 40, scale: 2 }), B(3, 'camera', { shot: 'wide', dist: 24, height: 11, dur: 5 }));
  } else {
    flat.push(B(0.2, 'spawnActor', { id: 'usurper', kind: 'skeleton_warrior', at: [15, 0, 0], face: -90, scale: 1.2 }), B(0.4, 'play', { who: 'usurper', anim: 'Cheer' }),
      B(0.3, 'caption', { text: 'The usurper is crowned. Evil wins!', dur: 3 }), B(0.4, 'sfx', { name: 'wahwah' }));
    good.forEach((id, i) => flat.push(B(0.2, 'place', { who: id, at: [2 + i * 1.5, 0, 5], face: 90 }), B(0.3, 'play', { who: id, anim: 'Hit_B' })));
    evil.forEach((id, i) => flat.push(B(0.2, 'place', { who: id, at: [17.5, 0, -3 + i * 2.2], face: -90 }), B(3 + i * 1.1, 'play', { who: id, anim: 'Cheer' }), B(3 + i * 1.1, 'banner', { who: id, text: ROLE_INFO[reveal.roles[id]].name, dur: 5 }), B(3 + i * 1.1, 'sfx', { name: 'ding' })));
    flat.push(B(3, 'camera', { shot: 'orbit', target: 'usurper', dist: 13, height: 4, dur: 8 }));
  }
  return { scene: 'throne', flat: flat.sort((x, y) => x.t - y.t), duration: 12, payload: { team: ids, culprit: null, hero: null, seed: 9 }, cast: ids };
}
