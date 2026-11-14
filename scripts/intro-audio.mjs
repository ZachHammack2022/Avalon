#!/usr/bin/env node
// Render the code-made soundtrack offline to a WAV: node scripts/intro-audio.mjs out.wav
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const out = process.argv[2] || 'intro.wav';
const app = createGameServer({ port: 0, host: '127.0.0.1' }); const { port } = await app.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/intro/index.html?t=1&w=320&h=180&pr=1`); await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
const b64 = await page.evaluate(() => window.renderWavBase64()); fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote', out, fs.statSync(out).size, 'bytes'); await browser.close(); process.exit(0);
