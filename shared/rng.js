// Small seeded RNG (mulberry32). Used by the server (injectable for tests) and by the
// TV cutscene player so a replay with the same seed looks identical.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Wraps a raw () => [0,1) function with helpers. */
export function makeRng(fn = Math.random) {
  const rng = {
    next: fn,
    int(n) { return Math.floor(fn() * n); },
    range(a, b) { return a + fn() * (b - a); },
    chance(p) { return fn() < p; },
    pick(arr) { return arr[Math.floor(fn() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(fn() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** n distinct items. */
    sample(arr, n) { return rng.shuffle(arr).slice(0, n); },
  };
  return rng;
}

export const seeded = (seed) => makeRng(mulberry32(seed));
export const randomSeed = () => (Math.random() * 4294967296) >>> 0;
