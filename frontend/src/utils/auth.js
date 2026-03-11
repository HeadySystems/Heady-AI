// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: frontend/src/utils/auth.js
// LAYER: ui/frontend
// HEADY_BRAND:END

let memoryToken = null;

/**
 * Retrieve admin token from sessionStorage or prompt the user.
 * Stored in sessionStorage (cleared on tab close) — no hardcoded fallback.
 */
export const getToken = () => {
  if (memoryToken) return memoryToken;

  try {
    const stored = sessionStorage.getItem('heady_admin_token');
    if (stored) {
      memoryToken = stored;
      return memoryToken;
    }
  } catch { /* sessionStorage unavailable */ }

  const input = window.prompt('Enter Heady API Key / Admin Token:');
  if (!input || !input.trim()) return '';

  memoryToken = input.trim();

  try {
    sessionStorage.setItem('heady_admin_token', memoryToken);
  } catch { /* silently fail */ }

  return memoryToken;
};

export const clearToken = () => {
  memoryToken = null;
  try { sessionStorage.removeItem('heady_admin_token'); } catch { /* */ }
};

export const hasToken = () => {
  if (memoryToken) return true;
  try { return !!sessionStorage.getItem('heady_admin_token'); } catch { return false; }
};
