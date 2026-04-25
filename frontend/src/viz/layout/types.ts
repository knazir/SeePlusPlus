// Shared types for heap-layout engines. The same shape is produced by both
// the dagre and ELK implementations so the rest of the app (HeapGraph,
// EdgeLayer) doesn't know which engine ran. ELK additionally fills in
// `edges` with routed polylines; dagre leaves it absent and EdgeLayer
// falls back to its geometry-based routing.

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

/** User-facing heap spacing preset. */
export type HeapDensity = 'dense' | 'normal' | 'airy';

export interface LayoutInput {
  /** Ordered [addr, block] pairs currently on the heap. */
  entries: ReadonlyArray<readonly [string, unknown]>;
  /** Measured (width, height) per heap addr. Missing entries are skipped. */
  sizes: ReadonlyMap<string, NodeSize>;
  /** Spacing preset. */
  density: HeapDensity;
}

/** A single edge as routed by a layout-aware engine. Coordinates are in
 *  the same world space as `LayoutResult.positions`. */
export interface RoutedLayoutEdge {
  source: string;
  target: string;
  /** Polyline points; first point is the exit anchor on the source, last
   *  is the entry anchor on the target. May contain bend points in
   *  between. */
  points: ReadonlyArray<{ x: number; y: number }>;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  /** Per-node center positions — stable across FLIP animations because
   *  they're computed at layout time, not from interpolating DOM rects. */
  centers: Map<string, { x: number; y: number }>;
  /** Bounding box of all positioned nodes (including their sizes). */
  width: number;
  height: number;
  /** Per-edge polylines from layout-aware engines (ELK). Keyed by
   *  `${source}->${target}`. Absent for engines that don't route edges
   *  (dagre); EdgeLayer falls back to geometry routing in that case. */
  edges?: Map<string, RoutedLayoutEdge>;
}

/** Common interface every heap-layout engine implements. Async because
 *  ELK runs in a Web Worker (the dagre engine wraps its sync result as
 *  a resolved Promise, paying the cost of the seam for the architecture
 *  win). */
export interface LayoutEngine {
  readonly name: 'dagre' | 'elk';
  layout(input: LayoutInput): Promise<LayoutResult>;
}

export const DENSITY_SPACING: Record<HeapDensity, { nodesep: number; ranksep: number }> = {
  dense: { nodesep: 12, ranksep: 16 },
  normal: { nodesep: 24, ranksep: 32 },
  airy: { nodesep: 40, ranksep: 56 },
};
