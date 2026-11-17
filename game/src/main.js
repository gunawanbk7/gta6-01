// main.js — Solmar Bay bootstrap and game loop. Wires the city, the player, the
// traffic, the police, the missions and the renderer into one game object (G),
// runs the frame loop, and owns the state machine: menu, playing, paused, over.
// Also the side systems: taxi fares, hidden cash, busted/wasted, saving.
import { buildCity, randomRoadPoint, districtAt } from './city.js';
import { mulberry32, randRange, pick, clamp, dist, fmtMoney } from './util.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Traffic, Pedestrians, Police, makeCar, VEHICLES } from './entities.js';
import { makePlayer, updatePlayer, damagePlayer } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { render } from './render.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const rng = mulberry32(20261117);

const G = {
  canvas, ctx,
  city: buildCity(20261117),
  rng,
  input: new Input(canvas),
  audio: new AudioEngine(),
  time: 0,
  state: 'menu', // menu | playing | paused | over
  overKind: null, overReason: '',
  overT: 0,
  cam: { x: 1180, y: 1180, zoom: 1 },
  shake: 0,
  goldenHour: false,
  banner: null,
  particles: [], tracers: [], skids: [],
  cashSpots: [],
  parkedCars: [],
  activeFare: null,
  fareT: 0,
  menuButtons: [],
  eventLog: [],
  mouseWorld: { x: 0, y: 0 },
  save: loadSave(),
};
G.player = makePlayer(1180, 1990);
G.player.money = G.save.money;
G.player.hasPistol = G.save.hasPistol;
G.traffic = new Traffic(G.city, mulberry32(77));
G.peds = new Pedestrians(G.city, mulberry32(78));
G.police = new Police(G.city, mulberry32(79));
G.missions = new MissionManager(G);

G.log = (msg) => { G.eventLog.push(msg); console.log('[solmar]', msg); };
G.showBanner = (text, color) => { G.banner = { text, color: color || '#7fe0a8', at: G.time }; };
G.addShake = (n) => { G.shake = Math.min(1, G.shake + n); };
G.spawnParticles = (x, y, n, color) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = randRange(rng, 30, 160);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: randRange(rng, 0.3, 0.8), color, size: randRange(rng, 2, 5) });
  }
};
G.addTracer = (x1, y1, x2, y2) => { G.tracers.push({ x1, y1, x2, y2, life: 0.12 }); };
G.addSkid = (x, y, angle) => { G.skids.push({ x, y, angle, life: 0.5 }); if (G.skids.length > 120) G.skids.shift(); };
G.spawnMissionCar = (type, x, y) => {
  const car = makeCar(type, x, y, 0);
  G.parkedCars.push(car);
  return car;
};
G.missionEvent = (type, data) => G.missions.onEvent(type, data);
G.saveGame = () => {
  G.save.money = G.player.money;
  G.save.hasPistol = G.player.hasPistol;
  G.save.bestMoney = Math.max(G.save.bestMoney, G.player.money);
  writeSave(G.save);
};
G.gameOver = (kind, reason) => {
  if (G.state === 'over') return;
  G.state = 'over';
  G.overKind = kind;
  G.overReason = reason || '';
  G.overT = 0;
  if (kind === 'wasted') { G.audio.busted(); }
  if (kind === 'busted') { G.audio.busted(); }
  G.log('Game over: ' + kind);
};

// Seed the world: parked cars, cash stashes, crowds.
for (const s of G.city.parkedSpots.slice(0, 26)) {
  const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'classic', 'sports']);
  const car = makeCar(type, s.x, s.y, s.vertical ? Math.PI / 2 : 0);
  G.parkedCars.push(car);
}
for (let i = 0; i < 12; i++) {
  const p = randomRoadPoint(rng, 1180, 1180, 0);
  G.cashSpots.push({ x: p.x + randRange(rng, -50, 50), y: p.y + randRange(rng, -50, 50), taken: G.save.cashFound.includes(i), id: i });
}
G.traffic.spawnInitial(12, 1180, 1180);
G.peds.spawnInitial(20, 1180, 1180);
// A fare waiting near the safehouse so the side job is visible immediately.
{
  const fare = G.peds.spawn(1180 + 60, 1990 - 40, { fare: true });
  fare.fareDest = G.city.landmarks.club;
}

// Menu buttons (recomputed on resize).
function layoutMenu() {
  const W = canvas.width, H = canvas.height;
  const labels = [
    { id: 'start', label: G.save.missionsDone.length > 0 ? 'CONTINUE — ' + G.save.missionsDone.length + '/6 JOBS DONE' : 'START A NEW LIFE IN SOLMAR BAY' },
    { id: 'sound', label: 'SOUND: ' + (G.audio.muted ? 'OFF' : 'ON') },
  ];
  G.menuButtons = labels.map((b, i) => ({ ...b, x: W / 2 - 160, y: H / 2 - 40 + i * 66 }));
}
layoutMenu();
window.addEventListener('resize', layoutMenu);

