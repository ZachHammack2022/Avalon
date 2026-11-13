// TV websocket: announces itself, resumes the same room after a refresh, reconnects with backoff.
export class TvNet {
  constructor({ onState, onCutscene, onRoom, onInfo, onStatus }) {
    Object.assign(this, { onState, onCutscene, onRoom, onInfo, onStatus });
    this.room = new URLSearchParams(location.search).get('room') || sessionStorage.getItem('sq.tv.room') || null;
    this.retry = 0; this.ws = null; this.connect();
  }
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => { this.retry = 0; this.onStatus && this.onStatus('online'); this.ws.send(JSON.stringify({ t: 'tv', room: this.room || undefined })); };
    this.ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'room') { this.room = m.code; try { sessionStorage.setItem('sq.tv.room', m.code); } catch { /* ignore */ } this.onRoom && this.onRoom(m.code); }
      else if (m.t === 'info') this.onInfo && this.onInfo(m);
      else if (m.t === 'state') this.onState(m.pub);
      else if (m.t === 'cutscene') this.onCutscene(m);
    };
    this.ws.onclose = () => { this.onStatus && this.onStatus('offline'); setTimeout(() => this.connect(), Math.min(5000, 400 * 2 ** this.retry++)); };
    this.ws.onerror = () => {};
  }
}
