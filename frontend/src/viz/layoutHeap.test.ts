import { describe, expect, it } from 'vitest';
import { layoutHeap } from './layoutHeap';

// Minimal C_STRUCT shape that collectPointers knows how to walk.
function nodeWithNext(addr: string, next: string | null): readonly unknown[] {
  const nextVal = next ?? '0x0';
  return [
    'C_STRUCT',
    addr,
    'Node',
    ['value', ['C_DATA', addr + '.value', 'int', 1]],
    ['next', ['C_DATA', addr + '.next', 'pointer', nextVal]],
  ] as const;
}

const SIZE = new Map([
  ['0xa', { w: 120, h: 40 }],
  ['0xb', { w: 120, h: 40 }],
  ['0xc', { w: 120, h: 40 }],
]);

describe('layoutHeap', () => {
  it('returns an empty layout for an empty heap', async () => {
    const layout = await layoutHeap([], new Map());
    expect(layout.positions.size).toBe(0);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it('lays out a straight linked list so targets sit below sources', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xb')],
      ['0xb', nodeWithNext('0xb', '0xc')],
      ['0xc', nodeWithNext('0xc', null)],
    ];
    const { positions } = await layoutHeap(entries, SIZE);
    expect(positions.size).toBe(3);
    const a = positions.get('0xa')!;
    const b = positions.get('0xb')!;
    const c = positions.get('0xc')!;
    expect(b.y).toBeGreaterThan(a.y);
    expect(c.y).toBeGreaterThan(b.y);
  });

  it('does not throw on a cycle', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xb')],
      ['0xb', nodeWithNext('0xb', '0xa')],
    ];
    const { positions } = await layoutHeap(entries, SIZE);
    expect(positions.size).toBe(2);
  });

  it('skips entries missing from the sizes map without failing', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xb')],
      ['0xb', nodeWithNext('0xb', null)],
    ];
    const sizes = new Map([['0xa', { w: 120, h: 40 }]]);
    const { positions } = await layoutHeap(entries, sizes);
    expect(positions.has('0xa')).toBe(true);
    expect(positions.has('0xb')).toBe(false);
  });

  it('ignores edges whose target is not in the heap entries (e.g. dangling pointer)', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xffff')],
    ];
    const { positions } = await layoutHeap(entries, SIZE);
    expect(positions.size).toBe(1);
  });

  it('reports a bounding box that covers every positioned node', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xb')],
      ['0xb', nodeWithNext('0xb', null)],
    ];
    const { positions, width, height } = await layoutHeap(entries, SIZE);
    for (const { x, y } of positions.values()) {
      expect(x + 120).toBeLessThanOrEqual(width + 0.001);
      expect(y + 40).toBeLessThanOrEqual(height + 0.001);
    }
  });

  it('returns routed edge polylines for each heap-to-heap pointer', async () => {
    const entries: Array<[string, unknown]> = [
      ['0xa', nodeWithNext('0xa', '0xb')],
      ['0xb', nodeWithNext('0xb', null)],
    ];
    const { edges } = await layoutHeap(entries, SIZE);
    expect(edges.size).toBe(1);
    const edge = edges.get('0xa->0xb');
    expect(edge).toBeDefined();
    expect(edge!.points.length).toBeGreaterThanOrEqual(2);
  });
});
