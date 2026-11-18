// The HUD: cash, health, wanted stars, speed, objective, message feed and
// the live 2D minimap. All DOM except the minimap canvas.
import { CFG } from './config.js';

export function createHud() {
  const cashEl = document.getElementById('cash');
  const healthEl = document.getElementById('healthfill');
  const starsEl = document.getElementById('stars');
  const speedEl = document.getElementById('speed');
  const objTitle = document.getElementById('obj-title');
  const objText = document.getElementById('obj-text');
  const feedEl = document.getElementById('feed');
  const map = document.getElementById('minimap');
  const mctx = map.getContext('2d');

  const hud = {
    feed(msg) {
      const div = document.createElement('div');
      div.textContent = msg;
      feedEl.appendChild(div);
      while (feedEl.children.length > 4) feedEl.removeChild(feedEl.firstChild);
      window.setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 9000);
    },
    setObjective(title, text) {
      objTitle.textContent = title;
      objText.textContent = text;
    },
    update(G) {
      cashEl.textContent = `$${Math.floor(G.cash)}`;
      healthEl.style.width = `${Math.max(0, G.player.health)}%`;
      let stars = '';
      for (let i = 0; i < CFG.wantedMax; i++) stars += i < G.wanted ? '★' : '☆';
      starsEl.textContent = stars;
      const speed = G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) * 3.6 : 0;
      speedEl.innerHTML = `${Math.round(speed)} <small>km/h</small>${G.combat.ammo < CFG.magSize || G.combat.reloading > 0 ? ` &nbsp;·&nbsp; 🔫 ${G.combat.reloading > 0 ? '…' : G.combat.ammo}/${CFG.magSize}` : ''}`;
      drawMinimap(G, mctx, map.width, map.height);
    },
  };
  return hud;
}

function drawMinimap(G, ctx, w, h) {
  const minX = CFG.worldMin;
  const minZ = CFG.worldMin;
  const span = CFG.worldMax - CFG.worldMin;
  const sx = (x) => ((x - minX) / span) * w;
  const sz = (z) => ((z - minZ) / span) * h;
  ctx.clearRect(0, 0, w, h);
  // Ocean and sand (south edge).
  ctx.fillStyle = '#1d7fb8';
  ctx.fillRect(0, sz(CFG.oceanZ0), w, h - sz(CFG.oceanZ0));
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, sz(CFG.beachZ0), w, sz(CFG.oceanZ0) - sz(CFG.beachZ0));
  // City ground.
  ctx.fillStyle = '#5a6b4a';
  ctx.fillRect(0, 0, w, sz(CFG.beachZ0));
  // Roads.
  ctx.strokeStyle = '#2e3138';
  ctx.lineWidth = Math.max(2, (CFG.roadWidth / span) * w);
  for (const c of CFG.roads) {
    ctx.beginPath();
    ctx.moveTo(sx(-95), sz(c));
    ctx.lineTo(sx(110), sz(c));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(c), sz(-95));
    ctx.lineTo(sx(c), sz(110));
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#3d4450';
  for (const b of G.city.colliders) {
    if (b.maxX > 78) continue; // harbour crates are not buildings
    ctx.fillRect(sx(b.minX), sz(b.minZ), sx(b.maxX) - sx(b.minX), sz(b.maxZ) - sz(b.minZ));
  }
  // Mission marker.
  if (G.missions.target) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(sx(G.missions.target.x), sz(G.missions.target.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(sx(G.missions.target.x), sz(G.missions.target.z), 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police.
  for (const car of G.police.cars) {
    ctx.fillStyle = '#2e6dff';
    ctx.beginPath();
    ctx.arc(sx(car.pos.x), sz(car.pos.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Thugs.
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(sx(e.pos.x), sz(e.pos.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = sx(G.player.pos.x);
  const py = sz(G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.yaw);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
