import { useEffect, useState } from 'react';

/**
 * Returns true while the given media query matches. Used to gate features
 * (e.g. the horizontal editor↔viz splitter) that only make sense at certain
 * viewport sizes. Seeds synchronously from `window.matchMedia` if available
 * so the first render already reflects the right state — no flicker.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
