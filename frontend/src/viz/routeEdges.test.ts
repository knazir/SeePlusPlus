import { describe, it, expect } from 'vitest';
import {
  routeEdges,
  type CardRect,
  type EdgeSample,
  type MeasuredRect,
} from './routeEdges';

function rect(left: number, top: number, w: number, h: number): MeasuredRect {
  return { left, top, right: left + w, bottom: top + h, width: w, height: h };
}
function card(id: string, left: number, top: number, w: number, h: number): CardRect {
  return { id, ...rect(left, top, w, h) };
}

function sample(
  args: Partial<EdgeSample> & Pick<EdgeSample, 'key' | 'target' | 'chip' | 'targetEl'>,
): EdgeSample {
  return {
    kind: 'pointer',
    sourceAddr: null,
    sourceCard: null,
    ...args,
  };
}

describe('routeEdges — pass 1 (A + D): horizontal anchor side selection', () => {
  it('stack chip targeting heap to the right exits chip.right and enters target.left', () => {
    const e = sample({
      key: 'stk-0',
      target: '0xAAA',
      chip: rect(100, 100, 60, 16),
      targetEl: rect(400, 80, 200, 60),
    });
    const [out] = routeEdges([e]);
    expect(out!.sourceSide).toBe('right');
    expect(out!.targetSide).toBe('left');
    expect(out!.x1).toBe(160);
    expect(out!.x2).toBe(400);
  });

  it('heap chip targeting card on the LEFT exits chip.left (avoids sweeping around the source card)', () => {
    const e = sample({
      key: 'h-0',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 200, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(100, 250, 200, 80),
    });
    const [out] = routeEdges([e]);
    expect(out!.sourceSide).toBe('left');
    expect(out!.targetSide).toBe('right');
    expect(out!.x1).toBe(540);
    expect(out!.x2).toBe(300);
  });

  it('layoutCenters override DOM-rect centers for stable side selection during animations', () => {
    const e = sample({
      key: 'h-2',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 200, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(100, 250, 200, 80),
    });
    const layoutCenters = new Map([
      ['0xAAA', { x: 500, y: 230 }],
      ['0xBBB', { x: 800, y: 290 }],
    ]);
    const [out] = routeEdges([e], { layoutCenters });
    expect(out!.sourceSide).toBe('right');
    expect(out!.targetSide).toBe('left');
  });
});

describe('routeEdges — (1): vertical routing with top/bottom target sides', () => {
  it('source above target at near-same x picks targetSide=top', () => {
    // Two heap cards stacked vertically, similar x. Source chip in upper
    // card; target is the lower card.
    const e = sample({
      key: 'v-0',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 220, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(400, 350, 200, 100),
    });
    const [out] = routeEdges([e]);
    expect(out!.targetSide).toBe('top');
    // Anchor lands on target's TOP edge horizontally centered.
    expect(out!.y2).toBe(350);
    expect(out!.x2).toBe(500);
  });

  it('source below target at near-same x picks targetSide=bottom', () => {
    const e = sample({
      key: 'v-1',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 470, 50, 16),
      sourceCard: rect(400, 430, 200, 100),
      targetEl: rect(400, 200, 200, 100),
    });
    const [out] = routeEdges([e]);
    expect(out!.targetSide).toBe('bottom');
    expect(out!.y2).toBe(300);
  });

  it('horizontal-dominant geometry still picks left/right (does not over-trigger top/bottom)', () => {
    const e = sample({
      key: 'h-3',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 200, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      // Target is far to the right; small vertical offset.
      targetEl: rect(900, 220, 200, 100),
    });
    const [out] = routeEdges([e]);
    expect(out!.targetSide).toBe('left');
  });
});

