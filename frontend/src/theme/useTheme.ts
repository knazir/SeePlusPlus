import { useEffect } from 'react';
import { useAppStore } from '../store';
import { applyTheme, PREFERS_LIGHT_MQ, resolvePreference } from './theme';

/**
 * Keeps the DOM's data-theme in sync with the store's themePreference. When
 * the preference is 'system', subscribes to matchMedia so an OS-level flip
 * re-applies the resolved theme live without requiring a page reload.
 *
 * The inline script in index.html does the initial paint-safe apply; this
 * hook is the long-running sync after React mounts.
 */
export function useTheme() {
  const pref = useAppStore((s) => s.themePreference);

  useEffect(() => {
    // Apply the resolved theme once for the current preference.
    applyTheme(resolvePreference(pref));
    if (pref !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mq = window.matchMedia(PREFERS_LIGHT_MQ);
    const onChange = () => applyTheme(resolvePreference('system', mq));

    // Older Safari only supports addListener; modern browsers have addEventListener.
    if ('addEventListener' in mq) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    const legacyMq = mq as MediaQueryList & {
      addListener: (fn: (e: MediaQueryListEvent) => void) => void;
      removeListener: (fn: (e: MediaQueryListEvent) => void) => void;
    };
    legacyMq.addListener(onChange);
    return () => legacyMq.removeListener(onChange);
  }, [pref]);
}
