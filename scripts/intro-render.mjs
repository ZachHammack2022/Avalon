#!/usr/bin/env node
// Render a frame range of the intro to PNGs: node scripts/intro-render.mjs <outdir> <startFrame> <endFrameExclusive> [fps=30]
// Frame n shows t = n / fps. Skips frames that already exist so an interrupted run can resume.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [out, a, b, fpsArg] = process.argv.slice(2); const fps = +fpsArg || 30, W = 1920, H = 1080;
fs.mkdirSync(out, { recursive: true });
const app = createGameServer({ port: 0, host: '127.0.0.1' }); const { port } = await app.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/intro/index.html?t=${(+a) / fps}&w=${W}&h=${H}&pr=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 600000 });
const t0 = Date.now(); let done = 0;
for (let n = +a; n < +b; n++) {
  const f = `${out}/f${String(n).padStart(5, "0")}.jpg`; if (fs.existsSync(f)) continue;
  await page.evaluate((t) => window.intro.render(t), n / fps);
  await page.locator('canvas').screenshot({ path: f, type: "jpeg", quality: 93 }); done++;
  if (done % 20 === 0) console.log(`frames ${a}-${b}: ${n - a + 1}/${b - a}, ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame`);
}
console.log(`done ${a}-${b}`); await browser.close(); process.exit(0);
