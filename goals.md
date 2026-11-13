# Saboteur Quests: Vertical Slice Spec

A family party game played on a TV, with everyone's phone as a controller (Jackbox-style). It follows **The Resistance: Avalon** rules 1:1, and each quest plays out as a funny **3D cutscene** on the TV. When a quest fails, the saboteurs secretly choose **who gets framed**, and that player is shown causing the disaster in the cutscene.

This doc covers the first vertical slice: one campaign, **"The Lost Crown,"** with five quests.

---

## 1. Goals and non-goals

**Goals**
- Avalon rules 1:1, including all six optional roles.
- Framing: on a failed quest, the cutscene shows one framed player causing the failure.
- 5 cutscenes, each with a shared opening, a suspense moment, 4 fail gags, and a success ending.
- Runs locally: a Node server on a Mac, the TV opens a URL, phones join on the same Wi-Fi.
- Bots can fill seats so the game is testable with 1–2 humans.

**Non-goals for this slice**
- Spoken narrator (captions only, but leave a hook for it; see §8).
- Additional campaigns or the random quest pool.
- Lady of the Lake.
- LLM players.
- Running gags across quests (recurring characters).
- Internet hosting and accounts.

---

## 2. Tech stack

| Part | Choice |
|---|---|
| Server | Node 20+, plain `http` and `ws` (WebSockets). No framework. |
| TV client | Plain ES modules plus **three.js** (served from `node_modules`), `GLTFLoader`, `AnimationMixer`. No build step. |
| Phone client | Plain HTML, CSS and JS. Mobile-first and touch-friendly. No framework. |
| Assets | KayKit packs (CC0), see §9 |
| Shared data | `shared/` modules imported by both server and TV: quest scripts, durations, rules tables. |

Run with `npm install && npm start`. The console prints the TV URL (`http://localhost:3000/tv`) and the phone URL (`http://<LAN-IP>:3000`).

### Suggested layout
```
server/
  index.js        HTTP static + WebSocket routing, room codes
  room.js         one game: players, phases, rules, bots
  rules.js        Avalon tables, role setup and validation, knowledge
  bots.js         bot decisions
shared/
  avalon.js       team sizes, evil counts, two-fail rule (used by server + TV)
  campaign-lost-crown.js   quest scripts (data), see §7
public/
  tv.html, tv/*.js        three.js app: scenes, cutscene player, overlays
  phone.html, phone/*.js  controller UI
  assets/kaykit/...       copied GLB/GLTF + textures
```

---

## 3. Architecture

- **The server is authoritative.** It holds all state, roles, votes and cards, picks cutscene variants, and is the only place that knows who is evil.
- **The TV is a pure display.** It never receives secret information until the game-over reveal.
- **Phones get public state plus their own private state only.** They never see anyone else's role, card, or framing pick.
- **Rooms:** the TV connects and gets a 4-letter room code. Phones join with the code and a name. The first human to join is the **VIP**, who sees lobby controls (start, add/remove bots, role toggles).
- **Reconnect:** phones store a token in `localStorage` and resume their seat after a refresh or screen lock. A player disconnected for more than 15 seconds during a game is played by a bot until they return.
- **Cutscene timing:** the server knows each script's duration from `shared/` and advances phases on its own timer. The TV just plays along, so a TV refresh never stalls the game. If the TV reconnects mid-cutscene, it skips to the result card.

### Message shapes (guidance, not a contract)
- TV → server: `{t:'tv', room?}`
- Phone → server: `join {room,name,token?}`, `start`, `addBot`, `removeBot`, `setRoles {...}`, `setAvatar {cls,color}`, `ready`, `propose {team:[ids]}`, `vote {approve}`, `play {card:'success'|'fail'}`, `pick {id}`, `assassinate {id}`, `again`
- Server → TV: `state` (public), `cutscene {questId, outcome, team, culprit?, hero?, gag?, seed}`
- Server → phone: `state` with a `me` block (role, what they know, legal actions)

---

## 4. Rules (Avalon 1:1)

