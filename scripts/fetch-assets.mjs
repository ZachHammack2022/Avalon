#!/usr/bin/env node
// Downloads the KayKit CC0 packs and copies the curated subset the game uses into
// public/assets/kaykit/. Idempotent. The copied files are committed, so `npm start` works offline;
// run `npm run assets` only to refresh or to add to the manifest below.
//
//   node scripts/fetch-assets.mjs [--force]      (--force re-clones the cache)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.assets-cache');
const OUT = path.join(ROOT, 'public', 'assets', 'kaykit');
const force = process.argv.includes('--force');

const HEX_ONLY = /^(hex_grass|hex_grass_sloped_high|hex_grass_sloped_low|hex_water|hex_river_[A-D]|hex_coast_[A-E]|tree_single_[AB]|trees_[AB]_(small|medium|large)|rock_single_[A-E]|hills?_|mountain_[ABC]|cloud_|building_(bridge_[AB]|castle_(blue|red)|tower_[AB]_(blue|red)|home_[AB]_(blue|red)|destroyed|well_blue)|wall_straight|wall_corner|fence_|barrel|bucket|crate_|flag_|tent|target|weaponrack|wheelbarrow|sack|pallet|ladder|resource_)/;

const PACKS = [
  { repo: 'KayKit-Character-Pack-Adventures-1.0', root: 'addons/kaykit_character_pack_adventures', copies: [
    { from: 'Characters/gltf', to: 'characters' },
    { from: 'Assets/gltf', to: 'props' },
  ] },
  { repo: 'KayKit-Character-Pack-Skeletons-1.0', root: 'addons/kaykit_character_pack_skeletons', copies: [
    { from: 'Characters/gltf', to: 'skeletons' },
    { from: 'Assets/gltf', to: 'skeleton-props' },
  ] },
  { repo: 'KayKit-Dungeon-Remastered-1.0', root: 'addons/kaykit_dungeon_remastered', copies: [
    { from: 'Assets/gltf', to: 'dungeon', skip: /^banner_(pattern|thin|triple|shield)/ },
  ] },
  { repo: 'KayKit-Medieval-Hexagon-Pack-1.0', root: 'addons/kaykit_medieval_hexagon_pack', copies: [
    ...['tiles/base', 'tiles/rivers', 'tiles/coast', 'decoration/nature', 'decoration/props', 'buildings/neutral', 'buildings/red', 'buildings/blue']
      .map((d) => ({ from: `Assets/gltf/${d}`, to: 'hex', only: HEX_ONLY })),
  ] },
];

const sh = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const pack of PACKS) {
  const dir = path.join(CACHE, pack.repo);
  if (force) fs.rmSync(dir, { recursive: true, force: true });
  if (!fs.existsSync(dir)) {
    console.log(`Cloning ${pack.repo}…`);
    sh('git', ['clone', '--depth', '1', `https://github.com/KayKit-Game-Assets/${pack.repo}`, dir]);
  }
  fs.copyFileSync(path.join(dir, 'LICENSE.txt'), path.join(OUT, `LICENSE-${pack.repo}.txt`));
  for (const c of pack.copies) {
    const src = path.join(dir, pack.root, c.from);
    const dst = path.join(OUT, c.to);
    fs.mkdirSync(dst, { recursive: true });
    const files = fs.readdirSync(src);
    // models first, then whatever they reference (.bin/.png), so `only`/`skip` filter by model name
    const wanted = new Set();
    for (const f of files) {
      const base = f.replace(/(\.gltf)?\.(gltf|glb)$/, '');
      if (!/\.(gltf|glb)$/.test(f)) continue;
      if (c.only && !c.only.test(base)) continue;
      if (c.skip && c.skip.test(base)) continue;
      wanted.add(f);
      if (f.endsWith('.gltf')) {
        const j = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
        for (const r of [...(j.buffers || []), ...(j.images || [])]) if (r.uri && !r.uri.startsWith('data:')) wanted.add(r.uri);
      }
    }
    if (!c.only && !c.skip) for (const f of files) if (/\.(png|bin)$/.test(f)) wanted.add(f);
    for (const f of wanted) {
      const outName = f.replace(/\.gltf\.glb$/, '.glb'); // the Dungeon pack mixes `x.glb` and `x.gltf.glb`
      fs.copyFileSync(path.join(src, f), path.join(dst, outName));
      (manifest[c.to] ||= []).push(outName);
    }
  }
}
for (const k of Object.keys(manifest)) manifest[k] = [...new Set(manifest[k])].sort();
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, 'ATTRIBUTION.md'), `# KayKit assets (CC0)

Models by Kay Lousberg (https://kaylousberg.com), released under CC0 1.0.
Source repositories (github.com/KayKit-Game-Assets): ${PACKS.map((p) => p.repo).join(', ')}.
License files are kept alongside this file. Credit is not required but appreciated.

Re-create this folder with \`npm run assets\`.
`);
const count = Object.values(manifest).reduce((n, a) => n + a.length, 0);
console.log(`Copied ${count} files into ${path.relative(ROOT, OUT)}`);