describe('routeEdges — (2): obstacle-aware side selection', () => {
  it('picks an alternative side when the natural path would cross another card', () => {
    // Source above target, mostly column-aligned ⇒ natural is
    // sourceSide=right + targetSide=top. An obstacle sits straddling the
    // chip→target.top straight line (between the source's right edge and
    // the target's top center). Going chip.LEFT routes the segment through
    // a different region of the canvas that avoids the obstacle.
    const obstacles: CardRect[] = [
      card('0xAAA', 400, 100, 100, 80),
      card('0xMID', 460, 230, 60, 100), // sits inside the natural path
      card('0xBBB', 400, 400, 100, 80),
    ];
    const e = sample({
      key: 'obs-0',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(460, 130, 30, 16),
      sourceCard: rect(400, 100, 100, 80),
      targetEl: rect(400, 400, 100, 80),
    });
    const [out] = routeEdges([e], { obstacles });
    // chip.right (490) → target.top (450, 400) crosses 0xMID (x in 460..520).
    // chip.left (460) → target.top (450, 400) skirts the obstacle's right
    // edge. The router should pick the lower-cost path (chip.left).
    expect(out!.sourceSide).toBe('left');
  });

  it('keeps the natural choice when no obstacles are in the way', () => {
    const obstacles: CardRect[] = [
      card('0xAAA', 400, 180, 200, 100),
      card('0xBBB', 400, 460, 200, 100),
    ];
    const e = sample({
      key: 'obs-1',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 220, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(400, 460, 200, 100),
    });
    const [out] = routeEdges([e], { obstacles });
    // No obstacle between source and target → natural top entry.
    expect(out!.targetSide).toBe('top');
  });

  it("does not treat the source's own card or the target's card as obstacles", () => {
    const obstacles: CardRect[] = [
      // Source card and target card included — should be filtered out by
      // the per-edge id-based exclude.
      card('0xAAA', 400, 180, 200, 100),
      card('0xBBB', 400, 460, 200, 100),
    ];
    const e = sample({
      key: 'self',
      target: '0xBBB',
      sourceAddr: '0xAAA',
      chip: rect(540, 220, 50, 16),
      sourceCard: rect(400, 180, 200, 100),
      targetEl: rect(400, 460, 200, 100),
    });
    const [out] = routeEdges([e], { obstacles });
    // If source/target were treated as obstacles, EVERY candidate would
    // cross at least one of them and the algorithm would degenerate.
    // Natural choice survives.
    expect(out!.targetSide).toBe('top');
  });
});

describe('routeEdges — pass 2 (B + C): per-(target, side) port distribution', () => {
  it('spreads N arrows arriving at the same target+side along the target side', () => {
    const tgt = rect(400, 200, 200, 120);
    const samples: EdgeSample[] = [
      sample({ key: 'a', target: '0xT', chip: rect(100, 220, 50, 16), targetEl: tgt }),
      sample({ key: 'b', target: '0xT', chip: rect(100, 260, 50, 16), targetEl: tgt }),
      sample({ key: 'c', target: '0xT', chip: rect(100, 300, 50, 16), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    expect(out.every((e) => e.targetSide === 'left')).toBe(true);
    expect(out.every((e) => e.x2 === 400)).toBe(true);
    const ys = out.map((e) => e.y2).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(208);
    expect(ys[1]).toBeCloseTo(260);
    expect(ys[2]).toBeCloseTo(312);
    expect(new Set(ys).size).toBe(3);
  });

  it('distributes top/bottom-side arrivals along the target horizontal extent', () => {
    const tgt = rect(400, 350, 200, 100);
    // Three sources directly above target at varying x — all enter top.
    const samples: EdgeSample[] = [
      sample({ key: 'a', target: '0xT', chip: rect(420, 200, 30, 16), sourceAddr: 'S1', sourceCard: rect(410, 180, 50, 50), targetEl: tgt }),
      sample({ key: 'b', target: '0xT', chip: rect(490, 200, 30, 16), sourceAddr: 'S2', sourceCard: rect(480, 180, 50, 50), targetEl: tgt }),
      sample({ key: 'c', target: '0xT', chip: rect(560, 200, 30, 16), sourceAddr: 'S3', sourceCard: rect(550, 180, 50, 50), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    expect(out.every((e) => e.targetSide === 'top')).toBe(true);
    const xs = out.map((e) => e.x2).sort((a, b) => a - b);
    expect(new Set(xs).size).toBe(3);
    // All within target.left+margin .. target.right-margin.
    expect(xs[0]).toBeGreaterThanOrEqual(tgt.left);
    expect(xs[xs.length - 1]).toBeLessThanOrEqual(tgt.right);
  });

  it('does not redistribute a singleton group', () => {
    const tgt = rect(400, 200, 200, 120);
    const e = sample({ key: 'solo', target: '0xT', chip: rect(100, 250, 50, 16), targetEl: tgt });
    const [out] = routeEdges([e]);
    expect(out!.y2).toBe(260);
  });

  it('orders distribution by source y so sibling crossings are minimized', () => {
    const tgt = rect(400, 200, 200, 120);
    const samples: EdgeSample[] = [
      sample({ key: 'mid', target: '0xT', chip: rect(100, 260, 50, 16), targetEl: tgt }),
      sample({ key: 'top', target: '0xT', chip: rect(100, 220, 50, 16), targetEl: tgt }),
      sample({ key: 'bot', target: '0xT', chip: rect(100, 300, 50, 16), targetEl: tgt }),
    ];
    const out = routeEdges(samples);
    const top = out.find((e) => e.key === 'top')!;
    const mid = out.find((e) => e.key === 'mid')!;
    const bot = out.find((e) => e.key === 'bot')!;
    expect(top.y2).toBeLessThan(mid.y2);
    expect(mid.y2).toBeLessThan(bot.y2);
  });
});
