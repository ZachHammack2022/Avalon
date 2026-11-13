// Team formations for 1-5 actors. Pure math. Yaw is degrees about +Y; yaw 0 faces +Z, 90 faces +X.
const rad = (d) => (d * Math.PI) / 180;
export const FORMATIONS = ['line', 'row', 'column', 'arc', 'huddle'];

/**
 * @returns {{x:number,z:number,yaw:number}[]} one slot per actor, index 0 = the "front" actor.
 * `facing` is the direction the group looks/travels in (deg).
 */
export function formationSlots(name, count, { center = [0, 0], facing = 0, spacing = 1.6 } = {}) {
  if (!FORMATIONS.includes(name)) throw new Error(`unknown formation "${name}"`);
  const fx = Math.sin(rad(facing)); const fz = Math.cos(rad(facing)); // forward
  const rx = fz; const rz = -fx; // right-hand side (perpendicular)
  const slots = [];
  for (let i = 0; i < count; i++) {
    const o = i - (count - 1) / 2; // -n/2 .. n/2, centered
    let x; let z; let yaw = facing;
    if (name === 'line' || name === 'row') {
      x = center[0] + rx * o * spacing; z = center[1] + rz * o * spacing;
    } else if (name === 'column') {
      // single file: front actor first (largest forward offset)
      const f = -o * spacing; x = center[0] + fx * f; z = center[1] + fz * f;
    } else if (name === 'arc') {
      const a = o * 0.5; // radians around the center, opening toward `facing`
      const r = Math.max(spacing * 1.2, 2.2);
      x = center[0] + rx * Math.sin(a) * r + fx * (Math.cos(a) - 1) * r * -0.6;
      z = center[1] + rz * Math.sin(a) * r + fz * (Math.cos(a) - 1) * r * -0.6;
      yaw = facing - (a * 180) / Math.PI * 0.5;
    } else { // huddle: circle looking inward
      const a = (i / count) * Math.PI * 2 + rad(facing);
      const r = Math.max(0.9, spacing * 0.55 * count / 2);
      x = center[0] + Math.sin(a) * r; z = center[1] + Math.cos(a) * r;
      yaw = (Math.atan2(center[0] - x, center[1] - z) * 180) / Math.PI;
    }
    slots.push({ x, z, yaw });
  }
  return slots;
}

/** Shortest signed angle difference in degrees. */
export function angleDelta(from, to) { return ((((to - from) % 360) + 540) % 360) - 180; }
export const yawToward = (from, to) => (Math.atan2(to[0] - from[0], to[2] - from[2]) * 180) / Math.PI;
