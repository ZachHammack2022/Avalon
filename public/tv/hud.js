// DOM heads-up display over the 3D canvas: room code, the record board, phase cards, captions, freeze-frame, fades.
import { onNarrate } from './engine/narrate.js';
import { boardTree, flipKeyFor, toDom } from './board.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export class Hud {
  constructor(root = document) {
    const $ = (id) => root.getElementById(id);
    this.el = { code: $('code'), joinurl: $('joinurl'), roombar: $('roombar'), board: $('board'), card: $('card'), caption: $('caption'), title: $('titlecard'), freeze: $('freeze'), fade: $('fade'), fps: $('fps'), status: $('status'), unlock: $('unlock') };
    this.capTimer = null; this.titleTimer = null; this.freezeTimer = null;
    this.boardSig = ''; this.boardRevealed = null; this.boardMode = 'hidden';
    this.capScale = store.get('sq.capScale') || 'medium';
    this.setCaptionScale(this.capScale);
    this.unsub = onNarrate((text, o) => this._caption(text, o.dur, o.style));
  }

  setRoom(code, joinUrl) {
    if (code) this.el.code.textContent = code;
    if (joinUrl) this.el.joinurl.textContent = joinUrl.replace(/^https?:\/\//, '').replace('/?room=', '  ·  room ');
  }
  setStatus(s) { this.el.status.textContent = s === 'online' ? '' : 'Reconnecting…'; this.el.status.hidden = s === 'online'; }

  /**
   * The record board. 'full' = quest shields + every proposal and vote (beside the campfire, the result and the
   * game-over cards); 'compact' = just the quest shields (during cutscenes, so the story has the screen);
   * 'hidden' = lobby. Only touches the DOM when something visible changed, so a running flip is never restarted.
   */
  setBoard(pub, mode = 'full') {
    const b = this.el.board;
    const tree = mode !== 'hidden' && pub && pub.game ? boardTree(pub) : null;
    if (!tree) {
      b.hidden = true; b.replaceChildren(); this.boardSig = ''; this.boardMode = 'hidden';
      document.body.classList.remove('board-on');
      if (!pub || !pub.game) this.boardRevealed = null;
      return;
    }
    const revealed = (pub.game.history || []).length;
    const sig = `${mode}|${JSON.stringify(tree)}`;
    const flip = flipKeyFor(pub, this.boardRevealed);
    this.boardRevealed = revealed;
    this.boardMode = mode;
    document.body.classList.toggle('board-on', mode === 'full');
    if (sig === this.boardSig) return;
    this.boardSig = sig;
    b.className = mode;
    b.replaceChildren(...(flip ? boardTree(pub, { flip }) : tree).map((n) => toDom(n)));
    b.hidden = false;
  }

  /** Fraction of the screen width the full board covers, measured from the right edge (0 when not full). */
  boardFraction() {
    const b = this.el.board;
    if (b.hidden || this.boardMode !== 'full' || !window.innerWidth) return 0;
    return Math.max(0, Math.min(0.45, (window.innerWidth - b.getBoundingClientRect().left) / window.innerWidth));
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
    // the game-over card (ten players, five quests, every award) can outgrow its 80vh box, which would cut the last
    // lines off: shrink its text in steps until it fits
    c.style.removeProperty('--fit');
    if (card.kind === 'gameover') {
      for (let s = 0.92; s >= 0.6 && c.scrollHeight > c.clientHeight + 1; s -= 0.08) c.style.setProperty('--fit', s.toFixed(2));
    }
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
  flash(color, dur = 0.35) {
    if (!this.el.flash) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:3'; this.el.fade.parentNode.insertBefore(d, this.el.fade); this.el.flash = d; }
    const f = this.el.flash; f.style.transition = 'none'; if (!color) { f.style.opacity = '0'; return; }
    f.style.background = color; f.style.opacity = '0.85'; void f.offsetWidth; f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = '0';
  }
  fade(to, dur = 0.5) { const f = this.el.fade; f.style.transitionDuration = `${dur}s`; f.style.opacity = to === 'black' ? '1' : '0'; }

  setCaptionScale(s) { this.capScale = s; document.documentElement.dataset.caps = s; store.set('sq.capScale', s); }
  cycleCaptionScale() { const order = ['small', 'medium', 'large']; this.setCaptionScale(order[(order.indexOf(this.capScale) + 1) % 3]); return this.capScale; }
}
