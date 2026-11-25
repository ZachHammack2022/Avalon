import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { createGameServer, isRoomCode, parseRange, resolveStatic, sendFile } from '../server/index.js';

async function boot(opts = {}) {
  const app = createGameServer({ port: 0, host: '127.0.0.1', publicHost: '127.0.0.1', ...opts });
  const info = await app.listen();
  return { app, info, ws: `ws://127.0.0.1:${info.port}/ws`, base: `http://127.0.0.1:${info.port}` };
}

const ALL = [];
after(() => { for (const c of ALL) c.ws.terminate(); });

class Client {
  constructor(url) {
    ALL.push(this);
    this.msgs = [];
    this.waiters = [];
    this.ws = new WebSocket(url);
    this.ws.on('message', (d) => { const m = JSON.parse(d.toString()); this.msgs.push(m); this.waiters = this.waiters.filter((w) => !w(m)); });
    this.open = new Promise((res, rej) => { this.ws.on('open', res); this.ws.on('error', rej); });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  waitFor(pred, ms = 8000) {
    const hit = this.msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout waiting for message')), ms);
      this.waiters.push((m) => { if (pred(m)) { clearTimeout(t); res(m); return true; } return false; });
    });
  }
  last(t) { return [...this.msgs].reverse().find((m) => m.t === t); }
  close() { this.ws.close(); }
}

const rawGet = (base, rawPath) => new Promise((res, rej) => {
  const u = new URL(base);
  const req = http.request({ host: u.hostname, port: u.port, path: rawPath, method: 'GET' }, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); });
  req.on('error', rej); req.end();
});

test('static: pages, shared modules and three.js are served; traversal and dotfiles are not', async () => {
  const { app, base } = await boot();
  try {
    for (const [p, type] of [['/', 'text/html'], ['/tv', 'text/html'], ['/shared/avalon.js', 'javascript'], ['/vendor/three/build/three.module.js', 'javascript'], ['/healthz', 'text/plain']]) {
      const r = await fetch(base + p);
      assert.equal(r.status, 200, p);
      assert.match(r.headers.get('content-type'), new RegExp(type), p);
    }
    for (const bad of ['/%2e%2e/package.json', '/shared/%2e%2e/package.json', '/..%2f..%2fetc/passwd', '/vendor/three/../../package.json', '/.git/config', '/shared/%00.js', '/server/index.js', '/node_modules/ws/package.json']) {
      const code = await rawGet(base, bad);
      assert.ok(code === 404 || code === 400, `${bad} -> ${code}`);
    }
    assert.equal((await fetch(base + '/api/info')).status, 200);
  } finally { await app.close(); }
});

test('the intro video is served as video with byte ranges (Safari will not play it otherwise)', async () => {
  const { app, base } = await boot();
  try {
    const url = `${base}/intro/dragon-intro.mp4`;
    const file = new URL('../public/intro/dragon-intro.mp4', import.meta.url);
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    const slice = (start, end) => { const b = Buffer.alloc(end - start + 1); fs.readSync(fd, b, 0, b.length, start); return b; };
    const whole = { length: size, subarray: (a, b) => slice(a, b - 1) };
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'video/mp4');
    assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.equal(Number(full.headers.get('content-length')), size);
    await full.body.cancel();
    // Safari's first probe, then a seek into the middle and a suffix
    for (const [h, start, end] of [['bytes=0-1', 0, 1], ['bytes=1000-1999', 1000, 1999], ['bytes=-100', whole.length - 100, whole.length - 1], [`bytes=${whole.length - 10}-`, whole.length - 10, whole.length - 1]]) {
      const r = await fetch(url, { headers: { range: h } });
      assert.equal(r.status, 206, h);
      assert.equal(r.headers.get('content-range'), `bytes ${start}-${end}/${whole.length}`, h);
      const got = Buffer.from(await r.arrayBuffer());
      assert.ok(got.equals(whole.subarray(start, end + 1)), h);
    }
    const bad = await fetch(url, { headers: { range: `bytes=${whole.length}-` } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers.get('content-range'), `bytes */${whole.length}`);
    await bad.arrayBuffer();
    // pages are not video, but ranges work for any file
    const page = await fetch(`${base}/tv`, { headers: { range: 'bytes=0-14' } });
    assert.equal(page.status, 206);
    assert.equal((await page.text()).length, 15);
    fs.closeSync(fd);
  } finally { await app.close(); }
});

