# Fable task board

## Status

Done:
- **A1-A5:** all five quests (sets, rigs, shared segments, success, 4 gags each).
- **B1-B3, B5 (as far as the quests needed):** hard cuts, group framing, bubbles/emotes, relative tweens, light dimming,
  new FX kinds, skeleton patrols, guards, crowd.
- **C1 (synth only):** new one-shot effects; bass and percussion under every music loop.
- **D1:** campfire rebuilt (open seating arc, tents, sky, embers, fireflies); the proposed team stands facing the TV.
- **D2:** ready ticks during role reveal; vote tokens flip one at a time with a verdict sting.
- **D3:** assassination scene with fire-side close-ups; victory endings on the throne set; game-over awards
  (hero of the realm, scapegoat, walking disaster).
- **F1/F3:** `scripts/shot.mjs` contact sheets; the browser check asserts the culprit is on screen at every freeze-frame
  and the hero during their hero beat.

- **D4 (phone polish):** haptics (tick on every button, pattern when it is your turn, result buzz), screen-enter transition, offline banner that disables buttons, ✔/✖ symbols alongside colour on decisions, focus rings, reduced-motion, 44px+ tap targets, small and landscape layouts.

Still open: real audio samples and music (C1), narration tuning (C2), gag variety and a second
campaign (E), performance budgets on real hardware (F2).

## A. Cutscenes (the main event)

One task per quest. Each covers: shared segments (setup / approach / moment), the **success** ending,
the **4 fail gags**, and the scene set in `public/tv/scenes/quests.js`. Gag ids and captions are already
in `shared/campaign-lost-crown.js`; author real `beats` there (they override the placeholder scaffold).

| # | Quest | Scene | Gags | Notes |
|---|-------|-------|------|-------|
| A1 | The Old Bridge | bridge | sweater, catch, sturdiness, celebration | Bridge must visibly sag/snap; rope physics faked with scripted rotations. |
| A2 | Whispering Woods | woods | thintree, distraction, bush, sneeze | Skeleton patrol path and fog; sneeze needs a ragdoll-style skeleton collapse. |
| A3 | The Vault | vault | knock, note, lever, outward | Door rig, lever, guards pouring in; the toss-out ending. |
| A4 | Dragon's Hoard | dragon | counting, goodboy, plume, angle | Biggest set: dragon rig, gold pile, fireball chase. |
| A5 | Throne Room | throne | selfcrown, roll, mug, speech | Crowd reactions, rolling crown, the usurper reveal. |

Per-quest definition of done:
- Every gag reads clearly without sound, in about 7 s, with the culprit framed in close-up at the punchline.
- The shared setup contains **no** culprit/hero references (validator enforces it).
- Success ending gives the hero a visible moment; consequence segment plays after every gag.
- Works at 5 and 10 players (formations and camera framing hold up).
- Screenshot of each gag's punchline frame checked in under `docs/shots/` (not required to commit big files).

## B. Engine polish (do before or alongside A)

- **B1. Camera direction.** Cuts vs. moves, whip pans, punch-ins on reactions, slow-mo around the punchline,
  screen shake on impacts. Add ops only through `shared/cutscene-ops.js` with validator and tests.
- **B2. Props and rigs library.** Reusable animated props in `scenes/kit.js`: doors, levers, ropes, torches,
  treasure, crowns, mugs, barrels. Fix the placeholder-quality bridge/vault rigs.
- **B3. FX pass.** Better dust, smoke, sparkle, coin burst, fire, water splash; screen-space effects
  (vignette, flash, desaturate on failure). All in `engine/fx.js`.
- **B4. Lighting and look.** Per-quest palettes, shadows, fog, bloom/tonemapping; keep 60 fps budget in mind
  (measure on a real Mac/TV; headless numbers are not representative).
- **B5. Crowd and skeleton actors.** Background NPCs, skeleton patrol, guards, courtiers with idle variation.
  Uses the 95 skeleton clips in `shared/anims.js`.

## C. Audio

- **C1. Real SFX and music.** Replace synthesized stand-ins in `engine/audio.js` with CC0 samples
  (add to the asset manifest, keep licenses in `assets/LICENSES`). Per-quest music beds, stingers for
  success/fail, ducking under narration.
- **C2. Narration.** Tune `engine/narrate.js` (voice choice, pacing, caption timing, fallback when
  speech synthesis is unavailable on the TV browser).

## D. Experience around the cutscenes

- **D1. Campfire / lobby scene.** Make the lobby alive: avatars idling, fire, ambient sound, join animations.
- **D2. Role reveal and vote reveal on the TV.** Dramatic card flips, vote tally reveal sequence.
- **D3. Endings.** Win/lose screens in `engine/endings.js`: assassination moment, role reveal parade,
  recap of who framed whom across the 5 quests (the funniest data we have).
- **D4. Phone polish.** Haptics, transitions, reconnect UX, small-screen layout, accessibility
  (contrast, tap target size), colorblind-safe vote/quest buttons.

## E. Content and replay value

- **E1. Gag variety.** Add a second pool of gags per quest (rotate so repeat groups don't see the same one
  first). Needs the campaign schema to accept more than 4 gags; add a validator test and a selection rule in
  `shared/cutscene.js`.
- **E2. Framing mechanics flavour.** Silly framing prompts, hero nomination callbacks ("{hero} carried this team"),
  running gags that reference earlier quests' culprits.
- **E3. Additional campaigns.** A second `campaign-*.js` (different setting, 5 quests, 4 gags each), plus a
  campaign picker in the lobby. Needs A-series patterns to be settled first.

## F. Quality gates

- **F1. Cutscene QA harness.** Extend `scripts/browser-check.mjs` to render every quest x gag x {5,10 players}
  at key timestamps, fail on console errors, missing clips, or off-screen culprits, and write a contact sheet.
- **F2. Performance budget.** Frame-time capture in the preview harness, draw-call/triangle budget per scene,
  a CI check on asset size.
- **F3. Playtest tooling.** `npm run sim` variants that fast-forward to a chosen quest/gag so authors can
  jump straight to what they are working on.

## Suggested order for a long run

1. B1 + B2 + B3 (shared tools first, one session each, merged before A starts).
2. A1 as the pilot: finish one quest end to end, review it, update `docs/CUTSCENES.md` with lessons.
3. A2-A5 in parallel, one session each, plus C1 and B4/B5.
4. D1-D4 and F1-F3 in parallel with the above.
5. E-series last, once the baseline is fun.
