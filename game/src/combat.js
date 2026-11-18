// Combat: punch (F) and pistol (click / Space on foot), tracers, hit feedback.
(function () {
  const S = window.SB;
  function makeCombat(scene) {
    const group = new THREE.Group(); scene.add(group);
    const markerGeo = new THREE.SphereGeometry(0.3, 8, 6);
    return { scene, group, cooldown: 0, tracers: [], muzzle: null,
      shoot(state) {
        if (this.cooldown > 0) return false;
        this.cooldown = 0.35;
        S.Audio.shoot();
        const p = state.player;
        const ox = p.inCar ? p.inCar.x : p.pos.x, oz = p.inCar ? p.inCar.z : p.pos.z;
        const ang = p.inCar ? p.inCar.angle : p.angle;
        const dirX = Math.sin(ang), dirZ = Math.cos(ang);
        // Tracer line
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ox, 1.3, oz), new THREE.Vector3(ox + dirX * 30, 1.3, oz + dirZ * 30)]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
        this.group.add(line); this.tracers.push({ line, t: 0.12 });
        // Hit test: nearest ped / police car in a forward cone
        let best = null, bestD = 1e9;
        for (const ped of state.traffic.peds) {
          if (!ped.alive) continue;
          const dx = ped.x - ox, dz = ped.z - oz, d = Math.hypot(dx, dz);
          if (d < 32 && d < bestD) {
            const dot = (dx * dirX + dz * dirZ) / (d || 1);
            if (dot > 0.86) { best = { kind: 'ped', obj: ped, d }; bestD = d; }
          }
        }
        for (const pc of state.police) {
          if (!pc.mesh.visible) continue;
          const dx = pc.x - ox, dz = pc.z - oz, d = Math.hypot(dx, dz);
          if (d < 32 && d < bestD) {
            const dot = (dx * dirX + dz * dirZ) / (d || 1);
            if (dot > 0.86) { best = { kind: 'police', obj: pc, d }; bestD = d; }
          }
        }
        if (best) {
          if (best.kind === 'ped') {
            best.obj.alive = false; best.obj.mesh.visible = false;
            state.feed.push('Pedestrian down! A witness called the cops.');
            S.Police.setWanted(state, Math.max(state.wanted, 1), 'Shots fired in Solmar Bay');
          } else {
            best.obj.speed = 0; best.obj.x += dirX * 3; best.obj.z += dirZ * 3;
            state.feed.push('You hit a police cruiser!');
            S.Police.setWanted(state, Math.min(5, state.wanted + 1), 'You shot at the police');
          }
        }
        return true;
      },
      punch(state) {
        if (this.cooldown > 0) return false;
        this.cooldown = 0.45; S.Audio.punch();
        const p = state.player;
        for (const ped of state.traffic.peds) {
          if (!ped.alive) continue;
          const d = Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z);
          if (d < 2.6) {
            ped.alive = false; ped.mesh.visible = false;
            state.feed.push('You knocked a pedestrian flat. Someone saw that.');
            S.Police.setWanted(state, Math.max(state.wanted, 1), 'Assault reported');
            return true;
          }
        }
        state.feed.push('Rico swings at the air.');
        return true;
      },
      update(dt) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        for (let i = this.tracers.length - 1; i >= 0; i--) {
          const t = this.tracers[i]; t.t -= dt;
          if (t.t <= 0) { this.group.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
        }
      } };
  }
  S.Combat = { makeCombat };
})();
