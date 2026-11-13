// All narration goes through narrate(text) so a spoken narrator can be added behind a TV toggle later.
// Today: captions only. Flip `setSpeech(true)` (settings panel has a hidden-by-default toggle) to use speechSynthesis.
const listeners = new Set();
let speech = false;

export const onNarrate = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const setSpeech = (on) => { speech = !!on; if (!speech && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); };
export const speechEnabled = () => speech;

export function narrate(text, opts = {}) {
  for (const fn of listeners) fn(text, opts);
  if (speech && typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' && !opts.silent) {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.0; speechSynthesis.speak(u); } catch { /* ignore */ }
  }
}
