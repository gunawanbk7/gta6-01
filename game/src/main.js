// Solmar Bay — main entry. Wires the city, player, traffic, police, combat,
// missions, HUD, audio and save together, runs the game loop, and stages
// screenshot scenes from ?shot= for the maker's own screenshots.
import { buildCity, CITY } from './city.js';
import { Player } from './player.js';
import { Vehicle, CAR_MODELS } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { clamp, damp, angleLerp, dist2D, mulberry32, pick } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || 7) || 7;

class Game {
  constructor() {
    this.time = 0;
    this.timeOfDay = 9.5; // 09:30, golden morning over the bay
    this.cash = 120;
    this.state = 'menu'; // menu | playing | paused | dead | busted
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 11;
    this.dragTimer = 0;
    this.regenTimer = 0;
    this.autopilot = null; // { target: {x,z} } when staging a screenshot
    this.shotMode = SHOT;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

    this.input = new Input(this.renderer.domElement);
    this.input.escapeHandler = () => this.togglePause();
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.city = buildCity(this.scene, SEED);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.city, SEED);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this);

    this.bindMenu();
    this.bindOverlays();
    addEventListener('resize', () => this.onResize());
    // Play-test hook: the maker (and automated checks) read live state here,
    // and can move the player for scripted play-tests.
    window.__solmar = {
      teleport: (x, z) => {
        if (this.player.inVehicle) this.exitCar();
        this.player.setPosition(x, z);
      },
      nearestCar: () => {
        const c = this.traffic.nearestCar(this.player.x, this.player.z, 500);
        return c ? { x: Math.round(c.x), z: Math.round(c.z), name: c.model.name } : null;
      },
      setWanted: (n) => { this.police.wanted = n; this.police.heat = 0; },
      startMission: () => this.missions.start(),
      state: () => ({
        mode: this.state,
        cash: this.cash,
        health: Math.round(this.player.health),
        wanted: this.police.wanted,
        inCar: !!this.player.inVehicle,
        car: this.player.inVehicle ? this.player.inVehicle.model.name : null,
        speed: this.player.inVehicle ? Math.round(this.player.inVehicle.speed * 3.2) : 0,
        x: Math.round(this.player.inVehicle ? this.player.inVehicle.x : this.player.x),
        z: Math.round(this.player.inVehicle ? this.player.inVehicle.z : this.player.z),
        mission: this.missions.active ? this.missions.active.def.title : null,
        missionStep: this.missions.active ? this.missions.active.step : -1,
        missionsCompleted: this.missions.completed,
        ammo: this.player.ammo,
        weapon: this.player.weapon,
        peds: this.traffic.peds.filter((p) => p.alive).length,
        trafficCars: this.traffic.cars.filter((c) => !c.dead).length,
        policeCars: this.police.cars.length,
      }),
    };
    this.clock = new THREE.Clock();
    this.loop();
  }

  bindMenu() {
    const startBtn = document.getElementById('start-btn');
    const continueBtn = document.getElementById('continue-btn');
    const menu = document.getElementById('menu');
    if (hasSave()) continueBtn.style.display = 'inline-block';
    startBtn.onclick = () => { this.audio.ensure(); this.audio.click(); this.startGame(false); };
    continueBtn.onclick = () => { this.audio.ensure(); this.audio.click(); this.startGame(true); };
    menu.style.display = 'flex';
    if (SHOT && SHOT !== 'start') {
      // Staged screenshot: skip the menu entirely.
      this.startGame(false);
      this.stageShot(SHOT);
    }
  }
  bindOverlays() {
    document.getElementById('resume-btn').onclick = () => this.togglePause(false);
    document.getElementById('save-btn').onclick = () => {
      if (saveGame(this)) this.hud.feed('Progress saved.', '#7dff8a');
    };
    document.getElementById('quit-btn').onclick = () => location.reload();
    document.getElementById('respawn-btn').onclick = () => this.respawn();
    document.getElementById('restart-btn').onclick = () => { clearSave(); location.reload(); };
  }
  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  startGame(fromSave) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.state = 'playing';
    if (fromSave) {
      const s = loadSave();
      if (s) {
        this.cash = s.cash;
        this.player.health = s.health;
        this.missions.completed = s.missionsCompleted || 0;
        this.player.setPosition(s.x || 0, s.z || 24);
        this.timeOfDay = s.timeOfDay || 9.5;
        this.hud.feed('Welcome back to Solmar Bay, Mara.', '#7fd8ff');
      }
    } else {
      this.hud.feed('Welcome to Solmar Bay. Rico is waiting — press M for the mission list.', '#7fd8ff');
    }
    this.missions.start();
    this.updateHUDStatic();
  }

  stageShot(kind) {
    const g = this;
    const putInCar = (modelIdx) => {
      const car = new Vehicle(g.scene, CAR_MODELS[modelIdx % CAR_MODELS.length],
        g.player.x + 3, g.player.z + 2, Math.PI / 2, false);
      car.driver = null;
      g.traffic.cars.push(car);
      g.enterCar(car, false);
      return car;
    };
    if (kind === 'street') {
      this.player.setPosition(-6, 30);
      this.camYaw = Math.PI * 0.95;
    } else if (kind === 'drive') {
      putInCar(0);
      this.player.inVehicle.heading = Math.PI;
      this.player.inVehicle.mesh.position.set(160, 0, 120);
      // Cruise the beach road north and south, ocean on the right.
      this.autopilot = { points: [[160, -160], [160, 160]], i: 0 };
    } else if (kind === 'chase') {
      putInCar(5);
      this.player.inVehicle.heading = Math.PI / 2;
      this.player.inVehicle.mesh.position.set(0, 0, 40);
      this.police.addWanted(3, 'staged chase');
      // Two cruisers ahead on the same road, so the chase is in frame.
      this.police.spawnPolice(70, 40);
      this.police.spawnPolice(95, 34);
      this.autopilot = { points: [[160, 40], [-160, 40]], i: 0 };
      this.hud.feed('SBPD pursuit in progress — 3 stars!', '#ff6a5a');
    } else if (kind === 'mission') {
      putInCar(1);
      this.player.inVehicle.heading = 0;
      this.player.inVehicle.mesh.position.set(-60, 0, -40);
      this.autopilot = { points: [[-40, -40]], i: 0, stop: true };
      this.hud.feed('MISSION 1: First Wheels — drive to Rico\'s Garage.', '#ffd94e');
    }
  }

  enterCar(car, stolen) {
    const p = this.player;
    p.inVehicle = car;
    car.driver = 'player';
    car.stolen = stolen;
    p.mesh.visible = false;
    this.audio.ensure();
    this.audio.click();
    if (stolen) {
      this.police.addWanted(1, 'car theft');
      this.hud.feed(`You stole the ${car.model.name}! The SBPD noticed.`, '#ff6a5a');
      this.traffic.scarePeds(car.x, car.z, 16);
    } else {
      this.hud.feed(`You are driving the ${car.model.name}.`, '#7fd8ff');
    }
  }
  exitCar() {
    const p = this.player;
    const car = p.inVehicle;
    if (!car) return;
    car.driver = null;
    car.speed *= 0.3;
    const f = car.forward();
    p.setPosition(car.x - f.x * 3.5, car.z - f.z * 3.5);
    p.mesh.visible = true;
    p.inVehicle = null;
    this.hud.feed('You got out of the car.', '#9aa5b1');
  }

  togglePause(force) {
    const pause = force !== undefined ? force : this.state === 'playing';
    if (pause && this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause').style.display = 'flex';
    } else if (!pause && this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause').style.display = 'none';
    }
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    document.getElementById('end-title').textContent = 'WASTED';
    document.getElementById('end-text').textContent =
      'Mara Voss went down in Solmar Bay. The city keeps moving without her — for now.';
    document.getElementById('end').style.display = 'flex';
    this.audio.failBuzz();
  }
  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    document.getElementById('end-title').textContent = 'BUSTED';
    document.getElementById('end-text').textContent =
      'The SBPD hauled Mara in. A fine and a night in the cells — then back to the bay.';
    document.getElementById('end').style.display = 'flex';
    this.audio.failBuzz();
  }
  respawn() {
    const fine = this.state === 'busted' ? 100 : 150;
    this.cash = Math.max(0, this.cash - fine);
    this.player.health = 100;
    this.player.alive = true;
    this.player.ammo = this.player.ammoMax;
    if (this.player.inVehicle) this.exitCar();
    this.player.setPosition(-120, 120);
    this.player.heading = Math.PI / 2;
    this.police.clearAll();
    this.missions.hideMarker();
    if (this.missions.active) this.missions.showMarker();
    document.getElementById('end').style.display = 'none';
    this.state = 'playing';
    this.hud.feed(`You paid a $${fine} fine and walked out. Back to work.`, '#ffd94e');
    this.updateHUDStatic();
  }

  saveGame() { saveGame(this); }
  updateHUDStatic() {
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setStars(this.police.wanted);
  }

  // One frame of the whole game.
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.state === 'playing') this.update(dt);
    // The city keeps breathing behind menus and pause screens.
    this.city.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    const input = this.input;
    const p = this.player;
    this.timeOfDay = (this.timeOfDay + dt / 240) % 24;
    const hh = Math.floor(this.timeOfDay), mm = Math.floor((this.timeOfDay - hh) * 60);
    this.hud.setClock(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  SOLMAR BAY`);

    // Camera orbit from mouse drag.
    const mouse = input.consumeMouse();
    if (mouse.dx !== 0 || mouse.dy !== 0) {
      this.camYaw -= mouse.dx * 0.005;
      this.camPitch = clamp(this.camPitch + mouse.dy * 0.003, 0.08, 1.1);
      this.dragTimer = 1.6;
    }
    this.dragTimer = Math.max(0, this.dragTimer - dt);

    // Global keys.
    if (input.hit('KeyM')) { this.audio.setMuted(!this.audio.muted); this.hud.feed(this.audio.muted ? 'Sound muted (M to unmute).' : 'Sound on.', '#9aa5b1'); }
    if (input.hit('Digit1')) { p.weapon = 'fist'; this.hud.feed('Fists ready.', '#9aa5b1'); }
    if (input.hit('Digit2')) { p.weapon = 'pistol'; this.hud.feed('Pistol drawn. Click or J to fire, R to reload.', '#9aa5b1'); }
    if (input.hit('KeyR')) { p.reload(); this.hud.feed(`Reloaded — ${p.ammo}/${p.ammoMax} rounds.`, '#9aa5b1'); }

    const mv = input.moveVector();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');

    if (p.inVehicle) {
      const car = p.inVehicle;
      // Autopilot for staged screenshots: drive through the waypoints.
      let throttle = mv.f, steer = mv.s;
      if (this.autopilot) {
        const ap = this.autopilot;
        const pt = ap.points[ap.i];
        const d = dist2D(car.x, car.z, pt[0], pt[1]);
        if (d < 10) {
          if (ap.stop) { throttle = 0; steer = 0; }
          else ap.i = (ap.i + 1) % ap.points.length;
        }
        if (!(ap.stop && d < 10)) {
          throttle = 1;
          const want = Math.atan2(pt[0] - car.x, pt[1] - car.z);
          let dh = want - car.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          steer = clamp(dh * 1.6, -1, 1);
        }
      }
      if (input.down('Space')) throttle = 0; // handbrake
      car.drive(throttle, steer, dt, this.city.colliders);
      if (input.down('Space')) car.speed = damp(car.speed, 0, 6, dt);
      if (input.hit('KeyE')) this.exitCar();
      if (input.hit('KeyF') || input.mouseClicked) this.audio.horn();
      this.hud.setHint('WASD: drive · Space: handbrake · E: get out · F: horn');
      // Running over pedestrians is a crime, and it is noticed.
      for (const ped of this.traffic.peds) {
        if (!ped.alive || ped.guard) continue;
        if (Math.abs(car.speed) > 5 && dist2D(ped.x, ped.z, car.x, car.z) < 2.4) {
          this.combat.killPed(this, ped);
        }
      }
      // Camera chases the car's heading.
      if (this.dragTimer <= 0 && Math.abs(car.speed) > 2) {
        this.camYaw = angleLerp(this.camYaw, car.heading + Math.PI, Math.min(1, dt * 2.2));
      }
      this.audio.setEngine(clamp(Math.abs(car.speed) / 34, 0, 1), true);
      this.audio.updateMusic(dt, Math.abs(car.speed) > 6);
    } else {
      p.update(dt, { f: mv.f, s: mv.s, run }, this.camYaw, this.city.colliders, CITY.bound);
      // Camera follows the player's heading while moving.
      if (this.dragTimer <= 0 && p.speed > 1) {
        this.camYaw = angleLerp(this.camYaw, p.heading + Math.PI, Math.min(1, dt * 2.5));
      }
      this.audio.setEngine(0, false);
      this.audio.updateMusic(dt, false);
      // Steal / enter the nearest car.
      const near = this.traffic.nearestCar(p.x, p.z, 4.5)
        || this.police.cars.find((c) => dist2D(p.x, p.z, c.x, c.z) < 4.5);
      if (near) {
        this.hud.setHint(near.driver === 'traffic' || near.driver === 'police'
          ? `Press E to steal the ${near.model.name}`
          : `Press E to drive the ${near.model.name}`);
        if (input.hit('KeyE')) this.enterCar(near, near.driver === 'traffic' || near.driver === 'police');
      } else {
        this.hud.setHint(p.weapon === 'pistol'
          ? 'Click / J: shoot   R: reload   1: fists   2: pistol'
          : 'WASD: move   Shift: run   F: punch   E: enter car   2: draw pistol');
      }
      // Combat on foot.
      if (input.hit('KeyF')) this.combat.punch(this);
      if (input.mouseClicked || input.hit('KeyJ')) this.combat.shoot(this);
    }

    this.traffic.update(dt, p, this.city.colliders);
    this.police.update(dt, p, this);
    this.combat.update(dt);
    this.missions.update(dt);
    this.audio.setSiren(this.police.wanted > 0, dt);

    // Slow health regen while clean.
    if (this.police.wanted === 0 && p.alive) {
      this.regenTimer += dt;
      if (this.regenTimer > 1) { this.regenTimer = 0; p.heal(2); }
    } else this.regenTimer = 0;

    // Death by damage (wasted) is checked here; busted is checked by police.
    if (!p.alive && this.state === 'playing') this.wasted();

    // Third-person camera.
    const tx = p.inVehicle ? p.inVehicle.x : p.x;
    const tz = p.inVehicle ? p.inVehicle.z : p.z;
    const cy = Math.cos(this.camPitch), sy = Math.sin(this.camPitch);
    const ox = Math.sin(this.camYaw) * cy * this.camDist;
    const oz = Math.cos(this.camYaw) * cy * this.camDist;
    const oy = 2 + sy * this.camDist;
    const cx = damp(this.camera.position.x, tx + ox, 14, dt);
    const cz = damp(this.camera.position.z, tz + oz, 14, dt);
    const cyy = damp(this.camera.position.y, oy, 14, dt);
    this.camera.position.set(cx, cyy, cz);
    this.camera.lookAt(tx, 2.1, tz);

    // HUD.
    this.hud.setCash(this.cash);
    this.hud.setHealth(p.health, p.maxHealth);
    this.hud.setStars(this.police.wanted);
    this.hud.setSpeed(p.inVehicle ? p.inVehicle.speed : 0, !!p.inVehicle);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.setCrosshair(!p.inVehicle && p.weapon === 'pistol', p.weapon);
    this.hud.updateDialogue(dt);
    this.hud.drawMinimap(this);
    this.audio.ensure();
  }
}

addEventListener('DOMContentLoaded', () => { new Game(); });
