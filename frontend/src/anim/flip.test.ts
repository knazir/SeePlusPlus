import { describe, expect, it, vi } from 'vitest';
import { captureRects, computeDelta, playEnter, playFlip } from './flip';

// jsdom doesn't implement Element.animate. We stub it via a spy and assert
// playFlip/playEnter call it with the expected keyframes + options. This is
// the only meaningful unit-testable surface of the FLIP module; the actual
// visual behavior is covered by Playwright MCP walkthroughs.
function rect(left: number, top: number, width = 10, height = 10): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function fakeEl(r: DOMRect): { el: HTMLElement; animate: ReturnType<typeof vi.fn> } {
  const animate = vi.fn();
  const el = {
    getBoundingClientRect: () => r,
    animate,
  } as unknown as HTMLElement;
  return { el, animate };
}

describe('captureRects / computeDelta', () => {
  it('snapshots rect per key', () => {
    const a = fakeEl(rect(10, 20));
    const b = fakeEl(rect(30, 40));
    const rects = captureRects(new Map([['a', a.el], ['b', b.el]]));
    expect(rects.get('a')!.left).toBe(10);
    expect(rects.get('b')!.top).toBe(40);
  });

  it('computeDelta gives prev-minus-curr (so inverse transform points back to old)', () => {
    const prev = rect(100, 50);
    const curr = rect(10, 5);
    expect(computeDelta(prev, curr)).toEqual({ dx: 90, dy: 45 });
  });
});

describe('playFlip', () => {
  it('animates a persisting element that moved', () => {
    const { el, animate } = fakeEl(rect(0, 0));
    playFlip(new Map([['k', rect(50, 20)]]), new Map([['k', el]]));
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, opts] = animate.mock.calls[0]!;
    expect(keyframes).toEqual([
      { transform: 'translate(50px, 20px)' },
      { transform: 'translate(0, 0)' },
    ]);
    expect(opts.duration).toBe(520);
    expect(opts.easing).toBe('cubic-bezier(0.22, 0.61, 0.36, 1)');
  });

  it('skips elements with zero delta (no unnecessary animations)', () => {
    const { el, animate } = fakeEl(rect(42, 42));
    playFlip(new Map([['k', rect(42, 42)]]), new Map([['k', el]]));
    expect(animate).not.toHaveBeenCalled();
  });

  it('skips elements not in the prev-rects map (they are new; caller plays enter instead)', () => {
    const { el, animate } = fakeEl(rect(0, 0));
    playFlip(new Map(), new Map([['newKey', el]]));
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('playEnter', () => {
  it('animates a new element with opacity+scale keyframes', () => {
    const animate = vi.fn();
    const el = { animate } as unknown as HTMLElement;
    playEnter(el);
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, opts] = animate.mock.calls[0]!;
    expect(keyframes[0]).toMatchObject({ opacity: 0 });
    expect(keyframes[1]).toMatchObject({ opacity: 1 });
    expect(opts.duration).toBe(360);
  });
});
