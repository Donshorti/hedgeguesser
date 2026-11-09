export const PREFIX = 'hg:v1:';

export function load(key, fallback) {
  let raw;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    return fallback;
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    remove(key);
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable */
  }
}

/** Remove every HedgeGuesser key (Settings → Reset all data). */
export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
