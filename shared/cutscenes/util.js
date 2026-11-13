// Tiny helpers for hand-authored beat lists. `seq(...)` flattens nested arrays and sorts by time.
export const b = (t, op, args = {}) => ({ t, op, ...args });
export const seq = (...parts) => parts.flat(Infinity).filter(Boolean).sort((x, y) => x.t - y.t);
/** Shift a list of beats by dt seconds. */
export const at = (dt, beats) => beats.flat(Infinity).filter(Boolean).map((x) => ({ ...x, t: +(x.t + dt).toFixed(3) }));
export const cam = (t, shot, args = {}) => b(t, 'camera', { shot, ...args });
export const cap = (t, text, dur = 2.6) => b(t, 'caption', { text, dur });
export const say = (t, who, text, dur = 1.4, style) => b(t, 'say', { who, text, dur, ...(style ? { style } : {}) });
export const emote = (t, who, text, dur = 1.1, color) => b(t, 'emote', { who, text, dur, ...(color ? { color } : {}) });
export const sfx = (t, name, volume) => b(t, 'sfx', { name, ...(volume !== undefined ? { volume } : {}) });
export const play = (t, who, anim, extra = {}) => b(t, 'play', { who, anim, ...extra });
export const rig = (t, name, action, args, dur) => b(t, 'rig', { name, action, ...(dur !== undefined ? { dur } : {}), ...(args ? { args } : {}) });
