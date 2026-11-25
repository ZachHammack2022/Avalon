#!/usr/bin/env node
// Bot-only balance/soak simulation on a virtual clock: plays many full games per player count and prints stats.
// Each table plays the recommended roles for its size, the roles a new room starts with.
//   npm run sim -- [gamesPerCount=200] [lancelot]
import { makeRoom, fill, runUntil } from '../test/helpers.js';
import { validateRoleConfig } from '../shared/avalon.js';

const per = Number(process.argv[2] || 200);
const lancelot = process.argv.includes('lancelot');
const rows = [];
for (let n = 5; n <= 10; n++) {
  const tally = { good: 0, evil: 0, reasons: {}, minutes: 0 };
  for (let g = 0; g < per; g++) {
    const { room, clock } = makeRoom({ seed: n * 100000 + g });
    const [h] = fill(room, 1, n - 1);
    // Lancelot takes a good and an evil seat: where the recommended evil roles fill every evil seat, Oberon or Mordred
    // makes room for him
    if (lancelot) {
      const base = room.roleConfig();
      const roles = [{ lancelot: true }, { lancelot: true, oberon: false }, { lancelot: true, mordred: false }].map((x) => ({ ...base, ...x })).find((c) => validateRoleConfig(n, c).ok);
      room.handle(h.p.id, { t: 'setRoles', roles });
    }
    room.handle(h.p.id, { t: 'start' });
    room.detachPhone(h.p.id, h.conn);
    const t0 = clock.now();
    if (!runUntil(room, clock, 'gameover')) throw new Error(`stuck: n=${n} game=${g} phase=${room.phase}`);
    const rv = room.g.reveal;
    tally[rv.winner]++; tally.reasons[rv.reason] = (tally.reasons[rv.reason] || 0) + 1; tally.minutes += (clock.now() - t0) / 60000;
  }
  rows.push({ players: n, 'good win %': +(100 * tally.good / per).toFixed(0), 'evil win %': +(100 * tally.evil / per).toFixed(0), 'avg min (bots only)': +(tally.minutes / per).toFixed(1), endings: JSON.stringify(tally.reasons) });
}
console.table(rows);