// ---------- update ----------
function update(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 2.2);
  for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);
  for (const s of G.skids) s.life -= dt * 0.25;
  G.skids = G.skids.filter((s) => s.life > 0);
  if (G.banner && G.time - G.banner.at > 3.4) G.banner = null;

  // Mouse position in world coordinates (for aiming).
  G.mouseWorld.x = G.cam.x + (G.input.mouse.x - canvas.width / 2) / G.cam.zoom;
  G.mouseWorld.y = G.cam.y + (G.input.mouse.y - canvas.height / 2) / G.cam.zoom;

  if (G.state === 'menu') {
    // Slow drift over downtown behind the title.
    G.cam.x = 1180 + Math.sin(G.time * 0.07) * 320;
    G.cam.y = 1180 + Math.cos(G.time * 0.05) * 260;
    G.cam.zoom = 0.85;
    if (G.input.mouse.clicked) {
      for (const b of G.menuButtons) {
        if (G.input.mouse.x >= b.x && G.input.mouse.x <= b.x + 320 && G.input.mouse.y >= b.y && G.input.mouse.y <= b.y + 52) {
          G.audio.ensure();
          if (b.id === 'start') {
            G.state = 'playing';
            G.missions.offerNext();
            G.showBanner('Welcome to Solmar Bay — take the job, Jax', '#ffd23c');
          } else if (b.id === 'sound') {
            G.audio.setMuted(!G.audio.muted);
            G.save.muted = G.audio.muted;
            writeSave(G.save);
            layoutMenu();
          }
        }
      }
    }
    if (G.input.hit('Enter')) {
      G.audio.ensure();
      G.state = 'playing';
      G.missions.offerNext();
    }
    G.input.endFrame();
    return;
  }

  if (G.state === 'over') {
    G.overT += dt;
    if (G.overT > 0.6 && (G.input.hit('Enter') || G.input.mouse.clicked)) {
      respawn();
    }
    G.input.endFrame();
    return;
  }

  if (G.input.hit('p', 'Escape')) {
    G.state = G.state === 'paused' ? 'playing' : 'paused';
  }
  if (G.input.hit('m')) {
    G.audio.setMuted(!G.audio.muted);
    G.save.muted = G.audio.muted;
    writeSave(G.save);
  }
  if (G.state === 'paused') { G.input.endFrame(); return; }

  // Dialogue pauses the world; Enter / click advances it.
  if (G.missions.dialogue) {
    if (G.input.hit('Enter') || G.input.mouse.clicked) {
      G.audio.ensure();
      G.missions.advanceDialogue();
    }
    G.input.endFrame();
    return;
  }
  // Accept an offered job.
  if (G.missions.offered && G.input.hit('Enter')) {
    const def = G.missions.offered;
    G.audio.ensure();
    G.missions.startMission(def);
    G.input.endFrame();
    return;
  }

  G.audio.ensure();
  updatePlayer(G, dt);
  G.traffic.update(dt, G.player, [...G.traffic.cars, ...G.police.cruisers, G.player.car].filter(Boolean));
  G.peds.update(dt, G.player);
  G.police.update(dt, G.player, G.peds);
  G.missions.update(dt);

  // Wanted upkeep.
  G.police.maintain(G.player.wanted, G.player.x, G.player.y);
  const sirenNear = G.police.cruisers.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 600);
  G.audio.setSiren(G.player.wanted > 0, sirenNear ? 1 : 0.4);

  // Foot-cop arrest: an officer touching Jax on foot books him.
  if (!G.player.car && G.player.wanted > 0 && G.player.invulnT <= 0) {
    const copNear = G.peds.list.some((pd) => pd.isCop && !pd.dead && dist(pd.x, pd.y, G.player.x, G.player.y) < 28);
    const cruiserNear = G.police.cruisers.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 32);
    if (copNear || cruiserNear) {
      G.police.arrestT += dt;
      if (G.police.arrestT > 1.2) G.gameOver('busted');
    } else {
      G.police.arrestT = Math.max(0, G.police.arrestT - dt * 2);
    }
  }

  // Armed rivals shoot at the player.
  for (const ped of G.peds.list) {
    if (!ped.armed || ped.dead) continue;
    const d = dist(ped.x, ped.y, G.player.x, G.player.y);
    if (d < 380) {
      ped.shootT = (ped.shootT || 0) - dt;
      if (ped.shootT <= 0) {
        ped.shootT = 1.4;
        G.addTracer(ped.x, ped.y, G.player.x, G.player.y);
        G.audio.shoot();
        if (Math.random() < 0.45) damagePlayer(G, 6);
      }
    }
  }

  // Cash pickups.
  for (const c of G.cashSpots) {
    if (!c.taken && dist(c.x, c.y, G.player.x, G.player.y) < 32) {
      c.taken = true;
      G.player.money += 50;
      G.save.cashFound.push(c.id);
      G.saveGame();
      G.audio.cash();
      G.showBanner('Hidden cash +$50', '#7fe0a8');
    }
  }

  // Taxi fares.
  updateFares(dt);

  // Traffic / pedestrians stay near the player.
  G.traffic.maintain(G.player.x, G.player.y);
  G.peds.maintain(G.player.x, G.player.y);

  // Camera follows, easing out with speed.
  const targetZoom = G.zoomLock ?? (G.player.car ? clamp(1.05 - Math.abs(G.player.car.speed) / 900, 0.78, 1) : 1);
  G.cam.zoom = G.cam.zoom + (targetZoom - G.cam.zoom) * Math.min(1, dt * 2);
  G.cam.x += (G.player.x - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (G.player.y - G.cam.y) * Math.min(1, dt * 5);
  G.cam.x = clamp(G.cam.x, 0, 2800);
  G.cam.y = clamp(G.cam.y, 0, 2800);

  G.input.endFrame();
}

