// TV app: a pure display. Receives public state from the server and plays cutscenes the server tells it to.
// It never sees secrets and never makes a game-relevant random choice.
import { Hud } from './hud.js';
import { TvNet } from './net.js';
import { cardFor, trackFor } from './cards.js';
import { GameAudio } from './engine/audio.js';
import { narrate } from './engine/narrate.js';

const params = new URLSearchParams(location.search);
const hud = new Hud(document);
const audio = new GameAudio();

function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
const use3d = !params.has('no3d') && webgl();

class App {
  constructor() {
    this.pub = null; this.joinUrl = ''; this.view = 'none'; this.cutsceneActive = false; this.firstState = true; this.endingsDone = false;
    this.chain = Promise.resolve(); this.players = new Map();
    this.stage = null; this.player = null; this.campfire = null;
  }

  async init() {
    if (use3d) {
      const [{ Stage }, { CutscenePlayer }, { CampfireView }] = await Promise.all([import('./engine/stage.js'), import('./engine/cutscene-player.js'), import('./campfire-view.js')]);
      this.stage = new Stage(document.getElementById('stage'), { audio, hud, quality: params.get('q') || 'high' });
      this.player = new CutscenePlayer({ stage: this.stage });
      this.campfire = new CampfireView(this.stage);
      this.loop();
    } else document.getElementById('stage').style.background = 'radial-gradient(#2a2038, #0b0910)';
    this.net = new TvNet({
      onState: (pub) => this.onState(pub), onCutscene: (m) => this.onCutscene(m),
      onRoom: (code) => hud.setRoom(code, this.joinUrl), onInfo: (i) => { this.joinUrl = i.joinUrl; hud.setRoom(null, i.joinUrl); },
      onStatus: (s) => hud.setStatus(s),
    });
  }

  queue(fn) { this.chain = this.chain.then(fn).catch((e) => console.error('[tv]', e)); return this.chain; }

  loop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (this.view === 'cutscene' || this.view === 'ending') this.player.update(dt); else this.stage.update(dt);
      this.stage.render(dt);
      if (params.has('fps')) { const f = document.getElementById('fps'); f.hidden = false; f.textContent = `${this.stage.stats.fps.toFixed(0)} fps`; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  onState(pub) {
    const first = this.firstState; this.firstState = false;
    const prev = this.pub; this.pub = pub;
    this.players = new Map(pub.players.map((p) => [p.id, p]));
    hud.setRoom(pub.room, this.joinUrl);
    hud.setTrack(trackFor(pub));
    // cards (plain-text view): hidden while a cutscene plays, otherwise always up to date
    if (pub.phase === 'cutscene' && this.cutsceneActive) hud.showCard(null);
    else if (pub.phase === 'gameover' && use3d && !first && prev && prev.phase !== 'gameover' && !this.endingsDone) hud.showCard(null);
    else hud.showCard(cardFor(pub, { joinUrl: this.joinUrl }));
    if (pub.phase !== 'cutscene' && pub.phase !== 'questResult') hud.clearCaption();
    if (!use3d) return;
    this.queue(() => this.syncView(pub, first, prev));
  }

  async syncView(pub, first, prev) {
    const phase = pub.phase;
    const campfirePhases = ['lobby', 'roleReveal', 'propose', 'vote', 'voteReveal', 'questPlay'];
    if (campfirePhases.includes(phase) || (phase === 'cutscene' && !this.cutsceneActive && this.view !== 'cutscene')) {
      if (this.view !== 'campfire') { this.view = 'campfire'; this.cutsceneActive = false; hud.fade('black', 0.3); await sleep(300); await this.campfire.enter(false); audio.music('camp'); hud.fade('clear', 0.5); }
      this.campfire.sync(pub);
    } else if (phase === 'questResult' && this.view === 'campfire') {
      // TV refreshed during the result card: keep the campfire behind it
      this.campfire.sync(pub);
    } else if (phase === 'assassination') {
      if (this.view !== 'night') { this.view = 'night'; hud.fade('black', 0.4); await sleep(400); await this.campfire.enter(true); audio.music('night'); this.campfire.sync(pub); hud.fade('clear', 0.6); }
      else this.campfire.sync(pub);
    } else if (phase === 'gameover') {
      await this.gameOver(pub, first || (prev && prev.phase === 'gameover'));
    }
  }

  async onCutscene(payload) {
    if (!use3d) return;
    this.cutsceneActive = true; hud.showCard(null);
    this.queue(async () => {
      this.view = 'cutscene';
      hud.fade('black', 0.3); await sleep(300);
      await this.player.load(payload, this.players);
      hud.fade('clear', 0.4);
      this.player.onDone = () => { this.cutsceneActive = false; };
      this.player.start();
    });
  }

  async gameOver(pub, skipEndings) {
    const rv = pub.reveal;
    const ids = pub.players.map((p) => p.id);
    const { assassinationScript, victoryScript } = await import('./engine/endings.js');
    const play = (script) => new Promise(async (resolve) => {
      this.view = 'ending';
      hud.fade('black', 0.3); await sleep(300);
      await this.player.loadCustom({ ...script, players: this.players });
      hud.fade('clear', 0.4);
      this.player.onDone = resolve; this.player.start();
    });
    if (!skipEndings && !this.endingsDone) {
      this.endingsDone = true;
      if (rv.assassination) await play(assassinationScript(rv, ids));
      await play(victoryScript(rv, ids));
      hud.showCard(cardFor(this.pub, { joinUrl: this.joinUrl }));
    } else {
      this.endingsDone = true;
      await this.player.loadCustom({ ...victoryScript(rv, ids), players: this.players }); this.view = 'ending'; this.player.seek(6); this.player.start();
    }
    if (this.pub.phase === 'gameover') hud.showCard(cardFor(this.pub, { joinUrl: this.joinUrl }));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = new App();
window.__tv = { app, hud, audio };

// settings + audio unlock
const unlock = () => {
  if (!audio.unlock()) return;
  document.getElementById('unlock').hidden = true;
  if (app.view === 'campfire') audio.music('camp'); // start the music the first time the browser lets us
};
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock);
const muteBtn = document.getElementById('btn-mute');
const toggleMute = () => { audio.setMuted(!audio.muted); muteBtn.textContent = audio.muted ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', toggleMute);
document.getElementById('btn-caps').addEventListener('click', () => narrate(`Caption size: ${hud.cycleCaptionScale()}`, { dur: 1.5, silent: true }));
document.getElementById('btn-full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()));
window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') toggleMute(); if (e.key === 'c' || e.key === 'C') document.getElementById('btn-caps').click(); if (e.key === 'f' || e.key === 'F') document.getElementById('btn-full').click(); });

app.init();
