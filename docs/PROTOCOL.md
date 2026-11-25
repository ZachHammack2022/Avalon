# Wire protocol

One WebSocket endpoint, `/ws`, JSON text frames, max 8 KB per frame. The first message identifies the client; after that a
connection is a **TV** (display only, sends nothing else) or a **phone** (controller). Per-connection rate limit: 40-message burst,
refilled at 20/s; excess messages are dropped.

## Handshake

| Client → server | Reply |
|---|---|
| `{t:'tv', room?}` | `{t:'room', code}`, `{t:'info', joinUrl, phoneBase}`, `{t:'state', pub}`. Unknown/missing `room` creates a new room. |
| `{t:'join', room, name, token?, cls?, color?}` | `{t:'joined', id, token, room, resumed}` then `{t:'state', pub, me}`; or `{t:'error', code:'noRoom'|'joinFailed', msg}` |

A `token` that matches a seat resumes it (the old socket for that seat is closed). New players cannot join once a game started.

## Phone → server (after joining)

`setAvatar {cls?, color?}` · VIP/lobby: `start`, `addBot`, `removeBot {id?}`, `kick {id}`, `setRoles {roles:{merlin,assassin,percival,morgana,mordred,oberon}}`, `setClassic {on}` ·
`leave` (lobby) · `ready` · `propose {team:[ids]}` · `vote {approve}` · `play {card:'success'|'fail'}` · `pick {id}` · `assassinate {id}` · `again` (VIP, game over).
Illegal actions get `{t:'error', code:'action', msg}` and change nothing.

## Server → TV

* `state {pub}`: public state (below) plus, only while `phase === 'cutscene'`, `pub.cutscene`.
* `cutscene {questId, questIndex, outcome:'success'|'fail', team:[ids], culprit|null, hero|null, gag|null, seed, prevOutcome, failCount?}`
  sent once when the cutscene starts (never replayed on reconnect: the TV shows the result card instead). `failCount` only in Classic mode.

## Server → phone

`state {pub, me}`. `pub` is exactly the TV's public state *without* `cutscene`. `me` is private:

```
me: { id, name, vip, takeover,
      role, roleName, team:'good'|'evil', knowKind:'none'|'evil'|'allies'|'merlins', knows:[ids], note,   // once a game started
      legal: {action:'ready'|'propose'|'vote'|'assassinate'|'again'|'wait', size?, options?, done?},
      quest?: {onTeam, step:'card'|'pick'|'done'|null, canFail, options:[ids]} }                         // during questPlay
```

## Public state (`pub`)

```
{ room, phase, phaseEndsAt, config:{roles:{…}, classic},
  players:[{id,name,cls,color,bot,vip,connected,takeover,ready}],
  validation?: {ok,errors,warnings}            // lobby only
  game?: { n, questIndex, quest:{id,name}, teamSize, leader, rejectCount, team:[ids],
           results:[{questIndex,outcome,team,culprit,hero,failCount?}],   // only results whose cutscene has finished
           voted?:[ids] (vote), votes?:{id:bool} + approved (voteReveal), waitingOn? (questPlay), assassinationEnabled,
           history:[{questIndex,leader,team,votes:{id:bool},approved}] (every revealed proposal; public) },
  reveal?: { winner, reason, roles:{id:role}, assassination, recap:[…] }  // gameover only, the ONLY place roles/cards/picks appear
}
```

Phases: `lobby → roleReveal → propose → vote → voteReveal → (questPlay → cutscene → questResult | next propose) … → assassination? → gameover`.
