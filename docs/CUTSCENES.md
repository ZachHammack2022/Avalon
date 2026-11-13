# Cutscene authoring guide

Everything except the cutscene *content* is built. The pipeline plays all 5 quests × (success + 4 fail gags) today using
**placeholder choreography**. Your job is to replace the placeholders with the real, funny choreography from `goals.md` §6–7,
building out each quest's environment in `public/tv/scenes/quests.js` as you go.

You do not need to touch the server, phones, networking, rules, or the TV's HUD/phase logic.

## The 60-second loop

```bash
npm start                      # server (the preview harness is served by it)
open http://localhost:3000/preview?quest=bridge&outcome=fail&gag=sweater&team=3&seed=2
```

* The **preview harness** (`/preview`) plays any quest × outcome × gag × team size (2–5) × seed with no phones. It has a scrubber,
  pause, single-frame step, 0.25–2× speed, fps counter, previous-quest-result toggle (changes the opening caption), and the
  assassination/victory scenes. `H` hides the panel; `Space` pauses. Deep links: `?quest&outcome&gag&team&seed&autoplay=1&panel=0&paused=1`.
* Console: `await __preview.load({quest:'vault', outcome:'fail', gag:'lever', team:4, seed:9})`, `await __preview.seek(12.5)`,
  `__preview.info`, `__preview.errors` (every console warning/error the engine emitted, e.g. a typo'd animation or a missing mark).
* **Validation:** `node --test` (instant) checks the data: every op/arg/ref/animation, segment timing, shared segments not
  leaking the outcome, 4 gags per quest, gag duration 6–8 s, total runtime 20–25 s. `npm run test:browser` (≈2 min, headless
  Chromium) then plays **every** cutscene, seeks through all segments and fails on any console warning/error or blank frame
  (`--quick` for one gag per quest, `--shots` to dump screenshots into `.shots/` for eyeballing).

## What a cutscene is

Data in `shared/campaign-lost-crown.js`. Each quest has:

```js
{ id, name, scene, tagline, durations:{setup:5, approach:7, moment:3, success:5},
  gags:[{id, name, caption, duration /*6-8*/, ...hints}],          // server picks one of these at random
  sceneIds:[],                                                      // ids your scene pre-creates (actors/props)
  beats:{ setup:[…], approach:[…], moment:[…], success:[…], fail:{ [gagId]:[…] } } }
```

A **beat** is `{ t, op, ...args }`; `t` = seconds from the start of that segment. `shared/cutscene-ops.js` is the contract: it lists
every op, its args and types, and the validator enforces it. To author, add a `beats` object to the quest's entry in `RAW` (same file). **Whatever you provide replaces the placeholder; whatever you
omit keeps playing the placeholder**, so you can do one segment or one gag at a time:

```js
{ id: 'bridge', …, beats: { moment: [ /* hand-written */ ], fail: { sweater: [ /* hand-written */ ] } } }
```

Rules the validator enforces (they come from the spec):

* **setup/approach/moment are shared** by success and fail. They may not use `culprit`/`hero`/`{culprit}`/`{hero}` (that would leak
  the outcome). Use `lead` (a seed-chosen team member, unrelated to the outcome) or `team:N` for the star of the approach.
* `culprit` exists only in fail segments, `hero` only in success segments.
* Player refs can only play the **76 Adventurer clips** (`PLAYER_ANIMS`); skeletons/custom actors can use all 95 (`shared/anims.js`).
* No beat may start after its segment ends (and timed ops must not run >0.5 s past it). Durations are what the *server* uses to time
  the phase, so keep segments to the declared lengths. Change a duration in `durations`/`gag.duration` and the server follows.
* `{culprit} {hero} {team} {lead} {intro}` are the caption slots. `{intro}` is the quest tagline with the "Fresh from their
  triumph… / Still smelling of smoke…" prefix (use it in the first setup caption).

### Op cheat sheet (full list + arg types in `shared/cutscene-ops.js`)

| Group | Ops |
|---|---|
| Actors | `formation` `place` `walkTo` `runTo` `play` `lookAt` `face` `hide` `show` `tweenTo` `spawnActor` |
| Props | `spawnProp` (`builtin:box|sphere|cylinder|cone|plank|note|crown|rope` or any asset name) `attach` `detach` `arc` `removeProp` |
| FX | `fx` `firePuff|smoke|coinBurst|dust|sparkle|splash` |
| Scene | `rig` calls an animation your scene registers (`{op:'rig', name:'bridge', action:'unravel', dur:3}`) |
| Camera | `camera` `wide|follow|closeUp|pushIn|lowAngle|overShoulder|orbit|crane|cut` + `shake` |
| UI/audio/time | `caption` `banner` `title` (time-skip cards) `freeze` (record scratch + hold + "Yep. That's {culprit}.") `sfx` `music` `slowmo` `fade` |

Conventions:

* **World:** Y up, 1 unit ≈ 1 m, characters ≈ 2 units tall. Yaw 0 faces +Z (toward the default camera), 90 faces +X. **The team travels
  along +X** in every scene. Positions are `[x,z]` (ground), `[x,y,z]`, a named **mark**, an actor ref, or `{at:ref, offset:[…]}`.
* **Marks:** every scene must define `spawn start mid goal spot` (`public/tv/scenes/quests.js`). Add your own (`door`, `lever`, …).
* **Targets** for `who`: `culprit hero lead team:0..4 team:all team:others` or any id you spawned / listed in `sceneIds`.
* `formation` positions the *whole team* (2–5 members): `line|row|column|arc|huddle`, `walk:true` to walk there over `dur`.
* `play` loops idle/walk/pose clips and plays others once, then returns to Idle (`then:'Death_A_Pose'` to hold a pose).
  Hand slots for `attach`: `handslot.r`, `handslot.l`, `head`.
* **Freeze:** `freeze` stops the *world* for `dur` seconds; the script clock keeps running, so schedule nothing inside the freeze window.
* **Determinism:** the same payload+seed must look the same on a TV refresh. If you need randomness in a scene, use
  `seeded()` from `shared/rng.js`, never `Math.random()` in anything that affects the picture.
* Comedy toolkit from the spec: hold ~1 s of silence (`music stop`, no motion) before chaos; culprit plays `Cheer` right after the
  disaster (oblivious pride); reaction shot = `camera closeUp` on `team:others` + `lookAt … at:'culprit'` slowly; one `freeze`
  at the peak.

## Building a scene

`public/tv/scenes/quests.js` returns, per quest, `{ name, music, bg, fog, hemi, sun, center, forward, marks, wideDist/Height/Angle, preload, build(stage), update(dt, stage), rigs }`.

* `preload`: **list every asset you use** (`'dungeon:torch_lit'`, `'hex:tree_single_A'`, `'skeleton_warrior'`, `'prop:mug_full'`…).
  `put(stage, name, {pos, rot, scale})` returns `null` if you forgot (and `spawnProp` warns), which the browser check turns into a failure.
  Name → file mapping: `public/tv/engine/asset-manifest.js` (`npm run assets` re-copies the curated packs; add to the lists in
  `scripts/fetch-assets.mjs` if you need more of a pack, e.g. other hex tiles).
* **Build what is missing** (rope bridge, gorge, dragon, vault door…) from simple low-poly geometry (`scenes/kit.js` has `box/cyl/ground/flame/scatter`).
  The bridge, vault door and a chunky dragon (eye, jaw, head, wings, tail with `openEye/sneeze/wake` rigs) exist as starters.
* **Rigs** are your scene-specific animations: `rigs: { bridge: { unravel(stage, {dur}) {…} } }`. Use `stage.tween({dur, delay, ease, update(k), done, owner, key})`
  (a new tween with the same `owner`+`key` replaces the old one), `stage.fx.burst(kind, pos, count, scale)`, and `stage.actors`/`stage.props`.
* **Skeleton patrol / guards / crowd**: spawn with `spawnActor` in the shared segments (they then exist in every branch) and give them `id`s;
  scenes can also pre-create them and list the ids in the quest's `sceneIds`. Skeletons have extra clips (`Skeletons_Awaken_*`, `Taunt`, `Death_C_Skeletons*`…).
* Keep to 60 fps at 1080p on a recent Mac: shadows are on (one 2048² sun), keep draw calls modest, share geometry, avoid
  per-frame allocations in `update`. `?q=low` turns shadows/AA off; `?fps` on the TV shows an fps counter.
* The **assassination** and **victory** scenes are in `public/tv/engine/endings.js` (beat scripts on the `night` and `throne` scenes). They work
  but are simple; polish at will. The third-success "roll straight into the assassination" hand-off is already automatic (server phase order).

## Things the engine already does for you

Avatars (class model + player color tint + feet ring + name banner), formations, walking/turning, animation crossfades, the
camera rig (smoothing between shots, shake), particles, tweens, record-scratch/freeze, captions (through `narrate()`), WebAudio
music + SFX (`public/tv/engine/audio.js`: add tracks in `TRACKS`, new one-shots in `sfx()`), seek/scrub, seeded `lead` selection.

## Definition of done for a quest

1. `node --test` is green; `npm run test:browser -- --quick --shots` is green and the screenshots look right.
2. All 4 gags + success play at team sizes 2, 3, 4, 5 in the preview (try several seeds) with no clipping/overlap and readable captions.
3. Setup/approach/moment are indistinguishable between success and fail (they share data, so just don't break that).
4. Total runtime is 20–25 s for every branch; the beat of silence, the reaction shot and the freeze-frame are all there.
