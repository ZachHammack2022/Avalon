#!/usr/bin/env node
// Bot-only balance/soak simulation on a virtual clock: plays many full games per player count and prints stats.
//   npm run sim -- [gamesPerCount=200]
import { makeRoom, fill, runUntil } from '../test/helpers.js';
import { validateRoleConfig } from '../shared/avalon.js';

const per = Number(process.argv[2] || 200);
const rows = [];
for (let n = 5; n <= 10; n++) {
  const tally = { good: 0, evil: 0, reasons: {}, minutes: 0, framed: 0, fails: 0 };
  for (let g = 0; g < per; g++) {
    const { room, clock } = makeRoom({ seed: n * 100000 + g });
    const [h] = fill(room, 1, n - 1);
    const roles = validateRoleConfig(n, { percival: true, morgana: true, mordred: n >= 7 }).ok ? { percival: true, morgana: true, mordred: n >= 7 } : {};
    room.handle(h.p.id, { t: 'setRoles', roles });
    room.handle(h.p.id, { t: 'start' });
    room.detachPhone(h.p.id, h.conn);
    const t0 = clock.now();
    if (!runUntil(room, clock, 'gameover')) throw new Error(`stuck: n=${n} game=${g} phase=${room.phase}`);
    const rv = room.g.reveal;
    tally[rv.winner]++; tally.reasons[rv.reason] = (tally.reasons[rv.reason] || 0) + 1; tally.minutes += (clock.now() - t0) / 60000;
    for (const r of rv.recap) if (r.outcome === 'fail') { tally.fails++; if (r.framed) tally.framed++; }
  }
  rows.push({ players: n, 'good win %': +(100 * tally.good / per).toFixed(0), 'evil win %': +(100 * tally.evil / per).toFixed(0), 'avg min (bots only)': +(tally.minutes / per).toFixed(1), 'framed culprit %': tally.fails ? +(100 * tally.framed / tally.fails).toFixed(0) : 0, endings: JSON.stringify(tally.reasons) });
}
console.table(rows);
