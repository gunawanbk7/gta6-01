// vehicles.js — car meshes and arcade driving physics, plus parked cars the
// player can steal. Every car is a group: body, cabin, wheels, headlights.
var SB = SB || {};
SB.vehicles = (function () {
  var COLORS = [0xd23c2e, 0x2e6fd2, 0xe8b93a, 0x3aa655, 0xe8e8e8, 0x222831, 0x8a4fd2, 0xd27a2e];
  var parked = [];   // stealable cars sitting at the kerb
  var all = [];      // every drivable car object in the world

  function makeCarMesh(color, isPolice) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
    body.position.y = 0.62; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2),
      new THREE.MeshLambertMaterial({ color: isPolice ? 0x111111 : 0x1c2b3a }));
    cabin.position.set(0, 1.18, -0.2); g.add(cabin);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
    glass.position.set(0, 1.12, 0.9); g.add(glass);
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wheels = [];
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.38, p[1]);
      g.add(w); wheels.push(w);
    });
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    [-0.6, 0.6].forEach(function (x) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
      l.position.set(x, 0.7, 2.22); g.add(l);
    });
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(0, 1.55, -0.2); g.add(bar);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      stripe.position.y = 0.85; g.add(stripe);
    }
    return { group: g, wheels: wheels };
  }

  function spawn(scene, x, z, heading, color, isPolice, isParked) {
    var mesh = makeCarMesh(color, !!isPolice);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = heading;
    scene.add(mesh.group);
    var car = {
      group: mesh.group, wheels: mesh.wheels, x: x, z: z, heading: heading,
      speed: 0, steer: 0, isPolice: !!isPolice, isParked: !!isParked,
      color: color, dead: false, flash: 0
    };
    all.push(car);
    if (isParked) parked.push(car);
    return car;
  }

  function spawnParkedRow(scene) {
    var spots = [
      [6, -38, 0], [6, -18, Math.PI], [-46, 6, Math.PI / 2], [46, -6, -Math.PI / 2],
      [6, 42, 0], [-6, 78, Math.PI], [86, 26, -Math.PI / 2], [-86, -46, Math.PI / 2],
      [26, 6, Math.PI / 2], [-26, -6, -Math.PI / 2], [66, 46, 0], [-66, -26, Math.PI]
    ];
    spots.forEach(function (s, i) {
      spawn(scene, s[0], s[1], s[2], COLORS[i % COLORS.length], false, true);
    });
  }

  // Arcade drive step: W/S throttle, A/D steer, Space handbrake. Returns speed.
  function drive(car, dt, input) {
    var accel = input.forward ? 14 : 0;
    var brake = input.back ? 20 : 0;
    if (input.back && car.speed > 0.5) { car.speed -= brake * dt; }
    else if (input.back) { car.speed = Math.max(car.speed - 8 * dt, -7); }
    else { car.speed += accel * dt; }
    if (!input.forward && !input.back) car.speed -= car.speed * 0.9 * dt;
    if (input.handbrake) car.speed -= car.speed * 3.2 * dt;
    var max = 30;
    car.speed = Math.max(-8, Math.min(max, car.speed));
    var steerTarget = input.left ? 0.55 : (input.right ? -0.55 : 0);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    if (Math.abs(car.speed) > 0.3) {
      car.heading += car.steer * dt * (car.speed / 8) * (car.speed < 0 ? -1 : 1);
    }
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    var fixed = SB.city.collide(nx, nz, 1.9);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.45; // bumped a wall
    car.x = fixed.x; car.z = fixed.z;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 2.2; });
    return car.speed;
  }

  function nearestParked(x, z, maxDist) {
    var best = null, bd = maxDist;
    parked.forEach(function (c) {
      if (c.dead || c.taken) return;
      var d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }

  return {
    spawn: spawn, spawnParkedRow: spawnParkedRow, drive: drive,
    nearestParked: nearestParked,
    all: all, parked: parked,
    reset: function () { all.length = 0; parked.length = 0; }
  };
})();
