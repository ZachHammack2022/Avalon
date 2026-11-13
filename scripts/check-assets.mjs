#!/usr/bin/env node
// Verifies the committed KayKit assets: every logical asset the engine references exists, GLBs parse, the
// character animation clip lists match shared/anims.js (so cutscene validation can be trusted), licenses are kept.
//   node scripts/check-assets.mjs              check
//   node scripts/check-assets.mjs --print-anims   print the clip lists as found on disk
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_ASSETS, resolveAsset, CHARACTER_FILES } from '../public/tv/engine/asset-manifest.js';
import { PLAYER_ANIMS, SKELETON_ANIMS } from '../shared/anims.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
let bad = 0;
const fail = (m) => { bad++; console.error(`FAIL ${m}`); };

function glbJson(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString());
}
const clips = (file) => (glbJson(file).animations || []).map((a) => a.name);
const common = (lists) => lists.reduce((a, b) => a.filter((x) => b.includes(x)));

for (const name of CORE_ASSETS) {
  const file = path.join(PUB, resolveAsset(name));
  if (!fs.existsSync(file)) { fail(`missing ${name} -> ${file}`); continue; }
  if (file.endsWith('.glb')) { try { glbJson(file); } catch (e) { fail(`${name}: ${e.message}`); } }
  else {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const r of [...(j.buffers || []), ...(j.images || [])]) if (r.uri && !r.uri.startsWith('data:') && !fs.existsSync(path.join(path.dirname(file), r.uri))) fail(`${name}: missing ${r.uri}`);
  }
}

const playerKinds = ['knight', 'mage', 'rogue', 'barbarian', 'rogueHooded'];
const skelKinds = Object.keys(CHARACTER_FILES).filter((k) => k.startsWith('skeleton_'));
const P = common(playerKinds.map((k) => clips(path.join(PUB, resolveAsset(k)))));
const S = common(skelKinds.map((k) => clips(path.join(PUB, resolveAsset(k)))));
if (process.argv.includes('--print-anims')) { console.log('PLAYER', P.join(' ')); console.log('SKELETON', S.join(' ')); }
if (P.join() !== PLAYER_ANIMS.join()) fail('shared/anims.js PLAYER_ANIMS differs from the GLBs (re-run with --print-anims and update)');
if (S.join() !== SKELETON_ANIMS.join()) fail('shared/anims.js SKELETON_ANIMS differs from the GLBs');

const lic = fs.readdirSync(path.join(PUB, 'assets/kaykit')).filter((f) => f.startsWith('LICENSE'));
if (lic.length < 4) fail(`expected 4 license files, found ${lic.length}`);
if (!fs.existsSync(path.join(PUB, 'assets/kaykit/ATTRIBUTION.md'))) fail('ATTRIBUTION.md missing');

console.log(bad ? `${bad} problem(s)` : `Assets OK: ${CORE_ASSETS.length} core assets, ${P.length} player clips, ${S.length} skeleton clips, ${lic.length} licenses.`);
process.exit(bad ? 1 : 0);
