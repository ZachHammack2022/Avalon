// Pure beat scheduler (no three.js). Given a flat, time-sorted beat list it fires each beat once,
// in order, as time advances. Used by the cutscene player, preview harness and tests.
export class Timeline {
  constructor(beats) {
    this.beats = beats;
    this.reset();
  }
  reset() { this.i = 0; this.time = 0; }
  get duration() { return this.beats.length ? this.beats[this.beats.length - 1].t : 0; }
  /** Advance by dt seconds; calls fire(beat) for every beat whose time has been reached. */
  update(dt, fire) {
    this.time += dt;
    while (this.i < this.beats.length && this.beats[this.i].t <= this.time + 1e-9) fire(this.beats[this.i++]);
  }
}
