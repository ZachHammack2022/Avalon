# Cook ledger: Dragon intro

Copy this to `cook/ROUNDS.md` at the start of a run. Keep the header current. Add one round entry per round, newest at the bottom. Label every number as measured or eyeballed.

Started: 2026-11-13 20:55 UTC
Time: floor [8h] | cap [none]
Bar: composition [99.9] | light [99.9] | color [99.9] | materials [99.9] | detail [99.9] | motion [9/10]
Calibration offset: [none yet] (from [user estimate, date])
Usage: [5h window], about 20% per hour, never 100%
Gate: stills approved [no] | final render [not started]
Best so far: round [N], `cook/stills/r[NN]/`, [commit or snapshot]

## Decisions

Made without asking, one line each.
- [time] [decision], because [reason]

## User feedback inbox

Exact words. Close an item only when a still or clip proves it.
- [time] "[quote]" | round [N] | [open / done, proof: path]

---

## Round [NN]

Time: [start] to [end] | total elapsed [h]
Usage: [% of window at the end of the round, or "not readable"]
Focus: [shot and dimension], because [user feedback / lowest score / largest gap]

Changes:
- [what changed, where]

Stills: `cook/stills/r[NN]/` | Side by side: `cook/compare/r[NN]/`

Scores, eyeballed: critic median after calibration ([n] critics, [models or "same model"])

| Shot | Comp | Light | Color | Materials | Detail | Motion | vs last round |
|---|---|---|---|---|---|---|---|
| S01 | | | | | | | |
| S02 | | | | | | | |

Raw critic medians before calibration: [ ]
Own score (logged, never decides): [ ]

Measured (command and result):
- [color check S01: saturation delta [+/-0.00], brightness delta [+/-0.00]]
- [render: [N] s per frame at [resolution], [N] sub-frames]

Not checked this round:
- [what, and why]

Top gaps from critics:
1. [shot, region, what is wrong, what to change]
2. [ ]
3. [ ]

Progress note sent: [time]
Stop check: bar [no] | floor [no] | stills approved [no] | final checked [no] -> [next round / ship / stop at cap]
Next focus: [ ]

## Round 05 (first full pass, rounds 1-5 merged: build + 4 fix iterations)

Time: 2026-11-13 20:55 to about 22:30 UTC | total elapsed about 1.5h (floor 8h NOT reached)
Usage: not readable
Focus: get all 6 shots rendering end to end.

Changes: procedural sky, terrain, pines, village (houses, tower, people, shader fire and smoke), dragon (trailing-spine body, flapping wings, jaw, legs), fire breath particles, cave with 14k instanced coins and treasures, cave mouth on the mountain, bloom and grade. Deterministic render(t) at public/intro/index.html?t=SECONDS.

Stills: `cook/stills/r05/` | Sheet: `cook/compare/r05-sheet.png`

Scores, eyeballed (2 fresh critics, sonnet + opus, no calibration offset yet), /10:
composition 5-5.5, light 6, color 6, materials 4 (sonnet), detail 4.5 (sonnet), motion 4 (sonnet), dragon design 4 (opus), first frame 5 (opus).
Own score (not decisive): about 6.
Measured: about 0.5 to 2.5 s per 1280x720 still on software GL. Color check, side-by-side with references: not run (no references).
Not checked: video clip render, contact-sheet timing, realtime fps on a real GPU, sound.

Top gaps from critics:
1. S03 t=13/14 flat saturated blue sky with dragon overhead clashes with the dusk palette; dragon crop awkward.
2. S04 t=26-33 tower and houses read as flat orange planes, fire still pale; dragon tiny. Push dragon larger in frame, darker smoke, red-core flames.
3. S06 ending: dragon reads as a canoe, head and eye unclear; need hero frame on head, rim light, curled tail. Entry into cave is too dark (t=49).
4. Dragon design: stiff body, weak legs, head unreadable at distance.
5. Near detail is thin (props, debris, embers). Note: critics asked for textures; rejected, brief says no textures. Use geometry and vertex colour variation instead.

Stop check: bar no | floor no | stills approved no | final render not started
Next focus: S06 hero ending, dragon head/body design, sky grade in S02, S03/S04 framing.

## Decisions (round 6)
- 2026-11-13 user: "lets keep /cook on the dragon intro, you can use whatever you want to make it awesome". Interpreted as creative latitude; still code-only, no texture files (original brief), no downloads.

## Round 11 (rounds 6-11 merged)

