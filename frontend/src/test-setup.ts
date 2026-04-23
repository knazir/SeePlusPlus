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

// jsdom doesn't implement Element.animate either. Stub returns a minimal
// Animation-ish object so FLIP code paths don't throw during component tests.
// anim/flip.test.ts swaps its own vi.fn() in per test for assertion.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function animateStub() {
    return {
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
      finished: Promise.resolve(),
    } as unknown as Animation;
  };
}
