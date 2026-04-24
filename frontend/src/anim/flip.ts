// FLIP (First/Last/Invert/Play) animation primitives for the heap graph.
//
// Only two animations: move (FLIP) and enter. Exit was attempted and pulled
// out — React unmounts components before useLayoutEffect runs, and the
// ghost-retention machinery needed to animate cards out reliably added
// more complexity than the polish was worth at this stage.

export const FLIP_DURATION = 520;
export const ENTER_DURATION = 360;
export const FLIP_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
/** Slight buffer added to the rAF-follow window so edges catch the tail end of the animation. */
export const FLIP_FOLLOW_MARGIN = 60;
/** Sub-pixel deltas from getBoundingClientRect caused a visible "twitch" on
 *  nodes that were visually stationary between steps. Treat anything under
 *  half a pixel as zero so we skip the animate() call entirely. */
export const FLIP_DELTA_EPSILON = 0.5;

/** Tag on every FLIP-produced animation so settleAnimations cancels only
 *  the translate animations, leaving enter animations running. */
const FLIP_ANIM_ID = 'spp-flip-translate';
export const ENTER_ANIM_ID = 'spp-enter';

/**
 * Cancel any in-flight FLIP translate animation on the given element and
 * wipe its inline transform so subsequent measurements reflect the settled
 * layout geometry (not a mid-animation transform).
 *
 * Why this matters: if step N+1 fires while step N's FLIP is still running,
 * getBoundingClientRect returns a mid-animation transform. Both the
 * "previous" and "current" captures then reflect animated state, and the
 * delta is non-zero even when layout didn't change — that's the jitter.
 *
 * Filtering by FLIP_ANIM_ID keeps enter animations untouched.
 */
function settleAnimations(el: HTMLElement): void {
  if (typeof el.getAnimations !== 'function') return;
  for (const anim of el.getAnimations()) {
    if (anim.id === FLIP_ANIM_ID) anim.cancel();
  }
  if (el.style?.transform) el.style.transform = '';
}

/** Snapshot every element's layout rect, after settling any in-flight FLIP
 *  animations so the rects reflect layout, not a frame of the animation. */
export function captureRects(els: Map<string, HTMLElement>): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const [key, el] of els) {
    settleAnimations(el);
    rects.set(key, el.getBoundingClientRect());
  }
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
    settleAnimations(el);
    const { dx, dy } = computeDelta(prev, el.getBoundingClientRect());
    if (Math.abs(dx) < FLIP_DELTA_EPSILON && Math.abs(dy) < FLIP_DELTA_EPSILON) continue;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: FLIP_DURATION, easing: FLIP_EASING, fill: 'both', id: FLIP_ANIM_ID },
    );
  }
}

/** Entrance animation for a newly-mounted heap node. Applied to the inner
 *  wrapper (see HeapNode) so the outer's layout rect stays untouched and
 *  arrow endpoints from EdgeLayer don't lurch while the card fades in. */
export function playEnter(el: HTMLElement): void {
  el.animate(
    [
      { opacity: 0, transform: 'translate(0, 8px) scale(0.96)' },
      { opacity: 1, transform: 'translate(0, 0) scale(1)' },
    ],
    { duration: ENTER_DURATION, easing: FLIP_EASING, fill: 'both', id: ENTER_ANIM_ID },
  );
}