### Player counts (5–10, bots count toward this)
| Players | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|
| Evil | 2 | 2 | 3 | 3 | 3 | 4 |
| Quest team sizes | 2-3-2-3-3 | 2-3-4-3-4 | 2-3-3-4-4 | 3-4-4-5-5 | 3-4-4-5-5 | 3-4-4-5-5 |

- **Quest 4 needs two Fail cards to fail when there are 7 or more players.** Every other quest fails on one.
- Three successful quests → good wins, unless the Assassin then finds Merlin.
- Three failed quests → evil wins.
- **Five rejected team proposals in a row** within one round → evil wins.
- Leadership rotates clockwise (in join order) after every proposal, whether it was approved or not.

### Roles (all toggleable in the lobby)
Merlin and Assassin are on by default. The VIP toggles Percival, Morgana, Mordred and Oberon.

| Role | Team | Knows |
|---|---|---|
| Loyal Servant | Good | nothing |
| **Merlin** | Good | all evil players **except Mordred** |
| **Percival** | Good | who Merlin and Morgana are, without knowing which is which |
| Minion | Evil | the other evil players (except Oberon) |
| **Assassin** | Evil | the other evil players (except Oberon). Guesses Merlin at the end |
| **Morgana** | Evil | the other evil players (except Oberon). Appears as a possible Merlin to Percival |
| **Mordred** | Evil | the other evil players (except Oberon). Hidden from Merlin |
| **Oberon** | Evil | **no one**, and the other evil players don't know him. Merlin *does* see him |

**Validation in the lobby:**
- The number of special evil roles must not exceed the evil count.
- Percival or Morgana without Merlin is blocked.
- Morgana without Percival shows a warning but is allowed.
- The Assassin is required whenever Merlin is on.

### Quest resolution, with framing
1. Each team member privately plays **Success** or **Fail**. Good players can only play Success; the Fail button is visible but disabled, so screens look the same at a glance.
2. Every team member then answers the same prompt: **"Who stood out on this quest?"** and picks one teammate (any team member, including themselves).
   - For a player who played **Fail**, the pick is the **framing target**.
   - For a player who played **Success**, the pick is a **hero nomination**.
   - Every player goes through the identical two-step flow with identical wording, so timing and screen-glances reveal nothing.
3. Count the Fail cards. The quest fails if fails ≥ the required number (1, or 2 on quest 4 at 7+ players).
4. **Failed quest:** the cutscene shows **exactly one culprit**, no matter how many Fails were played. If several evil players played Fail, pick one of their framing targets at random.
5. **Successful quest:** pick a hero at random from the nominations made by Success players.
6. **The fail count is never shown.** The TV shows only *Success* or *Failed*. This is a deliberate change from Avalon so that evil players never reveal how many of them were on a team. One consequence: on quest 4 at 7+ players, a single hidden Fail that didn't cause a failure leaves no trace.
   - *Lobby toggle "Classic: show fail count" (default off), for players who want the original Avalon information.*

### Assassination
If good reaches three successes, the TV plays a short dramatic beat ("The Assassin steps from the shadows…"). The Assassin picks a player on their phone. If they pick Merlin, evil wins.

### Game over
The TV reveals every role and replays a highlight list: each quest's result and culprit or hero. The VIP can start another game with the same players.

---

## 5. Phases

`lobby → roleReveal → [propose → vote → voteReveal → (approved: questPlay → cutscene → questResult) | (rejected: next leader)]* → assassination? → gameover`

| Phase | TV | Phones |
|---|---|---|
| **lobby** | Room code, join URL, avatars arriving at the campfire | Name, avatar class and color. VIP: start, bots, role toggles |
| **roleReveal** | "Check your phones. Keep them secret." | **Hold to reveal** role card plus what they know. "Ready" button. Advances when everyone is ready or after 30s |
| **propose** | Campfire scene, leader's crown, quest track, reject counter, quest name and team size | Leader: pick N players, confirm. Others: "Leader is choosing…" |
| **vote** | Proposed team highlighted; who has voted (not how) | Approve / Reject |
| **voteReveal** | Every vote revealed (as in Avalon). Approved or rejected | Result |
| **questPlay** | "The team sets out…", waiting on N players | Team: card → teammate pick. Non-team: "Watch the TV" |
| **cutscene** | Plays the quest cutscene (about 20–25s) | "Watch the TV." Optionally a buzz when the culprit is revealed |
| **questResult** | Result card: Success with hero name, or Failed with culprit name | Same |
| **assassination** | Drama beat | Assassin picks; others wait |
| **gameover** | Winner, all roles, recap | VIP: play again |

