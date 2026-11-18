// traffic.js — ambient traffic cars cruising the grid and pedestrians strolling
// the sidewalks. Both are simple, loop forever, and react to nothing but roads.
var SB = SB || {};
SB.traffic = (function () {
  var cars = [], peds = [];
  var PED_COLORS = [0xe86a6a, 0x6aa8e8, 0x7ad07a, 0xe8d06a, 0xc98ae8, 0xe8e8e8, 0x5a5a5a];

  function makePedMesh(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: color }));
    body.position.y = 0.95; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.7; g.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
    [-0.14, 0.14].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), legMat);
      leg.position.set(x, 0.25, 0); g.add(leg);
    });
    return g;
  }

  function init(scene) {
    cars.length = 0; peds.length = 0;
    var roads = SB.city.roads;
    var palette = [0xb03a2e, 0x2e6fb0, 0xc9a227, 0x4a7a4a, 0xdddddd, 0x333333];
    for (var i = 0; i < 10; i++) {
      var horizontal = i % 2 === 0;
      var line = roads[i % roads.length];
      var along = -100 + i * 22;
      var dir = (i % 4 < 2) ? 1 : -1;
      var car = SB.vehicles.spawn(scene, horizontal ? along : line + (dir > 0 ? 2.6 : -2.6),
        horizontal ? line + (dir > 0 ? 2.6 : -2.6) : along,
        horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        palette[i % palette.length], false, false);
      car.traffic = true; car.cruise = 7 + (i % 4);
      car.lane = line; car.horizontal = horizontal; car.dir = dir;
      cars.push(car);
    }
    for (var j = 0; j < 14; j++) {
      var mesh = makePedMesh(PED_COLORS[j % PED_COLORS.length]);
      var px = -90 + (j * 37) % 180, pz = -90 + (j * 53) % 180;
      mesh.position.set(px, 0, pz);
      scene.add(mesh);
      peds.push({ group: mesh, x: px, z: pz, heading: (j % 4) * Math.PI / 2,
        speed: 1.2 + (j % 3) * 0.4, walkPhase: j * 1.3, dead: false, fallT: 0 });
    }
  }

  function update(dt, playerPos) {
    cars.forEach(function (c) {
      if (c.dead) return;
      var step = c.cruise * dt;
      if (c.horizontal) { c.x += c.dir * step; if (c.x > 115) c.x = -115; if (c.x < -115) c.x = 115; }
      else { c.z += c.dir * step; if (c.z > 115) c.z = -115; if (c.z < -115) c.z = 115; }
      // slow down if the player is right ahead
      if (playerPos) {
        var d = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
        if (d < 7) { /* keep cruising; the player can be hit (wanted) */ }
      }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
    });
    peds.forEach(function (p) {
      if (p.dead) {
        p.fallT += dt;
        p.group.rotation.x = Math.min(p.fallT * 3, Math.PI / 2);
        return;
      }
      p.walkPhase += dt * 6;
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (p.x > 110 || p.x < -110 || p.z > 110 || p.z < -110) p.heading += Math.PI / 2;
      // bounce off buildings
      var f = SB.city.collide(p.x, p.z, 0.5);
      if (f.x !== p.x || f.z !== p.z) { p.heading += Math.PI / 2; p.x = f.x; p.z = f.z; }
      p.group.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.06, p.z);
      p.group.rotation.y = p.heading;
    });
  }

  function nearestPed(x, z, maxDist) {
    var best = null, bd = maxDist;
    peds.forEach(function (p) {
      if (p.dead) return;
      var d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  return { init: init, update: update, nearestPed: nearestPed, cars: cars, peds: peds };
})();
