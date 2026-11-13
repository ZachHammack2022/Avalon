// Camera shot math: pure functions from (shot spec, target positions, progress) to a camera pose.
// The Stage's CameraRig feeds this each frame, so shots track moving actors.
const rad = (d) => (d * Math.PI) / 180;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
/** Rotate vector about Y by `deg`. */
export function rotY(v, deg) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

const EASE = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k)),
  back: (k) => { const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },
  bounce: (k) => {
    const n = 7.5625; const d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};
export const ease = (name, k) => (EASE[name] || EASE.inOut)(Math.min(1, Math.max(0, k)));

/**
 * @param spec   { shot, dist?, height?, angle?, pos?, ease? }
 * @param ctx    { target:[x,y,z] (feet), target2?, center:[x,y,z] (team centroid), defaults? }
 * @param k      progress 0..1 through the shot's duration (0 if no duration)
 * @returns      { pos:[x,y,z], look:[x,y,z], fov }
 */
export function shotPose(spec, ctx, k = 0) {
  const angle = spec.angle || 0;
  const t = ctx.target || ctx.center;
  const head = add(t, [0, 1.6, 0]);
  const e = ease(spec.ease || 'inOut', k);
  switch (spec.shot) {
    case 'wide': {
      const d = spec.dist || 15; const hgt = spec.height ?? 7;
      return { pos: add(ctx.center, rotY([0, hgt, d], angle)), look: add(ctx.center, [0, 1, 0]), fov: 38 };
    }
    case 'follow': {
      const d = spec.dist || 7; const hgt = spec.height ?? 3;
      return { pos: add(t, rotY([0, hgt, d], angle + 35)), look: add(t, [0, 1.2, 0]), fov: 40 };
    }
    case 'closeUp': {
      const d = spec.dist || 3.4;
      return { pos: add(t, rotY([0, spec.height ?? 1.9, d], angle)), look: head, fov: 36 };
    }
    case 'pushIn': {
      const d = (spec.dist || 9) + (3 - (spec.dist || 9)) * e; // dolly from far to 3
      const hgt = (spec.height ?? 2.6) + (1.7 - (spec.height ?? 2.6)) * e;
      return { pos: add(t, rotY([0, hgt, d], angle)), look: head, fov: 36 - 6 * e };
    }
    case 'lowAngle': {
      const d = spec.dist || 5.5;
      return { pos: add(t, rotY([0, spec.height ?? 0.35, d], angle)), look: add(t, [0, 2.4, 0]), fov: 52 };
    }
    case 'overShoulder': {
      const a = ctx.target; const b = ctx.target2 || ctx.center;
      const dir = sub(b, a); dir[1] = 0; const l = len(dir) || 1; const nd = mul(dir, 1 / l);
      const right = [nd[2], 0, -nd[0]];
      return { pos: add(add(a, mul(nd, -2.4)), add([0, 2.3, 0], mul(right, 0.7))), look: add(b, [0, 1.5, 0]), fov: 42 };
    }
    case 'orbit': {
      const d = spec.dist || 7;
      return { pos: add(t, rotY([0, spec.height ?? 2.6, d], angle + k * 120)), look: head, fov: 40 };
    }
    case 'crane': {
      const from = add(t, rotY([0, 1.2, 6], angle)); const to = add(ctx.center, rotY([0, 12, 16], angle));
      return { pos: lerp3(from, to, e), look: lerp3(add(t, [0, 1.8, 0]), add(ctx.center, [0, 1, 0]), e), fov: 38 };
    }
    case 'cut':
      return { pos: spec.pos, look: ctx.target || add(spec.pos, [0, 0, -1]), fov: 40 };
    default:
      throw new Error(`unknown camera shot "${spec.shot}"`);
  }
}

/** Deterministic camera-shake offset (no RNG state): sum of sines at incommensurate rates. */
export function shakeOffset(intensity, t) {
  const a = intensity * 0.35;
  return [Math.sin(t * 47.1) * a, Math.sin(t * 61.3 + 1.3) * a, Math.sin(t * 39.7 + 2.1) * a * 0.6];
}
