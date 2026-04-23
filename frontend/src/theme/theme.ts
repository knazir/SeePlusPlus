/**
 * Theme preferences are one of three states:
 *   - 'dark'   — pin to dark, regardless of OS.
 *   - 'light'  — pin to light, regardless of OS.
 *   - 'system' — follow prefers-color-scheme, re-resolve on OS change.
 *
 * The *resolved* theme (what's actually applied to the DOM) is always 'dark'
 * or 'light'. The selector `html[data-theme='light']` is the switch.
 *
 * This module intentionally has no React; it's called from a small inline
 * script in index.html BEFORE React mounts (for FOUC prevention) and then
 * again by the React-side useTheme() hook to stay in sync.
 */
export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const STORAGE_KEY = 'spp.theme';
export const DATA_ATTR = 'data-theme';
export const PREFERS_LIGHT_MQ = '(prefers-color-scheme: light)';

export function readStoredPreference(storage: Storage | null = safeStorage()): ThemePreference {
  if (!storage) return 'system';
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  return 'system';
}

export function resolvePreference(
  pref: ThemePreference,
  mq: MediaQueryList | null = safeMatchMedia(PREFERS_LIGHT_MQ),
): ResolvedTheme {
  if (pref === 'dark' || pref === 'light') return pref;
  return mq?.matches ? 'light' : 'dark';
}

export function applyTheme(resolved: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.setAttribute(DATA_ATTR, resolved);
}

export function persistPreference(pref: ThemePreference, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, pref);
  } catch {
    // private-mode / quota errors are non-fatal — the preference just won't persist.
  }
}

/** Cycle order matches what the topbar toggle steps through. */
export function nextPreference(pref: ThemePreference): ThemePreference {
  if (pref === 'dark') return 'light';
  if (pref === 'light') return 'system';
  return 'dark';
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function safeMatchMedia(query: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null;
  } catch {
    return null;
  }
}
