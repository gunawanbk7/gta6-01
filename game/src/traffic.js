// Traffic: moving cars on the road grid + pedestrians wandering the sidewalks.
(function () {
  const S = window.SB;
  function makePedMesh() {
    const g = new THREE.Group();
    const cols = [0xe84a5f, 0x2a6fd8, 0x3aa86a, 0xf2c230, 0x8a4ad8, 0xe8e8e8];
    const c = cols[Math.floor(Math.random() * cols.length)];
    const skin = new THREE.MeshLambertMaterial({ color: [0xd8a070, 0x8a5a30, 0xe8c090][Math.floor(Math.random() * 3)] });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), new THREE.MeshLambertMaterial({ color: c }));
    body.position.y = 1.0; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
    head.position.y = 1.7; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    legL.position.set(-0.15, 0.38, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
    g.userData = { legL, legR, phase: Math.random() * 6 };
    return g;
  }
  function spawnTraffic(scene, colliders) {
    const cars = [], peds = [];
    const R = S.CONFIG.roadEvery;
    // Parked cars along roads (stealable) + moving traffic
    for (let i = 0; i < 14; i++) {
      const road = -176 + Math.floor(Math.random() * 9) * R;
      const along = -190 + Math.random() * 380;
      const horizontal = Math.random() < 0.5;
      const c = S.Vehicles.makeCar(horizontal ? along : road + 3.5, horizontal ? road + 3.5 : along,
        horizontal ? Math.PI / 2 : 0, { parked: i < 8 });
      scene.add(c.mesh); cars.push(c);
    }
    // Guaranteed stealable cars near spawn (0,20)
    [[6, 26, 0], [-6, 30, Math.PI], [10, 14, Math.PI / 2]].forEach(([x, z, a]) => {
      const c = S.Vehicles.makeCar(x, z, a, { parked: true, color: 0xd84a3a });
      scene.add(c.mesh); cars.push(c);
    });
    for (let i = 0; i < 22; i++) {
      const m = makePedMesh();
      const x = -190 + Math.random() * 380, z = -190 + Math.random() * 360;
      m.position.set(x, 0, z); scene.add(m);
      peds.push({ mesh: m, x, z, angle: Math.random() * Math.PI * 2, speed: 1 + Math.random() * 1.4,
        targetAngle: Math.random() * Math.PI * 2, changeT: 2 + Math.random() * 4, alive: true });
    }
    return { cars, peds };
  }
  function updateTraffic(t, dt, playerPos, colliders) {
    // Moving traffic cars: drive along roads, wrap around, avoid the player slightly
    for (const c of t.cars) {
      if (c.parked || c.police) continue;
      c.speed = 9;
      const nx = c.x + Math.sin(c.angle) * c.speed * dt;
      const nz = c.z + Math.cos(c.angle) * c.speed * dt;
      if (Math.abs(nx) > 205 || Math.abs(nz) > 200 || S.Vehicles.hitsBuilding(nx, nz, colliders)) {
        c.angle += Math.PI / 2; // turn at block ends
        continue;
      }
      c.x = nx; c.z = nz;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.angle;
      c.mesh.userData.wheels.forEach((w) => { w.rotation.x += c.speed * dt * 2.4; });
    }
    for (const p of t.peds) {
      if (!p.alive) continue;
      p.changeT -= dt;
      if (p.changeT <= 0) { p.targetAngle = Math.random() * Math.PI * 2; p.changeT = 3 + Math.random() * 5; }
      let da = p.targetAngle - p.angle;
      while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      p.angle += Math.max(-1.5 * dt, Math.min(1.5 * dt, da));
      const nx = p.x + Math.sin(p.angle) * p.speed * dt;
      const nz = p.z + Math.cos(p.angle) * p.speed * dt;
      if (!S.Vehicles.hitsBuilding(nx, nz, colliders) && Math.abs(nx) < 205 && Math.abs(nz) < 200) { p.x = nx; p.z = nz; }
      else p.targetAngle += Math.PI / 2;
      p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.angle;
      p.mesh.userData.phase += dt * 6;
      const sw = Math.sin(p.mesh.userData.phase) * 0.45;
      p.mesh.userData.legL.rotation.x = sw; p.mesh.userData.legR.rotation.x = -sw;
    }
  }
  S.Traffic = { spawnTraffic, updateTraffic };
})();
