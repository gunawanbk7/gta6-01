// player.js — Rico Vale on foot and behind the wheel: movement, camera,
// entering / stealing cars, health and respawn.
var SB = SB || {};
SB.player = (function () {
  var P = {
    x: 0, z: 8, heading: Math.PI, speed: 0, onFoot: true, car: null,
    health: 100, cash: 250, wanted: 0, wantedTimer: 0, dead: false,
    group: null, walkPhase: 0, bustedTimer: 0
  };

  function makeMesh() {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f8b });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 8), jacket);
    body.position.y = 1.0; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.78; g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xd23c2e }));
    cap.position.y = 1.98; g.add(cap);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
    P.legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), legMat);
    P.legL.position.set(-0.15, 0.28, 0); g.add(P.legL);
    P.legR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), legMat);
    P.legR.position.set(0.15, 0.28, 0); g.add(P.legR);
    var armMat = jacket;
    P.armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), armMat);
    P.armL.position.set(-0.48, 1.05, 0); g.add(P.armL);
    P.armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), armMat);
    P.armR.position.set(0.48, 1.05, 0); g.add(P.armR);
    return g;
  }

  function init(scene) {
    P.group = makeMesh();
    P.group.position.set(P.x, 0, P.z);
    scene.add(P.group);
    P.group.visible = true;
  }

  function pos() { return { x: P.x, z: P.z }; }

  function addWanted(n, reason) {
    P.wanted = Math.max(0, Math.min(5, P.wanted + n));
    P.wantedTimer = 0;
    if (n > 0 && reason) SB.hud.feed(reason + ' — wanted level ' + P.wanted + '!');
  }

  function enterCar(car, stolen) {
    P.car = car; P.onFoot = false; car.taken = true; car.isParked = false;
    P.group.visible = false;
    SB.hud.feed(stolen ? 'You stole the car! The owner is calling the cops.' : 'You got in the car.');
    if (stolen) addWanted(1, 'Grand theft auto');
    SB.audio.chime();
  }

  function exitCar() {
    if (!P.car) return;
    var car = P.car;
    P.x = car.x + Math.cos(car.heading) * 2.6;
    P.z = car.z - Math.sin(car.heading) * 2.6;
    var f = SB.city.collide(P.x, P.z, 0.6);
    P.x = f.x; P.z = f.z;
    P.heading = car.heading;
    P.car = null; P.onFoot = true; P.speed = 0;
    P.group.visible = true;
    P.group.position.set(P.x, 0, P.z);
  }

  function damage(n, cause) {
    if (P.dead) return;
    P.health -= n;
    if (P.health <= 0) {
      P.health = 0; P.dead = true;
      SB.main.gameOver('wasted', cause || 'You were taken down on the streets of Solmar Bay.');
    }
  }

  function respawn() {
    P.health = 100; P.dead = false; P.wanted = 0; P.bustedTimer = 0;
    P.cash = Math.max(0, P.cash - 100);
    if (P.car) { P.car.taken = false; P.car = null; }
    P.onFoot = true; P.x = 0; P.z = 8; P.heading = Math.PI; P.speed = 0;
    P.group.visible = true;
    P.group.position.set(P.x, 0, P.z);
    SB.hud.feed('You woke up at Solmar General. $100 hospital bill.');
  }

  function update(dt) {
    if (P.dead) return;
    if (P.onFoot) {
      var fwd = (SB.isDown('KeyW') ? 1 : 0) - (SB.isDown('KeyS') ? 1 : 0);
      var turn = (SB.isDown('KeyA') ? 1 : 0) - (SB.isDown('KeyD') ? 1 : 0);
      var run = SB.isDown('ShiftLeft') || SB.isDown('ShiftRight');
      var spd = run ? 8.5 : 4.6;
      P.heading += turn * 2.6 * dt;
      var mx = Math.sin(P.heading) * fwd * spd;
      var mz = Math.cos(P.heading) * fwd * spd;
      var fixed = SB.city.collide(P.x + mx * dt, P.z + mz * dt, 0.6);
      var moved = Math.hypot(fixed.x - P.x, fixed.z - P.z);
      P.x = fixed.x; P.z = fixed.z;
      P.walkPhase += moved * 2.2;
      var swing = Math.sin(P.walkPhase) * 0.5 * (moved > 0.001 ? 1 : 0);
      if (P.legL) { P.legL.rotation.x = swing; P.legR.rotation.x = -swing; P.armL.rotation.x = -swing; P.armR.rotation.x = swing; }
      P.group.position.set(P.x, Math.abs(Math.sin(P.walkPhase)) * 0.03, P.z);
      P.group.rotation.y = P.heading;
      P.speed = moved / Math.max(dt, 1e-4);
      // try to enter a nearby parked car
      if (SB.wasPressed('KeyE')) {
        var near = SB.vehicles.nearestParked(P.x, P.z, 4.5);
        if (near) enterCar(near, true);
        else SB.hud.hint('No car close enough. Walk up to a parked car and press E.');
      }
    } else if (P.car) {
      var car = P.car;
      var sp = SB.vehicles.drive(car, dt, {
        forward: SB.isDown('KeyW'), back: SB.isDown('KeyS'),
        left: SB.isDown('KeyA'), right: SB.isDown('KeyD'),
        handbrake: SB.isDown('Space')
      });
      P.x = car.x; P.z = car.z; P.heading = car.heading; P.speed = Math.abs(sp);
      SB.audio.engine(Math.abs(sp) / 30);
      // running over a pedestrian is a crime
      var ped = SB.traffic.nearestPed(P.x, P.z, 2.2);
      if (ped && Math.abs(sp) > 3) {
        ped.dead = true; SB.audio.thud();
        addWanted(1, 'You ran over a pedestrian');
      }
      if (SB.wasPressed('KeyE')) exitCar();
    }
    // wanted slowly cools off when the player stays clean
    if (P.wanted > 0) {
      P.wantedTimer += dt;
      if (P.wantedTimer > 45) { P.wanted--; P.wantedTimer = 0; SB.hud.feed('The heat is dying down. Wanted level ' + P.wanted + '.'); }
    }
    // slow health regen out of combat
    if (P.health < 100 && P.wanted === 0) P.health = Math.min(100, P.health + dt * 1.5);
  }

  return {
    P: P, init: init, pos: pos, update: update, damage: damage,
    respawn: respawn, addWanted: addWanted, enterCar: enterCar, exitCar: exitCar
  };
})();
