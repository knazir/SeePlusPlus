import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAppStore, type PointerRouting } from '../store';
import { FLIP_DURATION, FLIP_FOLLOW_MARGIN } from '../anim/flip';
import { useHover } from '../viz/hoverContext';
import { useLayoutHints, type LayoutHints } from '../viz/layoutHintsContext';
import {
  routeEdges,
  type CardRect,
  type EdgeSample,
  type MeasuredRect,
  type RoutedEdge,
  type Side,
} from '../viz/routeEdges';

interface RenderEdge extends RoutedEdge {
  /** When the active layout engine pre-routes edges (ELK), this carries
   *  the engine's polyline in SVG-container-relative coordinates. The
   *  renderer uses it directly instead of building a bezier. Absent for
   *  dagre, which doesn't route edges. */
  polyline?: ReadonlyArray<{ x: number; y: number }>;
}

interface Props {
  /** The element whose descendants carry the [data-ptr-target] / [data-heap-addr] attributes. */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Optional element whose interior bounds clip the heap. If provided,
   * edges whose source or target lives inside this element and sits
   * outside its visible rect (e.g. panned offscreen) are dropped — we'd
   * rather show no arrow than an arrow pointing into blank space.
   */
  clipRef?: RefObject<HTMLElement | null>;
}

/**
 * Absolute SVG overlay that draws a curved arrow from every [data-ptr-target]
 * span to its matching [data-heap-addr] container. Targets equal to the
 * sentinel "null" are skipped.
 *
 * Geometry is DOM-dependent, so this is a layout-effect side-channel, not a
 * render-time computation. Triggers: ResizeObserver (container), MutationObserver
 * (descendant changes), step/trace change (via deps). For the FLIP window
 * after a step change we run a short rAF loop so edges follow the animating
 * nodes frame-by-frame — getBoundingClientRect reflects the animating
 * transform, so this Just Works.
 *
 * The actual side selection + port distribution logic lives in
 * `viz/routeEdges.ts` (pure, unit-tested). EdgeLayer is the DOM-measurement
 * + render shell around it.
 */