**Hold-to-reveal:** the phone shows its secret information only while a finger is held on a button, so neighbors can't read it over a shoulder. The role can be re-peeked at any time from a corner button.

---

## 6. Cutscene system

### Structure of every quest cutscene
1. **Setup (about 5s):** establishing shot. Caption introduces the quest. Team avatars arrive in formation, with names shown.
2. **Approach (about 6–8s):** the team works toward the goal. **Identical for success and fail**, so nobody can tell the outcome early.
3. **The moment (about 3s):** the music cuts, the camera pushes in, and everything holds.
4. **Outcome:**
   - **Fail (about 6–8s):** one gag starring the culprit, then the consequence, then a reaction shot of the team.
   - **Success (about 5s):** a hero beat, then the team cheers.

### Comedy direction (use throughout)
- **The beat of silence:** hold about 1s on the mistake before the chaos starts.
- **Oblivious pride:** the culprit often plays `Cheer` right after causing the disaster.
- **Reaction shot:** quick cut to the teammates turning their heads slowly.
- **Freeze-frame:** at the peak of the disaster, a record scratch, the frame freezes, and a caption reads *"Yep. That's {culprit}."* Then it continues.
- **Tone:** slapstick fails, dramatic successes. Family-friendly. Nobody gets hurt; at worst they're singed, flattened or soaked, cartoon-style.

### Engine
- A cutscene is **data** (see §7): a list of beats with camera shots, actor actions, props, captions and SFX cues, plus slots such as `{culprit}`, `{hero}` and `{team}`.
- Engine primitives:
  - **Camera shots:** `wide`, `follow(target)`, `closeUp(target)`, `pushIn(target)`, `lowAngle(target)`, `overShoulder(a,b)`, `orbit(target)`, `shake(intensity)`
  - **Actor actions:** `walkTo`, `runTo`, `play(anim)`, `lookAt`, `face`, `hide`, `tweenTo` (for cartoony motion such as falling, flattening or rolling)
  - **Props:** spawn, attach to a hand slot, tween, apply physics-free arcs
  - **FX:** fire puff, smoke, coin burst, dust, sparkle (simple particle sprites)
  - **UI:** caption, name banner, freeze-frame, record scratch, result card
- Formations handle team sizes 2–5.
- Each quest has a **seeded RNG** (sent from the server) so the gag choice and small variations look the same on reconnect.
- **The server picks the gag** at random from the quest's list and sends it with the culprit, so the TV never makes a game-relevant random choice.

### Audio
Simple: a music loop per scene, a "moment" stinger, a success fanfare, a fail "wah-wah," and the record scratch. Synthesized with WebAudio, or CC0 files. A mute toggle is on the TV.

---

## 7. Campaign: "The Lost Crown"

Story: a usurper has stolen the crown. The party must recover it and return it to the rightful heir before the coronation.

Each quest's opening caption can vary slightly based on the previous result ("Fresh from their triumph…" or "Still smelling of smoke…"). That's the only carry-over between quests in this slice.

### Quest 1: The Old Bridge
- **Setup:** dusk, a deep gorge, a rickety rope bridge. *"The only way into the kingdom is across the Old Bridge."*
- **Approach:** the team edges across in single file, one carrying a lantern. The bridge creaks.
- **Moment:** halfway across, the music stops and a rope groans.
- **Fail gags** (the server picks one):
  1. **The Sweater:** culprit tugs a loose rope "to tighten it." The whole bridge unravels plank by plank behind them like a sweater.
  2. **"Catch!":** culprit tosses the lantern ahead to a teammate. It sails past, into the gorge. A long silence, then a tiny *clink* far below. Darkness.
  3. **The Sturdiness Test:** culprit bounces twice to "test it," then drops straight through, leaving a cartoon-shaped hole. The team peers down.
  4. **Premature Celebration:** at the halfway point, culprit throws up their arms: "WE MADE IT!" and does a victory dance. The bridge disagrees.
