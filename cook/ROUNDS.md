# Cook ledger: Avalon phone UI/UX

Started: 2026-11-14 03:13 UTC
Time: floor 2h | cap 6h
Bar (critic median, out of 10): clarity 9 | hierarchy 9 | theme and craft 9 | consistency 9 | privacy 9 | ergonomics 9
Calibration offset: none yet (no user estimate)
Gate: stills approved no | final deliverable is the live UI (no long render)
Best so far: round 1, `cook/stills/r01/`

## Decisions

Made without asking, one line each.
- 03:13 Skipped intake questions, because the prompt and earlier answers in this session covered them (push to main allowed, code only).
- 03:15 Archived the shipped dragon-intro run to `cook-archive/2026-11-14-dragon-intro/`.
- 03:20 Secrets moved off the always-visible screen (role chip, team tint, role-specific hints), because a neighbour on the couch could read them. They now live only in the hold-to-reveal card.
- 03:20 Every choice is select-then-confirm, because single-tap votes and cards are easy to mis-tap and cannot be undone.
- 03:20 Emoji replaced with code-drawn SVG glyphs, because emoji differ per phone and look cheap.

## User feedback inbox

- 03:13 "take a hard look at the phone UI/UX here, make it awesome" | round 1 | open

---

## Round 01

Time: 03:13 to 04:05 | total elapsed 0.9h
Focus: whole phone UI rebuilt around a table-safe screen.
Changed: new `icons.js` (role, class and UI glyphs), avatars (colour + class glyph), quest tracker with shields and reject pips, face-down role card with hold-to-reveal, parchment role card with known players and secret counsel, vote tokens, quest cards, select-then-confirm, waiting screens with who-has-voted, vote reveal, result and game-over screens, help sheet (Now / How to play / Roles), compact layout for short phones, `scripts/phone-shots.mjs` (23 screens from mock states, overflow check).
Measured: 97/97 unit tests pass; live-game browser check passes; 23 screens at 390x844 and 320x568 with no horizontal overflow and no console errors.
Own score (eyeballed, not decisive): clarity 8.5, hierarchy 8.5, theme 8, consistency 8.5, privacy 9, ergonomics 8.
Critic: pending.
Next: critic findings.