export function EdgeLayer({ containerRef, clipRef }: Props) {
  const [edges, setEdges] = useState<RenderEdge[]>([]);
  const rafRef = useRef<number | null>(null);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const trace = useAppStore((s) => s.trace);
  const routing = useAppStore((s) => s.pointerRouting);
  const { hoveredAddr, setHoveredAddr } = useHover();
  const layoutHintsRef = useLayoutHints();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recompute = () =>
      setEdges(
        computeEdges(
          container,
          clipRef?.current ?? null,
          layoutHintsRef?.current ?? null,
        ),
      );

    // Single-frame recompute — used by the ResizeObserver / MutationObserver
    // subscriptions. Coalesces multiple signals into one rAF.
    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
      });
    };

    // Continuous follow during the FLIP window. Runs for FLIP_DURATION +
    // a small buffer so edges catch the tail end of the eased animation.
    let following = true;
    const followStart = performance.now();
    const follow = () => {
      if (!following) return;
      recompute();
      if (performance.now() - followStart < FLIP_DURATION + FLIP_FOLLOW_MARGIN) {
        rafRef.current = requestAnimationFrame(follow);
      }
    };
    follow();

    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    // Narrow the attribute filter to the attributes that actually change
    // edge geometry (style for left/top from HeapGraph, and the data
    // attributes that select source/target elements). Without the filter,
    // every hover toggle of `data-highlighted` / `data-orphan` re-fires
    // computeEdges + setEdges + a full re-render, which then writes
    // data-highlighted on a path and re-fires the observer — a feedback
    // loop coalesced by rAF but still wasteful and visibly costly on
    // larger heaps.
    const mo = new MutationObserver(schedule);
    mo.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'style',
        'data-heap-addr',
        'data-ptr-target',
        'data-stack-addr',
        'data-stack-contains',
        'data-stack-expanded',
      ],
    });

    return () => {
      following = false;
      ro.disconnect();
      mo.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [containerRef, clipRef, stepIndex, trace, layoutHintsRef]);

  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: 'none' }}
      data-testid="edge-layer"
    >
      <defs>
        <marker
          id="spp-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
        </marker>
      </defs>
      {edges.map((e) => {
        const hot = hoveredAddr === e.target;
        const d = edgePath(e, routing);
        return (
          <g key={e.key} style={{ pointerEvents: 'auto' }}>
            {/* Wide invisible hit-region so hovering the edge is forgiving */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              onMouseEnter={() => setHoveredAddr(e.target)}
              onMouseLeave={() => setHoveredAddr(null)}
            />
            <path
              d={d}
              data-ptr-kind={e.kind}
              data-highlighted={hot || undefined}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={hot ? 2 : 1.25}
              strokeDasharray={e.kind === 'ref' ? '4 3' : undefined}
              markerEnd="url(#spp-arrow)"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Catmull-Rom-to-cubic-Bezier smoothing through a polyline. Each input
 * point is preserved exactly (the path visits them in order); the corners
 * between segments are rounded off. Boundary tangents are zero (we
 * duplicate endpoints) so the path enters and leaves the first/last
 * waypoint cleanly without overshoot.
 */
function smoothPolyline(pts: ReadonlyArray<{ x: number; y: number }>): string {
  let d = `M ${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? pts[i + 1]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * Build an address → element lookup map from a single tree walk, with the
 * priority order: heap block > visible stack local > stack frame containing
 * the address. Lower-priority entries don't overwrite higher-priority ones.
 * Replaces three querySelector calls per pointer (was O(N×3 walks)) with
 * one walk per render cycle.
 */
function buildTargetMap(container: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  // Pass 1: heap blocks (highest priority).
  for (const el of container.querySelectorAll<HTMLElement>('[data-heap-addr]')) {
    const k = el.getAttribute('data-heap-addr');
    if (k && !map.has(k)) map.set(k, el);
  }
  // Pass 2: stack locals — only fill in addresses we don't already have.
  for (const el of container.querySelectorAll<HTMLElement>('[data-stack-addr]')) {
    const k = el.getAttribute('data-stack-addr');
    if (k && !map.has(k)) map.set(k, el);
  }
  // Pass 3: collapsed stack frames containing the target. data-stack-contains
  // is a space-separated list, so we expand each value to its constituents.
  for (const el of container.querySelectorAll<HTMLElement>('[data-stack-contains]')) {
    const list = el.getAttribute('data-stack-contains');
    if (!list) continue;
    for (const k of list.split(/\s+/)) {
      if (k && !map.has(k)) map.set(k, el);
    }
  }
  return map;
}

function toMeasured(r: DOMRect): MeasuredRect {
  return {
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

interface SampleWithEls {
  sample: EdgeSample;
  sourceEl: HTMLElement;
  targetEl: HTMLElement;
}

function computeEdges(
  container: HTMLElement,
  clip: HTMLElement | null,
  hints: LayoutHints | null,
): RenderEdge[] {
  const cRect = container.getBoundingClientRect();
  const clipRect = clip?.getBoundingClientRect() ?? null;
  const ptrs = Array.from(
    container.querySelectorAll<HTMLElement>('[data-ptr-target]'),
  );
  const targetMap = buildTargetMap(container);
  const layoutCenters = hints?.centers;
  const layoutEdges = hints?.edges;
  const worldOrigin = hints?.worldOrigin;

  // Phase 1: collect EdgeSamples from the DOM. Pure measurement only — no
  // routing decisions here, that's routeEdges' job. We keep the source/
  // target HTMLElements alongside the samples so the post-routing clip
  // pass can ask DOM "is this inside the clip container?" without
  // muddying the pure module's input shape.
  const enriched: SampleWithEls[] = [];
  for (let i = 0; i < ptrs.length; i++) {
    const p = ptrs[i]!;
    const target = p.getAttribute('data-ptr-target');
    if (!target || target === 'null') continue;
    const targetEl = targetMap.get(target);
    if (!targetEl) continue;
    const kind: EdgeSample['kind'] = p.getAttribute('data-ptr-kind') === 'ref' ? 'ref' : 'pointer';
    const sourceCardEl = p.closest<HTMLElement>('[data-heap-addr]');
    const sourceAddr = sourceCardEl?.getAttribute('data-heap-addr') ?? null;
    enriched.push({
      sourceEl: p,
      targetEl,
      sample: {
        key: `${i}:${target}`,
        kind,
        target,
        sourceAddr,
        chip: toMeasured(p.getBoundingClientRect()),
        sourceCard: sourceCardEl ? toMeasured(sourceCardEl.getBoundingClientRect()) : null,
        targetEl: toMeasured(targetEl.getBoundingClientRect()),
      },
    });
  }

  // Collect obstacle rects: every heap card and stack frame the routing
  // pass should avoid crossing. Per-edge filtering of source/target is
  // handled inside routeEdges via the id field, so we pass the full set.
  const obstacles: CardRect[] = [];
  for (const el of container.querySelectorAll<HTMLElement>('[data-heap-addr]')) {
    const id = el.getAttribute('data-heap-addr');
    if (!id) continue;
    obstacles.push({ id, ...toMeasured(el.getBoundingClientRect()) });
  }
  for (const el of container.querySelectorAll<HTMLElement>('[data-stack-frame-id]')) {
    const id = el.getAttribute('data-stack-frame-id');
    if (!id) continue;
    obstacles.push({ id, ...toMeasured(el.getBoundingClientRect()) });
  }

  // Phase 2: pure routing pass — chip-side / target-side / port distribution
  // / obstacle-aware fallback.
  const routed = routeEdges(
    enriched.map((e) => e.sample),
    { layoutCenters, obstacles },
  );

  // Phase 3: clipping + container-relative coordinate translation. Clipping
  // happens against the FINAL routed anchor points so off-pan edges drop
  // even though part of the card may still be visible.
  //
  // ELK enrichment: when the active layout engine routes edges (ELK fills
  // `layoutEdges`), we attach the engine's polyline to each edge so the
  // renderer can draw it directly instead of synthesizing a bezier. The
  // chip remains visibly the source — we prepend the chip's anchor as the
  // first polyline point so the path starts AT the chip, then follows
  // ELK's routed channels through the canvas.
  const out: RenderEdge[] = [];
  for (let idx = 0; idx < routed.length; idx++) {
    const r = routed[idx]!;
    const { sourceEl, targetEl, sample } = enriched[idx]!;
    if (clip && clipRect) {
      if (clip.contains(sourceEl) && !pointInRect(r.x1, r.y1, clipRect)) continue;
      if (clip.contains(targetEl) && !pointInRect(r.x2, r.y2, clipRect)) continue;
    }

    let polyline: ReadonlyArray<{ x: number; y: number }> | undefined;
    if (layoutEdges && worldOrigin && sample.sourceAddr !== null) {
      const elk = layoutEdges.get(`${sample.sourceAddr}->${sample.target}`);
      if (elk) {
        // ELK's points are in world coords (heap-graph-local, top-left
        // origin). Convert to SVG-container-relative.
        const dx = worldOrigin.x - cRect.left;
        const dy = worldOrigin.y - cRect.top;
        const elkPath = elk.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        // Sanity-check: the polyline's last point should land somewhere
        // inside the target's current bounding rect. If it doesn't, the
        // hints are stale (mid-step transition before the new layout has
        // published) and we drop them — geometry routing draws a
        // correct-but-plain bezier in the meantime.
        const last = elkPath[elkPath.length - 1]!;
        const tgtClient = sample.targetEl;
        const lastClientX = last.x + cRect.left;
        const lastClientY = last.y + cRect.top;
        const TOL = 8; // small margin for rounding / engine off-by-ones
        const inside =
          lastClientX >= tgtClient.left - TOL &&
          lastClientX <= tgtClient.right + TOL &&
          lastClientY >= tgtClient.top - TOL &&
          lastClientY <= tgtClient.bottom + TOL;
        if (inside) {
          polyline = [
            { x: r.x1 - cRect.left, y: r.y1 - cRect.top },
            ...elkPath.slice(1),
          ];
        }
      }
    }

    out.push({
      ...r,
      x1: r.x1 - cRect.left,
      y1: r.y1 - cRect.top,
      x2: r.x2 - cRect.left,
      y2: r.y2 - cRect.top,
      polyline,
    });
  }
  return out;
}

function edgePath(
  e: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    sourceSide: Side;
    targetSide: Side;
    polyline?: ReadonlyArray<{ x: number; y: number }>;
  },
  routing: PointerRouting,
): string {
  // ELK-routed polylines feed into the curved branch — but ELK with
  // `edgeRouting: POLYLINE` returns straight segments, so rendering them
  // verbatim looks like straight lines under "curved." We use ELK's
  // polyline as routing waypoints and smooth them into a curve:
  //   - 2-point polylines (no engine bend) fall through to the geometry
  //     curved-bezier — that knows about chip/target sides and produces
  //     a proper bend even between vertically aligned endpoints.
  //   - 3+ point polylines (ELK actually bent around something) get a
  //     Catmull-Rom-to-cubic-Bezier smoothing that visits each waypoint
  //     while rounding off the corners.
  if (routing === 'curved' && e.polyline && e.polyline.length >= 3) {
    return smoothPolyline(e.polyline);
  }
  if (routing === 'straight') {
    return `M ${e.x1},${e.y1} L ${e.x2},${e.y2}`;
  }
  if (routing === 'orthogonal') {
    // Path shape depends on the target side. Horizontal entries (left/right)
    // bend through a midX; vertical entries (top/bottom) need a different
    // shape — the chip exits horizontally first so the path doesn't graze
    // through the source card, then drops/rises vertically to align with
    // the target column, then enters from above/below.
    if (e.targetSide === 'top' || e.targetSide === 'bottom') {
      const horizOff = e.sourceSide === 'right' ? 24 : -24;
      const cornerX = e.x1 + horizOff;
      const midY = (e.y1 + e.y2) / 2;
      return `M ${e.x1},${e.y1} L ${cornerX},${e.y1} L ${cornerX},${midY} L ${e.x2},${midY} L ${e.x2},${e.y2}`;
    }
    const midX = e.x1 + (e.x2 - e.x1) / 2;
    return `M ${e.x1},${e.y1} L ${midX},${e.y1} L ${midX},${e.y2} L ${e.x2},${e.y2}`;
  }
  // Curved bezier. Control handles pull outward from the chosen side on
  // each endpoint:
  //   sourceSide=right ⇒ c1 to the right of source
  //   sourceSide=left  ⇒ c1 to the left of source
  //   targetSide=left  ⇒ c2 to the left of target  (horizontal approach)
  //   targetSide=right ⇒ c2 to the right of target (horizontal approach)
  //   targetSide=top   ⇒ c2 above target          (vertical approach)
  //   targetSide=bottom⇒ c2 below target          (vertical approach)
  // Source side is always horizontal because chips are horizontal pills.
  const dx = Math.max(24, Math.abs(e.x2 - e.x1) * 0.5);
  const dy = Math.max(24, Math.abs(e.y2 - e.y1) * 0.5);
  const c1x = e.sourceSide === 'right' ? e.x1 + dx : e.x1 - dx;
  const c1y = e.y1;
  let c2x = e.x2;
  let c2y = e.y2;
  switch (e.targetSide) {
    case 'left':
      c2x = e.x2 - dx;
      break;
    case 'right':
      c2x = e.x2 + dx;
      break;
    case 'top':
      c2y = e.y2 - dy;
      break;
    case 'bottom':
      c2y = e.y2 + dy;
      break;
  }
  return `M ${e.x1},${e.y1} C ${c1x},${c1y} ${c2x},${c2y} ${e.x2},${e.y2}`;
}
