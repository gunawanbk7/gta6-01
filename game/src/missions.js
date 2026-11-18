// Missions: 4-mission story chain with stages, markers, dialogue, cash rewards.
(function () {
  const S = window.SB;
  function makeMarker(scene) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    cyl.position.y = 4.5; g.add(cyl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 4), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    arrow.position.y = 10; arrow.rotation.x = Math.PI; g.add(arrow);
    g.visible = false; scene.add(g);
    return { group: g, arrow, cyl };
  }
  function currentMission(state) { return S.MISSIONS[state.missionIndex] || null; }
  function currentStage(state) {
    const m = currentMission(state); if (!m) return null;
    return m.stages[state.stageIndex] || null;
  }
  function stageTarget(state) {
    const st = currentStage(state); if (!st || !st.target) return null;
    return { x: st.target[0], z: st.target[1] };
  }
  function placeMarker(state) {
    const t = stageTarget(state);
    if (!t) { state.marker.group.visible = false; state.markerTarget = null; return; }
    state.marker.group.visible = true;
    state.marker.group.position.set(t.x, 0, t.z);
    state.markerTarget = t;
  }
  function startMission(state, idx) {
    const m = S.MISSIONS[idx]; if (!m) return;
    state.missionIndex = idx; state.stageIndex = 0;
    state.feed.push('MISSION ' + m.id + ': ' + m.title + ' — $' + m.reward);
    state.feed.push(m.intro);
    state.dialogue = m.intro; state.dialogueT = 8;
    const st = m.stages[0];
    if (st && st.wantedAtStart) S.Police.setWanted(state, st.wantedAtStart, 'The heat is on for this job');
    placeMarker(state);
    S.Audio.mission();
  }
  function advanceStage(state) {
    const m = currentMission(state); if (!m) return;
    state.stageIndex++;
    if (state.stageIndex >= m.stages.length) {
      state.cash += m.reward;
      state.completedMissions.push(m.id);
      state.feed.push('MISSION COMPLETE: ' + m.title + '  +$' + m.reward + '  (cash $' + state.cash + ')');
      state.dialogue = 'Mara: "Clean work, Rico. $' + m.reward + ' is yours."'; state.dialogueT = 6;
      S.Audio.cash(); S.Audio.mission();
      S.Save.save(state);
      state.missionIndex++;
      state.stageIndex = 0;
      if (currentMission(state)) { startMission(state, state.missionIndex); }
      else { state.feed.push('All missions complete! Solmar Bay is yours, Rico. Free roam — keep the city.'); state.dialogue = 'All missions complete! Free roam.'; state.dialogueT = 8; placeMarker(state); }
    } else {
      const st = m.stages[state.stageIndex];
      state.feed.push('Next: ' + st.text);
      if (st.wantedAtStart) S.Police.setWanted(state, st.wantedAtStart, 'The heat is on for this job');
      placeMarker(state);
      S.Audio.pickup();
    }
  }
  function updateMissions(state, dt) {
    const m = currentMission(state); if (!m) { placeMarker(state); return; }
    const st = currentStage(state); if (!st) return;
    const px = state.player.inCar ? state.player.inCar.x : state.player.pos.x;
    const pz = state.player.inCar ? state.player.inCar.z : state.player.pos.z;
    if (st.type === 'steal') {
      if (state.player.inCar) { state.feed.push('Car stolen! Now drive to the Marina gate.'); advanceStage(state); }
      return;
    }
    if (st.type === 'goto' && st.target) {
      const d = Math.hypot(px - st.target[0], pz - st.target[1]);
      state.missionDist = Math.round(d);
      if (d < 6) {
        if (m.id === 4 && state.stageIndex === 0) {
          state.feed.push('Till grabbed! $1,000 job — now RUN to the Marina hideout!');
          S.Police.setWanted(state, 3, 'Store robbery — every cruiser in the bay is coming');
        }
        advanceStage(state);
      }
    }
    // Marker pulse
    if (state.marker.group.visible) {
      state.marker.arrow.rotation.y += dt * 3;
      state.marker.arrow.position.y = 10 + Math.sin(performance.now() / 300) * 0.8;
    }
  }
  S.Missions = { makeMarker, currentMission, currentStage, startMission, advanceStage, updateMissions, placeMarker, stageTarget };
})();
