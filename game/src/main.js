// Solmar Bay — bootstrap and game loop. Wires every system together:
// city, player, cars, traffic, police, missions, combat, HUD, audio, save.
// Also owns the camera, car stealing, wanted heat, busted/complete flows,
// the ?shot= states for screenshots, and the window.__solmar debug API.
const THREE = window.THREE;
import { WORLD, PLAYER } from './config.js';
import { mulberry32 } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { Player, makePlayerMesh } from './player.js';
import { makeCarMesh, DriveCar, randomCarColor } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police, Wanted } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.wanted = new Wanted();
    this.rng = mulberry32(SEED);
    // Debug counters for headless play-testing: mousedown -> tryShoot -> shot.
    this.debug = { mousedown: 0, shootCalls: 0, shotsFired: 0 };
    this.input.onMouseDown = () => { this.debug.mousedown += 1; };

    this.state = 'menu'; // menu | playing | paused | busted | complete
    this.cash = PLAYER.startCash;
    this.ammo = PLAYER.magSize;
    this.camYaw = Math.PI;
    this.camPitch = 0.42;
    this.camDist = 10;
    this.lastDragAt = 0;
    this.ramCooldown = 0;
    this.shotHeatCooldown = 0;
    this.saveTimer = 0;
    this.missionIndexAtSave = 0;
    this.fps = 0;
    this.frames = 0;
    this.fpsTimer = 0;
    this.time = 0;
    this.pausedByDialogue = false;

    this.city = buildCity(this.scene, SEED);
    this.player = new Player(makePlayerMesh(), 4, 10);
    this.scene.add(this.player.mesh);
    this.traffic = new Traffic(this.scene, mulberry32(SEED + 1));
    this.traffic.spawnCars(14);
    this.traffic.spawnPeds(36);
    this.police = new Police(this.scene);
    this.combat = new Combat(this.scene, this.camera);
    this.missions = new MissionManager(this.scene);
    this.car = null; // DriveCar the player is driving, or null
    this.parkedCars = [];
    for (const spot of this.city.parkedSpots) {
      const mesh = makeCarMesh(randomCarColor(this.rng));
      this.scene.add(mesh);
      const car = new DriveCar(mesh, spot.x, spot.z, spot.angle);
      car.playerOwned = false;
      car.missionCar = spot.mission === 1;
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.angle;
      this.parkedCars.push(car);
    }

    this.input.onPause = () => this.togglePause();
    this.input.onMute = () => {
      this.audio.setMuted(!this.audio.muted);
      this.hud.feed(this.audio.muted ? 'Sound muted (M to unmute)' : 'Sound on');
    };

    window.addEventListener('resize', () => this.onResize());
    this.canvas.addEventListener('click', () => {
      if (this.state !== 'playing') return;
      if (this.hud.dialogueOpen()) { this.hud.advanceDialogue(); return; }
      // Shooting itself is handled in the loop via input.mouseClicked, so a
      // single click never fires twice.
    });

    this.wireMenus();
    this.hud.showMenu('menu-start');
    el('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health);
    this.hud.setStars(0);
    this.hud.setObjective('Press Start to begin your story in Solmar Bay.');
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);

    // The ?shot= states jump straight into a staged scene for screenshots.
    const shot = params.get('shot');
    if (shot) this.applyShot(shot);
    // Staged shots hide the mission briefing so the world reads clearly.
    if (shot && shot !== 'start') this.hud.dialogueEl.style.display = 'none';

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  wireMenus() {
    el('btn-start').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      clearSave();
      this.startNewGame();
    });
    el('btn-continue').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      this.startFromSave();
    });
    el('btn-resume').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      this.togglePause();
    });
    el('btn-quit').addEventListener('click', () => {
      this.audio.click();
      this.saveNow();
      this.state = 'menu';
      this.hud.showMenu('menu-start');
      el('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';
    });
    el('btn-busted-ok').addEventListener('click', () => {
      this.audio.click();
      this.respawn();
    });
    el('btn-complete-ok').addEventListener('click', () => {
      this.audio.click();
      this.state = 'playing';
      this.hud.hideMenus();
    });
    el('btn-restart').addEventListener('click', () => {
      this.audio.click();
      clearSave();
      this.startNewGame();
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- starting -------------------------------------------------------------
  startNewGame() {
    this.cash = PLAYER.startCash;
    this.player.health = PLAYER.maxHealth;
    this.player.x = 4;
    this.player.z = 10;
    this.player.angle = Math.PI;
    this.wanted.clear();
    this.police.clear();
    this.combat.ammo = PLAYER.magSize;
    this.combat.reserve = 48;
    this.missions.index = 0;
    this.missions.done = false;
    this.exitCar(true);
    this.state = 'playing';
    this.hud.hideMenus();
    this.hud.feed('Welcome to Solmar Bay. Make your name, Rook.');
    this.missions.start(this.missionCtx());
    this.saveNow();
  }

  startFromSave() {
    const data = loadGame();
    this.startNewGame();
    if (!data) return;
    this.cash = data.cash ?? PLAYER.startCash;
    this.player.health = data.health ?? PLAYER.maxHealth;
    this.combat.ammo = data.ammo ?? PLAYER.magSize;
    if (data.pos) { this.player.x = data.pos[0]; this.player.z = data.pos[1]; }
    if (typeof data.missionIndex === 'number' && data.missionIndex < MISSIONS.length) {
      this.missions.index = data.missionIndex;
      this.missions.start(this.missionCtx());
    }
    this.hud.feed('Progress loaded. Back on the streets.');
    this.saveNow();
  }

  missionCtx() {
    return {
      landmarks: this.city.landmarks,
      showDialogue: (title, lines) => this.hud.showDialogue(title, lines),
      say: (m) => this.hud.feed(m),
      setWanted: (n) => { this.wanted.stars = n; this.hud.feed(`Wanted level: ${'★'.repeat(n)}`); },
      addCash: (n) => { this.cash += n; this.hud.setCash(this.cash); this.saveNow(); },
      audio: this.audio,
      onAllMissionsDone: () => {
        this.state = 'complete';
        this.audio.missionDone();
        el('complete-stats').textContent = `Cash: $${this.cash.toLocaleString('en-US')} — every job done. Solmar Bay is yours, Rook.`;
        this.hud.showMenu('menu-complete');
        this.saveNow();
      },
    };
  }

  saveNow() {
    saveGame({
      cash: this.cash,
      missionIndex: this.missions.index,
      missionsDone: this.missions.index,
      health: this.player.health,
      ammo: this.combat.ammo,
      playerPos: { x: this.player.x, z: this.player.z },
    });
  }

  // --- car stealing -----------------------------------------------------------
  nearestParkedCar(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of this.parkedCars) {
      const dx = car.x - this.player.x;
      const dz = car.z - this.player.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    this.car = car;
    this.parkedCars = this.parkedCars.filter((c) => c !== car);
    this.player.mesh.visible = false;
    if (!car.playerOwned) {
      car.playerOwned = true;
      this.wanted.add(1, 'stolen car');
      this.hud.feed('You stole a car! The law noticed. ★');
      this.audio.horn();
    } else {
      this.hud.feed('Back in your car.');
    }
  }

  exitCar(silent) {
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    const side = { x: Math.cos(car.angle), z: -Math.sin(car.angle) };
    this.player.x = car.x + side.x * 2.2;
    this.player.z = car.z + side.z * 2.2;
    this.player.angle = car.angle;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    if (!silent) this.hud.feed('You got out of the car.');
    // The car becomes parked again where it stopped.
    car.speed = 0;
    this.parkedCars.push(car);
  }

  tryShoot() {
    if (this.car) return; // no drive-bys in this build; shoot on foot
    this.debug.shootCalls += 1;
    const targets = [];
    for (const ped of this.traffic.peds) {
      targets.push({
        mesh: ped.mesh,
        onHit: (dmg) => {
          this.traffic.knockDown(ped);
          this.wanted.add(1, 'assault');
          this.hud.feed('You shot a pedestrian! Wanted up. ★');
        },
      });
    }
    for (const car of this.police.cars) {
      targets.push({
        mesh: car.mesh,
        onHit: (dmg) => {
          car.health -= dmg;
          if (car.health <= 0) {
            this.scene.remove(car.mesh);
            this.police.cars = this.police.cars.filter((c) => c !== car);
            this.wanted.add(1, 'cop down');
            this.hud.feed('You wrecked a police cruiser! ★');
          }
        },
      });
    }
    for (const car of this.traffic.cars) {
      targets.push({
        mesh: car.mesh,
        onHit: (dmg) => { /* traffic cars shrug off bullets */ },
      });
    }
    const result = this.combat.shoot(targets);
    if (result === 'hit' || result === 'miss') {
      this.debug.shotsFired += 1;
      this.audio.shoot();
      if (this.shotHeatCooldown <= 0) {
        this.wanted.add(1, 'gunfire');
        this.shotHeatCooldown = 6;
        this.hud.feed('Gunfire reported! Wanted up. ★');
      }
    } else if (result === 'empty') {
      this.hud.feed('Click — out of ammo. Press R to reload.');
      this.audio.click();
    }
  }

  tryPunch() {
    const targets = [];
    for (const ped of this.traffic.peds) {
      if (ped.fallen > 0) continue;
      targets.push({
        x: ped.mesh.position.x,
        z: ped.mesh.position.z,
        onHit: () => {
          this.traffic.knockDown(ped);
          this.wanted.add(1, 'assault');
          this.hud.feed('You decked a pedestrian! Wanted up. ★');
        },
      });
    }
    const hit = this.combat.punch({ x: this.player.x, z: this.player.z }, this.player.angle, targets);
    if (hit) this.audio.punch();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showMenu('menu-pause');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.hideMenus();
    }
  }

  respawn() {
    const lost = Math.floor(this.cash * 0.2);
    this.cash = Math.max(0, this.cash - lost);
    this.player.health = PLAYER.maxHealth;
    this.player.x = 4;
    this.player.z = 10;
    this.wanted.clear();
    this.police.clear();
    this.exitCar(true);
    this.state = 'playing';
    this.hud.hideMenus();
    this.hud.feed(`Busted! The Bay PD took $${lost} and dropped you at the plaza.`);
    this.saveNow();
  }

  damagePlayer(amount, source) {
    if (this.state !== 'playing') return;
    this.player.health = Math.max(0, this.player.health - amount);
    if (this.player.health <= 0) {
      this.state = 'busted';
      this.audio.busted();
      this.audio.engine(0, false);
      this.audio.siren(false);
      el('busted-text').textContent = `The Bay PD caught ${source === 'police' ? 'you after a chase' : 'you'}. You lost 20% of your cash.`;
      this.hud.showMenu('menu-busted');
    }
  }

  // --- staged ?shot= states for screenshots ----------------------------------
  applyShot(shot) {
    this.audio.ensure();
    if (shot === 'start') return; // menu screen is the shot
    this.startNewGame();
    if (shot === 'street') {
      this.player.x = 4;
      this.player.z = 10;
      this.camYaw = Math.PI * 0.92;
      this.hud.feed('Solmar Bay — on foot, downtown.');
    } else if (shot === 'drive') {
      const car = this.parkedCars.find((c) => c.missionCar) || this.parkedCars[0];
      this.enterCar(car);
      this.car.x = 0;
      this.car.z = -60;
      this.car.angle = 0;
      this.car.speed = 16;
      this.wanted.stars = 0;
      this.camYaw = Math.PI;
    } else if (shot === 'chase') {
      const car = this.parkedCars.find((c) => c.missionCar) || this.parkedCars[0];
      this.enterCar(car);
      this.car.x = 0;
      this.car.z = -30;
      this.car.angle = 0;
      this.car.speed = 20;
      this.missions.index = 2;
      this.missions.start(this.missionCtx());
      // Mission 3's briefing sets 2 stars; the chase shot wants 3.
      this.wanted.stars = 3;
      this.police.sync(3, { x: 0, z: -30 });
      this.camYaw = Math.PI;
      this.hud.feed('Three stars — the whole Bay PD is on you!');
    } else if (shot === 'mission') {
      const car = this.parkedCars.find((c) => c.missionCar) || this.parkedCars[0];
      this.enterCar(car);
      this.car.x = 58;
      this.car.z = 30;
      this.car.angle = Math.PI / 2;
      this.car.speed = 0;
      this.wanted.stars = 0;
      this.missions.index = 0;
      this.missions.step = 1; // already in a car: drive to the garage
      this.missions.active = true;
      this.missions.refreshMarker(this.city.landmarks);
      this.hud.setObjective(this.missions.objectiveText());
      this.camYaw = Math.PI * 0.75;
      this.hud.feed('Mission: drive the car to Marco\'s Garage.');
    }
  }

  // --- main loop ---------------------------------------------------------------
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.08, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.frames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    if (this.state !== 'playing') {
      // Frozen scene still renders (menu backdrop), ocean keeps moving.
      this.city.update(this.time);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    const input = this.input;
    const dialogueOpen = this.hud.dialogueOpen();

    // Camera orbit from mouse drag.
    if (input.mouseDX !== 0 || input.mouseDY !== 0) {
      this.camYaw -= input.mouseDX * 0.005;
      this.camPitch = Math.max(0.15, Math.min(1.1, this.camPitch + input.mouseDY * 0.003));
      this.lastDragAt = this.time;
    }

    // Dialogue advances on E.
    if (dialogueOpen && input.wasPressed('KeyE')) {
      this.hud.advanceDialogue();
      this.audio.click();
    }

    const playerPos = this.car ? { x: this.car.x, z: this.car.z } : { x: this.player.x, z: this.player.z };

    if (!dialogueOpen) {
      // Interact: enter / exit a car.
      if (input.wasPressed('KeyE')) {
        if (this.car) {
          if (Math.abs(this.car.speed) < 2) this.exitCar(false);
          else this.hud.feed('Slow down first!');
        } else {
          const near = this.nearestParkedCar(4.5);
          if (near) this.enterCar(near);
        }
      }
      if (input.mouseClicked && !this.car) this.tryShoot();
      if (input.wasPressed('KeyF') && !this.car) this.tryPunch();
      if (input.wasPressed('KeyR') && !this.car) {
        if (this.combat.reload()) {
          this.hud.feed('Reloaded.');
          this.audio.click();
        }
      }
    }

    // --- movement ----------------------------------------------------------------
    if (this.car) {
      const move = input.moveAxis();
      const throttle = move.y;
      const steer = -move.x; // D turns right: angle decreases? keep arcade feel
      this.car.step(dt, { throttle, steer, handbrake: input.down('Space') }, this.city.colliders);
      // Car vs pedestrian: knock them down (and earn heat).
      for (const ped of this.traffic.peds) {
        if (ped.fallen > 0) continue;
        const dx = ped.mesh.position.x - this.car.x;
        const dz = ped.mesh.position.z - this.car.z;
        if (dx * dx + dz * dz < 4.4 && Math.abs(this.car.speed) > 3) {
          this.traffic.knockDown(ped);
          this.wanted.add(1, 'hit pedestrian');
          this.hud.feed('You hit a pedestrian! Wanted up. ★');
          this.car.speed *= 0.8;
        }
      }
      // Car vs traffic car: shove and slow.
      for (const t of this.traffic.cars) {
        const dx = t.mesh.position.x - this.car.x;
        const dz = t.mesh.position.z - this.car.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.6 && d > 0.01) {
          this.car.x -= (dx / d) * (3.6 - d) * 0.5;
          this.car.z -= (dz / d) * (3.6 - d) * 0.5;
          this.car.speed *= 0.85;
          this.car.health = Math.max(0, this.car.health - 2);
        }
      }
      if (this.car.health <= 0) {
        this.hud.feed('Your car is wrecked!');
        const wreck = this.car;
        this.scene.remove(wreck.mesh);
        this.car = null;
        this.player.mesh.visible = true;
        this.player.x = wreck.x + 2;
        this.player.z = wreck.z + 2;
      }
      this.audio.engine(Math.abs(this.car ? this.car.speed : 0) / 38, true);
    } else {
      const move = input.moveAxis();
      this.player.step(dt, { x: move.x, y: move.y, run: input.down('ShiftLeft') || input.down('ShiftRight') }, this.camYaw, this.city.colliders);
      this.audio.engine(0, false);
    }

    // --- world life ----------------------------------------------------------------
    this.traffic.update(dt, playerPos);
    this.city.update(this.time);
    this.combat.update(dt);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.shotHeatCooldown = Math.max(0, this.shotHeatCooldown - dt);

    // --- police + wanted ------------------------------------------------------------
    this.police.sync(this.wanted.stars, playerPos);
    const policeNear = this.police.nearestDist(playerPos) < 55;
    this.wanted.update(dt, policeNear);
    this.police.update(dt, playerPos, this.car ? this.car.speed : 0, this.city.colliders, (car, dist) => {
      if (this.ramCooldown <= 0) {
        this.ramCooldown = 0.9;
        this.damagePlayer(8, 'police');
        if (this.car) this.car.health = Math.max(0, this.car.health - 6);
        this.audio.punch();
        this.hud.feed('A cruiser rammed you!');
      }
    });
    this.audio.siren(this.police.cars.length > 0);

    // --- missions ---------------------------------------------------------------------
    this.missions.update(dt, {
      pos: playerPos,
      inCar: !!this.car,
      wanted: this.wanted.stars,
      holdingE: input.down('KeyE'),
      dt,
      landmarks: this.city.landmarks,
      setWanted: (n) => { this.wanted.stars = n; },
      addCash: (n) => { this.cash += n; this.hud.setCash(this.cash); this.saveNow(); },
      say: (m) => this.hud.feed(m),
      audio: this.audio,
      showDialogue: (title, lines) => this.hud.showDialogue(title, lines),
      onAllMissionsDone: () => {
        this.state = 'complete';
        this.audio.missionDone();
        el('complete-stats').textContent = `Cash: $${this.cash.toLocaleString('en-US')} — every job done. Solmar Bay is yours, Rook.`;
        this.hud.showMenu('menu-complete');
        this.saveNow();
      },
    });

    // --- camera ------------------------------------------------------------------------
    const target = this.car
      ? { x: this.car.x, z: this.car.z, y: 1.6 }
      : { x: this.player.x, z: this.player.z, y: 1.7 };
    if (this.car && this.time - this.lastDragAt > 2) {
      // Ease the camera behind the car when driving.
      const want = this.car.angle + Math.PI;
      let diff = want - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, 2.2 * dt);
    }
    const dist = this.car ? 13 : 10;
    const height = dist * Math.tan(this.camPitch) + 1.2;
    const cx = target.x + Math.sin(this.camYaw) * dist;
    const cz = target.z + Math.cos(this.camYaw) * dist;
    this.camera.position.set(cx, height, cz);
    this.camera.lookAt(target.x, target.y, target.z);

    // --- HUD -----------------------------------------------------------------------------
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health);
    this.hud.setStars(this.wanted.stars);
    this.hud.setSpeed(this.car ? this.car.speed * 3.6 : 0);
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.setCrosshair(!this.car);
    const nearCar = !this.car && this.nearestParkedCar(4.5);
    this.hud.setInteract(
      dialogueOpen ? '' :
      nearCar ? 'Press E to steal this car' :
      this.car && Math.abs(this.car.speed) < 2 ? 'Press E to get out' : '',
    );
    this.hud.drawMinimap({
      player: { x: playerPos.x, z: playerPos.z, angle: this.car ? this.car.angle : this.player.angle },
      cars: this.traffic.cars.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      police: this.police.cars.map((c) => ({ x: c.x, z: c.z })),
      peds: this.traffic.peds.filter((p) => p.fallen <= 0).map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
      marker: this.missions.markerPos,
    });

    // Autosave every 25 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 25) {
      this.saveTimer = 0;
      this.saveNow();
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}

