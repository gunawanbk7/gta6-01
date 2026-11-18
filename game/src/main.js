// Solmar Bay — bootstrap, game loop, camera, menus, scene presets and the
// built-in self-test. Wires every module together into one playable game.
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { hasSave, saveGame, loadGame, clearSave } from './save.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerOnFoot } from './player.js';
import { createParkedCars, nearestStealableCar, enterCar, exitCar, updatePlayerCar, createCarRecord } from './vehicles.js';
import { createTraffic, updateTraffic, createPedestrians, updatePedestrians } from './traffic.js';
import { createPolice, setWanted, addWanted, updatePolice } from './police.js';
import { createCombat, doPunch, doShoot, startReload, updateCombat, spawnThugs } from './combat.js';
import { createMissions, updateMissions, jumpToMission, resetMissionToStart, setMarker } from './missions.js';
import { createHud } from './hud.js';

window.__solmarErrors = [];
window.addEventListener('error', (e) => {
  window.__solmarErrors.push(String(e.message || e.error || 'unknown error'));
});

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const sceneName = params.get('scene') || 'start';
  const selftest = params.get('selftest') === '1';

  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = 'game';
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.skyColor);
  scene.fog = new THREE.Fog(CFG.fogColor, 130, 280);
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 600);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6b4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.sunColor, 1.4);
  sun.position.set(60, 90, -40);
  scene.add(sun);

  const G = {
    scene,
    camera,
    renderer,
    input: createInput(renderer.domElement),
    audio: createAudio(),
    city: buildCity(scene),
    player: null,
    parkedCars: [],
    traffic: [],
    peds: [],
    police: null,
    combat: null,
    missions: null,
    hud: null,
    cash: 0,
    wanted: 0,
    wantedTimer: 0,
    camYaw: Math.PI,
    state: 'menu', // menu | playing | paused | won
    clock: new THREE.Clock(),
    ocean: null,
    selftest,
    test: { active: selftest, t: 0, enteredCar: false, drove: false, wanted: 0, punched: false, shot: false, missionStage: '', done: false, startX: 0, startZ: 0 },
  };
  G.ocean = scene.getObjectByName('ocean');
  G.player = createPlayer(scene);
  G.player.pos.set(0, 0, 20);
  G.parkedCars = createParkedCars(scene);
  G.traffic = createTraffic(scene);
  G.peds = createPedestrians(scene);
  G.police = createPolice(scene);
  G.combat = createCombat();
  G.missions = createMissions(scene);
  G.hud = createHud();
  window.__solmar = G;

  // --- Outcomes ------------------------------------------------------------
  G.showWin = () => {
    G.state = 'won';
    document.getElementById('win-cash').textContent = `$${Math.floor(G.cash)}`;
    document.getElementById('win-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    clearSave();
  };
  function respawn(reason, fee) {
    if (G.player.inCar) exitCar(G);
    G.cash = Math.max(0, G.cash - fee);
    G.player.health = CFG.playerHealth;
    setWanted(G, 0);
    G.player.pos.set(CFG.hospital.x, 0, CFG.hospital.z);
    G.player.group.position.copy(G.player.pos);
    G.hud.feed(reason);
    G.audio.fail();
    resetMissionToStart(G);
  }
  G.onBusted = (msg) => respawn(`${msg} Busted! Hospital bill $150.`, 150);
  G.onWasted = () => respawn('You got wasted! The hospital patched you up — $100.', 100);

  // --- Menus ---------------------------------------------------------------
  const startScreen = document.getElementById('start-screen');
  const hudEl = document.getElementById('hud');
  const pauseScreen = document.getElementById('pause-screen');
  function beginPlaying() {
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    G.audio.ensure();
    G.state = 'playing';
    G.input.clear();
  }
  document.getElementById('btn-start').addEventListener('click', () => {
    clearSave();
    G.cash = 0;
    G.player.health = CFG.playerHealth;
    G.player.pos.set(0, 0, 20);
    jumpToMission(G, 0, 'steal');
    G.hud.feed('Rico Delmar is back in Solmar Bay. Vera Kosta is waiting.');
    beginPlaying();
  });
  const continueBtn = document.getElementById('btn-continue');
  if (hasSave()) {
    continueBtn.classList.remove('hidden');
    continueBtn.addEventListener('click', () => {
      const s = loadGame();
      if (s) {
        G.cash = s.cash;
        G.player.health = s.health;
        G.player.pos.set(s.px || 0, 0, s.pz || 20);
        G.player.yaw = s.pyaw || 0;
        if (Array.isArray(s.completed)) G.missions.completed = s.completed;
        setWanted(G, s.wanted || 0);
        jumpToMission(G, Math.min(s.missionIndex || 0, 4), 'steal');
        G.hud.feed('Welcome back, Rico. The Bay kept your seat warm.');
      }
      beginPlaying();
    });
  }
  document.getElementById('btn-resume').addEventListener('click', () => {
    pauseScreen.classList.add('hidden');
    G.state = 'playing';
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    saveGame(G);
    G.hud.feed('Progress saved.');
  });
  document.getElementById('btn-again').addEventListener('click', () => {
    window.location.href = window.location.pathname;
  });

  // --- Scene presets (?scene=...) ------------------------------------------
  function applyScene(name) {
    beginPlaying();
    const coupe = G.parkedCars.find((c) => c.missionCar === 'coupe');
    if (name === 'cover') {
      G.cash = 2500;
      jumpToMission(G, 3, 'escape');
      setWanted(G, 4);
      coupe.pos.set(0, 0, 10);
      coupe.yaw = Math.PI;
      coupe.group.position.copy(coupe.pos);
      coupe.group.rotation.y = coupe.yaw;
      G.player.pos.copy(coupe.pos);
      enterCar(G, coupe);
      G.autoDrive = true;
      G.autoDriveSpeed = 11;
      coupe.speed = 11;
      for (const [x, z] of [[-3, 16], [3, 19], [0, 24]]) {
        const pc = createCarRecord(scene, 0x1a1a1a, x, z, Math.PI, { police: true });
        pc.speed = 14;
        G.police.cars.push(pc);
      }
      G.audio.setSiren(true);
      G.hud.feed('Four stars! Lose the Solmar Bay police!');
    } else if (name === 'drive') {
      jumpToMission(G, 0, 'steal');
      G.missions.stage = 'deliver';
      setMarker(G, CFG.hideout.x, CFG.hideout.z);
      G.player.pos.set(CFG.marinaCoupe.x - 2, 0, CFG.marinaCoupe.z);
      enterCar(G, coupe);
      addWanted(G, 1);
      G.hud.feed('You stole the coupe! Get it to the Anchor hideout.');
    } else if (name === 'mission') {
      jumpToMission(G, 2, 'fight');
      setWanted(G, 2);
      G.player.pos.set(78, 0, 4);
      G.player.yaw = Math.PI / 2;
      G.camYaw = -Math.PI / 2;
      G.hud.feed('Dockside trouble — take down the Marlin thugs!');
    } else if (name === 'foot') {
      jumpToMission(G, 0, 'steal');
      G.player.pos.set(0, 0, 20);
      G.camYaw = Math.PI;
      G.hud.feed('On foot in downtown Solmar Bay. Find a car — or a job.');
    }
  }

  // --- Self-test (?selftest=1) --------------------------------------------
  // Wall-clock driven (headless SwiftShader runs at low FPS, so accumulated
  // frame dt would stretch the test far past real time).
  function selfTestStep(dt) {
    const t = G.test;
    if (!t.startedAt) t.startedAt = performance.now();
    t.t = (performance.now() - t.startedAt) / 1000;
    const coupe = G.parkedCars.find((c) => c.missionCar === 'coupe');
    if (t.t > 0.3 && !t.enteredCar) {
      G.player.pos.set(CFG.marinaCoupe.x - 2, 0, CFG.marinaCoupe.z);
      enterCar(G, coupe);
      t.enteredCar = true;
      t.startX = coupe.pos.x;
      t.startZ = coupe.pos.z;
      jumpToMission(G, 0, 'steal');
    }
    if (t.enteredCar && t.t < 3.0) {
      // Hold the throttle open: pin speed before the driving update.
      G.player.car.speed = 14;
    }
    if (t.enteredCar && !t.drove) {
      const moved = Math.hypot(coupe.pos.x - t.startX, coupe.pos.z - t.startZ);
      if (Math.abs(coupe.speed) > 5 && moved > 5) t.drove = true;
    }
    if (t.t > 3.2 && t.wanted === 0) {
      addWanted(G, 2);
      G.police.spawnTimer = 0;
      t.wanted = G.wanted;
    }
    if (t.t > 3.8 && t.enteredCar) {
      exitCar(G);
      t.enteredCar = 'done';
    }
    if (t.t > 4.0 && !t.punched) {
      // Put a thug next to Rico and punch him.
      spawnThugs(G, [[G.player.pos.x + 1.5, G.player.pos.z + 0.5]]);
      doPunch(G);
      t.punched = G.combat.punched;
    }
    if (t.t > 5.0 && !t.shot) {
      // Put a thug straight ahead of the camera and shoot.
      const fwdX = -Math.sin(G.camYaw);
      const fwdZ = -Math.cos(G.camYaw);
      spawnThugs(G, [[G.player.pos.x + fwdX * 3, G.player.pos.z + fwdZ * 3]]);
      doShoot(G);
      t.shot = G.combat.shot;
    }
    if (t.t > 5.6 && !t.missionStage) {
      t.missionStage = G.missions.stage;
    }
    if (t.t > 6.2 && !t.done) {
      t.done = true;
      const result = {
        ready: true,
        enteredCar: t.enteredCar === 'done',
        drove: t.drove,
        wanted: t.wanted,
        punched: t.punched,
        shot: t.shot,
        missionStage: t.missionStage,
        errors: window.__solmarErrors,
      };
      window.__solmarSelfTest = result;
      document.getElementById('selftest').textContent = JSON.stringify(result);
    }
  }

  // --- Camera ---------------------------------------------------------------
  const camTarget = new THREE.Vector3();
  function updateCamera(dt) {
    if (G.state === 'menu') {
      const a = performance.now() * 0.00004;
      camera.position.set(Math.sin(a) * 70, 38, 20 + Math.cos(a) * 70);
      camera.lookAt(0, 0, 10);
      return;
    }
    const p = G.player.pos;
    const dist = G.player.inCar ? 15 : 11;
    const height = G.player.inCar ? 7 : 6;
    const tx = p.x + Math.sin(G.camYaw) * dist;
    const tz = p.z + Math.cos(G.camYaw) * dist;
    const k = 1 - Math.exp(-8 * dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (height - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    // Never trail far behind at low frame rates: snap when too far off.
    const off = Math.hypot(tx - camera.position.x, height - camera.position.y, tz - camera.position.z);
    if (off > 24) camera.position.set(tx, height, tz);
    camTarget.set(p.x, 1.6, p.z);
    camera.lookAt(camTarget);
  }

  // --- Main loop ------------------------------------------------------------
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(G.clock.getDelta(), 0.05);
    if (G.state === 'playing') {
      // Look.
      G.camYaw -= G.input.takeDragYaw();
      if (G.player.inCar && G.player.car) {
        G.camYaw = lerpAngle(G.camYaw, G.player.car.yaw + Math.PI, Math.min(1, dt * 1.5));
      }
      // Actions.
      if (G.input.pressed('KeyE')) {
        if (G.player.inCar) {
          exitCar(G);
        } else {
          const car = nearestStealableCar(G, 4.5);
          if (car) {
            enterCar(G, car);
            addWanted(G, 1);
            G.hud.feed(car.missionCar === 'coupe' ? 'You stole the red coupe!' : 'You stole a car! The police are coming.');
          }
        }
      }
      if (G.input.pressed('KeyF') && !G.player.inCar) doPunch(G);
      const clicks = G.input.takeClicks();
      for (let i = 0; i < clicks; i++) doShoot(G);
      if (G.input.pressed('KeyR')) startReload(G);
      if (G.input.pressed('KeyM')) {
        G.audio.setMuted(!G.audio.isMuted());
        G.hud.feed(G.audio.isMuted() ? 'Sound off.' : 'Sound on.');
      }
      if (G.input.pressed('KeyP')) {
        G.state = 'paused';
        pauseScreen.classList.remove('hidden');
      }
      // World updates.
      if (G.player.inCar) updatePlayerCar(G, dt);
      else updatePlayerOnFoot(G, dt);
      updateTraffic(G, dt);
      updatePedestrians(G, dt);
      updatePolice(G, dt);
      updateMissions(G, dt);
      updateCombat(G, dt);
      G.hud.update(G);
      const speed01 = G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) / CFG.carMaxSpeed : 0;
      G.audio.engine(speed01, G.player.inCar);
      G.audio.update(dt);
      if (G.player.health <= 0) G.onWasted();
      if (G.test.active) selfTestStep(dt);
    }
    if (G.ocean) G.ocean.position.y = 0.01 + Math.sin(performance.now() * 0.0006) * 0.06;
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (sceneName !== 'start') {
    applyScene(sceneName);
  } else if (selftest) {
    beginPlaying();
    jumpToMission(G, 0, 'steal');
  }
  frame();
}

boot();
