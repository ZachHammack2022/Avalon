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

Round 17 closing frame: tried two side angles for the last 3 s. The head is still hidden behind the folded wing at t=60-61 (visible at t=58). Open item: raise the head or fold the near wing lower during the settle.

## Round 18
Fix: the dragon's head is lifted off the coins during the settle (headLift 2.6 m from t=58.5), so it is visible in the closing frames (t=60, 61). Closed the open item from round 17.
Sheet: `cook/compare/r18-sheet.png` (12 frames), closing check `cook/compare/r17c-sheet.png`.

Round 18 critic (1 sonnet, fresh context, eyeballed, no calibration offset): composition 6, light 7, color 6.5, materials 4, detail 5, dragon design 5, story clarity 7.
Gaps: opening (frames 1-2) dragon thin in beige haze and low contrast terrain; frame 5 thin wings and tiled pines; frame 9 cave arch looks pasted on and floats high; frame 11 cave interior murky with no focal point. Burning village frames (6-8) are the best and the quality reference.
Stop check: bar no (about 6-7 vs 9) | floor about 7.5h of 8h | stills approved no | final render not started

## Round 20
Changes: dragon rebuilt with a deeper chest, thicker neck and larger wings (arms and fingers about 20-25% longer, fuller membrane scallops); cave mouth set into the slope with a boulder ring and a ledge, tilted to the terrain normal; sun disc enlarged and sky glow lowered so the opening is less washed out; cave gets four stone pillars and a stronger moon shaft.
Sheet: `cook/compare/r20-sheet.png`. Critic scores: pending.

Round 20 critic (1 sonnet, fresh context, eyeballed, no calibration offset): composition 6, light 7, color 6.5, materials 4, detail 5, dragon design 4.5, story clarity 6.
Plateau: scores have been flat for rounds 14, 18 and 20 (about 6-7 on light/color/composition, 4-5 on materials/detail/dragon).
Gaps: final hoard shot has a small dark dragon and noisy coins; mid-flight frames show a flat red dragon cutout; frame 7 wing slab crops out and blocks the tower; opening dragon thin against the sun; fire frames overexposed.
Stop check: bar no (about 6-7 vs 9) | floor reached | stills approved no | final render not started

## Round 22 (bigger rebuild, "keep pushing")
Changes: fresnel rim light on dragon (driven per phase: warm at sunset, hotter in fire, warm gold in cave), tail blade, shaded house walls (vertex colour gradient), ground clutter (900 rocks, 1200 bushes, 9000 grass tufts) around the village, cave hero props (giant chalice, crown, gem clusters), S03 camera pulled back so the wing no longer blocks the tower, bloom and flame alpha reduced, closer closing shot.
First rim pass was too strong (dragon washed pink); reduced to 0.3-0.5 outdoors and 0.07 in the cave.
Sheet: `cook/compare/r22-sheet.png`. Critic: pending.

Round 22 critic (1 sonnet, fresh context, eyeballed, no calibration offset): composition 6, light 7, color 6, materials 4, detail 5, dragon design 4, story clarity 6.
Result: no improvement after the "keep pushing" rebuild; plateau confirmed across rounds 14, 18, 20 and 22. Clutter and rim light did not move the scores.
Gaps: S05 mountain frames (cave mouth reads as a prop, huge wing planes crop the frame), opening dragon small, dragon design inconsistent across shots (thin bat early, flat red slab later), saturated pure-red wing clashes with the palette.
Stop check: bar no (about 6-7 vs 9) | floor reached | stills approved no | final render not started

## Round 26 (research round, web now reachable via curl)
User: "can you use rag, like just go look up some cool dragons or shots to inform your look here" and "you have access to any website now!". WebFetch could not resolve hosts (its own resolver), but curl through the session proxy worked, so pages were fetched with curl and read as text.
Sources read: Definition magazine, "Behind the shot: House of the Dragon" (cinematography: clarity, "give chaos a shape", light motivated by fire/smoke/sky, a single day passing cool to warm to fiery sunset, atmosphere over clarity); 80.lv, Final Fantasy-inspired dragon workflow (line of action, mixed animal references, wings as thin slivers, early attempts "too red overall", three-point key/fill/rim, embers and grain added in post). Tuts+ page needs JavaScript, nothing extracted. Search snippets: silhouette first, warm amber rim on a dark dragon, membrane slack between fingers, visible elbow and wrist.
Applied: dragon recoloured from saturated red to dark charcoal body, bronze membrane with a darker-to-lighter gradient, belly kept warm; elbow spurs and deeper slack scallops; light film grain; S05 chase camera fixed (it was inside the mountain at t=43, producing the black blobs) and kept above terrain; cave-mouth rocks and arch made visible instead of black.
Sheet: `cook/compare/r26-sheet.png`. Critic: pending.

Round 26 critic (1 sonnet, fresh context, eyeballed, no calibration offset): composition 6, light 7, color 6.5, materials 4, detail 5, dragon design 3.5, story clarity 6.5.
Reading: the reference-informed palette and grain did not raise scores; dragon design dropped to 3.5 because the dragon is small, thin and often cropped in most frames, never a hero shape. Next try: make the dragon bigger and bulkier in frame everywhere (scale 1.55 to 2.0, thicker body, bigger head).

## Round 27
Change: dragon scale 1.55 to 2.0 and head 1.5 to 1.7 so it is larger in every frame. Sheet: `cook/compare/r27-sheet.png`. Critic: not run (self-eyeballed: the opening and mountain shots read better, the dragon fills more of the frame; the cave closing frame is now crowded).
Stop check: bar no (about 6-7 vs 9) | floor reached | stills approved no | final render not started

## Final render (user approved the stills: "lgtm, approved")
Rendered 1860 frames at 1920x1080, 30 fps with scripts/intro-render.mjs (3 parallel workers, software GL, 1.9-16 s per frame depending on shot), encoded with ffmpeg (H.264 crf 17, yuv420p) plus the code-made soundtrack (AAC 192k).
File: cook/final/dragon-intro.mp4 (git-ignored). Checked with ffprobe: h264 1920x1080, 30/1 fps, 1860 frames, 62.000 s; aac audio 62.000 s. Measured loudness of the mixed file: -23.7 LUFS integrated, -5.2 dBFS peak. Spot-checked frames at t=2, 30 and 58 s in the encoded file: correct shots; the six near-empty JPEGs are the black fade-in and fade-out frames.
Not done: motion blur by sub-frame accumulation (skipped for render time), nobody has listened to the audio, final scores stay at about 6-7 out of 10 against a 9 bar.
Stop check: bar NO (reported honestly) | floor yes | stills approved yes | final rendered and file checked yes
