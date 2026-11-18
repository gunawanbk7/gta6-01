// Solmar Bay — every 2D surface: cash, health, wanted stars, speed, ammo,
// mission objective, message feed, dialogue box, the live minimap, and the
// start / pause / busted / complete menus. All plain DOM + one canvas.
import { WORLD } from './config.js';

function el(id) { return document.getElementById(id); }

export class HUD {
  constructor() {
    this.cashEl = el('hud-cash');
    this.healthFill = el('hud-health-fill');
    this.healthText = el('hud-health-text');
    this.starsEl = el('hud-stars');
    this.speedEl = el('hud-speed');
    this.ammoEl = el('hud-ammo');
    this.objectiveEl = el('hud-objective');
    this.feedEl = el('hud-feed');
    this.dialogueEl = el('dialogue');
    this.dialogueTitle = el('dialogue-title');
    this.dialogueText = el('dialogue-text');
    this.dialogueHint = el('dialogue-hint');
    this.crosshair = el('crosshair');
    this.interactEl = el('hud-interact');
    this.minimap = el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.dialogueLines = [];
    this.dialogueIndex = 0;
    this.dialogueDone = null;
    this.feedItems = [];
  }

  setCash(n) { this.cashEl.textContent = `$${Math.floor(n).toLocaleString('en-US')}`; }
  setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    this.healthFill.style.width = `${pct}%`;
    this.healthFill.style.background = pct > 50 ? '#39d353' : pct > 25 ? '#f2c230' : '#d83a2e';
    this.healthText.textContent = `${Math.ceil(pct)}`;
  }
  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.style.color = n > 0 ? '#ffd76a' : '#888888';
  }
  setSpeed(kmh) { this.speedEl.textContent = `${Math.round(Math.abs(kmh))} km/h`; }
  setAmmo(ammo, reserve) { this.ammoEl.textContent = `🔫 ${ammo} / ${reserve}`; }
  setObjective(text) { this.objectiveEl.textContent = text; }
  setInteract(text) {
    if (text) {
      this.interactEl.textContent = text;
      this.interactEl.style.display = 'block';
    } else {
      this.interactEl.style.display = 'none';
    }
  }
  setCrosshair(on) { this.crosshair.style.display = on ? 'block' : 'none'; }

  feed(msg) {
    this.feedItems.push(msg);
    if (this.feedItems.length > 4) this.feedItems.shift();
    this.feedEl.innerHTML = this.feedItems.map((m) => `<div>${m}</div>`).join('');
  }

  showDialogue(title, lines, onDone) {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueDone = onDone || null;
    this.dialogueTitle.textContent = title;
    this.renderDialogueLine();
    this.dialogueEl.style.display = 'block';
  }

  renderDialogueLine() {
    const [speaker, text] = this.dialogueLines[this.dialogueIndex];
    this.dialogueText.innerHTML = `<b>${speaker}:</b> ${text}`;
    this.dialogueHint.textContent = this.dialogueIndex < this.dialogueLines.length - 1
      ? 'Press E or click to continue…'
      : 'Press E or click to start…';
  }

  advanceDialogue() {
    if (this.dialogueEl.style.display !== 'block') return false;
    if (this.dialogueIndex < this.dialogueLines.length - 1) {
      this.dialogueIndex += 1;
      this.renderDialogueLine();
      return true;
    }
    this.dialogueEl.style.display = 'none';
    const cb = this.dialogueDone;
    this.dialogueDone = null;
    if (cb) cb();
    return true;
  }

  dialogueOpen() { return this.dialogueEl.style.display === 'block'; }

  // --- minimap -------------------------------------------------------------
  drawMinimap(data) {
    const ctx = this.mapCtx;
    const S = this.minimap.width; // square canvas
    const scale = S / (WORLD.half * 2 + 40);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262b';
    ctx.fillRect(0, 0, S, S);
    // ocean + sand at the bottom (south)
    ctx.fillStyle = '#1f7fb8';
    ctx.fillRect(0, toY(WORLD.oceanZ), S, S - toY(WORLD.oceanZ));
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, toY(WORLD.beachZ), S, toY(WORLD.oceanZ) - toY(WORLD.beachZ));
    // roads
    ctx.fillStyle = '#5a5e66';
    for (let c = -180; c <= 180; c += WORLD.roadGap) {
      ctx.fillRect(toX(c) - 3, 0, 6, S);
      ctx.fillRect(0, toY(c) - 3, S, 6);
    }
    // mission marker
    if (data.marker) {
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#39ff88';
      ctx.beginPath();
      ctx.arc(toX(data.marker.x), toY(data.marker.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // pedestrians
    ctx.fillStyle = '#c8c8c8';
    for (const p of data.peds || []) ctx.fillRect(toX(p.x) - 1, toY(p.z) - 1, 2, 2);
    // traffic cars
    ctx.fillStyle = '#f2c230';
    for (const c of data.cars || []) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // police (flashing)
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2222' : '#2266ff';
    for (const c of data.police || []) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // player arrow
    const px = toX(data.player.x);
    const py = toY(data.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(data.player.angle), Math.cos(data.player.angle)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --- menus ----------------------------------------------------------------
  showMenu(id) {
    for (const m of document.querySelectorAll('.menu')) m.style.display = 'none';
    if (id) el(id).style.display = 'flex';
  }

  hideMenus() {
    for (const m of document.querySelectorAll('.menu')) m.style.display = 'none';
  }
}