test('a download the browser cuts off closes its file (video players abort range requests all the time)', async () => {
  const fdDir = '/proc/self/fd';
  const { app, info } = await boot();
  try {
    const openFiles = () => fs.readdirSync(fdDir).length;
    const before = fs.existsSync(fdDir) ? openFiles() : 0;
    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port: info.port, path: '/intro/dragon-intro.mp4' }, (res) => {
          res.once('data', () => { req.destroy(); setTimeout(resolve, 20); });
        });
        req.on('error', () => {});
      });
    }
    await new Promise((r) => setTimeout(r, 200));
    // Linux shows open files under /proc; elsewhere this still proves the server survives the aborts
    if (fs.existsSync(fdDir)) assert.ok(openFiles() - before < 6, `${openFiles() - before} files left open`);
    assert.equal((await fetch(`http://127.0.0.1:${info.port}/healthz`)).status, 200);
  } finally { await app.close(); }
});

test('a file that cannot be read ends its response instead of crashing the server', async () => {
  const ended = await new Promise((resolve) => {
    const res = new Writable({ write(chunk, enc, cb) { cb(); } });
    res.on('close', () => resolve(true));
    sendFile('/no/such/file.mp4', res);
  });
  assert.equal(ended, true);
});

test('parseRange follows the Range header rules', () => {
  assert.deepEqual(parseRange('bytes=0-1', 1000), { start: 0, end: 1 });
  assert.deepEqual(parseRange('bytes=10-', 1000), { start: 10, end: 999 });
  assert.deepEqual(parseRange('bytes=-200', 1000), { start: 800, end: 999 });
  assert.deepEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange('bytes=990-5000', 1000), { start: 990, end: 999 });
  for (const h of [undefined, '', 'bytes=-', 'bytes=5-1', 'bytes=0-1,4-5', 'items=0-1', 'bytes=a-b']) assert.equal(parseRange(h, 1000), null, String(h));
  for (const h of ['bytes=1000-', 'bytes=-0', 'bytes=2000-3000']) assert.equal(parseRange(h, 1000), 'unsatisfiable', h);
});

test('resolveStatic confines paths to the mounts', () => {
  assert.equal(resolveStatic('/shared/../server/index.js'), null);
  assert.equal(resolveStatic('/../x'), null);
  assert.ok(resolveStatic('/shared/avalon.js').endsWith('shared/avalon.js'));
});

test('after a server restart the TV gets its room back under the same code, and phones rejoin with it', async () => {
  let code; let token;
  {
    const { app, ws } = await boot();
    try {
      const tv = new Client(ws); await tv.open; tv.send({ t: 'tv' });
      ({ code } = await tv.waitFor((m) => m.t === 'room'));
      const ph = new Client(ws); await ph.open; ph.send({ t: 'join', room: code, name: 'Ann' });
      ({ token } = await ph.waitFor((m) => m.t === 'joined'));
    } finally { await app.close(); }
  }
  const { app, ws } = await boot(); // the server came back with no rooms
  try {
    const tv = new Client(ws); await tv.open; tv.send({ t: 'tv', room: code.toLowerCase() });
    assert.equal((await tv.waitFor((m) => m.t === 'room')).code, code);
    // the phone still has the code and its old token: it lands in the lobby under its name
    const ph = new Client(ws); await ph.open; ph.send({ t: 'join', room: code, name: 'Ann', token });
    const j = await ph.waitFor((m) => m.t === 'joined');
    assert.equal(j.room, code); assert.equal(j.resumed, false);
    assert.deepEqual((await tv.waitFor((m) => m.t === 'state' && m.pub.players.length === 1)).pub.players.map((p) => p.name), ['Ann']);
    // a second TV asking for that code joins the same room; a made-up or taken-looking code gets a fresh one
    const tv2 = new Client(ws); await tv2.open; tv2.send({ t: 'tv', room: code });
    assert.equal((await tv2.waitFor((m) => m.t === 'room')).code, code);
    const tv3 = new Client(ws); await tv3.open; tv3.send({ t: 'tv', room: 'AB1!' });
    const fresh = (await tv3.waitFor((m) => m.t === 'room')).code;
    assert.notEqual(fresh, code); assert.ok(isRoomCode(fresh));
    for (const c of [tv, tv2, tv3, ph]) c.close();
  } finally { await app.close(); }
  assert.equal(isRoomCode('ABCD'), true);
  for (const bad of ['ABC', 'ABCDE', 'abcd', 'ABIO', 'AB1D', null, 42]) assert.equal(isRoomCode(bad), false, String(bad));
});

