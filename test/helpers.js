import { Room } from '../server/room.js';
import { seeded } from '../shared/rng.js';

export class FakeClock {
  constructor() { this.t = 1_000_000; this.q = []; this.id = 1; }
  now() { return this.t; }
  setTimeout(fn, ms) { const id = this.id++; this.q.push({ id, at: this.t + ms, fn }); return id; }
  clearTimeout(id) { this.q = this.q.filter((x) => x.id !== id); }
  /** Advance virtual time, firing timers in order (including ones scheduled while advancing). */
  advance(ms) {
    const end = this.t + ms;
    for (;;) {
      this.q.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.q[0];
      if (!next || next.at > end) break;
      this.q.shift();
      this.t = Math.max(this.t, next.at);
      next.fn();
    }
    this.t = end;
  }
}

export class FakeConn {
  constructor() { this.msgs = []; this.closed = false; }
  send(o) { this.msgs.push(JSON.parse(JSON.stringify(o))); } // deep copy = what would hit the wire
  close() { this.closed = true; }
  last(type) { for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i].t === type) return this.msgs[i]; return null; }
  get state() { return this.last('state'); }
}

export function makeRoom(opts = {}) {
  const clock = new FakeClock();
  const room = new Room({ code: 'TEST', rng: seeded(opts.seed ?? 1), clock, ...opts });
  return { room, clock };
}

/** Add `humans` human players (connected) and `bots` bots. Returns {humans:[{p,conn}], ...}. */
export function fill(room, humans, bots) {
  const hs = [];
  for (let i = 0; i < humans; i++) {
    const conn = new FakeConn();
    const r = room.join({ name: `Human${i + 1}` }, conn);
    hs.push({ p: r.player, conn, token: r.token });
  }
  const vip = room.vip;
  for (let i = 0; i < bots; i++) room.handle(vip.id, { t: 'addBot' });
  return hs;
}

/** Run the virtual clock until the room reaches `phase` (or give up). */
export function runUntil(room, clock, phase, maxMs = 3 * 3600 * 1000, step = 500) {
  let spent = 0;
  while (room.phase !== phase && spent < maxMs) { clock.advance(step); spent += step; }
  return room.phase === phase;
}

/** Play a full all-bot game; returns the reveal. */
export function playBotGame(room, clock) {
  const vip = room.vip;
  room.handle(vip.id, { t: 'start' });
  if (!runUntil(room, clock, 'gameover')) throw new Error(`stuck in ${room.phase}`);
  return room.g.reveal;
}

export const roleOf = (room, id) => room.g.roles.get(id);
export const findByRole = (room, role) => room.players.find((p) => room.g.roles.get(p.id) === role);
