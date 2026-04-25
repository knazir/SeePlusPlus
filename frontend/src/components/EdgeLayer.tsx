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
  /** Engine-routed polyline in SVG-container-relative coords. Present when
   *  the active layout engine pre-routes edges; absent otherwise. */
  polyline?: ReadonlyArray<{ x: number; y: number }>;
}

interface Props {
  /** Container whose descendants carry the [data-ptr-target] / [data-heap-addr] attributes. */
  containerRef: RefObject<HTMLElement | null>;
  /** Optional clipping element. Edges whose anchor point falls outside
   *  this element's visible rect (e.g. panned offscreen) are dropped. */
  clipRef?: RefObject<HTMLElement | null>;
}

/**
 * Absolute SVG overlay that draws an arrow from every [data-ptr-target]
 * to its matching [data-heap-addr]. Targets equal to "null" are skipped.
 *
 * Geometry is DOM-dependent, so the work runs in a layout effect with a
 * ResizeObserver + MutationObserver to recompute on changes, plus a short
 * rAF follow during the FLIP window so edges track animating nodes
 * frame-by-frame. Side-selection and port-distribution logic lives in
 * `viz/routeEdges.ts`; EdgeLayer is the DOM-measurement + render shell.
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

    // Coalesce ResizeObserver/MutationObserver signals into one rAF.
    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
      });
    };

    // Track FLIP-animating nodes for the duration of the animation.
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
    // Limit observation to attributes that actually change edge geometry.
    // Hover state and orphan flags are written as data attributes on the
    // observed nodes; an unfiltered subtree observer would treat those as
    // geometry changes and rebuild every edge per mouse-move.
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

/** Catmull-Rom → cubic Bezier smoothing. Visits every waypoint; rounds
 *  the corners. Endpoints are duplicated to zero out boundary tangents. */
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

/** Address → element lookup with priority: heap block > visible stack
 *  local > stack frame containing the address. */
function buildTargetMap(container: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const el of container.querySelectorAll<HTMLElement>('[data-heap-addr]')) {
    const k = el.getAttribute('data-heap-addr');
    if (k && !map.has(k)) map.set(k, el);
  }
  for (const el of container.querySelectorAll<HTMLElement>('[data-stack-addr]')) {
    const k = el.getAttribute('data-stack-addr');
    if (k && !map.has(k)) map.set(k, el);
  }
  // data-stack-contains is a space-separated list of addresses contained
  // by a collapsed stack frame.
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

  // Collect samples from the DOM. We keep the source and target elements
  // alongside the measured rects so the clipping pass below can do
  // contains() checks without having to re-query.
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

  // Obstacles for routing: every heap card and stack frame. routeEdges
  // filters out the source's and target's own rects via the id field.
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

  const routed = routeEdges(
    enriched.map((e) => e.sample),
    { layoutCenters, obstacles },
  );

  // Clip against final routed anchor points (so off-pan edges drop even
  // when part of the card is still visible) and attach engine-routed
  // polylines from the layout when present, prepended with the chip
  // anchor so the path still visibly originates at the chip.
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
        // Engine points are in heap-local world coords; convert to
        // SVG-container-relative.
        const dx = worldOrigin.x - cRect.left;
        const dy = worldOrigin.y - cRect.top;
        const elkPath = elk.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        // Drop polylines whose last point doesn't land inside the
        // current target rect — happens when hints lag a step change.
        const last = elkPath[elkPath.length - 1]!;
        const tgtClient = sample.targetEl;
        const lastClientX = last.x + cRect.left;
        const lastClientY = last.y + cRect.top;
        const TOL = 8;
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
  // Engine polylines arrive as straight segments. Smooth 3+ point paths
  // through their bend points; 2-point polylines fall through to the
  // geometry bezier so straight-segment edges still render as curves.
  if (routing === 'curved' && e.polyline && e.polyline.length >= 3) {
    return smoothPolyline(e.polyline);
  }
  if (routing === 'straight') {
    return `M ${e.x1},${e.y1} L ${e.x2},${e.y2}`;
  }
  if (routing === 'orthogonal') {
    // For top/bottom entries the path exits horizontally before bending
    // vertically; horizontal entries bend through a midX.
    if (e.targetSide === 'top' || e.targetSide === 'bottom') {
      const horizOff = e.sourceSide === 'right' ? 24 : -24;
      const cornerX = e.x1 + horizOff;
      const midY = (e.y1 + e.y2) / 2;
      return `M ${e.x1},${e.y1} L ${cornerX},${e.y1} L ${cornerX},${midY} L ${e.x2},${midY} L ${e.x2},${e.y2}`;
    }
    const midX = e.x1 + (e.x2 - e.x1) / 2;
    return `M ${e.x1},${e.y1} L ${midX},${e.y1} L ${midX},${e.y2} L ${e.x2},${e.y2}`;
  }
  // Cubic bezier. Source handle is always horizontal (chip is a pill);
  // target handle pulls outward from the chosen side so the curve enters
  // from the right direction.
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
