// Pure routing pass for pointer arrows. Takes DOM-measured chip + target
// rectangles and decides:
//
//   (A) which side of the source CHIP each arrow exits — left or right —
//       based on geometry, not field names. The chip stays the visible
//       source of the arrow ("which field owns this pointer is obvious")
//       but we pick the side closer to the target so the arrow doesn't
//       sweep all the way across the source card to reach a target on the
//       opposite side.
//
//   (B) per-(target, target-side) port distribution: when N arrows arrive
//       at the same target on the same side, distribute their endpoints
//       along that side's extent so they don't pile up at a single point.
//
//   (C) edge bundling between card pairs is realised through the same
//       distribution: arrows that share both endpoints (same source card,
//       same target, same target side) get spread along the target side
//       instead of stacking.
//
//   (D) layout-aware port selection: when a `layoutCenters` map is
//       provided (filled by `layoutHeap`), side selection uses the
//       layout's stable card centers rather than DOM rects. That keeps
//       the chosen sides constant across FLIP animations — only the
//       coordinates interpolate, not the routing decision.
//
//   (1) vertical routing: target side is 4-way (left/right/top/bottom).
//       When source and target are roughly column-aligned, the arrow
//       enters the target's TOP or BOTTOM edge instead of forcing a
//       horizontal entry, which avoids the "sweep around the target's
//       width" pattern for stacked heap structures (linked lists).
//
//   (2) obstacle-aware side selection: every (sourceSide × targetSide)
//       combination is scored against the layout's other card rectangles.
//       A path that crosses other cards costs more; the lowest-scoring
//       combination is picked. Falls back to the natural choice when no
//       alternative is meaningfully better.
//
// Pure module: takes data in, returns data out. No DOM access. Easily
// unit-tested. EdgeLayer.tsx wraps the DOM-measurement step and renders
// the resulting paths.

export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface MeasuredRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export type EdgeKind = 'pointer' | 'ref';

export interface EdgeSample {
  /** Stable React/SVG key for the rendered path. */
  key: string;
  kind: EdgeKind;
  /** Target heap address — used to group arrows that share an endpoint. */
  target: string;
  /** Address of the enclosing source card, or null if the chip lives on
   *  the stack (where there's no enclosing heap card). */
  sourceAddr: string | null;
  /** The chip rect — visible source of the arrow. */
  chip: MeasuredRect;
  /** The card rect that contains the chip (heap node). null for stack
   *  chips, where there's no surrounding card to avoid crossing. */
  sourceCard: MeasuredRect | null;
  /** The target element rect (heap card, stack local, or stack frame). */
  targetEl: MeasuredRect;
}

export interface CardRect extends MeasuredRect {
  /** Stable identifier for the card (heap address or similar). Used so
   *  per-edge scoring can skip the source's and target's own rects. */
  id: string;
}

export interface RoutedEdge {
  key: string;
  kind: EdgeKind;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Which side of the chip the arrow exits — chips are horizontal pills,
   *  so source side is constrained to left or right. */
  sourceSide: 'left' | 'right';
  /** Which side of the target rectangle the arrow enters — full 4-way. */
  targetSide: Side;
}

export interface RouteOptions {
  /** Per-card center positions from the most recent layout. When provided,
   *  side selection prefers these (stable across FLIP) over the live DOM
   *  rects. Keys are heap addresses. */
  layoutCenters?: ReadonlyMap<string, { x: number; y: number }>;
  /** Card rectangles arrows should avoid crossing. The source's own and
   *  target's own rects are filtered out per-edge by `id` match. Pass the
   *  full set of cards (heap nodes + stack frames) in any order. */
  obstacles?: ReadonlyArray<CardRect>;
}

