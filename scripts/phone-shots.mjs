#!/usr/bin/env node
// Authoring aid: screenshots of the phone UI at a phone viewport -> .shots/phone-*.png
import { createRequire } from 'node:module';
import { createGameServer } from '../server/index.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const app = createGameServer({ port: 0, host: '127.0.0.1' });
const { port } = await app.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = (n) => p.screenshot({ path: `.shots/phone-${n}.png` });
const tv = await (await browser.newContext()).newPage();
await tv.goto(`http://127.0.0.1:${port}/tv?no3d&nointro`);
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('code').textContent));
const code = await tv.evaluate(() => document.getElementById('code').textContent);
await p.goto(`http://127.0.0.1:${port}/phone.html`); await shot('0-join');
await p.fill('input.code', code); await p.fill('input[placeholder="Your name"]', 'Zach'); await p.click('text=Join');
await p.waitForSelector('text=You\'re the VIP'); await shot('1-lobby');
for (let i = 0; i < 4; i++) await p.click('text=+ Bot');
await p.waitForSelector('text=Start game'); await p.click('text=Start game');
await p.waitForSelector('text=Your secret role'); await shot('2-reveal');
await p.click("#helpbtn"); await p.waitForTimeout(400); await shot('3-help-now');
await p.click('#sheet >> text=You'); await p.waitForTimeout(300); await shot('4-help-you');
await p.click('#sheet >> text=How to play'); await shot('5-help-how');
await p.click('#sheet >> text=Roles'); await shot('6-help-roles');
await p.click('.close'); await p.click('text=I\'m ready');
for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const s = await p.evaluate(() => window.__sq.state?.me?.legal?.action); if (['propose', 'vote'].includes(s)) break; }
await shot('7-action');
console.log('errors:', errs);
await browser.close(); await app.close?.(); process.exit(0);
