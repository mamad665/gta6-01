// Save / load progress in localStorage.

const KEY = 'solmar-city-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      health: state.health,
      ammo: state.ammo,
      savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