- **Fail consequence:** the team ends up dangling or dropping into the river below and washes away downstream. Reaction shot.
- **Success:** the team reaches the far side just as the bridge collapses behind them. The hero turns to the camera and dusts off their hands.

### Quest 2: The Whispering Woods
- **Setup:** a moonlit forest. A patrol of skeletons marches through. *"Sneak past the patrol."*
- **Approach:** the team creeps from tree to tree behind the patrol.
- **Moment:** a skeleton stops and slowly turns.
- **Fail gags:**
  1. **Thin Tree:** culprit hides behind a tree half their width. The skeletons tilt their heads in unison.
  2. **Distraction:** culprit throws a rock to distract the patrol and hits a skeleton squarely in the skull. *Bonk.*
  3. **Bush Disguise:** culprit's bush disguise works perfectly, except the legs stick out. Then the bush waddles.
  4. **The Sneeze:** culprit sneezes so hard a skeleton falls apart. It reassembles angrily with its skull on its hip.
- **Fail consequence:** the skeletons chase the team out of the woods in a cartoon running loop.
- **Success:** the patrol marches right past. The hero gives a silent thumbs-up from the shadows.

### Quest 3: The Vault
- **Setup:** the usurper's treasury, an enormous round vault door with torches. *"The crown's map is locked in the royal vault."*
- **Approach:** the team sneaks to the door and the hero kneels with lockpicks.
- **Moment:** the tumblers click…
- **Fail gags:**
  1. **Polite Knock:** culprit steps forward and knocks politely. A guard opens the door. Beat. Guard and team stare.
  2. **The Thank-You Note:** culprit leaves a note on the vault: *"Sorry for the robbery! ♥ — {culprit}."* The camera zooms on the signature. The guards read it and look up.
  3. **DO NOT PULL:** culprit reads the sign aloud, "Do… not… pull," then pulls the lever. Alarm bells.
  4. **Outward Door:** culprit cracks it perfectly and proudly swings the door open. It opens outward and flattens the team.
- **Fail consequence:** alarm, guards pour in, and the team is tossed out the front gate.
- **Success:** the door swings open with a golden glow. The hero holds up the map.

### Quest 4: The Dragon's Hoard *(two-fail quest at 7+ players)*
- **Setup:** a cave. A dragon sleeps on a mountain of gold with the crown on top. *"Do. Not. Wake. The dragon."*
- **Approach:** the team tiptoes through the gold as coins shift and slide.
- **Moment:** extreme close-up of the dragon's eye. Silence.
- **Fail gags:**
  1. **Counting:** culprit starts counting the gold out loud, "One… two… three…", with a time-skip caption. The dragon's eye opens on "forty-seven."
  2. **Good Boy:** culprit pets the dragon. It purrs. Then it sneezes fire, and the team emerges with charcoal faces and blinks.
  3. **Plume:** culprit's helmet plume tickles the dragon's nose. Slow-motion sneeze build-up.
  4. **Better Angle:** culprit climbs onto the dragon "for a better angle." The dragon wakes and flies off with the culprit waving from its back.
- **Fail consequence:** the team flees the cave in a cartoon fireball chase.
- **Success:** the hero lifts the crown in a low-angle shot as the dragon snores on.

### Quest 5: The Throne Room
- **Setup:** a grand hall. The usurper stands at the throne, mid-ceremony. *"Return the crown to the rightful heir."*
- **Approach:** the team marches down the carpet and the crowd gasps.
- **Moment:** the crown is raised over the heir's head…
- **Fail gags:**
  1. **Self-Coronation:** culprit puts the crown on their own head, bows to the crowd, then notices the guards.
  2. **The Roll:** culprit trips. The crown rolls the full length of the hall like a wheel into the usurper's hands. Usurper: *"Oh! Thank you."*
  3. **The Mug:** culprit solemnly crowns the heir with a tavern mug. The crowd falls silent, then the camera finds the real crown on the culprit's belt.
  4. **The Speech:** culprit begins "a few words." Time-lapse: candles melt, the guards fall asleep, and the usurper crowns himself in the background.
