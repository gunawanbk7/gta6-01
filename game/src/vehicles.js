// Vehicles: build cars (body, cabin, wheels, lights) + player driving physics.
(function () {
  const S = window.SB;
  const CAR_COLORS = [0xd84a3a, 0x2a6fd8, 0xf2c230, 0x3aa86a, 0x8a4ad8, 0xe8e8e8, 0x222831, 0xe87a2a, 0x2ad8c8, 0xc8d82a];
  function makeCarMesh(color, isPolice) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf5f5f5 : color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
    body.position.y = 0.65; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), new THREE.MeshLambertMaterial({ color: isPolice ? 0x222831 : 0x1e2a38 }));
    cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true; g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const wheels = [];
    [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w);
    });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.7, 0.7].forEach((x) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
      l.position.set(x, 0.7, 2.22); g.add(l);
    });
    if (isPolice) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x222831 }));
      bar.position.set(0, 1.75, -0.2); g.add(bar);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      r.position.set(-0.3, 1.76, -0.2); g.add(r);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      b.position.set(0.3, 1.76, -0.2); g.add(b);
      g.userData.lightBar = [r, b];
    }
    g.userData.wheels = wheels;
    return g;
  }
  function makeCar(x, z, angle, opts) {
    opts = opts || {};
    const mesh = makeCarMesh(opts.color != null ? opts.color : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], !!opts.police);
    mesh.position.set(x, 0, z); mesh.rotation.y = angle;
    return { mesh, x, z, angle, speed: 0, police: !!opts.police, parked: !!opts.parked,
      color: opts.color || 0, health: 100, driver: opts.driver || null, stuck: 0 };
  }
  // Simple arcade driving: W/S throttle, A/D steer, handbrake Space.
  function driveCar(car, input, dt, colliders) {
    const cfg = S.CONFIG;
    const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
    const back = input.isDown('KeyS') || input.isDown('ArrowDown');
    const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const right = input.isDown('KeyD') || input.isDown('ArrowRight');
    if (fwd) car.speed += cfg.carAccel * dt;
    else if (back) car.speed -= (car.speed > 0.5 ? cfg.carAccel * 1.4 : cfg.carAccel * 0.6) * dt;
    else car.speed *= Math.pow(0.4, dt);
    if (input.isDown('Space')) car.speed *= Math.pow(0.05, dt);
    car.speed = Math.max(-cfg.carReverse, Math.min(cfg.carMaxSpeed, car.speed));
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    if (Math.abs(car.speed) > 0.5) car.angle += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 10);
    const nx = car.x + Math.sin(car.angle) * car.speed * dt;
    const nz = car.z + Math.cos(car.angle) * car.speed * dt;
    if (!hitsBuilding(nx, nz, colliders)) { car.x = nx; car.z = nz; }
    else { if (Math.abs(car.speed) > 8) S.Audio.crash(); car.speed *= -0.25; }
    car.x = Math.max(-205, Math.min(205, car.x));
    car.z = Math.max(-205, Math.min(185, car.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    const spin = car.speed * dt * 2.4;
    car.mesh.userData.wheels.forEach((w) => { w.rotation.x += spin; });
    return Math.abs(car.speed) * 3.6;
  }
  function hitsBuilding(x, z, colliders) {
    for (const c of colliders) if (x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1) return true;
    return false;
  }
  S.Vehicles = { makeCar, makeCarMesh, driveCar, hitsBuilding, CAR_COLORS };
})();
