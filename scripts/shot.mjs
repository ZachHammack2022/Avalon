#!/usr/bin/env node
// Authoring aid: contact sheet of one cutscene at chosen times (headless Chromium via Playwright).
//   node scripts/shot.mjs bridge fail sweater --team 4 --seed 3 --t 1,4,8,12,15,16,17,18,19,20,21,22 --out .shots/x.png
//   node scripts/shot.mjs bridge success                  (default: 12 evenly spaced frames)
//   --from 15 --to 23 --n 16   evenly spaced range        --cols 4   --w 480
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [quest, outcome = 'fail', gag] = pos;
const special = opt('special', '');
const team = +opt('team', 4); const seed = +opt('seed', 3); const cols = +opt('cols', 4); const W = +opt('w', 480); const H = Math.round(W * 9 / 16);
const out = opt('out', `.shots/${special || quest}-${outcome}-${gag || 'win'}-t${team}.png`);
fs.mkdirSync('.shots', { recursive: true });

const app = createGameServer({ port: 0, host: '127.0.0.1' });
const { port } = await app.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver|software WebGL/.test(m.text())) logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(`pageerror ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/preview?panel=0&paused=1`);
const { duration } = await page.evaluate((c) => __preview.load(c), special ? { special } : { quest, outcome, gag, team, seed, culprit: opt('culprit') || undefined });
await page.evaluate(() => __preview.pause());
let times;
if (opt('t')) times = opt('t').split(',').map(Number);
else { const a = +opt('from', 0.5); const b = +opt('to', duration - 0.1); const n = +opt('n', 12); times = Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)); }
const imgs = [];
for (const t of times) {
  { const err = await page.evaluate((t) => __preview.seek(t).then(() => null, (e) => e.stack), t); if (err) { console.log(`seek(${t}) threw:\n${err}`); process.exit(1); } }
  const cap = await page.evaluate(() => window.__preview.lastCaption ? window.__preview.lastCaption() : '');
  imgs.push({ t, cap, url: `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64')}` });
}
await page.close();
const dir = fs.mkdtempSync('.shots/tmp-');
imgs.forEach((im, i) => fs.writeFileSync(`${dir}/${i}.jpg`, Buffer.from(im.url.split(',')[1], 'base64')));
fs.writeFileSync(`${dir}/i.html`, `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${W}px);font:13px monospace;color:#fff">${imgs.map((im, i) => `<div><img src="${i}.jpg" width="${W}" height="${H}" style="display:block"><div style="height:22px;line-height:22px;padding-left:6px;overflow:hidden;white-space:nowrap">t=${im.t.toFixed(2)} ${im.cap.replace(/</g, '&lt;')}</div></div>`).join('')}</body>`);
await browser.close(); const b2 = await chromium.launch(); const sheet = await b2.newPage({ viewport: { width: cols * W, height: Math.ceil(imgs.length / cols) * (H + 22) } });
await sheet.goto(`file://${process.cwd()}/${dir}/i.html`);
await sheet.screenshot({ path: out });
fs.rmSync(dir, { recursive: true });
console.log(out, `(${duration}s)`);
if (logs.length) console.log('CONSOLE:\n' + [...new Set(logs)].join('\n'));
await b2.close(); await app.close();
