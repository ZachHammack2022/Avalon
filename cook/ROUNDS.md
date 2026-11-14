# Cook ledger: Avalon phone UI/UX

Started: 2026-11-14 03:13 UTC
Time: floor 2h | cap 6h
Bar (critic median, out of 10): clarity 9 | hierarchy 9 | theme and craft 9 | consistency 9 | privacy 9 | ergonomics 9
Calibration offset: none yet (no user estimate)
Gate: stills approved no | final deliverable is the live UI (no long render)
Best so far: round 6, `cook/stills/r06/`

## Decisions

Made without asking, one line each.
- 03:13 Skipped intake questions, because the prompt and earlier answers in this session covered them (push to main allowed, code only).
- 03:15 Archived the shipped dragon-intro run to `cook-archive/2026-11-14-dragon-intro/`.
- 03:20 Secrets moved off the always-visible screen (role chip, team tint, role-specific hints), because a neighbour on the couch could read them. They now live only in the hold-to-reveal card.
- 03:20 Every choice is select-then-confirm, because single-tap votes and cards are easy to mis-tap and cannot be undone.
- 03:20 Emoji replaced with code-drawn SVG glyphs, because emoji differ per phone and look cheap.

## User feedback inbox

- 03:13 "take a hard look at the phone UI/UX here, make it awesome" | round 1 | open
- 06:10 "Yeah you can break that rule! Keep cooking to make the app better, you have full creative authority!" | round 6 | done for fonts and icons, proof: `cook/stills/r06/`

---

## Round 01

Time: 03:13 to 04:05 | total elapsed 0.9h
Focus: whole phone UI rebuilt around a table-safe screen.
Changed: new `icons.js` (role, class and UI glyphs), avatars (colour + class glyph), quest tracker with shields and reject pips, face-down role card with hold-to-reveal, parchment role card with known players and secret counsel, vote tokens, quest cards, select-then-confirm, waiting screens with who-has-voted, vote reveal, result and game-over screens, help sheet (Now / How to play / Roles), compact layout for short phones, `scripts/phone-shots.mjs` (23 screens from mock states, overflow check).
Measured: 97/97 unit tests pass; live-game browser check passes; 23 screens at 390x844 and 320x568 with no horizontal overflow and no console errors.
Own score (eyeballed, not decisive): clarity 8.5, hierarchy 8.5, theme 8, consistency 8.5, privacy 9, ergonomics 8.
Critic 1 (zero context, eyeballed): clarity 7, hierarchy 6, theme 6, consistency 7, privacy 4, ergonomics 5. Main findings: Fail card disabled for Good leaks team; red selected card; team-coloured role card border; overlaps on 320px; peek button under the primary button; weak glyphs.

## Round 02

Time: 04:05 to 04:40 | total elapsed 1.5h
Focus: privacy and small-phone layout, from critic 1.
Changed: quest cards identical for everyone and face-down once chosen; role card frame neutral; real scroll region with a fixed action bar; 0.26 s deliberate hold; lobby look picker collapsed, roster first; tracker double-dot for 2-Fail quests; redrawn minion, assassin, rogue, barbarian, hooded glyphs; centred waiting screens.
Measured: 97/97 tests, live-game check pass, 23 screens x 2 sizes with no overflow or console errors.
Critic 2 (zero context, eyeballed): clarity 7, hierarchy 7, theme 6, consistency 8, privacy 5, ergonomics 6. Main findings: fixed left/right card order leaks via thumb; coloured sigil and pill on the role card; "The story blames" reads as proof; hold bar next to primary button; one-tap kick; tracker too tall; disabled buttons look live.

## Round 03

Time: 04:40 to 05:15 | total elapsed 2.1h
Focus: remaining privacy tells and mis-tap risk, from critic 2.
Changed: hold-to-peek moved into the header name chip (bottom bar removed, more room everywhere); quest card order shuffled per player and quest; a Good player's card always plays as Success with no visible difference; role card in one neutral ink with alignment in words; "Suspicion falls on"; armed-only primary buttons with a dashed hint before a choice; bot stepper; two-step remove for humans; collapsed role settings; single-row tracker with the legend in help; chalice for Success, banner for Percival, new knight and barbarian glyphs; Join disabled until valid.
Measured: 97/97 tests, live-game check pass, 23 screens x 2 sizes with no overflow or console errors.
Own score (eyeballed, not decisive): clarity 8.5, hierarchy 8.5, theme 8, consistency 9, privacy 9, ergonomics 8.5.
Critic 3 (zero context, eyeballed): clarity 7, hierarchy 6, theme 6, consistency 7, privacy 7, ergonomics 6. Main findings: chosen vote token readable before lock-in; bright role card; choices far from the confirm button; cryptic tracker dots; Join button; unclear 'Who stood out?' copy; weak minion, chalice and barbarian glyphs.

## Round 04

Time: 05:15 to 05:45 | total elapsed 2.6h
Focus: critic 3 findings.
Changed: vote token turns face-down once chosen (same pattern as the quest card); dark role card with quiet gold ink; tokens and cards anchored just above the action bar; tracker shows "2 Fails" under the shield and "Rejected teams n/5"; Join sits under the fields; "I'm ready" appears only after the first look at the card; role settings above the roster for the host; vote verdict as a plain line; framed note on a failed quest; redrawn minion (horned skull), chalice and axe.
Not taken: removing red and blue avatar colours (they are shared with the TV scenes), unique glyph per player (only five avatar classes exist), removing self from "Who stood out?" (server rule).
Measured: 97/97 tests, live-game check pass, 23 screens x 2 sizes with no overflow or console errors.
Critic 4 (zero context, eyeballed): clarity 8, hierarchy 7, theme 6, consistency 8, privacy 8, ergonomics 7. Main findings: page ghosting through the hold overlay; tracker wording; Approve looked pre-selected; Change button too close to Lock in; small face-down card; no assassination line at game over.

## Round 05

Time: 05:45 to 06:00 | total elapsed 2.8h
Focus: cheap, valid items from critic 4.
Changed: opaque hold overlay; "needs 2" in neutral ink and brighter future shields; lighter Reject token; "Change my vote/card" as a text link; larger face-down role card; assassination line and aligned role column at game over; bot count in the stepper; one-line role summary in the lobby.
Measured: 97/97 tests, live-game check pass, 23 screens x 2 sizes with no overflow or console errors.
Critic: not run for this round.

## Round 06

Time: 06:10 to 06:50 | total elapsed 3.6h
Focus: theme and craft (lowest score), now that licensed assets are allowed; plus one real feature.
Changed: bundled Cinzel (headings) and Alegreya Sans (body), 126 KB of woff2; role, class and scene glyphs from game-icons.net (CC BY 3.0) generated by `scripts/build-phone-icons.mjs`; fine grain overlay; credits file. New Record tab in the help sheet: every proposal, who voted how, and each quest result (server now publishes `game.history`, public table knowledge only).
Measured: 97/97 tests, live-game check pass, 24 screens x 2 sizes with no overflow or console errors.
Critic 5: pending.
