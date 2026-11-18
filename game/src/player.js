// Player: on-foot character, movement, entering/exiting cars, health.
(function () {
  const S = window.SB;
  function makePlayerMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0xe8e83a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a4a8a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 1.8; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    hair.position.y = 2.08; g.add(hair);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.3), pants); legL.position.set(-0.18, 0.4, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.25), shirt); armL.position.set(-0.48, 1.05, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.48; g.add(armR);
    g.userData = { legL, legR, armL, armR };
    return g;
  }
  function makePlayer(scene) {
    const mesh = makePlayerMesh(); scene.add(mesh);
    return { mesh, pos: new THREE.Vector3(0, 0, 20), angle: 0, speed: 0,
      health: 100, inCar: null, walkPhase: 0, onGround: true };
  }
  function updatePlayer(p, input, dt, colliders, cameraYaw) {
    const cfg = S.CONFIG;
    let mx = 0, mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const spd = run ? cfg.runSpeed : cfg.walkSpeed;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      // movement relative to camera yaw
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const wx = mx * cos - mz * sin, wz = mx * sin + mz * cos;
      const nx = p.pos.x + wx * spd * dt, nz = p.pos.z + wz * spd * dt;
      if (!S.Vehicles.hitsBuilding(nx, p.pos.z, colliders)) p.pos.x = nx;
      if (!S.Vehicles.hitsBuilding(p.pos.x, nz, colliders)) p.pos.z = nz;
      p.angle = Math.atan2(wx, wz);
      p.walkPhase += dt * spd * 1.4;
      p.speed = spd;
    } else p.speed = 0;
    p.pos.x = Math.max(-205, Math.min(205, p.pos.x));
    p.pos.z = Math.max(-205, Math.min(200, p.pos.z));
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.angle;
    const sw = moving ? Math.sin(p.walkPhase) * 0.5 : 0;
    p.mesh.userData.legL.rotation.x = sw; p.mesh.userData.legR.rotation.x = -sw;
    p.mesh.userData.armL.rotation.x = -sw; p.mesh.userData.armR.rotation.x = sw;
    return moving;
  }
  S.Player = { makePlayer, updatePlayer };
})();
