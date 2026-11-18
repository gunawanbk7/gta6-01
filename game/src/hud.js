// The HUD: cash, health, wanted stars, speed, mission objective, message
// feed, dialogue box, crosshair, and a live 2D minimap of Solmar Bay.
export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'health-fill', 'health-text', 'stars', 'speed', 'speed-box',
      'objective', 'feed', 'dialogue', 'crosshair', 'hint', 'damage', 'minimap', 'clock']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.feedLines = [];
    this.dialogueTimer = 0;
  }
  setCash(n) { this.el.cash.textContent = '$' + n.toLocaleString('en-US'); }
  setHealth(h, max) {
    const pct = Math.max(0, Math.round((h / max) * 100));
    this.el['health-fill'].style.width = pct + '%';
    this.el['health-fill'].style.background = pct > 50 ? '#4ade80' : pct > 25 ? '#f2c14e' : '#ef4444';
    this.el['health-text'].textContent = pct + '%';
  }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.style.color = n === 0 ? '#9aa5b1' : n < 3 ? '#ffd94e' : '#ff5a4a';
  }
  setSpeed(kmh, inCar) {
    this.el['speed-box'].style.display = inCar ? 'block' : 'none';
    if (inCar) this.el.speed.textContent = Math.round(Math.abs(kmh) * 3.2);
  }
  setObjective(text) { this.el.objective.textContent = text; }
  setClock(text) { this.el.clock.textContent = text; }
  setHint(text) { this.el.hint.textContent = text; }
  setCrosshair(on, weapon) {
    this.el.crosshair.style.display = on ? 'block' : 'none';
    this.el.crosshair.textContent = weapon === 'pistol' ? '+' : '✊';
  }
  feed(text, color) {
    const line = document.createElement('div');
    line.textContent = text;
    if (color) line.style.color = color;
    this.el.feed.prepend(line);
    this.feedLines.unshift(line);
    while (this.feedLines.length > 5) {
      const old = this.feedLines.pop();
      if (old.parentNode) old.parentNode.removeChild(old);
    }
  }
  dialogue(text) {
    this.el.dialogue.textContent = text;
    this.el.dialogue.style.display = 'block';
    this.dialogueTimer = 7;
  }
  updateDialogue(dt) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.style.display = 'none';
    }
  }
  flashDamage() {
    const d = this.el.damage;
    d.style.opacity = '0.55';
    setTimeout(() => { d.style.opacity = '0'; }, 180);
  }
  // North-up minimap: roads, beach, ocean, player, cars, police, mission marker.
  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 180, W = 440; // world spans -220..220
    const toMap = (x, z) => [((x + 220) / W) * S, ((z + 220) / W) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20, 32, 44, 0.85)';
    ctx.fillRect(0, 0, S, S);
    // Ocean + beach.
    ctx.fillStyle = '#1e7fa8';
    const [ox] = toMap(196, 0);
    ctx.fillRect(ox, 0, S - ox, S);
    ctx.fillStyle = '#e8d29a';
    const [bx] = toMap(168, 0);
    ctx.fillRect(bx, 0, ox - bx, S);
    // Roads.
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 4;
    for (const v of game.city.roadLines) {
      const [x] = toMap(v, 0); const [, y] = toMap(0, v);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    // Plaza.
    ctx.fillStyle = '#7fb8d8';
    const [px0, pz0] = toMap(0, 0);
    ctx.beginPath(); ctx.arc(px0, pz0, 5, 0, Math.PI * 2); ctx.fill();
    // Mission marker: pulsing yellow diamond.
    const target = game.missions.markerTarget();
    if (target) {
      const [mx, mz] = toMap(target.x, target.z);
      const r = 5 + Math.sin(game.time * 5) * 2;
      ctx.fillStyle = '#ffd94e';
      ctx.beginPath();
      ctx.moveTo(mx, mz - r); ctx.lineTo(mx + r, mz); ctx.lineTo(mx, mz + r); ctx.lineTo(mx - r, mz);
      ctx.closePath(); ctx.fill();
    }
    // Traffic cars (white), police (flashing red/blue), player (green arrow).
    ctx.fillStyle = '#ffffff';
    for (const c of game.traffic.cars) {
      if (c.dead) continue;
      const [cx, cz] = toMap(c.x, c.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    for (const c of game.police.cars) {
      const [cx, cz] = toMap(c.x, c.z);
      ctx.fillStyle = Math.floor(game.time * 5) % 2 ? '#ff2233' : '#2244ff';
      ctx.beginPath(); ctx.arc(cx, cz, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
    }
    const pxx = game.player.inVehicle ? game.player.inVehicle.x : game.player.x;
    const pzz = game.player.inVehicle ? game.player.inVehicle.z : game.player.z;
    const [mx2, mz2] = toMap(pxx, pzz);
    const heading = game.player.inVehicle ? game.player.inVehicle.heading : game.player.heading;
    ctx.save();
    ctx.translate(mx2, mz2);
    ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
