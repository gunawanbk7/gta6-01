// Save / load for Solmar Bay, in localStorage. Stores cash, health, mission
// progress, the player's position and the time of day. Nothing leaves the browser.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      cash: game.cash,
      health: game.player.health,
      missionsCompleted: game.missions.completed,
      x: game.player.inVehicle ? game.player.inVehicle.x : game.player.x,
      z: game.player.inVehicle ? game.player.inVehicle.z : game.player.z,
      timeOfDay: game.timeOfDay,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
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

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
