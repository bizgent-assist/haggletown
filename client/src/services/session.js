// Sign-in token from wallet sign-in. Kept per browser; a missing or blocked storage just means signing in again.
const KEY = 'haggletown_session';

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
