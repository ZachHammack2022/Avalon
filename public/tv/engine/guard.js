// Keeps the TV running when one piece misbehaves. A broken cutscene beat or a bad frame is reported once and skipped,
// instead of ending the render loop, which would freeze the picture (and every cutscene and ending after it) until
// someone reloads the page. Pure: no DOM, unit-tested in Node.

/** A reporter that logs each distinct error once: a bug that repeats every frame must not flood the console. */
export function onceReporter(log = (...a) => console.error(...a)) {
  const seen = new Set();
  return (where, e) => {
    const key = `${where}: ${e && e.message}`;
    if (seen.has(key)) return;
    if (seen.size >= 100) seen.clear();
    seen.add(key);
    log(`[tv] ${where}:`, e);
  };
}

/**
 * A requestAnimationFrame loop calling step(dt) (seconds, capped at 0.1). The next frame is booked before this one
 * runs, so a throw in step costs one frame and is reported, never the loop.
 */
export function frameLoop(step, { raf = (f) => requestAnimationFrame(f), now = () => performance.now(), report = onceReporter() } = {}) {
  let last = now();
  const tick = (t) => {
    raf(tick);
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
    try { step(dt); } catch (e) { report('frame', e); }
  };
  raf(tick);
}