function updateFares(dt) {
  const p = G.player;
  G.fareT += dt;
  if (!G.activeFare && G.fareT > 20 && p.car) {
    G.fareT = 0;
    // Find a waiting fare ped near the player.
    const waiting = G.peds.list.find((pd) => pd.fare && !pd.dead && !pd.inCar && dist(pd.x, pd.y, p.x, p.y) < 500);
    if (waiting) {
      waiting.fareDest = pick(rng, Object.values(G.city.landmarks));
      G.activeFare = { ped: waiting, dest: waiting.fareDest, pay: 40 + Math.floor(rng() * 50) };
      G.showBanner('Passenger waiting — stop near the $ marker', '#ffd23c');
    }
  }
  if (G.activeFare) {
    const f = G.activeFare;
    if (f.ped.dead) { G.activeFare = null; return; }
    if (!f.ped.inCar) {
      // Pickup: stop the car next to the passenger.
      if (p.car && dist(f.ped.x, f.ped.y, p.x, p.y) < 46 && Math.abs(p.car.speed) < 40) {
        f.ped.inCar = p.car;
        G.peds.list = G.peds.list.filter((pd) => pd !== f.ped);
        G.showBanner('Passenger aboard — take them to ' + f.dest.label, '#37d67a');
        G.audio.pickup();
      }
    } else if (dist(p.x, p.y, f.dest.x, f.dest.y) < 70) {
      p.money += f.pay;
      G.save.faresDone++;
      G.saveGame();
      G.audio.cash();
      G.showBanner('Fare complete +' + fmtMoney(f.pay), '#7fe0a8');
      G.activeFare = null;
      G.fareT = 0;
    }
  }
}

function respawn() {
  const p = G.player;
  if (G.overKind === 'wasted') {
    p.money = Math.max(0, p.money - 150);
    p.hp = 100;
    p.x = G.city.landmarks.hospital.x; p.y = G.city.landmarks.hospital.y + 40;
  } else if (G.overKind === 'busted') {
    p.money = Math.max(0, p.money - 100);
    p.hp = 100;
    p.x = G.city.landmarks.policeHQ.x; p.y = G.city.landmarks.policeHQ.y + 60;
  } else {
    // Failed job: Jax keeps his health, the job is offered again.
    p.hp = Math.max(50, p.hp);
  }
  if (p.car) { G.parkedCars.push(p.car); p.car.isPlayer = false; p.car.speed = 0; p.car = null; }
  p.wanted = 0;
  p.invulnT = 3;
  G.police.clear();
  G.peds.list = G.peds.list.filter((pd) => !pd.isCop && !pd.armed);
  G.state = 'playing';
  G.saveGame();
  G.missions.offerNext();
  G.cam.x = p.x; G.cam.y = p.y;
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  try {
    update(dt);
  } catch (err) {
    console.error(err);
    G.log('ERROR: ' + err.message);
  }
  try {
    render(G);
  } catch (err) {
    console.error(err);
    G.log('RENDER ERROR: ' + err.message);
  }
  requestAnimationFrame(frame);
}

window.__SOLMAR__ = G;
document.getElementById('status').textContent = 'Solmar Bay loaded.';

// Shot staging: ?shot=cover|street|mission|harbour
if (params.get('shot')) {
  stageShot(G, params.get('shot'));
  G.log('Staged shot: ' + params.get('shot'));
}
if (G.save.muted) G.audio.setMuted(true);

requestAnimationFrame(frame);
