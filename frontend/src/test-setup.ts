import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship ResizeObserver. No-op shim is fine — tests don't verify
// layout coordinates (that's Playwright's job).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
