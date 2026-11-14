// Plays the dragon intro video full-screen over the TV. Resolves when it ends or is skipped (any key / click).
export function playIntro(src = '/intro/dragon-intro.mp4') {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.src = src; v.playsInline = true;
    v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:50';
    const hint = document.createElement('div');
    hint.textContent = 'Press any key to skip';
    hint.style.cssText = 'position:fixed;right:2vh;bottom:2vh;z-index:51;color:#f2d9a8;font:2vh system-ui;opacity:.6';
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      window.removeEventListener('keydown', finish, true); window.removeEventListener('pointerdown', finish, true);
      v.pause(); v.remove(); hint.remove(); resolve();
    };
    v.addEventListener('ended', finish); v.addEventListener('error', finish);
    document.body.append(v, hint);
    // listeners are added a beat late so the key/click that started the game doesn't skip it
    setTimeout(() => { window.addEventListener('keydown', finish, true); window.addEventListener('pointerdown', finish, true); }, 600);
    v.play().catch(() => { v.muted = true; v.play().catch(finish); });
  });
}
