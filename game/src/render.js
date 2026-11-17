// render.js — everything the player sees: the city from above with long sun shadows,
// traffic and crowds, the player and their car, particles and skid marks, then the
// HUD (health, money, wanted stars, speed, objective), the live minimap, dialogue,
// menus and overlays. All drawing is plain Canvas 2D, culled to the viewport.
import { clamp, lerp, dist, fmtMoney, fmtTime } from './util.js';
import { WORLD, ROAD_W, V_ROADS, H_ROADS, districtAt, roadNameAt } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCarShape(ctx, car, time) {
  const spec = car.spec;
  const L = spec.len, W = spec.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -L / 2 + 4, -W / 2 + 5, L, W, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#16181c';
  const wy = W / 2 - 1;
  ctx.fillRect(-L / 2 + 6, -wy - 3, 10, 5);
  ctx.fillRect(L / 2 - 16, -wy - 3, 10, 5);
  ctx.fillRect(-L / 2 + 6, wy - 2, 10, 5);
  ctx.fillRect(L / 2 - 16, wy - 2, 10, 5);
  // Body.
  ctx.fillStyle = spec.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Police livery.
  if (car.isPolice) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-6, -W / 2 + 1, 12, W - 2);
    const flash = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-2, -W / 2 - 1, 5, 6);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-2, W / 2 - 5, 5, 6);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  roundRect(ctx, -L / 2 + 12, -W / 2 + 4, L - 26, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.55)';
  ctx.fillRect(L / 2 - 14, -W / 2 + 4, 3, W - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 2, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 2, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-L / 2, -W / 2 + 3, 2, 5);
  ctx.fillRect(-L / 2, W / 2 - 8, 2, 5);
  ctx.restore();
}

function drawPed(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dead) {
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = p.moving ? Math.sin(time * 10 + p.x) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Legs.
  ctx.fillStyle = p.pants;
  ctx.beginPath(); ctx.arc(-3 + bob, 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3 - bob, 2, 4, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  // Head + facing tick.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 12, Math.sin(p.angle) * 12); ctx.stroke();
  if (p.isCop) {
    ctx.fillStyle = '#dfe6ee';
    ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, -12);
  }
  if (p.armed) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18); ctx.stroke();
  }
  if (p.fare) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 0, -14);
  }
  ctx.restore();
}

