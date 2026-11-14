#!/usr/bin/env node
// Authoring aid: draws every phone screen from mock states (no game needed) and writes screenshots + contact sheets.
//   node scripts/phone-shots.mjs [outDir=.shots/phone] [--w 390 --h 844]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : '.shots/phone';
const W = +opt('w', 390); const H = +opt('h', 844);
fs.mkdirSync(out, { recursive: true });

const names = ['Zach', 'Mabel', 'Theo', 'Priya', 'Gus', 'Wren', 'Odalys'];
const cls = ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded', 'mage', 'knight'];
const colors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1'];
const players = names.map((name, i) => ({ id: `p${i}`, name, cls: cls[i], color: colors[i], bot: i > 2, vip: i === 0, connected: i !== 5, ready: i % 2 === 0 }));
const roles = { p0: 'merlin', p1: 'minion', p2: 'loyal', p3: 'assassin', p4: 'percival', p5: 'morgana', p6: 'loyal' };
const config = { roles: { merlin: true, assassin: true, percival: true, morgana: true, mordred: false, oberon: false }, classic: false };
const results = [{ questIndex: 0, outcome: 'success', team: ['p0', 'p2'], hero: 'p2' }, { questIndex: 1, outcome: 'fail', team: ['p0', 'p1', 'p3'], culprit: 'p0' }];
const V = (...yes) => Object.fromEntries(players.map((p) => [p.id, yes.includes(p.id)]));
const history = [
  { questIndex: 0, leader: 'p1', team: ['p1', 'p3'], votes: V('p1', 'p3', 'p5'), approved: false },
  { questIndex: 0, leader: 'p2', team: ['p0', 'p2'], votes: V('p0', 'p2', 'p4', 'p6', 'p1'), approved: true },
  { questIndex: 1, leader: 'p3', team: ['p0', 'p1', 'p3'], votes: V('p0', 'p1', 'p3', 'p5'), approved: true },
  { questIndex: 2, leader: 'p4', team: ['p4', 'p5', 'p6'], votes: V('p4', 'p5'), approved: false },
];
const game = (x = {}) => ({ n: 7, history, questIndex: 2, teamSize: 3, leader: 'p4', rejectCount: 2, team: ['p0', 'p4', 'p6'], results, assassinationEnabled: true, ...x });
const pub = (phase, g, x = {}) => ({ room: 'KQXD', phase, players, config, ...(g === null ? {} : { game: game(g) }), ...x });
const good = (legal, x = {}) => ({ id: 'p0', name: 'Zach', vip: true, role: 'merlin', team: 'good', knowKind: 'evil', knows: ['p1', 'p3', 'p5'], legal, ...x });
const evil = (legal, x = {}) => ({ id: 'p0', name: 'Zach', vip: true, role: 'assassin', team: 'evil', knowKind: 'allies', knows: ['p1', 'p5'], note: 'These are your fellow Minions of Mordred.', legal, ...x });
const wait = { action: 'wait' };
const reveal = { winner: 'good', roles, recap: [...results.map((r) => ({ ...r, framed: r.questIndex === 1 })), { questIndex: 2, outcome: 'success', hero: 'p6' }, { questIndex: 3, outcome: 'fail', culprit: 'p4', framed: true }, { questIndex: 4, outcome: 'success', hero: 'p0' }] };

