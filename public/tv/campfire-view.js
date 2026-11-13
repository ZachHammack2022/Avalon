// The campfire backdrop for lobby / propose / vote: avatars sit around the fire, the leader wears a crown,
// the proposed team stands up into a lit ring, and vote tokens float over heads at the reveal.
import * as THREE from 'three';
import { seatSlots } from './scenes/campfire.js';
import { makeBanner } from './engine/actor.js';

const RING_R = 8.2;

function token(text, color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.font = '800 78px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.5, 1.5, 1); s.renderOrder = 1000; return s;
}

export class CampfireView {
  constructor(stage) { this.stage = stage; this.actors = new Map(); this.crown = null; this.tokens = new Map(); this.rings = new Map(); this.night = false; this.key = ''; }

  async enter(night = false) {
    this.night = night;
    this.actors.clear(); this.tokens.clear(); this.rings.clear(); this.crown = null; this.key = '';
    const def = await this.stage.loadScene(night ? 'night' : 'campfire');
    this.stage.cast.clear();
    this.stage.camSpec = { shot: 'wide', start: this.stage.time };
    return def;
  }

  /** Ring slots for the proposed team (a lit semicircle in front of the fire). */
  ringSlots(n) {
    return Array.from({ length: n }, (_, i) => {
      const ang = Math.PI / 2 + (i - (n - 1) / 2) * 0.42; // arc centered on +z (toward the camera)
      return { x: Math.cos(ang) * RING_R, z: Math.sin(ang) * RING_R, yaw: (Math.atan2(-Math.cos(ang), -Math.sin(ang)) * 180) / Math.PI };
    });
  }

  sync(pub) {
    const st = this.stage; const players = pub.players;
    const seats = seatSlots(players.length);
    const g = pub.game;
    const team = new Set(g && ['propose', 'vote', 'voteReveal', 'questPlay'].includes(pub.phase) ? g.team : []);
    const teamList = g ? g.team.filter((id) => team.has(id)) : [];
    const ring = this.ringSlots(teamList.length);
    // add / remove
    for (const p of players) {
      if (!this.actors.has(p.id)) {
        const s = seats[players.indexOf(p)];
        const a = st.addActor({ id: p.id, kind: p.cls, name: p.name, color: p.color, at: [s.x, 0, s.z], yaw: s.yaw, player: true });
        a.showBanner(Infinity); a.play('Sit_Floor_Down', { loop: false, then: 'Sit_Floor_Idle' });
        a.stateKey = 'sit'; this.actors.set(p.id, a);
      }
    }
    for (const [id, a] of [...this.actors]) if (!players.some((p) => p.id === id)) { st.world.remove(a.root); st.actors.delete(id); this.actors.delete(id); }
    // positions & poses
    players.forEach((p, i) => {
      const a = this.actors.get(p.id);
      if (a.name !== p.name) a.showBanner(Infinity, p.name);
      a.root.visible = true;
      const dim = !p.connected && !p.bot;
      a.root.traverse((o) => { if (o.isMesh && o.material && 'opacity' in o.material) { o.material.transparent = dim; o.material.opacity = dim ? 0.45 : 1; } });
      const onTeam = team.has(p.id);
      const want = onTeam ? 'stand' : 'sit';
      const target = onTeam ? ring[teamList.indexOf(p.id)] : seats[i];
      const key = `${want}:${target.x.toFixed(2)},${target.z.toFixed(2)}`;
      if (a.stateKey !== key) {
        a.stateKey = key;
        const to = new THREE.Vector3(target.x, 0, target.z);
        if (onTeam) {
          a.play('Sit_Floor_StandUp', { loop: false, then: 'Idle' });
          setTimeout(() => st.moveActor(a, to, { speed: 2.2, endYaw: target.yaw }), 700);
        } else if (a.currentName === 'Idle' || a.currentName.startsWith('Walking')) {
          st.moveActor(a, to, { speed: 2.2, endYaw: target.yaw });
          setTimeout(() => a.play('Sit_Floor_Down', { loop: false, then: 'Sit_Floor_Idle' }), (a.root.position.distanceTo(to) / 2.2) * 1000 + 100);
        } else { a.root.position.copy(to); a.setYaw(target.yaw); }
      }
      if (a.ring) a.ring.material.opacity = onTeam ? 1 : 0.6;
    });
    // lit ring under team members
    for (const [id, r] of this.rings) if (!team.has(id)) { r.removeFromParent(); this.rings.delete(id); }
    for (const id of team) {
      const a = this.actors.get(id); if (!a || this.rings.has(id)) continue;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; a.root.add(disc); this.rings.set(id, disc);
    }
    // leader crown
    if (g) {
      const leader = this.actors.get(g.leader);
      if (!this.crown) { this.crown = st._builtin('crown'); this.crown.scale.setScalar(2.6); }
      if (leader && this.crown.parent !== leader.root) { leader.root.add(this.crown); this.crown.position.set(0, 2.3, 0); }
    } else if (this.crown) this.crown.removeFromParent();
    // vote tokens
    for (const t of this.tokens.values()) t.removeFromParent(); this.tokens.clear();
    if (g && pub.phase === 'vote') for (const id of g.voted) this._token(id, '?', '#6b7280');
    if (g && pub.phase === 'voteReveal') for (const p of players) this._token(p.id, g.votes[p.id] ? '✔' : '✘', g.votes[p.id] ? '#2e9e4f' : '#d64545');
  }

  _token(id, text, color) {
    const a = this.actors.get(id); if (!a) return;
    const s = token(text, color); s.position.y = a.height + 1.9; a.root.add(s); this.tokens.set(id, s);
  }
}
