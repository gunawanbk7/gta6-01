// save.js — progress persists in localStorage so a session survives a reload:
// money, finished jobs, the pistol unlock and best stats.
const KEY = 'solmar-bay-save-v1';

export function defaultSave() {
  return {
    money: 250,
    missionsDone: [],
    hasPistol: false,
    cashFound: [],
    faresDone: 0,
    bestMoney: 250,
    muted: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch (e) {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) { /* storage unavailable: play on without saving */ }
}
