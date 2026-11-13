#!/usr/bin/env node
// Render stills of the intro at given times: node scripts/intro-stills.mjs <outdir> t1 t2 ...  (env W,H)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [out, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const W = +process.env.W || 1280, H = +process.env.H || 720;
const app = createGameServer({ port: 0, host: '127.0.0.1' }); const { port } = await app.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message)); page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver|swiftshader|WebGL/i.test(m.text())) console.error(m.type(), m.text()); });
await page.goto(`http://127.0.0.1:${port}/intro/index.html?t=${ts[0] || 0}&w=${W}&h=${H}&pr=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
for (const t of ts) { const t0 = Date.now(); await page.evaluate((t) => window.intro.render(t), +t); await page.locator('canvas').screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.png` }); console.log('t', t, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
await browser.close(); await app.close?.(); process.exit(0);
