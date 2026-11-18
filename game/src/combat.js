// combat.js — punch and pistol. Click fires at what the camera faces;
// F punches the nearest pedestrian. Victims fall, witnesses raise the heat.
var SB = SB || {};
SB.combat = (function () {
  var cooldown = 0;
  var tracer = null;

  function init(scene) {
    var geo = new THREE.BoxGeometry(0.06, 0.06, 1);
    tracer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe27a }));
    tracer.visible = false; scene.add(tracer);
  }

  function punch() {
    if (cooldown > 0) return;
    cooldown = 0.45;
    SB.audio.punch();
    var p = SB.player.P;
    var ped = SB.traffic.nearestPed(p.x, p.z, 2.4);
    if (ped) {
      ped.dead = true;
      SB.hud.feed('You knocked a bystander flat.');
      SB.player.addWanted(1, 'Assault in broad daylight');
    } else {
      SB.hud.hint('Nobody in punching range.');
    }
  }

  function shoot(camera) {
    if (cooldown > 0) return;
    cooldown = 0.32;
    SB.audio.gunshot();
    SB.player.addWanted(1, 'Shots fired on the street');
    var p = SB.player.P;
    // shot origin: player position, direction: camera forward
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    var ox = p.x, oz = p.z, oy = p.onFoot ? 1.5 : 1.2;
    var dx = dir.x, dz = dir.z;
    var best = null, bestD = 60;
    function consider(tx, tz, obj) {
      var vx = tx - ox, vz = tz - oz;
      var along = vx * dx + vz * dz;
      if (along < 1 || along > bestD) return;
      var perp = Math.abs(vx * dz - vz * dx);
      if (perp < 1.6) { bestD = along; best = obj; }
    }
    SB.traffic.peds.forEach(function (pd) { if (!pd.dead) consider(pd.x, pd.z, { kind: 'ped', ref: pd }); });
    SB.police.units.forEach(function (u) { if (!u.dead) consider(u.x, u.z, { kind: 'cop', ref: u }); });
    SB.traffic.cars.forEach(function (c) { if (!c.dead && !c.traffic) return; if (!c.dead) consider(c.x, c.z, { kind: 'car', ref: c }); });
    if (tracer) {
      tracer.visible = true;
      tracer.position.set(ox + dx * bestD / 2, oy, oz + dz * bestD / 2);
      tracer.lookAt(ox + dx * bestD, oy, oz + dz * bestD);
      tracer.scale.set(1, 1, bestD);
      setTimeout(function () { if (tracer) tracer.visible = false; }, 70);
    }
    if (best) {
      if (best.kind === 'ped') { best.ref.dead = true; SB.hud.feed('You dropped a bystander. The city saw it.'); }
      if (best.kind === 'cop') {
        best.ref.dead = true;
        if (best.ref.group) best.ref.group.visible = false;
        SB.hud.feed('You took out a police cruiser!');
        SB.player.addWanted(1, 'Cop down');
      }
      if (best.kind === 'car') { SB.hud.feed('Your shot pinged off a passing car.'); }
    }
  }

  function update(dt, camera) {
    cooldown = Math.max(0, cooldown - dt);
    if (SB.player.P.onFoot && SB.wasPressed('KeyF')) punch();
    if (SB.mouse.clicked && SB.main && SB.main.mode === 'play') shoot(camera);
  }

  return { init: init, update: update, punch: punch, shoot: shoot };
})();
