// HTTP static + WebSocket routing + room codes. No framework: node:http and `ws`.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { makeRng } from '../shared/rng.js';
import { assertCampaignValid } from '../shared/campaign-lost-crown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOUNTS = [
  ['/shared/', path.join(ROOT, 'shared')],
  ['/vendor/three/', path.join(ROOT, 'node_modules', 'three')],
  ['/', path.join(ROOT, 'public')],
];
const PAGES = { '/': 'phone.html', '/tv': 'tv.html', '/preview': 'preview.html' };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.map': 'application/json',
};
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return 'localhost';
}

/** Resolve a URL path to a file under one of the mounts, or null. Exported for tests. */
export function resolveStatic(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  if (PAGES[p]) p = '/' + PAGES[p];
  for (const [prefix, dir] of MOUNTS) {
    if (!p.startsWith(prefix)) continue;
    const rel = p.slice(prefix.length);
    const full = path.resolve(dir, rel);
    if (full !== dir && !full.startsWith(dir + path.sep)) return null; // path traversal
    if (rel.split('/').some((seg) => seg.startsWith('.'))) return null; // no dotfiles
    return full;
  }
  return null;
}

export function createGameServer({
  port = 3000, host = '0.0.0.0', timing, timeScale = 1, clock, rngFactory = () => makeRng(), publicHost, quiet = false,
} = {}) {
  assertCampaignValid();
  const rooms = new Map();
  let boundPort = port;

  const joinUrl = (code) => `http://${publicHost || lanAddress()}:${boundPort}/?room=${code}`;

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
    if (req.url.startsWith('/api/info')) {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ phoneBase: `http://${publicHost || lanAddress()}:${boundPort}`, rooms: rooms.size }));
      return;
    }
    const file = resolveStatic(req.url);
    if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
      const ext = path.extname(file).toLowerCase();
      const immutable = file.includes(`${path.sep}assets${path.sep}`);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'content-length': st.size,
        'cache-control': immutable ? 'public, max-age=86400' : 'no-cache',
      });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

  function newRoom() {
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join(''); } while (rooms.has(code));
    const room = new Room({ code, rng: rngFactory(), clock, timing, timeScale, onEmpty: () => {} });
    rooms.set(code, room);
    return room;
  }

  const sendJson = (ws) => (obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const conn = { send: sendJson(ws), close: () => ws.close() };
    let role = null; // 'tv' | 'phone'
    let room = null;
    let playerId = null;
    let bucket = 40; // simple token bucket: 40 msgs burst, refill 20/s
    const refill = setInterval(() => { bucket = Math.min(40, bucket + 20); }, 1000);

    ws.on('message', (data) => {
      if (--bucket < 0) return;
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

      if (!role) {
        if (msg.t === 'tv') {
          const want = typeof msg.room === 'string' ? msg.room.toUpperCase() : null;
          room = (want && rooms.get(want)) || newRoom();
          role = 'tv';
          room.attachTv(conn);
          conn.send({ t: 'info', joinUrl: joinUrl(room.code), phoneBase: joinUrl('').replace('/?room=', '') });
        } else if (msg.t === 'join') {
          const code = String(msg.room || '').toUpperCase();
          const r = rooms.get(code);
          if (!r) { conn.send({ t: 'error', code: 'noRoom', msg: 'No such room. Check the code on the TV.' }); return; }
          const res = r.join({ name: msg.name, token: msg.token, cls: msg.cls, color: msg.color }, conn);
          if (!res.ok) { conn.send({ t: 'error', code: 'joinFailed', msg: res.error }); return; }
          role = 'phone'; room = r; playerId = res.player.id;
          conn.send({ t: 'joined', id: playerId, token: res.token, room: r.code, resumed: !!res.resumed });
          r.broadcast();
        } else {
          conn.send({ t: 'error', code: 'hello', msg: 'Say tv or join first.' });
        }
        return;
      }
      if (role === 'phone') {
        const err = room.handle(playerId, msg);
        if (err) conn.send({ t: 'error', code: 'action', msg: err.error });
      }
    });

    ws.on('close', () => {
      clearInterval(refill);
      if (role === 'tv' && room) room.detachTv(conn);
      if (role === 'phone' && room) room.detachPhone(playerId, conn);
    });
    ws.on('error', () => {});
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, 20000);
  heartbeat.unref();

  const gc = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      if (r.tvs.size === 0 && r.humans().every((p) => !p.connected) && now - r.lastActivity > 30 * 60 * 1000) { r.destroy(); rooms.delete(code); }
    }
  }, 60000);
  gc.unref();

  return {
    server, wss, rooms,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          boundPort = server.address().port;
          resolve({ port: boundPort, tvUrl: `http://localhost:${boundPort}/tv`, phoneUrl: `http://${publicHost || lanAddress()}:${boundPort}` });
        });
      });
    },
    close() {
      clearInterval(heartbeat); clearInterval(gc);
      for (const r of rooms.values()) r.destroy();
      for (const ws of wss.clients) ws.terminate();
      return new Promise((resolve) => wss.close(() => server.close(() => resolve())));
    },
  };
}

// ---- CLI ----
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : undefined; };
  const port = Number(arg('port') || process.env.PORT || 3000);
  const timeScale = Number(arg('speed') || 1);
  const app = createGameServer({ port, timeScale });
  app.listen().then((info) => {
    console.log('\n  Saboteur Quests: The Lost Crown\n');
    console.log(`  TV:     ${info.tvUrl}`);
    console.log(`  Phones: ${info.phoneUrl}   (same Wi-Fi)`);
    console.log(`  Preview harness: http://localhost:${info.port}/preview\n`);
  }).catch((e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. Try PORT=3001 npm start` : e); process.exit(1); });
}
