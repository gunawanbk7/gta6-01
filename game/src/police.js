// police.js — the Solmar Bay Police: spawn pursuit cars for the wanted level,
// chase the player, ram them, and bust them when they are cornered slow.
var SB = SB || {};
SB.police = (function () {
  var units = [];
  var sceneRef = null;

  function init(scene) { sceneRef = scene; units.length = 0; }

  function wantedCount() { return SB.player.P.wanted; }

  function update(dt) {
    var want = wantedCount();
    var target = Math.min(want, 4);
    // spawn up to the wanted level's worth of units
    while (units.length < target && sceneRef) {
      var a = Math.random() * Math.PI * 2;
      var px = SB.player.P.x + Math.cos(a) * 45;
      var pz = SB.player.P.z + Math.sin(a) * 45;
      var car = SB.vehicles.spawn(sceneRef, px, pz, 0, 0xffffff, true, false);
      car.police = true;
      units.push(car);
      SB.audio.alarm();
    }
    // remove extras when the heat drops
    while (units.length > target) {
      var gone = units.pop();
      if (gone) { sceneRef.remove(gone.group); gone.dead = true; }
    }
    SB.audio.siren(want > 0);
    var p = SB.player.P;
    units.forEach(function (u) {
      if (u.dead) return;
      var dx = p.x - u.x, dz = p.z - u.z;
      var dist = Math.hypot(dx, dz) || 1;
      var wantHeading = Math.atan2(dx, dz);
      var dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 3 * dt));
      var chaseSpeed = 13 + want * 2.5;
      u.speed = Math.min(chaseSpeed, u.speed + 10 * dt);
      var nx = u.x + Math.sin(u.heading) * u.speed * dt;
      var nz = u.z + Math.cos(u.heading) * u.speed * dt;
      var fixed = SB.city.collide(nx, nz, 1.9);
      if (fixed.x !== nx || fixed.z !== nz) { u.speed *= 0.4; u.heading += 0.6 * dt; }
      u.x = fixed.x; u.z = fixed.z;
      u.group.position.set(u.x, 0, u.z);
      u.group.rotation.y = u.heading;
      u.flash = (u.flash + dt * 6) % 2;
      u.group.children.forEach(function (ch) { /* light bar flashes via scale pulse */ });
      // ram damage + busted check
      if (dist < 3.2) {
        if (p.onFoot) SB.player.damage(18 * dt, 'The police ran you down.');
        else {
          SB.player.damage(6 * dt, 'Police rammed your car.');
          if (p.car) p.car.speed *= 0.92;
        }
        if (Math.abs(p.speed) < 1.5) {
          p.bustedTimer += dt;
          if (p.bustedTimer > 2.5) {
            p.bustedTimer = 0;
            SB.main.gameOver('busted', 'The Solmar Bay Police caught you. Bail cost you $150.');
          }
        } else p.bustedTimer = 0;
      }
    });
  }

  return { init: init, update: update, units: units };
})();
