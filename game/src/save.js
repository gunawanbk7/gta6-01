// Solmar Bay — save/load through localStorage. One job: persist the
// player's cash, mission progress, health and position, and restore them.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      health: state.health,
      ammo: state.ammo,
      pos: state.playerPos ? [state.playerPos.x, state.playerPos.z] : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
