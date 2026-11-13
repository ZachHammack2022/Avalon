// DOM heads-up display over the 3D canvas: room code, quest track, phase cards, captions, freeze-frame, fades.
import { onNarrate } from './engine/narrate.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export class Hud {
  constructor(root = document) {
    const $ = (id) => root.getElementById(id);
    this.el = { code: $('code'), joinurl: $('joinurl'), roombar: $('roombar'), track: $('track'), card: $('card'), caption: $('caption'), title: $('titlecard'), freeze: $('freeze'), fade: $('fade'), fps: $('fps'), status: $('status'), unlock: $('unlock') };
    this.capTimer = null; this.titleTimer = null; this.freezeTimer = null;
    this.capScale = store.get('sq.capScale') || 'medium';
    this.setCaptionScale(this.capScale);
    this.unsub = onNarrate((text, o) => this._caption(text, o.dur, o.style));
  }

  setRoom(code, joinUrl) {
    if (code) this.el.code.textContent = code;
    if (joinUrl) this.el.joinurl.textContent = joinUrl.replace(/^https?:\/\//, '').replace('/?room=', '  ·  room ');
  }
  setStatus(s) { this.el.status.textContent = s === 'online' ? '' : 'Reconnecting…'; this.el.status.hidden = s === 'online'; }

  setTrack(items) {
    this.el.track.replaceChildren(...items.map((s, i) => { const d = document.createElement('div'); d.className = `q ${s}`; d.textContent = s === 'success' ? '✔' : s === 'fail' ? '✘' : String(i + 1); return d; }));
    this.el.track.hidden = items.length === 0;
  }

  showCard(card) {
    const c = this.el.card;
    if (!card) { c.hidden = true; c.replaceChildren(); return; }
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; };
    c.className = `card ${card.kind} ${card.tone || ''}`;
    c.replaceChildren(
      mk('h1', '', card.title),
      ...(card.big ? [mk('div', 'big', card.big)] : []),
      ...(card.subtitle ? [mk('div', 'sub', card.subtitle)] : []),
      ...card.lines.map((l) => mk('p', '', l)),
    );
    c.hidden = false;
  }

  // 3D-driven overlays
  caption(text, dur = 3, style) { this._caption(text, dur, style); }
  _caption(text, dur = 3, style) {
    const c = this.el.caption; c.textContent = text; c.className = `show ${style || ''}`;
    clearTimeout(this.capTimer); this.capTimer = setTimeout(() => { c.className = ''; }, dur * 1000);
  }
  clearCaption() { clearTimeout(this.capTimer); this.el.caption.className = ''; }
  title(text, dur = 2) {
    const t = this.el.title; t.textContent = text; t.className = 'show';
    clearTimeout(this.titleTimer); this.titleTimer = setTimeout(() => { t.className = ''; }, dur * 1000);
  }
  freeze(text, dur = 1.2) {
    const f = this.el.freeze; f.textContent = text; f.className = 'show';
    clearTimeout(this.freezeTimer); this.freezeTimer = setTimeout(() => { f.className = ''; }, dur * 1000);
  }
  fade(to, dur = 0.5) { const f = this.el.fade; f.style.transitionDuration = `${dur}s`; f.style.opacity = to === 'black' ? '1' : '0'; }

  setCaptionScale(s) { this.capScale = s; document.documentElement.dataset.caps = s; store.set('sq.capScale', s); }
  cycleCaptionScale() { const order = ['small', 'medium', 'large']; this.setCaptionScale(order[(order.indexOf(this.capScale) + 1) % 3]); return this.capScale; }
}
