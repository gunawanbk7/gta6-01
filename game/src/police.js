// Police: wanted stars, pursuing cruisers, sirens, bust/escape logic.
(function () {
  const S = window.SB;
  function spawnPolice(scene, state) {
    const police = [];
    for (let i = 0; i < 4; i++) {
      const c = S.Vehicles.makeCar(state.player.pos.x + (i % 2 ? 60 : -60), state.player.pos.z + (i < 2 ? -50 : 50),
        0, { police: true });
      c.mesh.visible = false; scene.add(c.mesh); police.push(c);
    }
    return police;
  }
  function setWanted(state, n, reason) {
    n = Math.max(0, Math.min(5, n));
    if (n > state.wanted) {
      state.wanted = n; state.wantedTimer = 0;
      state.feed.push((reason || 'The law is onto you') + ' — wanted level ' + n + ' ★');
      if (n >= 2) S.Audio.siren();
    } else if (n < state.wanted) state.wanted = n;
    state.hudDirty = true;
  }
  function updatePolice(state, dt) {
    const wanted = state.wanted;
    const target = state.player.inCar ? state.player.inCar : state.player.pos;
    const tp = state.player.inCar ? { x: state.player.inCar.x, z: state.player.inCar.z } : { x: state.player.pos.x, z: state.player.pos.z };
    // Wanted decays after 25s without a new crime, faster when on foot and slow
    if (wanted > 0) {
      state.wantedTimer += dt;
      const speed = state.player.inCar ? Math.abs(state.player.inCar.speed) : state.player.speed;
      if (state.wantedTimer > 25 && speed < 3) { setWanted(state, wanted - 1, 'You slipped out of sight'); state.wantedTimer = 0; }
    }
    let active = 0;
    for (const pc of state.police) {
      const shouldBeActive = active < wanted;
      pc.mesh.visible = shouldBeActive;
      if (!shouldBeActive) { active++; continue; }
      active++;
      const dx = tp.x - pc.x, dz = tp.z - pc.z, dist = Math.hypot(dx, dz) || 1;
      if (dist > 120) { // respawn closer
        pc.x = tp.x + (Math.random() < 0.5 ? 55 : -55); pc.z = tp.z + (Math.random() < 0.5 ? 45 : -45);
      }
      const wantAngle = Math.atan2(dx, dz);
      let da = wantAngle - pc.angle;
      while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      pc.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, da));
      pc.speed = Math.min(34, 16 + wanted * 3);
      const nx = pc.x + Math.sin(pc.angle) * pc.speed * dt;
      const nz = pc.z + Math.cos(pc.angle) * pc.speed * dt;
      if (!S.Vehicles.hitsBuilding(nx, nz, state.colliders)) { pc.x = nx; pc.z = nz; }
      pc.mesh.position.set(pc.x, 0, pc.z); pc.mesh.rotation.y = pc.angle;
      pc.mesh.userData.wheels.forEach((w) => { w.rotation.x += pc.speed * dt * 2.4; });
      // Flashing light bar
      if (pc.mesh.userData.lightBar) {
        const on = Math.floor(performance.now() / 300) % 2 === 0;
        pc.mesh.userData.lightBar[0].material.color.setHex(on ? 0xff2222 : 0x551111);
        pc.mesh.userData.lightBar[1].material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
      // Ram: damage player / car when touching
      if (dist < 4.5) {
        if (state.player.inCar) {
          state.player.inCar.health -= 18 * dt;
          state.player.inCar.speed *= 0.96;
          if (state.player.inCar.health <= 0) { state.feed.push('Your car is wrecked! Bail out!'); exitWreck(state); }
        } else {
          state.player.health -= 12 * dt;
          if (state.player.health <= 0) bust(state);
        }
      }
    }
    // Siren blips while chased
    if (wanted > 0 && Math.random() < dt * 0.5) S.Audio.siren();
  }
  function bust(state) {
    state.player.health = 100; state.cash = Math.max(0, state.cash - 100);
    setWanted(state, 0, 'Busted! The cops took $100 and dropped you at the station');
    state.player.pos.set(0, 0, 20); state.player.inCar = null;
    state.feed.push('Busted — $100 fine. Rico is back on Coral Avenue.');
  }
  function exitWreck(state) {
    const car = state.player.inCar; if (!car) return;
    state.player.inCar = null; state.player.pos.set(car.x + 3, 0, car.z + 3);
    car.parked = true; car.speed = 0;
    state.feed.push('Car wrecked — Rico bailed out on foot.');
  }
  S.Police = { spawnPolice, setWanted, updatePolice, bust };
})();
