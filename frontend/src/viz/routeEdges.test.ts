import { describe, it, expect } from 'vitest';
import { routeEdges, type EdgeSample, type MeasuredRect } from './routeEdges';

function rect(left: number, top: number, w: number, h: number): MeasuredRect {
  return { left, top, right: left + w, bottom: top + h, width: w, height: h };
}

function sample(args: Partial<EdgeSample> & Pick<EdgeSample, 'key' | 'target' | 'chip' | 'targetEl'>): EdgeSample {
  return {
    kind: 'pointer',
    sourceAddr: null,
    sourceCard: null,
    ...args,
  };
}

describe('routeEdges — pass 1 (A + D): anchor side selection', () => {
  it('stack chip targeting heap to the right exits chip.right and enters target.left', () => {
    const e = sample({
      key: 'stk-0',
      target: '0xAAA',
      chip: rect(100, 100, 60, 16),    // stack chip at x ~ 100..160
      targetEl: rect(400, 80, 200, 60), // heap card far to the right
    });
    const [out] = routeEdges([e]);
    expect(out!.sourceSide).toBe('right');
    expect(out!.targetSide).toBe('left');
    expect(out!.x1).toBe(160); // chip.right
    expect(out!.x2).toBe(400); // target.left
  });

  it('heap chip targeting card on the LEFT exits chip.left (avoids sweeping around the source card)', () => {
    // Source card: a heap node at x=400..600. Chip is in its rightmost
    // column at x=540..590. Target is to the LEFT at x=100..200.
    const e = sample({
      key: 'h-0',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 200, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(100, 250, 200, 80),
    });
    const [out] = routeEdges([e]);
    // Card center is 500; target center is 200 — target is left of card.
    expect(out!.sourceSide).toBe('left');
    // Target on the left of source ⇒ enter from target's right side
    // (the side closer to the source).
    expect(out!.targetSide).toBe('right');
    expect(out!.x1).toBe(540); // chip.left, NOT card.left
    expect(out!.x2).toBe(300); // target.right
  });

  it('heap chip targeting card on the RIGHT exits chip.right (the natural side)', () => {
    const e = sample({
      key: 'h-1',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(140, 200, 50, 16),     // chip on the right of a small card
      sourceCard: rect(50, 180, 150, 100),
      targetEl: rect(400, 250, 200, 80),
    });
    const [out] = routeEdges([e]);
    expect(out!.sourceSide).toBe('right');
    expect(out!.targetSide).toBe('left');
    expect(out!.x1).toBe(190); // chip.right
    expect(out!.x2).toBe(400); // target.left
  });

  it('layoutCenters override DOM-rect centers for stable side selection during animations', () => {
    // DOM rects say target is to the LEFT of the source (mid-FLIP), but
    // layoutCenters say it's still to the RIGHT (the target it's animating
    // toward). Side must follow the layout, not the transient rect.
    const e = sample({
      key: 'h-2',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 200, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(100, 250, 200, 80), // currently to the left (mid-FLIP)
    });
    const layoutCenters = new Map([
      ['0xAAA', { x: 500, y: 230 }],
      ['0xBBB', { x: 800, y: 290 }], // layout says target is to the right
    ]);
    const [out] = routeEdges([e], { layoutCenters });
    expect(out!.sourceSide).toBe('right');
    expect(out!.targetSide).toBe('left');
  });
});

describe('routeEdges — pass 2 (B + C): per-(target, side) port distribution', () => {
  it('spreads N arrows arriving at the same target+side along the target side', () => {
    const tgt = rect(400, 200, 200, 120); // target.left = 400, top=200, bot=320
    const samples: EdgeSample[] = [
      sample({ key: 'a', target: '0xT', chip: rect(100, 220, 50, 16), targetEl: tgt }),
      sample({ key: 'b', target: '0xT', chip: rect(100, 260, 50, 16), targetEl: tgt }),
      sample({ key: 'c', target: '0xT', chip: rect(100, 300, 50, 16), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    // All arrive on the LEFT of the target (sources are to the left).
    expect(out.every((e) => e.targetSide === 'left')).toBe(true);
    expect(out.every((e) => e.x2 === 400)).toBe(true);

    // Endpoints distributed within target.top + margin and target.bottom - margin.
    // margin = min(8, height/4) = 8 here. Effective range = [208, 312].
    const ys = out.map((e) => e.y2).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(208);
    expect(ys[1]).toBeCloseTo(260);
    expect(ys[2]).toBeCloseTo(312);
    // Each is distinct.
    expect(new Set(ys).size).toBe(3);
  });

  it('does not redistribute a singleton group', () => {
    const tgt = rect(400, 200, 200, 120);
    const e = sample({ key: 'solo', target: '0xT', chip: rect(100, 250, 50, 16), targetEl: tgt });
    const [out] = routeEdges([e]);
    // Singleton: y2 stays at target's vertical center.
    expect(out!.y2).toBe(260);
  });

  it('groups by target SIDE — same target but different sides do not redistribute together', () => {
    const tgt = rect(400, 200, 200, 120);
    const samples: EdgeSample[] = [
      // Two arrivals on the LEFT side from sources on the left.
      sample({ key: 'a', target: '0xT', chip: rect(100, 220, 50, 16), targetEl: tgt }),
      sample({ key: 'b', target: '0xT', chip: rect(100, 290, 50, 16), targetEl: tgt }),
      // One arrival on the RIGHT side from a source on the right of target.
      sample({ key: 'c', target: '0xT', chip: rect(800, 250, 50, 16), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    const a = out.find((e) => e.key === 'a')!;
    const b = out.find((e) => e.key === 'b')!;
    const c = out.find((e) => e.key === 'c')!;

    expect(a.targetSide).toBe('left');
    expect(b.targetSide).toBe('left');
    expect(c.targetSide).toBe('right');
    // Left-side pair distributed; right-side singleton untouched.
    expect(a.y2).not.toBe(b.y2);
    expect(c.y2).toBe(260); // target vertical center
  });

  it('orders distribution by source y so sibling crossings are minimized', () => {
    const tgt = rect(400, 200, 200, 120);
    const samples: EdgeSample[] = [
      // Pass them in shuffled source-y order; output should still be sorted.
      sample({ key: 'mid', target: '0xT', chip: rect(100, 260, 50, 16), targetEl: tgt }),
      sample({ key: 'top', target: '0xT', chip: rect(100, 220, 50, 16), targetEl: tgt }),
      sample({ key: 'bot', target: '0xT', chip: rect(100, 300, 50, 16), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    // The arrow whose chip is highest (top) should arrive at the highest
    // y on the target side; lowest source → lowest target y.
    const top = out.find((e) => e.key === 'top')!;
    const mid = out.find((e) => e.key === 'mid')!;
    const bot = out.find((e) => e.key === 'bot')!;
    expect(top.y2).toBeLessThan(mid.y2);
    expect(mid.y2).toBeLessThan(bot.y2);
  });
});