interface InternalEdge extends EdgeSample {
  sourceSide: 'left' | 'right';
  targetSide: Side;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Anchor {
  x: number;
  y: number;
}

const SOURCE_SIDES: Array<'left' | 'right'> = ['left', 'right'];
const TARGET_SIDES: Side[] = ['left', 'right', 'top', 'bottom'];

function chipAnchor(chip: MeasuredRect, side: 'left' | 'right'): Anchor {
  return {
    x: side === 'left' ? chip.left : chip.right,
    y: (chip.top + chip.bottom) / 2,
  };
}

function rectAnchor(r: MeasuredRect, side: Side): Anchor {
  switch (side) {
    case 'left':
      return { x: r.left, y: (r.top + r.bottom) / 2 };
    case 'right':
      return { x: r.right, y: (r.top + r.bottom) / 2 };
    case 'top':
      return { x: (r.left + r.right) / 2, y: r.top };
    case 'bottom':
      return { x: (r.left + r.right) / 2, y: r.bottom };
  }
}

/**
 * Liang–Barsky line-clipping test. Returns true if any portion of the
 * segment p0→p1 lies inside the rect.
 */
function segmentIntersectsRect(
  p0: Anchor,
  p1: Anchor,
  r: MeasuredRect,
): boolean {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;
  const checks: ReadonlyArray<readonly [number, number]> = [
    [-dx, p0.x - r.left],
    [dx, r.right - p0.x],
    [-dy, p0.y - r.top],
    [dy, r.bottom - p0.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
    } else if (p < 0) {
      const t = q / p;
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      const t = q / p;
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

/** Natural source side: the chip side facing the target. Ties default to
 *  'right' (the chip's natural exit direction in the current rendering). */
function naturalSourceSide(
  sourceCenterX: number,
  targetCenterX: number,
): 'left' | 'right' {
  if (Math.abs(targetCenterX - sourceCenterX) < 1) return 'right';
  return targetCenterX < sourceCenterX ? 'left' : 'right';
}

/** Natural target side: pick whichever of the target's four sides is on
 *  the dominant axis of the (target → source) vector. Horizontal-dominant
 *  vectors enter through left/right; vertical-dominant through top/bottom.
 *  This is what gives clean tree-edge routing for vertically stacked
 *  cards. Uses caller-provided "stable" centers (layout positions when
 *  available) so the decision doesn't flip mid-FLIP just because a rect
 *  interpolated past the threshold. */
function naturalTargetSide(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): Side {
  const dx = sourceCenter.x - targetCenter.x;
  const dy = sourceCenter.y - targetCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'top' : 'bottom';
}

/** Score for a candidate (sourceSide, targetSide) pair, lower is better:
 *
 *   crosses * 100 + naturalDistance
 *
 * Obstacle crossings always dominate. Among paths with the same number of
 * crossings, "naturalDistance" (number of sides that don't match the
 * natural choice) breaks ties so absent obstacles we always pick the
 * direction-aligned pair. We deliberately don't include path length —
 * a curved bezier doesn't follow a straight line, and natural-side
 * preference already encodes "go toward where the target sits."
 */
function scoreSides(
  sample: EdgeSample,
  sourceSide: 'left' | 'right',
  targetSide: Side,
  obstacles: ReadonlyArray<CardRect>,
  excludeIds: ReadonlySet<string>,
  naturalSourceSide_: 'left' | 'right',
  naturalTargetSide_: Side,
): number {
  const src = chipAnchor(sample.chip, sourceSide);
  const tgt = rectAnchor(sample.targetEl, targetSide);
  let crosses = 0;
  for (const r of obstacles) {
    if (excludeIds.has(r.id)) continue;
    if (segmentIntersectsRect(src, tgt, r)) crosses++;
  }
  let naturalDistance = 0;
  if (sourceSide !== naturalSourceSide_) naturalDistance += 1;
  if (targetSide !== naturalTargetSide_) naturalDistance += 1;
  return crosses * 100 + naturalDistance;
}

export function routeEdges(
  samples: ReadonlyArray<EdgeSample>,
  options: RouteOptions = {},
): RoutedEdge[] {
  const obstacles = options.obstacles ?? [];

  // Pass 1: anchor selection (A) + (1) vertical-side + (2) obstacle-aware.
  const initial: InternalEdge[] = samples.map((s) => {
    // "Stable" source/target points used for direction (= which side is
    // closer / dominant axis). Prefer layout-time card centers when
    // available so decisions don't flip mid-FLIP just because a DOM rect
    // interpolated past a threshold. Fall back to DOM card center, and
    // ultimately the chip's own center for stack chips with no card.
    const layoutSrc =
      s.sourceAddr !== null ? options.layoutCenters?.get(s.sourceAddr) : undefined;
    const layoutTgt = options.layoutCenters?.get(s.target);
    const stableSrc = layoutSrc ?? (s.sourceCard
      ? {
          x: (s.sourceCard.left + s.sourceCard.right) / 2,
          y: (s.sourceCard.top + s.sourceCard.bottom) / 2,
        }
      : {
          x: (s.chip.left + s.chip.right) / 2,
          y: (s.chip.top + s.chip.bottom) / 2,
        });
    const stableTgt = layoutTgt ?? {
      x: (s.targetEl.left + s.targetEl.right) / 2,
      y: (s.targetEl.top + s.targetEl.bottom) / 2,
    };

    const naturalSrc = naturalSourceSide(stableSrc.x, stableTgt.x);
    const naturalTgt = naturalTargetSide(stableSrc, stableTgt);

    // Obstacle-aware selection: score every (source × target) combo and
    // pick the lowest. The natural-side bonus in `scoreSides` keeps the
    // natural pair winning when no alternative is meaningfully better.
    const excludeIds = new Set<string>();
    if (s.sourceAddr !== null) excludeIds.add(s.sourceAddr);
    excludeIds.add(s.target);

    // Stack chips are pinned to chip.right. The address value sits in the
    // rightmost column of the stack-frame row, and the heap is always to
    // the right of the stack pane — leaving from chip.left and doubling
    // back is far more visually confusing than crossing another stack
    // pointer en route. Heap chips keep the adaptive choice because
    // heap-to-heap edges legitimately need either side depending on
    // which way the target sits relative to the source card.
    const sourceSidesToTry: Array<'left' | 'right'> = s.sourceCard
      ? SOURCE_SIDES
      : ['right'];

    let bestSrc: 'left' | 'right' = naturalSrc;
    let bestTgt: Side = naturalTgt;
    let bestScore = Infinity;
    for (const src of sourceSidesToTry) {
      for (const tgt of TARGET_SIDES) {
        const score = scoreSides(
          s,
          src,
          tgt,
          obstacles,
          excludeIds,
          naturalSrc,
          naturalTgt,
        );
        if (score < bestScore) {
          bestScore = score;
          bestSrc = src;
          bestTgt = tgt;
        }
      }
    }

    const srcA = chipAnchor(s.chip, bestSrc);
    const tgtA = rectAnchor(s.targetEl, bestTgt);
    return {
      ...s,
      sourceSide: bestSrc,
      targetSide: bestTgt,
      x1: srcA.x,
      y1: srcA.y,
      x2: tgtA.x,
      y2: tgtA.y,
    };
  });

  // Pass 2: per-(target, targetSide) port distribution (B + C).
  //
  // When multiple arrows arrive at the same target on the same side,
  // spread them along the target's vertical extent (left/right entries)
  // or horizontal extent (top/bottom entries). Prevents pile-up at a
  // single anchor point.
  const targetGroups = new Map<string, InternalEdge[]>();
  for (const e of initial) {
    const key = `${e.target}::${e.targetSide}`;
    let group = targetGroups.get(key);
    if (!group) {
      group = [];
      targetGroups.set(key, group);
    }
    group.push(e);
  }
  for (const group of targetGroups.values()) {
    if (group.length < 2) continue;
    const tgt = group[0]!.targetEl;
    const side = group[0]!.targetSide;
    if (side === 'left' || side === 'right') {
      // Sort by source y so within-cluster crossings are minimised.
      group.sort((a, b) => a.y1 - b.y1);
      const margin = Math.min(8, tgt.height / 4);
      const yMin = tgt.top + margin;
      const yMax = tgt.bottom - margin;
      for (let i = 0; i < group.length; i++) {
        const t = i / (group.length - 1);
        group[i]!.y2 = yMin + t * (yMax - yMin);
      }
    } else {
      // Top/bottom side: distribute across the target's HORIZONTAL extent.
      group.sort((a, b) => a.x1 - b.x1);
      const margin = Math.min(8, tgt.width / 4);
      const xMin = tgt.left + margin;
      const xMax = tgt.right - margin;
      for (let i = 0; i < group.length; i++) {
        const t = i / (group.length - 1);
        group[i]!.x2 = xMin + t * (xMax - xMin);
      }
    }
  }

  return initial.map((e) => ({
    key: e.key,
    kind: e.kind,
    target: e.target,
    x1: e.x1,
    y1: e.y1,
    x2: e.x2,
    y2: e.y2,
    sourceSide: e.sourceSide,
    targetSide: e.targetSide,
  }));
}
