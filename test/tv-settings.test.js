// The TV's corner buttons, driven in the tiny fake DOM: sound is remembered across a refresh of the TV page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './fake-dom.js';

const document = installDom();
const { bindSettings } = await import('../public/tv/settings.js');

function tvPage() {
  for (const id of ['btn-mute', 'btn-caps', 'btn-full']) {
    const old = document.getElementById(id); if (old) old.remove();
    const b = document.createElement('button'); b.id = id; document.body.append(b);
  }
  const audio = { muted: false, setMuted(m) { this.muted = m; } };
  const said = [];
  const hud = { scale: 'medium', cycleCaptionScale() { this.scale = this.scale === 'medium' ? 'large' : 'medium'; return this.scale; } };
  const settings = bindSettings({ doc: document, audio, hud, narrate: (t) => said.push(t) });
  return { settings, audio, said, mute: document.getElementById('btn-mute') };
}

test('TV settings: mute is remembered across a refresh, and the buttons say what they do', () => {
  let tv = tvPage();
  assert.equal(tv.audio.muted, false);
  assert.equal(tv.mute.getAttribute('aria-pressed'), 'false');
  tv.mute.click();
  assert.equal(tv.audio.muted, true);
  assert.equal(tv.mute.textContent, '🔇');
  assert.equal(tv.mute.getAttribute('aria-pressed'), 'true');
  tv = tvPage(); // the TV page is refreshed
  assert.equal(tv.audio.muted, true, 'still muted');
  assert.equal(tv.mute.getAttribute('aria-pressed'), 'true');
  tv.settings.toggleMute(); // the M key
  tv = tvPage();
  assert.equal(tv.audio.muted, false);
  document.getElementById('btn-caps').click();
  assert.deepEqual(tv.said, ['Caption size: large']);
  // a browser that refuses fullscreen does not throw
  document.fullscreenElement = null;
  document.documentElement = { requestFullscreen: () => Promise.reject(new Error('denied')) };
  assert.doesNotThrow(() => document.getElementById('btn-full').click());
  document.documentElement = { requestFullscreen: () => { throw new Error('unsupported'); } };
  assert.doesNotThrow(() => tv.settings.toggleFullscreen());
});