test('joining an unknown room is rejected; bad first messages get an error', async () => {
  const { app, ws } = await boot();
  try {
    const c = new Client(ws); await c.open;
    c.send({ t: 'join', room: 'ZZZZ', name: 'x' });
    assert.equal((await c.waitFor((m) => m.t === 'error')).code, 'noRoom');
    c.send({ t: 'bogus' });
    c.send('not json at all');
    c.ws.send('{{{');
    c.close();
  } finally { await app.close(); }
});

/** A phone that plays by its `me.legal` block. */
function autoPhone(client, { evilFails = true } = {}) {
  client.ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t !== 'state' || !m.me) return;
    const { me, pub } = m;
    if (!me.legal) return;
    const L = me.legal;
    const ids = pub.players.map((p) => p.id);
    if (L.action === 'ready') { if (!L.done) client.send({ t: 'ready' }); return; }
    if (L.action === 'propose') { client.send({ t: 'propose', team: ids.slice(0, L.size) }); return; }
    if (L.action === 'vote') { client.send({ t: 'vote', approve: true }); return; }
    if (L.action === 'assassinate') { client.send({ t: 'assassinate', id: L.options[0] }); return; }
    if (me.quest && me.quest.onTeam && me.quest.step === 'card') client.send({ t: 'play', card: me.quest.canFail && evilFails ? 'fail' : 'success' });
  });
}

test('end to end over real websockets: TV + 1 human + 4 bots play a full game, with a traffic audit', async () => {
  const { app, ws } = await boot({ timeScale: 400 });
  try {
    const tv = new Client(ws); await tv.open;
    tv.send({ t: 'tv' });
    const { code } = await tv.waitFor((m) => m.t === 'room');
    assert.match(code, /^[A-Z]{4}$/);
    assert.ok((await tv.waitFor((m) => m.t === 'info')).joinUrl.includes(`room=${code}`));

    const phone = new Client(ws); await phone.open;
    phone.send({ t: 'join', room: code.toLowerCase(), name: 'Zed' });
    const joined = await phone.waitFor((m) => m.t === 'joined');
    assert.ok(joined.token && joined.id);
    const first = await phone.waitFor((m) => m.t === 'state');
    assert.equal(first.me.vip, true);

    for (let i = 0; i < 4; i++) phone.send({ t: 'addBot' });
    await phone.waitFor((m) => m.t === 'state' && m.pub.players.length === 5);
    autoPhone(phone);
    phone.send({ t: 'start' });
    const over = await tv.waitFor((m) => m.t === 'state' && m.pub.phase === 'gameover', 30000);
    assert.ok(over.pub.reveal.winner);
    assert.equal(Object.keys(over.pub.reveal.roles).length, 5);

    // Audit all traffic the TV got before gameover
    const SECRET = /"(role|roleName|knows|knowKind|note|cards?|picks|failers|assassination|reveal|recap|failCount)":/;
    let sawCutscene = false;
    for (const m of tv.msgs) {
      if (m.t === 'state' && m.pub.phase === 'gameover') break;
      assert.ok(!SECRET.test(JSON.stringify(m)), `TV leak ${JSON.stringify(m).slice(0, 160)}`);
      if (m.t === 'cutscene') sawCutscene = true;
    }
    assert.ok(sawCutscene, 'TV received at least one cutscene message');
    // The phone saw only its own role in `me`
    const states = phone.msgs.filter((m) => m.t === 'state' && m.me);
    assert.ok(states.every((m) => m.me.id === joined.id));
    assert.ok(states.every((m) => !SECRET.test(JSON.stringify(m.pub)) || m.pub.phase === 'gameover'));
    tv.close(); phone.close();
  } finally { await app.close(); }
});

