import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAppStore, type PointerRouting } from '../store';
import { FLIP_DURATION, FLIP_FOLLOW_MARGIN } from '../anim/flip';
import { useHover } from '../viz/hoverContext';
import { useLayoutHints } from '../viz/layoutHintsContext';
import {
  routeEdges,
  type CardRect,
  type EdgeSample,
  type MeasuredRect,
  type RoutedEdge,
  type Side,
} from '../viz/routeEdges';

interface RenderEdge extends RoutedEdge {
  // Coordinates relative to the SVG container (cRect-relative).
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
          layoutHintsRef?.current.centers,
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
  layoutCenters: ReadonlyMap<string, { x: number; y: number }> | undefined,
): RenderEdge[] {
  const cRect = container.getBoundingClientRect();
  const clipRect = clip?.getBoundingClientRect() ?? null;
  const ptrs = Array.from(
    container.querySelectorAll<HTMLElement>('[data-ptr-target]'),
  );
  const targetMap = buildTargetMap(container);

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
  const out: RenderEdge[] = [];
  for (let idx = 0; idx < routed.length; idx++) {
    const r = routed[idx]!;
    const { sourceEl, targetEl } = enriched[idx]!;
    if (clip && clipRect) {
      if (clip.contains(sourceEl) && !pointInRect(r.x1, r.y1, clipRect)) continue;
      if (clip.contains(targetEl) && !pointInRect(r.x2, r.y2, clipRect)) continue;
    }
    out.push({
      ...r,
      x1: r.x1 - cRect.left,
      y1: r.y1 - cRect.top,
      x2: r.x2 - cRect.left,
      y2: r.y2 - cRect.top,
    });
  }
  return out;
}

function edgePath(
  e: { x1: number; y1: number; x2: number; y2: number; sourceSide: Side; targetSide: Side },
  routing: PointerRouting,
): string {
  if (routing === 'straight') {
    return `M ${e.x1},${e.y1} L ${e.x2},${e.y2}`;
  }
  if (routing === 'orthogonal') {
    // Two right-angle bends through a midpoint. The midpoint x is biased
    // toward the chosen exit/entry sides so the corners face outward
    // instead of folding back through the source/target rects.
    const midX = e.x1 + (e.x2 - e.x1) / 2;
    return `M ${e.x1},${e.y1} L ${midX},${e.y1} L ${midX},${e.y2} L ${e.x2},${e.y2}`;
  }
  // Bezier control points pull outward from the chosen side on each end:
  //   sourceSide=right ⇒ c1 to the right of source (curve flows right out)
  //   sourceSide=left  ⇒ c1 to the left of source (curve flows left out)
  //   targetSide=left  ⇒ c2 to the left of target (approach from outside L)
  //   targetSide=right ⇒ c2 to the right of target (approach from outside R)
  const dx = Math.max(24, Math.abs(e.x2 - e.x1) * 0.5);
  const c1x = e.sourceSide === 'right' ? e.x1 + dx : e.x1 - dx;
  const c2x = e.targetSide === 'left' ? e.x2 - dx : e.x2 + dx;
  return `M ${e.x1},${e.y1} C ${c1x},${e.y1} ${c2x},${e.y2} ${e.x2},${e.y2}`;
}
