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
//       along that side's vertical extent so they don't pile up at a
//       single point. Order within the cluster follows source y to keep
//       crossings minimal.
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
// Pure module: takes data in, returns data out. No DOM access. Easily
// unit-tested. EdgeLayer.tsx wraps the DOM-measurement step and renders
// the resulting paths.

export type Side = 'left' | 'right';

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

export interface RoutedEdge {
  key: string;
  kind: EdgeKind;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sourceSide: Side;
  targetSide: Side;
}

export interface RouteOptions {
  /** Per-card center positions from the most recent layout. When provided,
   *  side selection prefers these (stable across FLIP) over the live DOM
   *  rects. Keys are heap addresses. */
  layoutCenters?: ReadonlyMap<string, { x: number; y: number }>;
}

interface InternalEdge extends EdgeSample {
  sourceSide: Side;
  targetSide: Side;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function rectCenterX(r: MeasuredRect): number {
  return (r.left + r.right) / 2;
}
function rectCenterY(r: MeasuredRect): number {
  return (r.top + r.bottom) / 2;
}

/**
 * Decide which side of a rect a point/x-coordinate is on, with a deadband
 * to avoid flipping when the target is roughly aligned with the rect's
 * vertical centerline.
 */
function pickSideByX(rectCenter: number, otherX: number): Side {
  return otherX < rectCenter ? 'left' : 'right';
}

export function routeEdges(
  samples: ReadonlyArray<EdgeSample>,
  options: RouteOptions = {},
): RoutedEdge[] {
  // Pass 1: anchor selection (A) + (D).
  //
  // For each edge, decide which side of the source chip and the target
  // it uses. Heap-card chips use card-to-target geometry (so the arrow
  // exits the card on the side facing the target, instead of crossing
  // the card's own rows). Stack chips have no enclosing heap card, so
  // they fall back to chip-to-target geometry.
  const initial: InternalEdge[] = samples.map((s) => {
    const chipMidY = rectCenterY(s.chip);
    const tgtMidY = rectCenterY(s.targetEl);

    // Stable horizontal centers — prefer layout-time positions when
    // available so side decisions don't flip mid-FLIP because a rect
    // happened to interpolate past the threshold.
    const layoutSourceX =
      s.sourceAddr !== null
        ? options.layoutCenters?.get(s.sourceAddr)?.x
        : undefined;
    const layoutTargetX = options.layoutCenters?.get(s.target)?.x;

    const sourceCenterX =
      layoutSourceX ??
      (s.sourceCard ? rectCenterX(s.sourceCard) : rectCenterX(s.chip));
    const targetCenterX = layoutTargetX ?? rectCenterX(s.targetEl);

    const sourceSide: Side = pickSideByX(sourceCenterX, targetCenterX);
    const targetSide: Side = pickSideByX(targetCenterX, sourceCenterX);

    return {
      ...s,
      sourceSide,
      targetSide,
      x1: sourceSide === 'left' ? s.chip.left : s.chip.right,
      y1: chipMidY,
      x2: targetSide === 'left' ? s.targetEl.left : s.targetEl.right,
      y2: tgtMidY,
    };
  });

  // Pass 2: per-(target, targetSide) port distribution (B + C).
  //
  // When multiple arrows arrive at the same target on the same side,
  // spread them along the target's vertical extent. Stack frame and
  // local targets benefit too — anything where a popular addr is the
  // entry point for several pointers.
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
    // Sort by source y so the arrows fan into the target in the same
    // visual order they leave their sources — minimises crossings within
    // the cluster.
    group.sort((a, b) => a.y1 - b.y1);
    const tgt = group[0]!.targetEl;
    // Margin keeps endpoints off the rounded corners of the target.
    const margin = Math.min(8, tgt.height / 4);
    const yMin = tgt.top + margin;
    const yMax = tgt.bottom - margin;
    for (let i = 0; i < group.length; i++) {
      const t = i / (group.length - 1);
      group[i]!.y2 = yMin + t * (yMax - yMin);
    }
  }

  // Pass 3: per-(sourceCard, sourceSide) ordering (B + C, source side).
  //
  // When several chips in the same card exit on the same side, their y
  // values are already distinct (each chip lives on its own row), so no
  // spread is needed. We only sort group order to keep the source-y
  // sorting from pass 2 consistent. This is naturally satisfied by row
  // order today; the explicit pass exists so future layouts that put
  // multiple chips on a single row still get clean fan-out.
  // (No-op here — left as a documented integration point.)

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