test('a phone that reconnects with its token resumes its seat; a TV that reconnects gets the current phase', async () => {
  const { app, ws } = await boot();
  try {
    const tv = new Client(ws); await tv.open; tv.send({ t: 'tv' });
    const { code } = await tv.waitFor((m) => m.t === 'room');
    const p1 = new Client(ws); await p1.open;
    p1.send({ t: 'join', room: code, name: 'Ann' });
    const { token, id } = await p1.waitFor((m) => m.t === 'joined');
    for (let i = 0; i < 4; i++) p1.send({ t: 'addBot' });
    await p1.waitFor((m) => m.t === 'state' && m.pub.players.length === 5);
    p1.send({ t: 'start' });
    await p1.waitFor((m) => m.t === 'state' && m.pub.phase === 'roleReveal');
    const role = p1.last('state').me.role;
    p1.close();
    await new Promise((r) => setTimeout(r, 100));

    const p2 = new Client(ws); await p2.open;
    p2.send({ t: 'join', room: code, name: 'Ann', token });
    const j = await p2.waitFor((m) => m.t === 'joined');
    assert.equal(j.id, id); assert.equal(j.resumed, true);
    const st = await p2.waitFor((m) => m.t === 'state' && m.me);
    assert.equal(st.me.role, role);
    assert.equal(st.pub.players.length, 5);

    // a brand-new phone cannot join mid-game
    const p3 = new Client(ws); await p3.open;
    p3.send({ t: 'join', room: code, name: 'Late' });
    assert.match((await p3.waitFor((m) => m.t === 'error')).msg, /progress/);

    tv.close();
    const tv2 = new Client(ws); await tv2.open; tv2.send({ t: 'tv', room: code });
    const s = await tv2.waitFor((m) => m.t === 'state');
    assert.equal(s.pub.room, code);
    assert.equal(s.pub.phase, 'roleReveal');
    assert.equal(app.rooms.size, 1, 'TV resumed the same room rather than creating a new one');
  } finally { await app.close(); }
});

test('a phone sending a message named after a built-in gets an error and the server keeps running', async () => {
  const { app, ws, base } = await boot();
  try {
    const tv = new Client(ws); await tv.open;
    tv.send({ t: 'tv' });
    const { code } = await tv.waitFor((m) => m.t === 'room');
    const ph = new Client(ws); await ph.open;
    ph.send({ t: 'join', room: code, name: 'Mal' });
    await ph.waitFor((m) => m.t === 'joined');
    for (const t of ['__proto__', '__defineGetter__', '__defineSetter__', 'constructor']) ph.send({ t });
    await ph.waitFor((m) => m.t === 'error' && m.code === 'action' && ph.msgs.filter((x) => x.t === 'error').length === 4);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    // the room still works for the same phone
    ph.send({ t: 'addBot' });
    await tv.waitFor((m) => m.t === 'state' && m.pub.players.length === 2);
  } finally { await app.close(); }
});

test('oversized and flooding messages do not crash or wedge the server', async () => {
  const { app, ws } = await boot();
  try {
    const c = new Client(ws); await c.open;
    c.send({ t: 'tv' });
    await c.waitFor((m) => m.t === 'room');
    for (let i = 0; i < 500; i++) c.send({ t: 'x', i });
    const big = new Client(ws); await big.open;
    big.ws.send('x'.repeat(100000));
    await new Promise((r) => setTimeout(r, 150));
    const ok = await fetch(`http://127.0.0.1:${app.server.address().port}/healthz`);
    assert.equal(ok.status, 200);
  } finally { await app.close(); }
});
