// Heap layout via @dagrejs/dagre. Turns (heap entries + measured card sizes)
// into (addr → {x, y}) top-left coordinates for absolute positioning.
//
// `acyclicer: 'greedy'` is essential — heap graphs regularly contain cycles
// (doubly-linked lists, back-pointers, circular refs). Dagre's greedy
// feedback-arc-set pass reverses a minimal set of edges so the graph can be
// laid out as a DAG, then unreverses them, so cyclic pointers render
// instead of throwing.
//
// Disconnected components (multiple unrelated heap structures at the same
// step) lay out independently and dagre packs them into a single bounding
// box — matches legacy behavior out of the box.
import dagre from '@dagrejs/dagre';
import { collectPointers } from './reachability';

export interface NodeSize {
  w: number;
  h: number;
}

export interface NodePosition {
  /** Top-left x of the node in world coordinates, in pixels. */
  x: number;
  /** Top-left y of the node in world coordinates, in pixels. */
  y: number;
}

export interface HeapLayout {
  positions: Map<string, NodePosition>;
  /** Bounding box of all positioned nodes (including their sizes). */
  width: number;
  height: number;
}

/** User-facing heap spacing preset; maps to dagre's nodesep/ranksep. */
export type HeapDensity = 'dense' | 'normal' | 'airy';

const DENSITY_SPACING: Record<HeapDensity, { nodesep: number; ranksep: number }> = {
  dense: { nodesep: 12, ranksep: 16 },
  normal: { nodesep: 24, ranksep: 32 },
  airy: { nodesep: 40, ranksep: 56 },
};

export interface LayoutHeapOptions {
  /** Spacing preset. Defaults to 'normal'. */
  density?: HeapDensity;
}

/**
 * Compute a top-to-bottom layered layout for a set of heap entries.
 *
 * @param entries  Ordered [addr, block] pairs currently on the heap.
 * @param sizes    Measured (width, height) per heap addr. Missing entries are
 *                 skipped — the caller is responsible for rendering cards
 *                 once so they can be measured before calling this.
 */
export function layoutHeap(
  entries: ReadonlyArray<readonly [string, unknown]>,
  sizes: ReadonlyMap<string, NodeSize>,
  opts: LayoutHeapOptions = {},
): HeapLayout {
  const positions = new Map<string, NodePosition>();
  if (entries.length === 0) return { positions, width: 0, height: 0 };

  const { nodesep, ranksep } = DENSITY_SPACING[opts.density ?? 'normal'];

  const g = new dagre.graphlib.Graph({ directed: true, multigraph: false, compound: false });
  g.setGraph({
    rankdir: 'TB',
    nodesep,
    ranksep,
    marginx: 8,
    marginy: 8,
    acyclicer: 'greedy',
  });
  g.setDefaultEdgeLabel(() => ({}));

  const addrs = new Set<string>();
  for (const [addr] of entries) addrs.add(addr);

  for (const [addr] of entries) {
    const size = sizes.get(addr);
    if (!size) continue;
    g.setNode(addr, { width: size.w, height: size.h });
  }

  for (const [addr, block] of entries) {
    if (!sizes.has(addr)) continue;
    const targets = new Set<string>();
    collectPointers(block, targets);
    for (const target of targets) {
      if (target === addr) continue; // no self-loops — dagre tolerates but they look ugly
      if (!addrs.has(target)) continue;
      if (!sizes.has(target)) continue;
      g.setEdge(addr, target);
    }
  }

  dagre.layout(g);

  let maxRight = 0;
  let maxBottom = 0;
  for (const addr of g.nodes()) {
    const n = g.node(addr);
    if (!n) continue;
    // Dagre gives node centers; convert to top-left.
    const x = n.x - n.width / 2;
    const y = n.y - n.height / 2;
    positions.set(addr, { x, y });
    maxRight = Math.max(maxRight, x + n.width);
    maxBottom = Math.max(maxBottom, y + n.height);
  }

  return { positions, width: maxRight, height: maxBottom };
}
