// ELK-backed layout engine. Uses the Eclipse Layout Kernel's `layered`
// algorithm — same family as dagre (top-to-bottom layered DAG) — but with
// integrated edge routing, port assignment, and crossing minimisation.
//
// Why ELK over dagre: dagre lays out nodes; we glue our own edge routing
// on top. ELK does both as one decision, with awareness of channel space
// between layers, so heap-graph spaghetti is much less common. Bundle
// cost is real (~150KB gzipped) but the visualisation ceiling matters
// more than payload for a tool whose entire value is making memory
// legible.
//
// Cycles: ELK's layered algorithm handles cycles via its own cycle-
// breaking pass (default GREEDY) — so circular pointers and doubly-linked
// lists Just Work, mirroring dagre's behaviour.
//
// Async: ELK's bundled build internally uses a Web Worker; the layout
// call returns a Promise. Pure-JS small-graph cases (≤50 nodes) finish
// in <50ms, so the async cost is small. The interface is async-by-default
// either way (see types.ts).
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge } from 'elkjs/lib/elk-api';
import { collectPointers } from '../reachability';
import {
  DENSITY_SPACING,
  type LayoutEngine,
  type LayoutInput,
  type LayoutResult,
  type NodePosition,
  type RoutedLayoutEdge,
} from './types';

const elk = new ELK();

async function layout({ entries, sizes, density }: LayoutInput): Promise<LayoutResult> {
  const positions = new Map<string, NodePosition>();
  const centers = new Map<string, { x: number; y: number }>();
  if (entries.length === 0) return { positions, centers, width: 0, height: 0 };

  const { nodesep, ranksep } = DENSITY_SPACING[density];

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
      // POLYLINE produces straight-segment paths that route around nodes —
      // the visual we want for heap arrows. ORTHOGONAL produces only
      // right angles which can look stiffer; SPLINES is heavier and
      // similar visual to our existing bezier renderer.
      'elk.edgeRouting': 'POLYLINE',
      // Heuristics that improve real-world heap graphs:
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

  // Edge polylines from ELK. The `layered` algorithm with edges fed in as
  // sources/targets returns ElkExtendedEdge results that include `sections`
  // describing the routed polyline. Cast to access the variant fields —
  // the runtime shape is guaranteed by the engine's contract for this
  // algorithm.
  const routedEdges = new Map<string, RoutedLayoutEdge>();
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
    routedEdges.set(`${sourceAddr}->${targetAddr}`, {
      source: sourceAddr,
      target: targetAddr,
      points,
    });
  }

  return {
    positions,
    centers,
    width: maxRight,
    height: maxBottom,
    edges: routedEdges,
  };
}

export const elkEngine: LayoutEngine = { name: 'elk', layout };
