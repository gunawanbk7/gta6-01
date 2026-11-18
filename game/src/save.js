// Save / load: localStorage progress (cash, health, mission index, position).
(function () {
  const KEY = window.SB.CONFIG.saveKey;
  window.SB.Save = {
    save(state) {
      try {
        const data = { cash: state.cash, health: state.health, missionIndex: state.missionIndex,
          completed: state.completedMissions, pos: [state.player.pos.x, state.player.pos.z],
          wanted: state.wanted, time: Date.now() };
        localStorage.setItem(KEY, JSON.stringify(data));
        state.lastSave = new Date().toLocaleTimeString();
        return true;
      } catch (e) { return false; }
    },
    load() {
      try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
      catch (e) { return null; }
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
    has() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
  };
})();
