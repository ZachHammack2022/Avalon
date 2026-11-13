#!/usr/bin/env node
// Authoring aid: reference sheets of every animation clip at 3 points in time.  node scripts/anim-sheet.mjs [kind] -> .shots/anims-<kind>-N.png
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { createGameServer } from '../server/index.js';
import { PLAYER_ANIMS, SKELETON_ANIMS } from '../shared/anims.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const kind = process.argv[2] || 'knight';
const anims = process.argv[3] ? process.argv[3].split(',') : kind.startsWith('skeleton') ? SKELETON_ANIMS.filter((a) => !PLAYER_ANIMS.includes(a)) : PLAYER_ANIMS;
fs.mkdirSync('.shots', { recursive: true });
const app = createGameServer({ port: 0, host: '127.0.0.1' }); const { port } = await app.listen();
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/preview?panel=0&paused=1`);
const PER = 12;
for (let s = 0; s * PER < anims.length; s++) {
  const list = anims.slice(s * PER, s * PER + PER);
  await page.evaluate(async ({ list, kind }) => {
    const st = __preview.stage; __preview.pause(); __preview.player.def = null;
    await st.loadScene('campfire', [kind]); st.sceneDef.root.visible = false; st.scene.background.set(0x8899aa); st.scene.fog = null; st.hemi.intensity = 2.6; st.sun.intensity = 2.5; st.sun.position.set(6, 14, 16);
    list.forEach((name, i) => { for (let j = 0; j < 3; j++) {
      const a = st.addActor({ id: `${name}${j}`, kind, name: j === 1 ? name : '', color: '#ffffff', at: [((i % 4) - 1.5) * 8.6 + (j - 1) * 2.3, 0, (Math.floor(i / 4) - 1) * 6.2], yaw: 30, banner: j === 1 });
      const act = a.play(name, { loop: true }); const d = act.getClip().duration; a.mixer.update(d * [0.2, 0.5, 0.85][j]); if (j === 1) a.showBanner(Infinity);
    } });
    st.camSpec = { shot: 'cut', pos: [0, 15, 21], start: 0 }; st.camState = null; st.cast.clear();
    st.camera.position.set(0, 30, 62); st.camera.lookAt(0, 0.4, 0); st.camera.fov = 17; st.camera.updateProjectionMatrix();
    st.renderer.render(st.scene, st.camera);
  }, { list, kind });
  await page.screenshot({ path: `.shots/anims-${kind}-${s}.png` });
}
console.log('done'); await browser.close(); await app.close();
