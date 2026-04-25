// Heap layout via ELK's `layered` algorithm. ELK lays out nodes AND
// routes heap-to-heap edges in one pass; stack→heap edges are handled
// by the downstream geometry pass in routeEdges.ts.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge } from 'elkjs/lib/elk-api';
import { collectPointers } from './reachability';

export interface NodeSize {
  w: number;
  h: number;
}

export interface NodePosition {
  /** Top-left of the node in world coords, in pixels. */
  x: number;
  y: number;
}

export type HeapDensity = 'dense' | 'normal' | 'airy';

export interface RoutedLayoutEdge {
  source: string;
  target: string;
  /** Polyline points; first is the source exit, last is the target entry. */
  points: ReadonlyArray<{ x: number; y: number }>;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  /** Node centers in the same world space as positions. Stable across
   *  FLIP — caller can pass them to routeEdges as port hints. */
  centers: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  edges: Map<string, RoutedLayoutEdge>;
}

export interface LayoutHeapOptions {
  /** Defaults to 'normal'. */
  density?: HeapDensity;
}

const DENSITY_SPACING: Record<HeapDensity, { nodesep: number; ranksep: number }> = {
  dense: { nodesep: 12, ranksep: 16 },
  normal: { nodesep: 24, ranksep: 32 },
  airy: { nodesep: 40, ranksep: 56 },
};

const elk = new ELK();

export async function layoutHeap(
  entries: ReadonlyArray<readonly [string, unknown]>,
  sizes: ReadonlyMap<string, NodeSize>,
  opts: LayoutHeapOptions = {},
): Promise<LayoutResult> {
  const positions = new Map<string, NodePosition>();
  const centers = new Map<string, { x: number; y: number }>();
  const edges = new Map<string, RoutedLayoutEdge>();
  if (entries.length === 0) return { positions, centers, width: 0, height: 0, edges };

  const { nodesep, ranksep } = DENSITY_SPACING[opts.density ?? 'normal'];

  const addrs = new Set<string>();
  for (const [addr] of entries) addrs.add(addr);

  const children = entries
    .filter(([addr]) => sizes.has(addr))
    .map(([addr]) => ({
      id: addr,
      width: sizes.get(addr)!.w,
      height: sizes.get(addr)!.h,
    }));

  type ElkEdge = { id: string; sources: [string]; targets: [string] };
  const elkEdges: ElkEdge[] = [];
  for (const [addr, block] of entries) {
    if (!sizes.has(addr)) continue;
    const targets = new Set<string>();
    collectPointers(block, targets);
    for (const target of targets) {
      if (target === addr) continue;
      if (!addrs.has(target)) continue;
      if (!sizes.has(target)) continue;
      elkEdges.push({
        id: `${addr}->${target}`,
        sources: [addr],
        targets: [target],
      });
    }
  }

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(nodesep),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ranksep),
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.padding': '[top=8, right=8, bottom=8, left=8]',
    },
    children,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  let maxRight = 0;
  let maxBottom = 0;
  for (const node of result.children ?? []) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    positions.set(node.id, { x, y });
    centers.set(node.id, { x: x + w / 2, y: y + h / 2 });
    maxRight = Math.max(maxRight, x + w);
    maxBottom = Math.max(maxBottom, y + h);
  }

  // ElkExtendedEdge cast: the `layered` algorithm with sources/targets
  // returns edges with `sections`; the base ElkEdge type doesn't surface
  // it, but the runtime shape is guaranteed.
  for (const rawEdge of (result.edges ?? []) as ElkExtendedEdge[]) {
    const section = rawEdge.sections?.[0];
    if (!section) continue;
    const sourceAddr = rawEdge.sources?.[0];
    const targetAddr = rawEdge.targets?.[0];
    if (!sourceAddr || !targetAddr) continue;
    const points: Array<{ x: number; y: number }> = [
      { x: section.startPoint.x, y: section.startPoint.y },
    ];
    for (const bp of section.bendPoints ?? []) {
      points.push({ x: bp.x, y: bp.y });
    }
    points.push({ x: section.endPoint.x, y: section.endPoint.y });
    edges.set(`${sourceAddr}->${targetAddr}`, {
      source: sourceAddr,
      target: targetAddr,
      points,
    });
  }

  return { positions, centers, width: maxRight, height: maxBottom, edges };
}
