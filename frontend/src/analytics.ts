// Thin gtag wrapper. Call sites use `track(name, params?)`; missing or
// unloaded gtag is a silent no-op so analytics is never load-bearing on
// any code path.

type GtagFn = (
  cmd: string,
  name: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

export function track(name: string, params?: Record<string, unknown>): void {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // gtag must never throw out of a track call.
  }
}
