// main.js — boots Solmar Bay: renderer, camera, game loop, start/end screens,
// pause, save/load, and the debug hooks the play-test driver uses.
var SB = SB || {};
SB.main = (function () {
  var renderer, scene, camera, clock;
  var mode = 'menu';   // menu | play | paused | over
  var paused = false;
  var camDist = 11;

  function boot() {
    SB.hud.init();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    document.getElementById('scene').appendChild(renderer.domElement);
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    SB.city.build(scene);
    SB.vehicles.spawnParkedRow(scene);
    SB.traffic.init(scene);
    SB.player.init(scene);
    SB.police.init(scene);
    SB.combat.init(scene);
    SB.missions.init(scene);
    clock = new THREE.Clock();

    document.getElementById('playBtn').addEventListener('click', function () { startGame(false); });
    document.getElementById('continueBtn').addEventListener('click', function () { startGame(true); });
    document.getElementById('retryBtn').addEventListener('click', function () {
      SB.player.respawn();
      document.getElementById('endScreen').style.display = 'none';
      setMode('play');
    });
    // keep the Continue button honest: hide it when there is no save
    if (!SB.save.has()) document.getElementById('continueBtn').style.display = 'none';
    animate();
  }

  function startGame(fromSave) {
    SB.audio.unlock();
    SB.audio.click();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    setMode('play');
    if (fromSave) {
      var d = SB.save.read();
      if (d) {
        SB.player.P.cash = d.cash;
        SB.player.P.x = d.x || 0; SB.player.P.z = d.z || 8;
        SB.player.P.health = d.health || 100;
        SB.hud.feed('Save loaded — welcome back to Solmar Bay.');
        SB.missions.startMission(Math.min(d.missionIndex || 0, 3));
      } else SB.missions.startMission(0);
    } else {
      SB.save.clear();
      SB.missions.startMission(0);
    }
    SB.hud.feed('Welcome to Solmar Bay. Steal a car — press E near a parked one.');
  }

  function saveProgress() {
    var p = SB.player.P;
    SB.save.write({
      cash: Math.round(p.cash), missionIndex: SB.missions.state.index,
      health: Math.round(p.health), x: Math.round(p.x), z: Math.round(p.z),
      savedAt: new Date().toISOString()
    });
  }

  function gameOver(kind, text) {
    setMode('over');
    SB.audio.siren(false);
    SB.audio.engine(0);
    var fine = kind === 'busted' ? 150 : 100;
    SB.player.P.cash = Math.max(0, SB.player.P.cash - fine);
    document.getElementById('endTitle').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    document.getElementById('endText').textContent = text + ' ($' + fine + ' fine.)';
    document.getElementById('endScreen').style.display = 'flex';
    saveProgress();
  }

  function updateCamera(dt) {
    var p = SB.player.P;
    var target = new THREE.Vector3(p.x, p.onFoot ? 1.6 : 1.4, p.z);
    // camera yaw: follow the player's heading when driving, free orbit on foot
    var yaw = p.onFoot ? SB.camYaw : p.heading + Math.PI;
    if (p.onFoot) yaw = SB.camYaw;
    else SB.camYaw = yaw;
    var dist = p.onFoot ? 8.5 : 11.5;
    var pitch = SB.camPitch;
    var cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    var cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    var cy = target.y + Math.sin(pitch) * dist + 1.2;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 6));
    camera.lookAt(target.x, target.y + 0.4, target.z);
  }

  var saveTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (mode === 'play' && !paused) {
      if (SB.wasPressed('KeyP')) { paused = true; SB.hud.feed('Paused — press P to resume.'); }
      SB.player.update(dt);
      SB.traffic.update(dt, SB.player.pos());
      SB.police.update(dt);
      SB.combat.update(dt, camera);
      SB.missions.update(dt);
      SB.hud.update();
      updateCamera(dt);
      saveTimer += dt;
      if (saveTimer > 20) { saveTimer = 0; saveProgress(); }
    } else if (mode === 'menu') {
      // slow cinematic orbit over the city behind the start screen
      var t = performance.now() / 1000;
      camera.position.set(Math.sin(t * 0.05) * 90, 55, Math.cos(t * 0.05) * 90);
      camera.lookAt(0, 0, 20);
    } else if (paused) {
      if (SB.wasPressed('KeyP')) { paused = false; SB.hud.feed('Back on the street.'); }
    }
    if (SB.wasPressed('KeyM')) {
      var d = document.getElementById('dialog');
      if (d) d.style.display = 'none';
    }
    renderer.render(scene, camera);
    SB.endFrame();
  }

  // Debug hooks used by the headless play-test driver (real renders, real state).
  var api = { boot: boot, saveProgress: saveProgress, gameOver: gameOver, mode: 'menu' };
  function setMode(m) { mode = m; api.mode = m; }
  window.Solmar = {
    mode: function () { return mode; },
    mode: function () { return mode; },
    state: function () {
      var p = SB.player.P;
      return { mode: mode, cash: Math.round(p.cash), health: Math.round(p.health),
        wanted: p.wanted, onFoot: p.onFoot, x: Math.round(p.x), z: p.z && Math.round(p.z),
        speedKmh: Math.round(Math.abs(p.speed || 0) * 3.6),
        mission: SB.missions.state.index, step: SB.missions.state.step,
        missionActive: SB.missions.state.active, police: SB.police.units.length,
        peds: SB.traffic.peds.length, traffic: SB.traffic.cars.length };
    },
    start: function () { startGame(false); },
    startSaved: function () { startGame(true); },
    setWanted: function (n) { SB.player.P.wanted = n; SB.player.P.wantedTimer = 0; },
    giveCar: function () {
      var near = SB.vehicles.nearestParked(SB.player.P.x, SB.player.P.z, 200);
      if (near) SB.player.enterCar(near, false);
    },
    teleport: function (x, z) {
      var p = SB.player.P;
      if (p.car) { p.car.x = x; p.car.z = z; p.x = x; p.z = z; }
      else { p.x = x; p.z = z; p.group.position.set(x, 0, z); }
    },
    beginMission: function (i) { SB.missions.startMission(i); },
    holdKey: function (code, on) { SB.keys[code] = on; },
    shootAt: function () { SB.combat.shoot(camera); }
  };

  return api;
})();

window.addEventListener('load', function () { SB.main.boot(); });
