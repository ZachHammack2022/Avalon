# Saboteur Quests: The Lost Crown

A family party game for the TV with phones as controllers (Jackbox-style). It follows **The Resistance: Avalon** 1:1 (5–10 players, all
six optional roles). Every quest plays out as a funny 3D cutscene; when a quest fails, the saboteurs secretly choose **who gets framed**.
Full spec: [`goals.md`](goals.md).

```bash
npm install
npm start          # prints the TV URL and the phone URL
```

* **TV:** open `http://localhost:3000/tv` (fullscreen with `F`; `M` mutes, `C` cycles caption size; click once to unlock audio).
  `?no3d` runs the plain-text card view (also the automatic fallback without WebGL), `?fps` shows a frame counter, `?q=low` drops shadows.
* **Phones:** open `http://<your-LAN-IP>:3000` (the console prints it) on the same Wi-Fi and enter the 4-letter room code.
  The first person in is the **VIP** (start, bots, role toggles). Bots fill empty seats, so 1–2 humans can play.
* **Cutscene preview harness:** `http://localhost:3000/preview` (no phones needed).
* `npm run dev` restarts the server on change. `PORT=3001 npm start` changes the port.

## Status

| Milestone (goals §11) | State |
|---|---|
| 1. Platform + rules (rooms, reconnect, bots, roles, framing, assassination, game over) | **Done**, fully tested |
| 2. 3D foundation (assets, avatars, campfire, cutscene engine) | **Done** |
| 3. Quests (5 cutscenes × 4 gags + success, assassination, victory) | **Pipeline done; choreography is placeholder** (every gag plays; real comedy to be authored: [docs/CUTSCENES.md](docs/CUTSCENES.md)) |
| 4. Polish (audio, transitions, couch readability, phone UX) | Baseline done: synthesized audio, fades, big type, wake lock, hold-to-reveal; needs a real-TV/real-phone pass |

## Layout

```
server/index.js    HTTP static + WebSocket routing, room codes, heartbeat, GC
server/room.js     one game: phase state machine, timers, reconnect/takeover, per-client state (injectable clock)
server/rules.js    role assignment, knowledge, quest resolution + framing (pure)
server/bots.js     bot decisions (pure)
shared/            avalon tables + validation, campaign data, cutscene op contract, anims, rng, role/avatar info
public/phone.html, phone/    controller UI (plain DOM) + pure view-model
public/tv.html, tv/          TV app: HUD cards, campfire view, net; tv/engine = three.js stage, actors, camera, fx, audio, player
public/tv/scenes/            campfire + quest environments (placeholder-quality) and rigs
public/assets/kaykit/        CC0 KayKit packs (committed; licenses + ATTRIBUTION kept)
scripts/                     fetch-assets, check-assets, browser-check, simulate
test/                        node:test suites
docs/CUTSCENES.md            authoring guide for the cutscene content
```

## Tests and tools

| Command | What it does |
|---|---|
| `npm test` | ~90 unit/integration tests, no browser (≈10 s) |
| `npm run test:browser` | Headless Chromium: plays **every cutscene** in the preview harness (seek through all segments, fail on any console warning/error or blank frame) then a **full live game** through the real TV + phone pages. Needs Playwright (`--quick`, `--shots`, `--live-only`) |
| `npm run sim -- 200` | Bot-only soak/balance simulation per player count on a virtual clock |
| `npm run assets` / `assets:check` | Re-download+copy the KayKit packs / verify files and animation lists |

CI (`.github/workflows/ci.yml`) runs `npm test` and the asset check.

### Acceptance criteria (goals §12) → where they are verified

| Criterion | Verified by |
|---|---|
| No secrets to TV / other phones before game over | `test/room.test.js` (full-game traffic audit, key + role-value scans), `test/server.test.js` (same over real WebSockets) |
| Identical team-member flow | `room.test.js` (same state shape/legal actions; `canFail` is the only private difference), `ui-logic.test.js` (same screens) |
| Failed quest = exactly one culprit from Fail players' picks | `rules.test.js`, invariants checked in every simulated game |
| Quest 4 at 7+ needs two Fails | `avalon.test.js`, `rules.test.js` |
| Role knowledge table, every combination | `rules.test.js` (all valid player-count × role-config × several deals) |
| Phone refresh/lock rejoins; TV refresh resumes | `room.test.js`, `server.test.js`, and `browser-check` (reloads both pages mid-session) |
| Full game for every player count 5–10 and every role combo with 1 human + bots | `room.test.js` ("every player count and every valid role combo") |
| 60 fps at 1080p, readable from 3 m | **Needs a real Mac/TV**: type is sized in `vh`, `?fps` shows the counter; software-GL in CI can't judge this |
| A 5-player game takes 20–30 min | **Needs real play**: timers are in `server/room.js` `DEFAULT_TIMING` and the cutscene durations in `shared/campaign-lost-crown.js` |

## Design notes

* **Server authoritative.** `Room` never touches sockets (clients are `{send, close}` objects) and takes an injectable clock, which is how
  whole games run instantly in tests. The TV state is the public state (+ the cutscene payload only while a cutscene is current);
  phones get the same public state + their own `me` block. Role/knowledge/card/pick data lives only in `me` and, after the game, `reveal`.
* **Quest flow** is the same two steps for every team member (card, then "Who stood out?"). The Fail button is shown to everyone and
  disabled for good players. Results become public only once the cutscene ends.
* **Disconnects:** after 15 s a stand-in bot acts for the missing player (using only that seat's own knowledge) and hands control back on return.
* **TV refresh mid-cutscene** gets the state (incl. result data) but no replayed cutscene message, so it shows the result card. Mid-cutscene
  reconnect resumption is the spec'd behaviour; a TV that was already playing keeps playing.
* **Cutscenes are data**; durations live in `shared/` so the server times phases itself and the TV can never stall the game.
* The **Classic: show fail count** toggle is a VIP lobby option (phone), shown read-only on the TV.
