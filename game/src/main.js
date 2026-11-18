// Solmar Bay — main loop: boot, camera, car enter/exit, game state, shot modes.
(function () {
  const S = window.SB;
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x87c5e8, 220, 460);
  const camera = new THREE.PerspectiveCamera(62, 2, 0.1, 900);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
  sun.position.set(120, 180, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220; sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a55, 0.5); scene.add(hemi);

  const city = S.City.buildCity(scene);
  const state = {
    cash: S.CONFIG.startCash, wanted: 0, wantedTimer: 0,
    missionIndex: 0, stageIndex: 0, completedMissions: [],
    feed: [], dialogue: '', dialogueT: 0, lastSave: null, clock: 0,
    started: false, over: false, colliders: city.colliders,
    player: null, traffic: null, police: null, combat: null, marker: null,
    markerTarget: null, missionDist: null, hudDirty: false, ocean: city.ocean, ocean2: city.ocean2,
    cameraYaw: 0, cameraPitch: 0.32, cameraDist: 13, saveTimer: 0,
  };
  state.player = S.Player.makePlayer(scene);
  state.traffic = S.Traffic.spawnTraffic(scene, state.colliders);
  state.police = S.Police.spawnPolice(scene, state);
  state.combat = S.Combat.makeCombat(scene);
  state.marker = S.Missions.makeMarker(scene);
  const hud = S.HUD.initHUD(state);

  // Camera orbit with mouse drag; wheel zooms.
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.cameraYaw -= (e.clientX - lastX) * 0.005;
    state.cameraPitch = Math.max(0.08, Math.min(1.1, state.cameraPitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    state.cameraDist = Math.max(7, Math.min(26, state.cameraDist + Math.sign(e.deltaY) * 2));
  }, { passive: true });

  function nearestCar(maxD) {
    let best = null, bestD = maxD;
    for (const c of state.traffic.cars) {
      if (c.police) continue;
      const d = Math.hypot(c.x - state.player.pos.x, c.z - state.player.pos.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  function enterCar(car) {
    state.player.inCar = car; car.parked = false;
    state.player.mesh.visible = false;
    S.Audio.engine(true); S.Audio.horn();
    if (state.missionIndex === 0 && state.stageIndex === 0) {
      state.feed.push('You jacked a car on Coral Avenue! The owner is shouting — the cops noticed.');
      S.Police.setWanted(state, 1, 'Grand theft auto');
    } else {
      state.feed.push('You took the car. Drive!');
      S.Police.setWanted(state, Math.max(state.wanted, 1), 'Grand theft auto');
    }
  }
  function exitCar() {
    const car = state.player.inCar; if (!car) return;
    state.player.inCar = null;
    state.player.pos.set(car.x + 3, 0, car.z + 2);
    state.player.mesh.visible = true;
    state.feed.push('Rico got out of the car.');
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  function startGame(fromSave) {
    if (state.started) return;
    state.started = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    S.Audio.unlock();
    if (fromSave) {
      const save = S.Save.load();
      if (save) {
        state.cash = save.cash; state.player.health = save.health;
        state.missionIndex = Math.min(save.missionIndex || 0, S.MISSIONS.length);
        state.completedMissions = save.completed || [];
        if (save.pos) state.player.pos.set(save.pos[0], 0, save.pos[1]);
        state.feed.push('Save loaded — welcome back to Solmar Bay, Rico.');
      }
    } else {
      state.feed.push('Welcome to Solmar Bay. Rico Vega is back — and the city owes him.');
      state.feed.push('Mara is waiting. Steal a car to start Mission 1: First Wheels.');
    }
    S.Missions.startMission(state, state.missionIndex);
    S.Input.clearPressed();
  }
  document.getElementById('btn-start').addEventListener('click', () => startGame(false));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
  if (S.Save.has()) document.getElementById('btn-continue').style.display = 'inline-block';

  let last = performance.now(), saveAcc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    state.clock += dt;
    // Ocean shimmer
    state.ocean.position.y = 0.02 + Math.sin(now / 900) * 0.08;
    if (!state.started) {
      // Attract mode: slow orbit over the city behind the start screen
      const t = now / 12000;
      camera.position.set(Math.sin(t) * 150, 70, Math.cos(t) * 150);
      camera.lookAt(0, 0, 40);
      renderer.render(scene, camera);
      return;
    }
    const input = S.Input;
    if (state.dialogueT > 0) state.dialogueT -= dt;
    // Enter / exit car
    if (input.consume('KeyE')) {
      if (state.player.inCar) exitCar();
      else { const c = nearestCar(4.5); if (c) enterCar(c); else state.feed.push('No car close enough — walk up to one and press E.'); }
    }
    if (state.player.inCar) {
      S.Vehicles.driveCar(state.player.inCar, input, dt, state.colliders);
      state.player.pos.set(state.player.inCar.x, 0, state.player.inCar.z);
      state.player.angle = state.player.inCar.angle;
      // Camera follows car heading
      state.cameraYaw += (state.player.inCar.angle + Math.PI - state.cameraYaw) * 0.02;
      if (input.consume('KeyF') || input.mouseClicked()) state.combat.shoot(state);
    } else {
      S.Player.updatePlayer(state.player, input, dt, state.colliders, state.cameraYaw);
      if (input.consume('KeyF')) state.combat.punch(state);
      if (input.mouseClicked() || input.consume('Space')) state.combat.shoot(state);
    }
    if (input.consume('KeyM')) { const m = S.Audio.toggleMute(); state.feed.push(m ? 'Sound muted.' : 'Sound on.'); }
    if (input.consume('KeyH')) { state.feed.push('Help: WASD move/drive • E enter car • F punch • Click/Space pistol • drag mouse to orbit • M mute.'); }
    S.Traffic.updateTraffic(state.traffic, dt, state.player.pos, state.colliders);
    S.Police.updatePolice(state, dt);
    state.combat.update(dt);
    S.Missions.updateMissions(state, dt);
    // Collisions: traffic cars bump the player car
    if (state.player.inCar) {
      for (const c of state.traffic.cars) {
        if (c === state.player.inCar || c.police) continue;
        const d = Math.hypot(c.x - state.player.inCar.x, c.z - state.player.inCar.z);
        if (d < 4 && d > 0.01) {
          const push = (4 - d) * 0.5;
          c.x += (c.x - state.player.inCar.x) / d * push; c.z += (c.z - state.player.inCar.z) / d * push;
          state.player.inCar.speed *= 0.9;
        }
      }
    }
    // Autosave every 12s
    saveAcc += dt;
    if (saveAcc > 12) { saveAcc = 0; if (S.Save.save(state)) state.feed.push('Progress autosaved.'); }
    hud.update(dt);
    // Camera: third person behind player/car
    const focus = state.player.inCar ? { x: state.player.inCar.x, z: state.player.inCar.z, a: state.player.inCar.angle }
      : { x: state.player.pos.x, z: state.player.pos.z, a: state.cameraYaw };
    const camA = state.player.inCar ? state.player.inCar.angle + Math.PI : state.cameraYaw;
    const cd = state.cameraDist;
    camera.position.set(
      focus.x + Math.sin(camA) * cd * Math.cos(state.cameraPitch),
      4 + cd * Math.sin(state.cameraPitch),
      focus.z + Math.cos(camA) * cd * Math.cos(state.cameraPitch));
    camera.lookAt(focus.x, 2.2, focus.z);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // ---- Test / shot hooks (used by headless play-testing only) ----
  const params = new URLSearchParams(location.search);
  window.SOLMAR = {
    state, start: () => startGame(false),
    enterNearestCar() { const c = nearestCar(30); if (c) { state.player.pos.set(c.x - 2, 0, c.z); enterCar(c); } return !!state.player.inCar; },
    setWanted(n) { S.Police.setWanted(state, n, 'The heat is on'); },
    teleport(x, z) { if (state.player.inCar) { state.player.inCar.x = x; state.player.inCar.z = z; } else state.player.pos.set(x, 0, z); },
    completeMission() { const m = S.Missions.currentMission(state); if (m) { state.stageIndex = m.stages.length - 1; const st = m.stages[state.stageIndex]; if (st.target) this.teleport(st.target[0], st.target[1]); } },
    shoot() { return state.combat.shoot(state); },
    punch() { return state.combat.punch(state); },
    save() { return S.Save.save(state); },
    status() { return JSON.stringify({ started: state.started, cash: state.cash, health: Math.round(state.player.health), wanted: state.wanted, mission: state.missionIndex, stage: state.stageIndex, completed: state.completedMissions, inCar: !!state.player.inCar, pos: [Math.round(state.player.pos.x), Math.round(state.player.pos.z)], feed: state.feed.slice(-3) }); },
  };
  // Shot presets (?shot=start|street|chase|mission) for real-render screenshots
  const shot = params.get('shot');
  if (shot) {
    setTimeout(() => {
      if (shot === 'start') return; // start screen over attract orbit
      startGame(false);
      if (shot === 'street') { state.player.pos.set(0, 0, 26); }
      if (shot === 'chase') {
        window.SOLMAR.enterNearestCar();
        window.SOLMAR.setWanted(3);
        state.player.inCar.speed = 22;
      }
      if (shot === 'mission') {
        window.SOLMAR.enterNearestCar();
        state.player.inCar.angle = Math.PI / 2; // face down the Marina road for the shot
        const st = S.Missions.currentStage(state);
        if (st && st.target) window.SOLMAR.teleport(st.target[0] - 18, st.target[1] - 10);
      }
      document.getElementById('hud').style.display = 'block';
    }, 600);
  }
  window.addEventListener('error', (e) => { window.__solmarError = String(e.message || e.error); });
})();
