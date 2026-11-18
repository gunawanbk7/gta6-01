// HUD: cash, health, wanted stars, speed, objective, message feed, live minimap.
(function () {
  const S = window.SB;
  function buildMinimap(state) {
    const cv = document.getElementById('minimap');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, scale = W / 460;
    function draw() {
      ctx.fillStyle = '#1d2b1a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2f7fa8'; ctx.fillRect(0, (195 + 35) * scale * 0 + (230 / 460) * H - 0, W, H * 0.16); // ocean band (south)
      ctx.fillStyle = '#e8d49a'; ctx.fillRect(0, H * 0.82, W, H * 0.06); // beach
      ctx.strokeStyle = '#555c66'; ctx.lineWidth = 3;
      const R = S.CONFIG.roadEvery;
      for (let c = -200; c <= 200; c += R) {
        const p = (c + 230) * scale;
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
      }
      const px = (v) => (v + 230) * scale;
      // mission marker
      if (state.markerTarget) {
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath(); ctx.arc(px(state.markerTarget.x), px(state.markerTarget.z), 7, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px(state.markerTarget.x), px(state.markerTarget.z), 11, 0, 7); ctx.stroke();
      }
      // traffic + police
      ctx.fillStyle = '#9fb8cc';
      for (const c of state.traffic.cars) { if (!c.parked) ctx.fillRect(px(c.x) - 2, px(c.z) - 2, 4, 4); }
      ctx.fillStyle = '#3a7bff';
      for (const pc of state.police) if (pc.mesh.visible) ctx.fillRect(px(pc.x) - 3, px(pc.z) - 3, 6, 6);
      // player arrow
      const pxx = px(state.player.inCar ? state.player.inCar.x : state.player.pos.x);
      const pzz = px(state.player.inCar ? state.player.inCar.z : state.player.pos.z);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pxx, pzz, 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e84a5f'; ctx.beginPath(); ctx.arc(pxx, pzz, 2.5, 0, 7); ctx.fill();
    }
    return draw;
  }
  function initHUD(state) {
    const drawMap = buildMinimap(state);
    const els = {
      cash: document.getElementById('hud-cash'), health: document.getElementById('hud-health'),
      healthBar: document.getElementById('hud-health-bar'), wanted: document.getElementById('hud-wanted'),
      speed: document.getElementById('hud-speed'), objective: document.getElementById('hud-objective'),
      feed: document.getElementById('hud-feed'), dialogue: document.getElementById('hud-dialogue'),
      save: document.getElementById('hud-save'), time: document.getElementById('hud-time'),
    };
    let lastFeedLen = 0;
    function update(dt) {
      drawMap();
      els.cash.textContent = '$' + state.cash;
      els.health.textContent = Math.max(0, Math.round(state.player.health)) + '%';
      els.healthBar.style.width = Math.max(0, state.player.health) + '%';
      els.healthBar.style.background = state.player.health > 50 ? '#3aa86a' : state.player.health > 25 ? '#f2c230' : '#d84a3a';
      els.wanted.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      els.wanted.style.color = state.wanted > 0 ? '#ffd23a' : '#888';
      const spd = state.player.inCar ? Math.abs(state.player.inCar.speed) * 3.6 : state.player.speed * 3.6;
      els.speed.textContent = Math.round(spd) + ' km/h' + (state.player.inCar ? '  •  ' + (state.player.inCar.health > 0 ? 'CAR' : '') : '  •  ON FOOT');
      const m = S.Missions.currentMission(state), st = S.Missions.currentStage(state);
      els.objective.textContent = m ? ('MISSION ' + m.id + ' — ' + m.title + ' ($' + m.reward + '): ' + (st ? st.text : '')) + (state.missionDist != null && st && st.type === 'goto' ? '  •  ' + state.missionDist + 'm' : '')
        : 'All missions complete — free roam Solmar Bay!';
      if (state.feed.length !== lastFeedLen) {
        lastFeedLen = state.feed.length;
        els.feed.innerHTML = state.feed.slice(-5).map((f) => '<div>' + f.replace(/</g, '&lt;') + '</div>').join('');
      }
      els.dialogue.style.display = state.dialogueT > 0 ? 'block' : 'none';
      if (state.dialogueT > 0) els.dialogue.textContent = state.dialogue;
      els.save.textContent = state.lastSave ? ('Saved ' + state.lastSave) : (S.Save.has() ? 'Save found' : 'Autosave on');
      const t = state.clock; els.time.textContent = 'DAY 1  •  ' + String(Math.floor(t / 3600) + 9).padStart(2, '0') + ':' + String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    }
    return { update };
  }
  S.HUD = { initHUD };
})();