- **Fail consequence:** the usurper is crowned, and the team is escorted out.
- **Success:** the heir is crowned, the hall cheers, and the camera slowly cranes up. If this is the third success, roll straight into the assassination beat.

### Other scenes
- **Campfire (lobby / propose / vote):** avatars sit around a fire (`Sit_Floor_Idle`). The leader wears a crown. Proposed team members stand up into a lit ring. Vote reveal puts an approve or reject token over each head.
- **Assassination:** the campfire at night, the fire flickers low, and the Assassin's shadow. Reveal: Merlin is struck by a (comedic) rubber arrow, or the arrow misses and hits a log.
- **Victory:** good wins with a throne-room celebration. Evil wins with the usurper's coronation and the evil players revealed one by one, standing behind the throne.

---

## 8. Avatars, narration, settings

- **Avatars:** each player picks a KayKit class (Knight, Mage, Rogue, Barbarian, Hooded Rogue) and a color. The color tints the outfit or an accent and the name banner, and must be readable on the TV from a couch.
- **Narration:** captions only. Every caption runs through one `narrate(text)` function so a spoken narrator (`speechSynthesis`) can be added later behind a TV toggle that's easy to switch off.
- **TV settings:** mute, captions size, "Classic: show fail count" (default off).

---

## 9. Assets (all CC0)

Clone and copy the needed GLB/GLTF files and textures into `public/assets/kaykit/`. Keep the license files.
- `github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`: Knight, Mage, Rogue, Rogue_Hooded and Barbarian GLBs (76 animations each, including `Idle`, `Walking_A/B/C`, `Running_A`, `Cheer`, `Sit_Floor_*`, `PickUp`, `Interact`, `Hit_A/B`, `Death_A`, `Lie_*`, `Jump_*`, `Dodge_*`, `Throw`, `Use_Item`), plus props (mug, shields, weapons, spellbook, smokebomb).
- `github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`: the skeleton patrol and guards.
- `github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0`: vault, chests, coins, torches, walls and doors.
- `github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`: terrain, castle, bridge, trees and water.
- Build anything missing (dragon, gorge, rope bridge) from simple stylized low-poly geometry that matches the KayKit look. The dragon can be a chunky low-poly build with a few tweened parts (eye, jaw, wings, tail).

---

## 10. Bots

Bots exist for testing and to fill seats. They can hold any role.
- **Propose:** include themselves plus random others. Evil bots prefer including one evil player.
- **Vote:** good bots approve about 65% of the time (always if on the team). Evil bots approve if an evil player is on the team. Everyone approves on the fifth proposal.
- **Quest:** good bots play Success. Evil bots play Fail about 70% of the time, less often if they were on the last failed team. Framing target is a random good teammate. Hero nomination is random.
- **Assassin bot:** picks at random among players it doesn't know are evil.

---

## 11. Milestones

1. **Platform and rules, no 3D:** rooms, joining, reconnect, bots, roles and knowledge, propose/vote/quest/framing/assassination, game over. The TV shows plain text cards for each phase. **Exit:** a full game plays correctly with 1 human and bots for every player count from 5 to 10 and every role combination.
2. **3D foundation:** asset loading, avatars with class and color, campfire scene for lobby, propose and vote, and the cutscene engine with camera shots, actions and captions.
3. **Quests:** all five cutscenes, each with 4 fail gags and a success ending, plus the assassination and victory scenes.
4. **Polish:** audio, transitions, readability from a couch, phone UX pass.

---

## 12. Acceptance criteria

- [ ] No secret information (roles, cards, framing picks, fail count) reaches the TV or any other player's phone before game over. Verify by inspecting WebSocket traffic.
- [ ] Every team member's phone flow is identical in steps, wording and layout, regardless of role or card.
- [ ] A failed quest always shows exactly one culprit, chosen from the framing picks of the Fail players.
- [ ] Quest 4 at 7+ players requires two Fails.
- [ ] Role knowledge matches the table in §4 for every combination.
- [ ] A phone that refreshes or locks mid-game rejoins its seat. A TV that refreshes resumes at the current phase.
- [ ] Each cutscene runs at 60fps on a recent Mac at 1080p and is readable from about 3 m away.
- [ ] A complete 5-player game takes about 20–30 minutes.
