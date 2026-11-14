#!/usr/bin/env node
// Headless-Chromium check of the TV client. Needs Playwright (global install or `npm i -D playwright`).
//   npm run test:browser              every quest x outcome x gag, rotating team sizes 2-5 (about 2 min on software GL)
//   npm run test:browser -- --quick   one gag per quest + success
//   npm run test:browser -- --shots   also save screenshots to .shots/
// Per cutscene it seeks through setup / approach / moment / outcome / end and asserts: no console errors or
// warnings (missing assets, unknown anims, unresolved refs...), the canvas is not blank, and actors exist.
// Then it plays the real TV page against a live server with bot players for a few seconds.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
import { QUESTS } from '../shared/campaign-lost-crown.js';
import { cutsceneSeconds, segmentsFor } from '../shared/cutscene.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('Playwright not found. `npm i -D playwright && npx playwright install chromium`, or use a global install.'); process.exit(2); }

const quick = process.argv.includes('--quick');
const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots', { recursive: true });
const IGNORE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL/;

const app = createGameServer({ port: 0, host: '127.0.0.1' });
const { port } = await app.listen();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
let failures = 0;
const fail = (msg) => { failures++; console.error(`  FAIL ${msg}`); };

async function newPage(w = 960, h = 540) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) fail(`console.${m.type()}: ${m.text()}`); });
  return page;
}

/** Fraction of distinct coarse pixel colors sampled from the canvas: ~0 for a blank frame. */
async function frameStats(page) {
  return page.evaluate(() => {
    const c = document.getElementById('stage'); const t = document.createElement('canvas'); t.width = 48; t.height = 27;
    const g = t.getContext('2d'); g.drawImage(c, 0, 0, 48, 27);
    const d = g.getImageData(0, 0, 48, 27).data; const seen = new Set(); let lum = 0;
    for (let i = 0; i < d.length; i += 4) { seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); lum += d[i] + d[i + 1] + d[i + 2]; }
    return { colors: seen.size, lum: lum / (d.length / 4) / 3 };
  });
}