Time: 2026-11-14 ~00:00 UTC | floor 8h not reached (about 3h elapsed)
Changes: S02 sky regraded (no flat blue), dragon head 1.5x with brighter body/membrane colours, S04 camera moved onto the street, flames more orange and less washed, cave ambient raised and entry camera no longer stares at ceiling, dragon fill light, S06 hero ending now tracks the resting head (horns, eye), glow light lowered.
Stills: `cook/stills/r11/` | Sheet: `cook/compare/r11-sheet.png`
Critic scores: pending at time of writing. Measured: none beyond render times (~1-3 s per still, software GL).
Still open: coin glare in S06 mid frames (t=60), pale fire bloom in S03/S04, dragon body stiff, near detail thin, no clip render, no sound.
Next focus: dragon body/neck pose and legs, fire/smoke readability, S01 composition, then clip render test.

Round 11 critic (1 sonnet, fresh context, eyeballed, no calibration yet): composition 6, light 7, color 6.5, materials 4, detail 5, dragon design 4, story clarity 6.
Weakest frames: t=14 (dragon overhead reads upside-down, empty sky), t=44 (mountain faceted triangle, dragon cropped at bottom), t=8 (dragon like a paper cutout, thin wing), t=24 (orange wing crowds the tower and tree).
Next focus: re-frame t=14 and t=44, thicker wing membranes and ribs, per-face colour variation on rock and scales, dragon neck/body pose.
Stop check: bar no | floor no | stills approved no | final render not started

## Round 14 (rounds 12-14)
Time: 2026-11-14 | about 4h elapsed, floor 8h not reached
Changes: S02 split in two (no more upside-down overhead frame; second half watches the dragon bank away over the village), S05 is now a dynamic chase camera framing the dragon against the glowing cave mouth, thicker wing bones, neck S-curve, per-face colour variation and strata on the cave mountain and dragon scales.
Stills: `cook/stills/r14/` | Sheet: `cook/compare/r14-sheet.png`. Critic scores for this round: not run yet (eyeballed by me only: S02 and S05 clearly better).
Still open: coin glare mid S06, pale fire in S03, dragon body stiff, no clip render, no sound.

## Round 15
Time: 2026-11-14 | about 5h elapsed, floor 8h not reached
Changes: breath is now a long forward plume (head pitch -0.26, wider cone, less white), houses ignite as the breath passes, S01 dragon closer and centred on the sun, cave bloom and moon light reduced.
Critic (1 sonnet, eyeballed, r14 sheet): composition 6, light 7, color 6.5, materials 4, detail 5, dragon design 4.5, story 7.
Critic gaps: S01/S02 dragon thin and small (partly fixed), cave dragon hard to read against gold noise, closing frame unclear, mountain faces flat, pines clash with warm haze, fire billboards flat.
Stills: `cook/stills/r15/`, sheets `cook/compare/r15b.png`, `r15c.png`. Not measured: color check, clip render, fps.
Next focus: cave dragon separation (rim light, less coin noise near it), closing frame pull-back, pine tint, dragon body, clip render test.

## Round 16
Time: 2026-11-14 | about 6h elapsed, floor 8h not reached
User: "yes keep cooking" (also answered the sound question with yes; code-made sound to be tried next round, no downloads).
Changes: cool rim light plus warm fill on the cave dragon, calmer coin colours, closing shot now pulls back to show the whole hoard, pines tinted warmer, stronger body undulation.
Stills: `cook/stills/r16/`, sheet `cook/compare/r16-sheet.png`. Critic pass: not run this round (self-eyeballed: cave dragon separates much better; closing frame reads as a sleeping dragon on the hoard but the head is partly hidden by the wing at t=60-61).
Next focus: head visibility in the closing frame, code-made sound test, clip render test, critic pass.

## Round 17 (in progress)
Added code-made soundtrack (public/intro/sound.js: synthesized pad, wind, wing thumps, bell, drums, roars, fire, cave chimes) with a click-to-play start in index.html (?mute to skip) and scripts/intro-audio.mjs for an offline WAV render. Closing camera moved to a side angle where the head is visible. Audio not yet verified: offline render still running, and I cannot listen to it, so only level/spectrum measurements will be reported.

Round 17 result: the page script was broken by my own edit (fixed, commit 314a1c0). Offline WAV render now works (scripts/intro-audio.mjs, about 4 min on this machine).
Measured (ffmpeg, cook/audio/intro-r17.wav, 62 s): integrated -23.7 LUFS, true peak -5.0 dBFS, LRA 12.6 LU; RMS by 2 s window: t=5 -31 dB, t=20 -23.7, t=26 -19.7 (attack), t=40 -29, t=52 -29, t=60 -35. Loudness arc follows the story.
Not verified: how it sounds. Nobody has listened. WAV is git-ignored (11 MB).