export function render(G) {
  const { ctx, canvas, city } = G;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Camera.
  const cam = G.cam;
  const shx = (Math.random() - 0.5) * G.shake * 14;
  const shy = (Math.random() - 0.5) * G.shake * 14;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shx, -cam.y + shy);

  const vx0 = cam.x - W / 2 / cam.zoom - 60, vx1 = cam.x + W / 2 / cam.zoom + 60;
  const vy0 = cam.y - H / 2 / cam.zoom - 60, vy1 = cam.y + H / 2 / cam.zoom + 60;
  const onScreen = (x, y, w, h) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;

  // Ground.
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Beach sand.
  ctx.fillStyle = '#e8d5a0';
  ctx.fillRect(city.beach.x, Math.max(vy0, 0), city.beach.w, Math.min(vy1, 2380) - Math.max(vy0, 0));
  // Water with moving wave lines.
  for (const w of city.water) {
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const wy = w.y + ((i * 173 + G.time * 22) % Math.max(1, w.h));
      const wx = w.x + 20 + ((i * 97) % Math.max(1, w.w - 60));
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 30, wy - 8, wx + 60, wy);
      ctx.stroke();
    }
  }
  // Parks.
  for (const pk of city.parks) {
    if (!onScreen(pk.x, pk.y, pk.w, pk.h)) continue;
    ctx.fillStyle = '#69a854';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.strokeStyle = '#5b9450';
    ctx.lineWidth = 3;
    ctx.strokeRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Roads: asphalt, sidewalks, centre dashes.
  for (const rx of V_ROADS) {
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(rx - ROAD_W / 2 - 8, vy0, ROAD_W + 16, vy1 - vy0);
    ctx.fillStyle = '#3d4148';
    ctx.fillRect(rx - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
    ctx.strokeStyle = '#e8c33c';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    ctx.beginPath(); ctx.moveTo(rx, vy0); ctx.lineTo(rx, vy1); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ry of H_ROADS) {
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(vx0, ry - ROAD_W / 2 - 8, vx1 - vx0, ROAD_W + 16);
    ctx.fillStyle = '#3d4148';
    ctx.fillRect(vx0, ry - ROAD_W / 2, vx1 - vx0, ROAD_W);
    ctx.strokeStyle = '#e8c33c';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    ctx.beginPath(); ctx.moveTo(vx0, ry); ctx.lineTo(vx1, ry); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Harbour containers.
  for (const c of city.containers) {
    if (!onScreen(c.x, c.y, c.w, c.h)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(c.x + (c.w / 4) * i, c.y); ctx.lineTo(c.x + (c.w / 4) * i, c.y + c.h); ctx.stroke();
    }
  }
  // Trees.
  for (const t of city.trees) {
    if (!onScreen(t.x - 14, t.y - 14, 28, 28)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#3f9e58' : '#2f7d43';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Buildings with sun shadows and lit windows.
  for (const b of city.buildings) {
    if (!onScreen(b.x - 60, b.y - 60, b.w + 60, b.h + 60)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(b.x + b.height * 0.35, b.y + b.height * 0.45, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.windows && b.w > 40 && b.h > 40) {
      ctx.fillStyle = 'rgba(255,230,150,0.75)';
      const cols = Math.floor((b.w - 16) / 16), rows = Math.floor((b.h - 16) / 16);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 3 + Math.floor(b.x)) % 3 === 0) {
            ctx.fillRect(b.x + 10 + i * 16, b.y + 10 + j * 16, 7, 7);
          }
        }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Landmark labels.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.landmarks)) {
    const lm = city.landmarks[key];
    if (!onScreen(lm.x - 80, lm.y - 20, 160, 40)) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(lm.label, lm.x, lm.y - 8);
  }
  // Cash pickups.
  for (const c of G.cashSpots) {
    if (c.taken || !onScreen(c.x - 20, c.y - 20, 40, 40)) continue;
    const bob = Math.sin(G.time * 3 + c.x) * 3;
    ctx.fillStyle = '#1f9d4d';
    ctx.beginPath(); ctx.arc(c.x, c.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('$', c.x, c.y + bob + 5);
  }
  // Skid marks.
  for (const s of G.skids) {
    ctx.strokeStyle = `rgba(20,20,20,${Math.min(0.5, s.life)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(s.angle) * 22, s.y + Math.sin(s.angle) * 22);
    ctx.stroke();
  }
  // Mission marker (pulsing ring + beacon).
  const target = G.missions.stepTarget();
  if (target && G.state === 'playing' && !G.missions.dialogue) {
    const pulse = 1 + Math.sin(G.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath(); ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 58);
    ctx.lineTo(target.x - 10, target.y - 34);
    ctx.lineTo(target.x + 10, target.y - 34);
    ctx.closePath(); ctx.fill();
  }
  // Fare destination marker.
  if (G.activeFare && G.state === 'playing') {
    ctx.strokeStyle = '#37d67a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(G.activeFare.dest.x, G.activeFare.dest.y, 30 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2); ctx.stroke();
  }
  // Parked cars, traffic, police, peds, player.
  for (const c of G.parkedCars) if (onScreen(c.x - 40, c.y - 40, 80, 80)) drawCarShape(ctx, c, G.time);
  for (const c of G.traffic.cars) if (onScreen(c.x - 40, c.y - 40, 80, 80)) drawCarShape(ctx, c, G.time);
  for (const c of G.police.cruisers) if (onScreen(c.x - 60, c.y - 60, 120, 120)) drawCarShape(ctx, c, G.time);
  for (const p of G.peds.list) if (onScreen(p.x - 20, p.y - 20, 40, 40)) drawPed(ctx, p, G.time);
  if (G.player.car) {
    drawCarShape(ctx, G.player.car, G.time);
  } else if (G.state !== 'menu') {
    const p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f6f6b'; // Jax's teal jacket
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#123f3c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 16, Math.sin(p.angle) * 16); ctx.stroke();
    if (p.hasPistol) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10);
      ctx.lineTo(Math.cos(p.angle) * 24, Math.sin(p.angle) * 24); ctx.stroke();
    }
    ctx.restore();
  }
  // Tracers and particles.
  for (const t of G.tracers) {
    ctx.strokeStyle = `rgba(255,220,120,${t.life * 2})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const pt of G.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Warm golden-hour tint.
  if (G.goldenHour) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(255,170,80,0.10)');
    grad.addColorStop(1, 'rgba(255,110,60,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // Vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (G.state === 'menu') { drawMenu(G); return; }
  drawHUD(G);
  drawMinimap(G);
  if (G.missions.dialogue) drawDialogue(G);
  if (G.state === 'paused') drawPause(G);
  if (G.state === 'over') drawGameOver(G);
  if (G.banner) drawBanner(G);
}

// ---------- HUD ----------
function drawHUD(G) {
  const { ctx, canvas } = G;
  const W = canvas.width;
  const p = G.player;
  // Health + money panel.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, 12, 230, 64, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('JAX MARLOWE', 24, 34);
  ctx.fillStyle = '#2b2f36';
  roundRect(ctx, 24, 44, 150, 12, 6); ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#37d67a' : '#e5484d';
  roundRect(ctx, 24, 44, 150 * clamp(p.hp / 100, 0, 1), 12, 6); ctx.fill();
  ctx.fillStyle = '#7fe0a8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(Math.ceil(p.hp) + '', 182, 56);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(fmtMoney(p.money), 24, 70 - 2 + 0);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('MONEY', 130, 68);
  // Wanted stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, W - 212, 12, 200, 44, 10); ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? (p.wanted >= 4 ? '#ff3b30' : '#ffd23c') : 'rgba(255,255,255,0.25)';
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', W - 192 + i * 38, 44);
  }
  // District + street.
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, W - 212, 62, 200, 26, 8); ctx.fill();
  ctx.fillStyle = '#dfe6ee';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(districtAt(p.x, p.y).toUpperCase() + ' · ' + roadNameAt(p.x, p.y), W - 22, 80);
  // Objective banner.
  const obj = G.missions.currentObjective();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const ow = Math.min(560, ctx.measureText(obj).width + 90);
  roundRect(ctx, W / 2 - ow / 2, 12, ow, 34, 10); ctx.fill();
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('◆ ' + obj.toUpperCase(), W / 2, 34);
  // Mission timer.
  const step = G.missions.currentStep();
  if (step && step.time !== undefined && G.missions.active && !G.missions.dialogue) {
    const left = step.kind === 'wait'
      ? Math.max(0, step.time - (G.missions.active.state.holdT || 0))
      : Math.max(0, step.time - G.missions.active.state.t);
    ctx.fillStyle = left < 10 ? '#ff3b30' : '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(fmtTime(left), W / 2, 72);
  }
  if (step && step.kind === 'kill' && G.missions.active) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Taken out: ${G.missions.killCount} / ${step.count}`, W / 2, 72);
  }
  // Speed when driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.9);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, W - 212, canvas.height - 96, 200, 52, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + '', W - 66, canvas.height - 60);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9fb2c8';
    ctx.fillText('km/h', W - 24, canvas.height - 60);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.car.spec.name.toUpperCase(), W - 200, canvas.height - 60);
  }
  // Controls hint.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  roundRect(ctx, 12, canvas.height - 52, p.car ? 340 : 480, 40, 8); ctx.fill();
  ctx.fillStyle = '#cfe0ee';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p.car
    ? 'W/S drive · A/D steer · SPACE handbrake · E exit car · P pause · M mute'
    : 'WASD move · SHIFT run · E enter car · SPACE punch · CLICK shoot · P pause', 22, canvas.height - 27);
  // "Press ENTER" prompt for a new job.
  if (G.missions.offered && !G.missions.dialogue) {
    ctx.fillStyle = 'rgba(255,210,60,0.95)';
    roundRect(ctx, W / 2 - 210, canvas.height - 110, 420, 36, 10); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📞 NEW JOB: ' + G.missions.offered.title.toUpperCase() + ' — press ENTER', W / 2, canvas.height - 87);
  }
}

function drawMinimap(G) {
  const { ctx, canvas } = G;
  const size = 200, mx = canvas.width - size - 12, my = canvas.height - size - 12;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, mx - 6, my - 6, size + 12, size + 12, 10); ctx.fill();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  ctx.fillStyle = '#2e4a2e';
  ctx.fillRect(mx, my, size, size);
  // Water.
  ctx.fillStyle = '#2f7fb8';
  for (const w of G.city.water) ctx.fillRect(mx + w.x * scale, my + w.y * scale, w.w * scale, w.h * scale);
  // Roads.
  ctx.fillStyle = '#5a5f68';
  for (const rx of V_ROADS) ctx.fillRect(mx + (rx - ROAD_W / 2) * scale, my, ROAD_W * scale, size);
  for (const ry of H_ROADS) ctx.fillRect(mx, my + (ry - ROAD_W / 2) * scale, size, ROAD_W * scale);
  // Buildings.
  ctx.fillStyle = 'rgba(200,205,215,0.75)';
  for (const b of G.city.buildings) ctx.fillRect(mx + b.x * scale, my + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  // Fare destination.
  if (G.activeFare) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath(); ctx.arc(mx + G.activeFare.dest.x * scale, my + G.activeFare.dest.y * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target.
  const target = G.missions.stepTarget();
  if (target && !G.missions.dialogue) {
    ctx.fillStyle = '#ffd23c';
    const pulse = 4 + Math.sin(G.time * 5) * 1.5;
    ctx.beginPath(); ctx.arc(mx + target.x * scale, my + target.y * scale, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff3b30';
  for (const c of G.police.cruisers) {
    ctx.beginPath(); ctx.arc(mx + c.x * scale, my + c.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * scale, my + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#dfe6ee';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my - 10 + 0);
}

function drawDialogue(G) {
  const { ctx, canvas } = G;
  const d = G.missions.dialogue;
  const [speaker, line] = d.lines[d.i];
  const W = canvas.width, H = canvas.height;
  const bw = Math.min(680, W - 120);
  const bx = W / 2 - bw / 2, by = H - 168;
  ctx.fillStyle = 'rgba(8,10,16,0.88)';
  roundRect(ctx, bx, by, bw, 104, 12); ctx.fill();
  ctx.strokeStyle = speaker === 'IRIS' ? '#ff7ad9' : '#37c8d6';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, 104);
  ctx.fillStyle = speaker === 'IRIS' ? '#ff7ad9' : '#37c8d6';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(speaker, bx + 20, by + 28);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  wrapText(ctx, line, bx + 20, by + 54, bw - 40, 22);
  ctx.fillStyle = '#9fb2c8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('ENTER / CLICK ▸', bx + bw - 16, by + 88);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

function drawMenu(G) {
  const { ctx, canvas } = G;
  const W = canvas.width, H = canvas.height;
  // Dim the city behind the title.
  ctx.fillStyle = 'rgba(6,10,18,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', W / 2, H / 2 - 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('An open-world crime story — drive, steal, run, survive.', W / 2, H / 2 - 112);
  ctx.fillStyle = '#9fb2c8';
  ctx.font = '15px sans-serif';
  ctx.fillText('A fictional coastal city. Every name, face and street is invented — no real city, no real gang, no borrowed game.', W / 2, H / 2 - 84);
  // Buttons.
  const bw = 320, bh = 52;
  const buttons = G.menuButtons;
  for (const b of buttons) {
    const hover = G.input.mouse.x >= b.x && G.input.mouse.x <= b.x + bw && G.input.mouse.y >= b.y && G.input.mouse.y <= b.y + bh;
    ctx.fillStyle = hover ? '#ffd23c' : 'rgba(255,255,255,0.92)';
    roundRect(ctx, b.x, b.y, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#14181f';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(b.label, b.x + bw / 2, b.y + 33);
  }
  ctx.fillStyle = '#cfe0ee';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move · E enter car · SPACE punch / handbrake · CLICK shoot · P pause · M mute', W / 2, H / 2 + 170);
  ctx.fillText('Steal cars, take jobs from Iris, dodge the Solmar Bay PD — and do not get caught.', W / 2, H / 2 + 194);
  if (G.save.missionsDone.length > 0) {
    ctx.fillStyle = '#7fe0a8';
    ctx.fillText(`Progress saved: ${G.save.missionsDone.length}/6 jobs done · ${fmtMoney(G.save.money)} in the bank`, W / 2, H / 2 + 222);
  }
}

function drawPause(G) {
  const { ctx, canvas } = G;
  ctx.fillStyle = 'rgba(6,10,18,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfe0ee';
  ctx.fillText('P resume · M mute · progress auto-saves after every job', canvas.width / 2, canvas.height / 2 + 16);
}

function drawGameOver(G) {
  const { ctx, canvas } = G;
  ctx.fillStyle = 'rgba(10,4,6,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  if (G.overKind === 'wasted') {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('WASTED', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('You wake up at Solmar General, $150 lighter. Iris is not impressed.', canvas.width / 2, canvas.height / 2 + 8);
  } else if (G.overKind === 'busted') {
    ctx.fillStyle = '#2e6bff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('BUSTED', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The Solmar Bay PD books you. Bail costs $100 — and your pride.', canvas.width / 2, canvas.height / 2 + 8);
  } else {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('JOB FAILED', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(G.overReason || '', canvas.width / 2, canvas.height / 2 + 8);
  }
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press ENTER to keep playing', canvas.width / 2, canvas.height / 2 + 52);
}

function drawBanner(G) {
  const { ctx, canvas } = G;
  const b = G.banner;
  const age = G.time - b.at;
  const alpha = age < 0.2 ? age / 0.2 : age > 2.6 ? Math.max(0, 1 - (age - 2.6) / 0.6) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  const w = ctx.measureText(b.text).width + 80;
  roundRect(ctx, canvas.width / 2 - w / 2, 96, w, 52, 12); ctx.fill();
  ctx.fillStyle = b.color || '#7fe0a8';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.text, canvas.width / 2, 131);
  ctx.restore();
}
