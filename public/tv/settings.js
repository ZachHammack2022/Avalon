// The TV's corner buttons: sound, caption size, fullscreen (also on the M, C and F keys). Sound and caption size
// survive a refresh of the TV page; the caption size is kept by the HUD, the sound here.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function bindSettings({ doc = document, audio, hud, narrate }) {
  const $ = (id) => doc.getElementById(id);
  const mute = $('btn-mute'); const caps = $('btn-caps'); const full = $('btn-full');
  const showMute = () => {
    mute.textContent = audio.muted ? '🔇' : '🔊';
    mute.setAttribute('aria-pressed', String(audio.muted));
  };
  audio.setMuted(store.get('sq.muted') === '1');
  showMute();
  const toggleMute = () => { audio.setMuted(!audio.muted); store.set('sq.muted', audio.muted ? '1' : '0'); showMute(); };
  const cycleCaptions = () => narrate(`Caption size: ${hud.cycleCaptionScale()}`, { dur: 1.5, silent: true });
  const toggleFullscreen = () => {
    // the browser may refuse (no user gesture, or no fullscreen at all): that is not an error worth reporting
    try { const p = doc.fullscreenElement ? doc.exitFullscreen() : doc.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* unsupported */ }
  };
  mute.addEventListener('click', toggleMute);
  caps.addEventListener('click', cycleCaptions);
  full.addEventListener('click', toggleFullscreen);
  return { toggleMute, cycleCaptions, toggleFullscreen };
}
