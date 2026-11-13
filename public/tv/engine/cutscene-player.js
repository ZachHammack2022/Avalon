// Runs a cutscene (data from shared/campaign-lost-crown.js, or a custom script) on a Stage.
// The server decides culprit/hero/gag/seed; this only plays them. Supports seek() for the preview harness.
import { buildTimeline, cutsceneSeconds, fillSlots, introCaption, makeResolver } from '/shared/cutscene.js';
import { QUESTS } from '/shared/campaign-lost-crown.js';
import { Timeline } from './timeline.js';

export class CutscenePlayer {
  constructor({ stage }) {
    this.stage = stage;
    this.playing = false; this.time = 0; this.duration = 0; this.timeline = null;
    this.onDone = null; this.def = null;
  }

  /**
   * @param payload  server message {questIndex, outcome, team, culprit, hero, gag, seed, prevOutcome}
   * @param players  Map id -> {id,name,cls,color}
   */
  async load(payload, players) {
    const quest = QUESTS[payload.questIndex];
    const flat = buildTimeline(quest, payload.outcome, payload.gag);
    this.def = {
      scene: quest.scene, flat, payload, players, intro: introCaption(quest, payload.prevOutcome),
      duration: cutsceneSeconds(quest, payload.outcome, payload.gag), cast: payload.team,
    };
    await this._setup();
  }

  /** Custom script (endings): {scene, flat, payload, players, duration, cast} */
  async loadCustom(def) { this.def = { intro: '', ...def }; await this._setup(); }

  async _setup() {
    const d = this.def; const stage = this.stage;
    const castIds = d.cast;
    await stage.loadScene(d.scene, [...new Set(castIds.map((id) => d.players.get(id).cls))]);
    const resolver = makeResolver(d.payload);
    const nameOf = (id) => (d.players.get(id) ? d.players.get(id).name : id);
    stage.rt = { resolver, payload: d.payload, fill: (t) => fillSlots(t, d.payload, nameOf, resolver.lead, d.intro) };
    const spawn = stage.marks.spawn || stage.marks.start || [-10, 0];
    const seats = stage.sceneDef.seats ? stage.sceneDef.seats(castIds.length) : null; // campfire-style scenes seat everyone
    castIds.forEach((id, i) => {
      const p = d.players.get(id);
      const at = seats ? [seats[i].x, 0, seats[i].z] : [spawn[0] - (i % 3) * 1.3, 0, spawn[1] + Math.floor(i / 3) * 1.6];
      const a = stage.addActor({ id, kind: p.cls, name: p.name, color: p.color, at, yaw: seats ? seats[i].yaw : (stage.sceneDef.forward ?? 90), player: true });
      if (seats) a.play('Sit_Floor_Idle');
      stage.cast.set(id, a);
    });
    this.timeline = new Timeline(d.flat); this.time = 0; this.duration = d.duration; this.playing = false;
    stage.audio && !stage.silent && stage.sceneDef.music && stage.audio.music(stage.sceneDef.music);
  }

  start() { this.playing = true; }
  get done() { return this.time >= this.duration; }

  update(dt) {
    if (!this.playing) { this.stage.update(dt); return; }
    this.time += dt;
    this.timeline.update(dt, (b) => this.stage.exec(b));
    this.stage.update(dt);
    if (this.time >= this.duration) { this.playing = false; this.onDone && this.onDone(); }
  }

  /** Rebuild the world and fast-forward silently to `t` seconds (used by the scrubber and reconnects). */
  async seek(t) {
    const wasPlaying = this.playing;
    this.stage.silent = true;
    await this._setup();
    const step = 1 / 30;
    while (this.time + step <= t) { this.time += step; this.timeline.update(step, (b) => this.stage.exec(b)); this.stage.update(step); }
    this.stage.silent = false;
    this.playing = wasPlaying && t < this.duration;
  }
}
