// FLIP (First/Last/Invert/Play) animation primitives for the heap graph.
//
// Ported from tmp/design-spec/project/src/viz.jsx:186-222 (the design mock's
// working FLIP). The numbers (duration 520ms / enter 360ms / cubic-bezier)
// come from the mock and are the product decision — don't tune them here
// without design review.
//
// This module is intentionally pure DOM. The component owns when to call it;
// this file just knows how to measure and animate.

export const FLIP_DURATION = 520;
export const ENTER_DURATION = 360;
export const FLIP_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
/** Slight buffer added to the rAF-follow window so edges catch the tail end of the animation. */
export const FLIP_FOLLOW_MARGIN = 60;

/** Snapshot every element's layout rect. Caller keys by whatever identity is stable across renders (we use heap addr). */
export function captureRects(els: Map<string, HTMLElement>): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const [key, el] of els) rects.set(key, el.getBoundingClientRect());
  return rects;
}

/** Pixel delta between prev rect and current rect for a given element. */
export interface FlipDelta {
  dx: number;
  dy: number;
}

export function computeDelta(prev: DOMRect, curr: DOMRect): FlipDelta {
  return { dx: prev.left - curr.left, dy: prev.top - curr.top };
}

/**
 * For each key in `currentEls` that also appears in `prevRects`: if the element
 * has moved, animate it from its old position (via inverse transform) back to
 * its new position (identity transform).
 */
export function playFlip(
  prevRects: Map<string, DOMRect>,
  currentEls: Map<string, HTMLElement>,
): void {
  for (const [key, el] of currentEls) {
    const prev = prevRects.get(key);
    if (!prev) continue;
    const { dx, dy } = computeDelta(prev, el.getBoundingClientRect());
    if (dx === 0 && dy === 0) continue;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: FLIP_DURATION, easing: FLIP_EASING, fill: 'both' },
    );
  }
}

/** Entrance animation for a newly-mounted heap node. */
export function playEnter(el: HTMLElement): void {
  el.animate(
    [
      { opacity: 0, transform: 'translate(0, 8px) scale(0.96)' },
      { opacity: 1, transform: 'translate(0, 0) scale(1)' },
    ],
    { duration: ENTER_DURATION, easing: FLIP_EASING, fill: 'both' },
  );
}
