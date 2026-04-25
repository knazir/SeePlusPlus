// Shared types for heap-layout engines. Engines may optionally fill in
// the `edges` field with routed polylines; consumers that don't need
// that fall back to their own geometry.

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
  /** Per-node center, in the same world space as positions. Layout-time
   *  values — stable across FLIP animations. */
  centers: Map<string, { x: number; y: number }>;
  /** Bounding box of every positioned node (including its size). */
  width: number;
  height: number;
  /** Routed polylines, keyed by `${source}->${target}`. Optional —
   *  filled by engines that route edges, omitted otherwise. */
  edges?: Map<string, RoutedLayoutEdge>;
}

/** Async by interface so worker-backed engines fit; sync engines wrap
 *  their result as a resolved Promise. */
export interface LayoutEngine {
  readonly name: 'dagre' | 'elk';
  layout(input: LayoutInput): Promise<LayoutResult>;
}

export const DENSITY_SPACING: Record<HeapDensity, { nodesep: number; ranksep: number }> = {
  dense: { nodesep: 12, ranksep: 16 },
  normal: { nodesep: 24, ranksep: 32 },
  airy: { nodesep: 40, ranksep: 56 },
};
