// Preview harness: play any quest cutscene (quest x outcome x gag x team size x seed) without a server or phones.
// Deep-link: /preview?quest=bridge&outcome=fail&gag=sweater&team=3&seed=5&autoplay=1&panel=0
// Scripting (used by scripts/browser-check.mjs):  await __preview.load({...}); await __preview.seek(t); __preview.errors
import { Hud } from './hud.js';
import { Stage } from './engine/stage.js';
import { CutscenePlayer } from './engine/cutscene-player.js';
import { GameAudio } from './engine/audio.js';
import { QUESTS } from '/shared/campaign-lost-crown.js';
import { AVATAR_CLASSES, AVATAR_COLORS } from '/shared/avatars.js';
import { assassinationScript, victoryScript } from './engine/endings.js';
import { ROLES } from '/shared/avalon.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const errors = [];
window.addEventListener('error', (e) => errors.push(`error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${e.reason && e.reason.message || e.reason}`));
for (const level of ['error', 'warn']) { const orig = console[level].bind(console); console[level] = (...a) => { errors.push(`${level}: ${a.map(String).join(' ')}`); orig(...a); }; }

const hud = new Hud(document);
const audio = new GameAudio();
const stage = new Stage($('stage'), { audio, hud, quality: params.get('q') || 'high', preserveDrawingBuffer: true });
const player = new CutscenePlayer({ stage });
let paused = false; let speed = 1; let cfg = null; let seeking = false;

const NAMES = ['Ann', 'Bo', 'Cy', 'Dee', 'Eli', 'Flo', 'Gus', 'Hal', 'Ivy', 'Jo'];
const fakePlayers = (n) => new Map(Array.from({ length: n }, (_, i) => [`p${i + 1}`, { id: `p${i + 1}`, name: NAMES[i], cls: AVATAR_CLASSES[i % 5].id, color: AVATAR_COLORS[i] }]));

for (const q of QUESTS) { const o = document.createElement('option'); o.value = q.id; o.textContent = q.name; $('quest').append(o); }
function fillGags() { const q = QUESTS.find((x) => x.id === $('quest').value); $('gag').replaceChildren(...q.gags.map((g) => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; return o; })); }
$('quest').addEventListener('change', fillGags);

function readForm() {
  const team = +$('team').value; const seed = +$('seed').value || 1;
  const q = QUESTS.find((x) => x.id === $('quest').value);
  return { quest: q.id, outcome: $('outcome').value, gag: $('gag').value, team, seed, prev: $('prev').value || null, special: $('special').value };
}

async function load(c) {
  cfg = { team: 3, seed: 1, outcome: 'fail', prev: null, special: '', ...c };
  const players = fakePlayers(Math.max(cfg.team, cfg.special ? 7 : 0));
  const ids = [...players.keys()];
  if (cfg.special) {
    const roles = {}; ids.forEach((id, i) => { roles[id] = ['merlin', 'loyal', 'percival', 'assassin', 'minion', 'loyal', 'morgana'][i % 7]; });
    const rv = { winner: cfg.special.endsWith('evil') || cfg.special.endsWith('hit') ? 'evil' : 'good', roles, assassination: { assassin: ids[3], target: ids[0], hit: cfg.special.endsWith('hit') }, recap: [] };
    const script = cfg.special.startsWith('assassin') ? assassinationScript(rv, ids) : victoryScript(rv, ids);
    await player.loadCustom({ ...script, players });
  } else {
    const qi = QUESTS.findIndex((q) => q.id === cfg.quest);
    const team = ids.slice(0, cfg.team);
    const culprit = cfg.outcome === 'fail' ? (cfg.culprit ?? team[(cfg.seed + 1) % team.length]) : null;
    const hero = cfg.outcome === 'success' ? (cfg.hero ?? team[cfg.seed % team.length]) : null;
    const payload = { questIndex: qi, questId: cfg.quest, outcome: cfg.outcome, team, culprit, hero, gag: cfg.outcome === 'fail' ? cfg.gag || QUESTS[qi].gags[0].id : null, seed: cfg.seed, prevOutcome: cfg.prev };
    await player.load(payload, players);
  }
  $('scrub').max = player.duration; paused = !!params.get('paused'); $('pp').textContent = paused ? 'Play' : 'Pause';
  player.start(); updateTime();
  return { duration: player.duration };
}

function updateTime() { $('time').textContent = `${player.time.toFixed(1)} / ${player.duration.toFixed(1)}`; if (!seeking) $('scrub').value = player.time; }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused && !seeking && player.def) player.update(dt * speed); else if (player.def) stage.update(0);
  stage.render(dt); updateTime();
  $('fpsread').textContent = `${stage.stats.fps.toFixed(0)} fps`;
  $('errors').textContent = errors.slice(-2).join(' | ');
  requestAnimationFrame(frame);
}

$('go').addEventListener('click', () => load(readForm()));
$('pp').addEventListener('click', () => { paused = !paused; $('pp').textContent = paused ? 'Play' : 'Pause'; });
$('step').addEventListener('click', () => { paused = true; $('pp').textContent = 'Play'; player.update(1 / 30); });
$('speed').addEventListener('change', () => { speed = +$('speed').value; });
$('sound').addEventListener('change', () => { if ($('sound').checked) { audio.unlock(); audio.setMuted(false); } else audio.setMuted(true); });
$('scrub').addEventListener('input', async () => { seeking = true; await player.seek(+$('scrub').value); seeking = false; });
window.addEventListener('keydown', (e) => { if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hidepanel'); if (e.key === ' ') { e.preventDefault(); $('pp').click(); } });
audio.setMuted(true);

window.__preview = {
  errors, stage, player, load,
  async seek(t) { seeking = true; await player.seek(t); seeking = false; stage.render(0); },
  pause() { paused = true; }, play() { paused = false; },
  get info() { return { cam: stage.camera.position.toArray().map((v) => +v.toFixed(1)), time: player.time, duration: player.duration, actors: stage.actors.size, props: stage.props.size, fps: stage.stats.fps, scene: stage.sceneName }; },
};

fillGags();
for (const k of ['quest', 'outcome', 'gag', 'team', 'seed']) if (params.get(k)) { $(k).value = params.get(k); if (k === 'quest') fillGags(); }
if (params.get('panel') === '0') document.body.classList.add('hidepanel');
requestAnimationFrame(frame);
if (params.get('autoplay')) load(readForm());