function el(id) { return document.getElementById(id); }

const game = new Game();

// Debug / play-test API for headless verification.
window.__solmar = {
  game,
  state: () => ({
    state: game.state,
    cash: game.cash,
    health: game.player.health,
    wanted: game.wanted.stars,
    inCar: !!game.car,
    speed: game.car ? game.car.speed : 0,
    carHealth: game.car ? game.car.health : null,
    missionIndex: game.missions.index,
    missionDone: game.missions.done,
    objective: game.missions.objectiveText(),
    pos: game.car ? { x: game.car.x, z: game.car.z } : { x: game.player.x, z: game.player.z },
    police: game.police.cars.length,
    parkedCars: game.parkedCars.length,
    trafficCars: game.traffic.cars.length,
    peds: game.traffic.peds.length,
    fps: game.fps,
    errors: window.__errors.slice(),
    debug: { ...game.debug },
  }),
  start: () => game.startNewGame(),
  setWanted: (n) => { game.wanted.stars = n; },
  teleport: (x, z) => {
    if (game.car) { game.car.x = x; game.car.z = z; }
    else { game.player.x = x; game.player.z = z; }
  },
  enterNearestCar: () => {
    const car = game.nearestParkedCar(100);
    if (car) game.enterCar(car);
    return !!car;
  },
  key: (code, down) => {
    if (down) game.input.fakeDown(code);
    else game.input.fakeUp(code);
  },
  click: () => game.input.fakeClick(),
};
