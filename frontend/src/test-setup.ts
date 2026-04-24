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

// Element.getAnimations is also missing in jsdom. FLIP's settleAnimations
// helper calls it on every captureRects / playFlip to cancel any mid-flight
// transform so measurements reflect settled layout. Empty array is fine for
// tests — they don't actually run animations through jsdom.
if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations !== 'function') {
  Element.prototype.getAnimations = function getAnimationsStub() {
    return [];
  };
}

// CodeMirror's layer/measurement code calls Range.getClientRects to position
// decorations. jsdom doesn't implement it; the shim just returns empty
// geometry, which is fine because tests only assert DOM structure, not pixel
// positions.
if (typeof Range !== 'undefined' && typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = function () {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function () {
    return { bottom: 0, top: 0, left: 0, right: 0, height: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
}
