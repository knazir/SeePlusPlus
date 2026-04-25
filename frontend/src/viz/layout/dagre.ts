// Dagre-backed layout. Sync internally; doesn't route edges. The greedy
// acyclicer is required because heap graphs regularly contain cycles
// (doubly-linked lists, back-pointers); without it the layout would
// throw on those structures.
import dagre from '@dagrejs/dagre';
import { collectPointers } from '../reachability';
import {
  DENSITY_SPACING,
  type LayoutEngine,
  type LayoutInput,
  type LayoutResult,
  type NodePosition,
} from './types';

async function layout({ entries, sizes, density }: LayoutInput): Promise<LayoutResult> {
  const positions = new Map<string, NodePosition>();
  const centers = new Map<string, { x: number; y: number }>();
  if (entries.length === 0) return { positions, centers, width: 0, height: 0 };

  const { nodesep, ranksep } = DENSITY_SPACING[density];

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
      if (target === addr) continue; // no self-loops
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
    const x = n.x - n.width / 2;
    const y = n.y - n.height / 2;
    positions.set(addr, { x, y });
    centers.set(addr, { x: n.x, y: n.y });
    maxRight = Math.max(maxRight, x + n.width);
    maxBottom = Math.max(maxBottom, y + n.height);
  }

  return { positions, centers, width: maxRight, height: maxBottom };
}

export const dagreEngine: LayoutEngine = { name: 'dagre', layout };
