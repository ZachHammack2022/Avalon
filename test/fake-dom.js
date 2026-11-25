// A deliberately tiny DOM, just enough to run public/phone/app.js in Node so tests can render every phone screen
// without a browser. Supports what the phone code uses: element trees, classes, attributes, `hidden`, events
// (stored; tests run them with el.fire(type)), and querySelector/closest for simple selectors (`tag`, `.class`, `#id`, combined).
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

class Node {
  constructor() { this.childNodes = []; this.parentNode = null; }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this.replaceChildren(String(v)); }
  append(...kids) {
    for (let k of kids) {
      if (typeof k === 'string') k = new Text(k);
      if (k.parentNode) k.parentNode.childNodes = k.parentNode.childNodes.filter((n) => n !== k);
      k.parentNode = this; this.childNodes.push(k);
    }
  }
  replaceChildren(...kids) { for (const k of this.childNodes) k.parentNode = null; this.childNodes = []; this.append(...kids); }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this); this.parentNode = null; } }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
}
class Text extends Node {
  constructor(t) { super(); this.nodeType = 3; this.data = t; }
  get textContent() { return this.data; }
}

const parseSel = (sel) => {
  const m = /^([a-z0-9]*)((?:[.#][\w-]+)*)$/i.exec(sel.trim());
  if (!m) throw new Error(`fake-dom: unsupported selector ${sel}`);
  return { tag: m[1].toUpperCase(), ids: [...m[2].matchAll(/#([\w-]+)/g)].map((x) => x[1]), cls: [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]) };
};

class Element extends Node {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.listeners = {};
    this.style = { cssText: '' }; this.dataset = {}; this.scrollTop = 0; this.scrollLeft = 0; this.value = '';
    const self = this;
    this.classList = {
      add: (...c) => { self.className = [...new Set([...self._cls(), ...c])].join(' '); },
      remove: (...c) => { self.className = self._cls().filter((x) => !c.includes(x)).join(' '); },
      toggle: (c, on) => { const has = self._cls().includes(c); const want = on === undefined ? !has : !!on; if (want !== has) (want ? self.classList.add : self.classList.remove)(c); return want; },
      contains: (c) => self._cls().includes(c),
    };
  }
  _cls() { return (this.attrs.get('class') || '').split(/\s+/).filter(Boolean); }
  get className() { return this.attrs.get('class') || ''; }
  set className(v) { this.attrs.set('class', String(v)); }
  get id() { return this.attrs.get('id') || ''; }
  set id(v) { this.attrs.set('id', String(v)); }
  get hidden() { return this.attrs.has('hidden'); }
  set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }
  get disabled() { return this.attrs.has('disabled'); }
  set disabled(v) { if (v) this.attrs.set('disabled', ''); else this.attrs.delete('disabled'); }
  set innerHTML(v) { this.replaceChildren(); this.html = String(v); }
  get innerHTML() { return this.html || ''; }
  get offsetWidth() { return 0; } get clientWidth() { return 0; } get clientHeight() { return 0; } get scrollWidth() { return 0; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  focus() {} setPointerCapture() {}
  matches(sel) { const s = parseSel(sel); return (!s.tag || s.tag === this.tagName) && s.ids.every((i) => this.id === i) && s.cls.every((c) => this._cls().includes(c)); }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const k of n.children) { if (k.matches(sel)) out.push(k); walk(k); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  /** test helper: click handlers registered with onclick */
  click() { this.fire('click'); }
  /** test helper: run this element's listeners for `type` with an event carrying `props`. Returns the event. */
  fire(type, props = {}) {
    const ev = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const fn of this.listeners[type] || []) fn(ev);
    return ev;
  }
}

/** Install the globals the phone app expects, with the elements of public/phone.html. */
export function installDom() {
  const root = new URL('../', import.meta.url);
  // the app imports '/shared/…' and '/phone/…' as the server serves them
  register(`data:text/javascript,${encodeURIComponent(`
    const root = ${JSON.stringify(root.href)};
    export async function resolve(spec, ctx, next) {
      if (spec.startsWith('/shared/')) return next(root + spec.slice(1), ctx);
      if (spec.startsWith('/phone/')) return next(root + 'public' + spec, ctx);
      return next(spec, ctx);
    }`)}`, pathToFileURL('./'));
  const document = {
    body: new Element('body'), visibilityState: 'visible', listeners: {},
    createElement: (t) => new Element(t), createTextNode: (t) => new Text(t),
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    getElementById(id) { return this.body.id === id ? this.body : this.body.querySelector(`#${id}`); },
  };
  // the body of the real page, so tests see the same elements and attributes (tags and attributes only, no text)
  const html = readFileSync(new URL('public/phone.html', root), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  const stack = [document.body];
  for (const [, close, tag, attrs] of body.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>/gi)) {
    if (close) { stack.pop(); continue; }
    const e = new Element(tag);
    for (const [, k, v] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) e.setAttribute(k, v ?? '');
    stack[stack.length - 1].append(e);
    stack.push(e);
  }
  const store = new Map();
  Object.assign(globalThis, {
    document,
    window: globalThis,
    location: { search: '', protocol: 'http:', host: 'localhost' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    // sockets the app opens; tests can open one (readyState = 1) and read what it sent
    WebSocket: class FakeSocket { constructor() { this.readyState = 0; this.sent = []; FakeSocket.all.push(this); } send(d) { this.sent.push(JSON.parse(d)); } close() {} static all = []; },
    getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
  });
  globalThis.addEventListener = () => {};
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  return document;
}

/** Visible text of a subtree (hidden elements and screen-reader-only text included; tests decide what matters). */
export const textOf = (n) => n.textContent.replace(/\s+/g, ' ').trim();
