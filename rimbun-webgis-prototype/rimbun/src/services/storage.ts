import { SITE } from '../config/site';

/** localStorage wrapper that never throws (private mode, sandboxed frames, quota). */
export function loadState<T>(fallback: T): T {
  try {
    const raw = window.localStorage.getItem(SITE.storageKey);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveState(value: unknown) {
  try {
    window.localStorage.setItem(SITE.storageKey, JSON.stringify(value));
  } catch {
    /* storage unavailable — prototype keeps working in memory */
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(SITE.storageKey);
  } catch {
    /* ignore */
  }
}