/** [name, state | null, optional async step(page)] */
const SHOTS = [
  ['01-join', null],
  ['02-lobby-host', { pub: pub('lobby', null, { validation: { ok: true, errors: [], warnings: [] } }), me: { id: 'p0', name: 'Zach', vip: true } }],
  ['03-lobby-guest', { pub: pub('lobby', null, { validation: { ok: true, errors: [], warnings: [] } }), me: { id: 'p1', name: 'Mabel', vip: false } }],
  ['04-role-reveal', { pub: pub('roleReveal', {}), me: good({ action: 'ready', done: false }) }],
  ['05-role-card-good', { pub: pub('roleReveal', {}), me: good({ action: 'ready', done: false }) }, (p) => p.evaluate(() => __sq.showSecret())],
  ['06-wait-leader', { pub: pub('propose', {}), me: good(wait) }],
  ['07-propose', { pub: pub('propose', { leader: 'p0' }), me: good({ action: 'propose', size: 3 }) }, async (p) => { for (const i of [1, 3]) await p.click(`.people button >> nth=${i}`); }],
  ['08-vote', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }],
  ['09-vote-chosen', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }, (p) => p.click('.token.yes')],
  ['10-voted', { pub: pub('vote', { voted: ['p0', 'p1', 'p3', 'p6'] }), me: good(wait) }],
  ['11-vote-reveal', { pub: pub('voteReveal', { votes: { p0: true, p1: false, p2: true, p3: false, p4: true, p5: false, p6: true }, approved: true }), me: good(wait) }],
  ['12-quest-card-good', { pub: pub('questPlay', { waitingOn: 3 }), me: good(wait, { quest: { onTeam: true, step: 'card', canFail: false, options: ['p0', 'p4', 'p6'] } }) }],
  ['13-quest-card-evil', { pub: pub('questPlay', { waitingOn: 3 }), me: evil(wait, { quest: { onTeam: true, step: 'card', canFail: true, options: ['p0', 'p4', 'p6'] } }) }, (p) => p.click('.qcard.fail')],
  ['14-secret-counsel-evil', { pub: pub('questPlay', { waitingOn: 3 }), me: evil(wait, { quest: { onTeam: true, step: 'card', canFail: true, options: ['p0', 'p4', 'p6'] } }) }, (p) => p.evaluate(() => __sq.showSecret())],
  ['15-quest-pick', { pub: pub('questPlay', { waitingOn: 2 }), me: good(wait, { quest: { onTeam: true, step: 'pick', canFail: false, options: ['p0', 'p4', 'p6'] } }) }, (p) => p.click('.people button >> nth=2')],
  ['16-watch-quest', { pub: pub('questPlay', { waitingOn: 2, team: ['p1', 'p4', 'p6'] }), me: good(wait, { quest: { onTeam: false } }) }],
  ['17-cutscene', { pub: pub('cutscene', {}), me: good(wait) }],
  ['18-quest-result', { pub: pub('questResult', { questIndex: 3, results: [...results, { questIndex: 2, outcome: 'fail', team: ['p0', 'p4', 'p6'], culprit: 'p4' }] }), me: good(wait) }],
  ['19-assassinate', { pub: pub('assassination', { results: [...results, { questIndex: 2, outcome: 'success', hero: 'p6' }, { questIndex: 3, outcome: 'success', hero: 'p0' }] }), me: evil({ action: 'assassinate', options: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] }) }, (p) => p.click('.people button >> nth=3')],
  ['20-gameover', { pub: pub('gameover', {}, { reveal }), me: good({ action: 'again' }) }],
  ['21-help-now', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }, (p) => p.evaluate(() => __sq.openSheet('now'))],
  ['21b-help-record', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }, (p) => p.evaluate(() => __sq.openSheet('log'))],
  ['22-help-how', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }, (p) => p.evaluate(() => __sq.openSheet('how'))],
  ['23-help-roles', { pub: pub('vote', { voted: [] }), me: good({ action: 'vote' }) }, (p) => p.evaluate(() => __sq.openSheet('roles'))],
];

const app = createGameServer({ port: 0, host: '127.0.0.1' });
const { port } = await app.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
const errs = [];
const files = [];
for (const [name, st, step] of SHOTS) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${name}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errs.push(`${name}: ${m.text()}`));
  await p.goto(`http://127.0.0.1:${port}/phone.html`);
  await p.waitForFunction(() => window.__sq);
  if (st) await p.evaluate((s) => window.__sq.inject(s), st);
  if (step) await step(p);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  const f = `${out}/${name}.png`; await p.screenshot({ path: f }); files.push(f);
  // overflow check: anything wider than the viewport is a layout bug
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (over) errs.push(`${name}: horizontal overflow`);
  await p.close();
}
await browser.close();
for (let i = 0, n = 1; i < files.length; i += 6, n++) {
  const row = files.slice(i, i + 6);
  const inputs = row.flatMap((f) => ['-i', f]);
  const filter = row.length > 1 ? `hstack=${row.length},scale=${row.length * 330}:-1` : `scale=330:-1`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, `${out}/sheet-${n}.png`]);
}
console.log(errs.length ? `PROBLEMS:\n${errs.join('\n')}` : `ok: ${files.length} screens -> ${out}`);
process.exit(errs.length ? 1 : 0);