// ---------- 1. every cutscene in the preview harness ----------
if (!process.argv.includes('--live-only')) {
  const page = await newPage();
  await page.goto(`${base}/preview?panel=0&paused=1`);
  let n = 0;
  for (const q of QUESTS) {
    const variants = [['success', null], ...q.gags.map((g, i) => ['fail', g.id])].filter((v, i) => !quick || i < 2);
    for (const [outcome, gag] of variants) {
      const team = 2 + (n++ % 4);
      const label = `${q.id}/${outcome}${gag ? `/${gag}` : ''} team=${team}`;
      const before = failures;
      await page.evaluate(async (c) => __preview.load(c), { quest: q.id, outcome, gag: gag || undefined, team, seed: 11 + n, prev: n % 2 ? 'success' : 'fail' });
      await page.evaluate(() => __preview.pause());
      const segs = segmentsFor(q, outcome, gag);
      const dur = cutsceneSeconds(q, outcome, gag);
      const times = [0.5, segs[0].end - 0.5, segs[1].end - 0.5, segs[2].end - 0.2, segs[3].start + (segs[3].end - segs[3].start) * 0.5, dur - 0.3];
      for (const t of times) {
        await page.evaluate((t) => __preview.seek(t), t);
        const st = await frameStats(page);
        const info = await page.evaluate(() => __preview.info);
        if (st.colors < 6) fail(`${label} t=${t.toFixed(1)}: frame looks blank (${st.colors} colors)`);
        if (info.actors < team) fail(`${label}: only ${info.actors} actors`);
        if (shots && (t === times[4] || t === times[0])) await page.screenshot({ path: `.shots/${q.id}-${outcome}-${gag || 'win'}-${t.toFixed(0)}.png` });
      }
      // the punchline must frame its star: culprit on screen at the freeze-frame, hero on screen at their banner
      if (outcome === 'fail') {
        const fz = segs[3].beats.find((b) => b.op === 'freeze');
        await page.evaluate((t) => __preview.seek(t), segs[3].start + fz.t + 0.1);
        const at = await page.evaluate(() => __preview.onScreen('culprit'));
        if (!at || !at.visible) fail(`${label}: culprit is off screen at the freeze-frame (${JSON.stringify(at)})`);
      } else {
        const bn = segs[3].beats.find((b) => b.op === 'banner' && b.who === 'hero');
        if (bn) { await page.evaluate((t) => __preview.seek(t), segs[3].start + bn.t + 0.4); const at = await page.evaluate(() => __preview.onScreen('hero')); if (!at || !at.visible) fail(`${label}: hero is off screen during their hero beat (${JSON.stringify(at)})`); }
      }
      const errs = await page.evaluate(() => __preview.errors.filter((e) => !/GPU stall|GL Driver/.test(e)));
      if (errs.length) fail(`${label}: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
      console.log(`${failures === before ? 'ok  ' : 'FAIL'} ${label} (${dur}s)`);
      await page.evaluate(() => { __preview.errors.length = 0; });
    }
  }
  // endings
  for (const special of ['assassin-hit', 'assassin-miss', 'victory-good', 'victory-evil']) {
    const before = failures;
    await page.evaluate(async (s) => __preview.load({ special: s }), special);
    await page.evaluate(() => __preview.pause());
    for (const t of [0.5, 4, 7.5]) { await page.evaluate((t) => __preview.seek(t), t); const st = await frameStats(page); if (st.colors < 6) fail(`${special} t=${t}: blank`); }
    if (shots) await page.screenshot({ path: `.shots/${special}.png` });
    const errs = await page.evaluate(() => __preview.errors.filter((e) => !/GPU stall|GL Driver/.test(e)));
    if (errs.length) fail(`${special}: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    console.log(`${failures === before ? 'ok  ' : 'FAIL'} ending ${special}`);
    await page.evaluate(() => { __preview.errors.length = 0; });
  }
  await page.close();
}

// ---------- 2. the real TV + phone pages, live, with bots ----------
{
  const live = createGameServer({ port: 0, host: '127.0.0.1', publicHost: '127.0.0.1', timeScale: 6 });
  const { port: p2 } = await live.listen();
  const url = `http://127.0.0.1:${p2}`;
  const tv = await newPage(1280, 720);
  await tv.goto(`${url}/tv?nointro`);
  await tv.waitForSelector('#code:not(:empty)');
  await tv.waitForFunction(() => document.getElementById('code').textContent.length === 4);
  const code = (await tv.textContent('#code')).trim();
  const phone = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => fail(`phone pageerror: ${e.message}`));
  phone.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) fail(`phone console.error: ${m.text()}`); });
  await phone.goto(`${url}/?room=${code}`);
  await phone.fill('input[placeholder="Your name"]', 'Tester');
  await phone.click('main button.primary');
  await phone.waitForSelector('text=VIP');
  for (let i = 0; i < 4; i++) await phone.click('text=+ Bot');
  await phone.waitForFunction(() => window.__sq.state && window.__sq.state.pub.players.length === 5);
  await phone.click('text=Start game');
  await phone.waitForSelector('text=Your role');
  await tv.waitForFunction(() => /Check your phones/.test(document.getElementById('card').textContent));
  await tv.waitForFunction(() => window.__tv.app.view === 'campfire', null, { timeout: 60000 });
  await tv.waitForTimeout(1500);
  if (shots) await tv.screenshot({ path: '.shots/tv-rolereveal.png' });
  // hold-to-reveal: press and hold shows the role, release hides it
  const peek = await phone.$('#peek'); const box = await peek.boundingBox();
  await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await phone.mouse.down();
  await phone.waitForFunction(() => !document.getElementById('secret').hidden);
  await phone.mouse.up();
  await phone.waitForFunction(() => document.getElementById('secret').hidden);
  // the phone re-renders on every state push, so a tap can land on a button that is being replaced: retry until it registers
  for (let i = 0; i < 6; i++) {
    await phone.click("text=I'm ready", { timeout: 2000 }).catch(() => {});
    await phone.waitForTimeout(300);
    if (await phone.evaluate(() => { const s = window.__sq.state; return s.pub.phase !== 'roleReveal' || (s.me.legal && s.me.legal.done); })) break;
  }
  // a bot leader can propose within milliseconds, so accept any phase past the role reveal
  await tv.waitForFunction(() => !['lobby', 'roleReveal'].includes(window.__tv.app.pub.phase), null, { timeout: 60000 });
  await tv.waitForTimeout(2500);
  if (shots) await tv.screenshot({ path: '.shots/tv-propose.png' });
  console.log('ok   phone + TV lobby, role reveal, hold-to-reveal');
  // play on: the human plays by the legal-action block through the phone UI
  let guard = 0;
  while (guard++ < 600) {
    const phase = await phone.evaluate(() => window.__sq.state && window.__sq.state.pub.phase);
    if (phase === 'gameover') break;
    const clicked = await phone.evaluate(() => {
      const st = window.__sq.state; const L = st.me.legal; const btn = (txt) => [...document.querySelectorAll('main button')].find((b) => b.textContent.includes(txt) && !b.disabled);
      if (L.action === 'propose') { const chips = [...document.querySelectorAll('.chip')]; chips.slice(0, L.size).forEach((c) => c.click()); const s = btn('Send'); if (s && !s.disabled) { s.click(); return true; } return false; }
      if (L.action === 'vote') { const b = btn('Approve'); if (b) { b.click(); return true; } }
      if (L.action === 'assassinate') { window.confirm = () => true; const c = document.querySelector('.chip'); if (c) { c.click(); return true; } }
      if (st.me.quest && st.me.quest.onTeam) {
        if (st.me.quest.step === 'card') { const b = btn('Success'); if (b) { b.click(); return true; } }
        if (st.me.quest.step === 'pick') { const c = document.querySelector('.chip'); if (c) { c.click(); return true; } }
      }
      return false;
    });
    await phone.waitForTimeout(clicked ? 60 : 120);
  }
  const phase = await phone.evaluate(() => window.__sq.state.pub.phase);
  if (phase !== 'gameover') fail(`game did not finish (stuck in ${phase})`);
  await tv.waitForFunction(() => window.__tv && window.__tv.app.pub && window.__tv.app.pub.phase === 'gameover');
  await phone.waitForSelector('text=Play again');
  if (shots) await phone.screenshot({ path: '.shots/phone-gameover.png' });
  // phone refresh resumes the seat
  await phone.reload();
  await phone.waitForFunction(() => window.__sq.state && window.__sq.state.me && window.__sq.state.me.role);
  // TV refresh resumes the room at the current phase
  await tv.reload();
  await tv.waitForFunction(() => window.__tv.app.pub && window.__tv.app.pub.phase === 'gameover');
  console.log(`${failures ? 'FAIL' : 'ok  '} full game via phone UI + TV, phone reload resumed, TV reload resumed (${guard} polls)`);
  await live.close();
}

await browser.close(); await app.close();
console.log(failures ? `\n${failures} failure(s)` : '\nAll browser checks passed.');
process.exit(failures ? 1 : 0);
