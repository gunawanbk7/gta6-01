// Save / load for Solmar Bay, via localStorage. Only plain progress numbers
// and positions are stored — never anything personal.
const SAVE_KEY = 'solmar-bay-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash,
      health: G.player.health,
      missionIndex: G.missions.index,
      wanted: G.wanted,
      px: G.player.pos.x,
      pz: G.player.pos.z,
      pyaw: G.player.yaw,
      completed: G.missions.completed.slice(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage unavailable — nothing to clear */
  }
}
