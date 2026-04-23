import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAppStore, type PointerRouting } from '../store';
import { FLIP_DURATION, FLIP_FOLLOW_MARGIN } from '../anim/flip';
import { useHover } from '../viz/hoverContext';

type EdgeKind = 'pointer' | 'ref';

interface Edge {
  key: string;
  kind: EdgeKind;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Props {
  /** The element whose descendants carry the [data-ptr-target] / [data-heap-addr] attributes. */
  containerRef: RefObject<HTMLElement | null>;
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
 */
export function EdgeLayer({ containerRef }: Props) {
  const [edges, setEdges] = useState<Edge[]>([]);
  const rafRef = useRef<number | null>(null);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const trace = useAppStore((s) => s.trace);
  const routing = useAppStore((s) => s.pointerRouting);
  const { hoveredAddr, setHoveredAddr } = useHover();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Single-frame recompute — used by the ResizeObserver / MutationObserver
    // subscriptions. Coalesces multiple signals into one rAF.
    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setEdges(computeEdges(container));
      });
    };

    // Continuous follow during the FLIP window. Runs for FLIP_DURATION +
    // a small buffer so edges catch the tail end of the eased animation.
    let following = true;
    const followStart = performance.now();
    const follow = () => {
      if (!following) return;
      setEdges(computeEdges(container));
      if (performance.now() - followStart < FLIP_DURATION + FLIP_FOLLOW_MARGIN) {
        rafRef.current = requestAnimationFrame(follow);
      }
    };
    follow();

    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    const mo = new MutationObserver(schedule);
    mo.observe(container, { childList: true, subtree: true, attributes: true });

    return () => {
      following = false;
      ro.disconnect();
      mo.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [containerRef, stepIndex, trace]);

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
        return (
          <g key={e.key} style={{ pointerEvents: 'auto' }}>
            {/* Wide invisible hit-region so hovering the edge is forgiving */}
            <path
              d={edgePath(e, routing)}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              onMouseEnter={() => setHoveredAddr(e.target)}
              onMouseLeave={() => setHoveredAddr(null)}
            />
            <path
              d={edgePath(e, routing)}
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

/**
 * Resolve a pointer-target address to a DOM element, in priority order:
 *   1. A heap block with [data-heap-addr="<target>"]
 *   2. A visible stack local with [data-stack-addr="<target>"]
 *      (only rendered when its frame is expanded)
 *   3. A stack frame that contains the target address in its
 *      [data-stack-contains] list (frame collapsed — we draw to the frame)
 * Null when none match (e.g. pointer into data/text segment, or target
 * is outside the currently-rendered step).
 */
function resolveTarget(
  container: HTMLElement,
  target: string,
): HTMLElement | null {
  const escaped = cssEscape(target);
  return (
    container.querySelector<HTMLElement>(`[data-heap-addr="${escaped}"]`) ||
    container.querySelector<HTMLElement>(`[data-stack-addr="${escaped}"]`) ||
    container.querySelector<HTMLElement>(`[data-stack-contains~="${escaped}"]`)
  );
}

function computeEdges(container: HTMLElement): Edge[] {
  const cRect = container.getBoundingClientRect();
  const ptrs = Array.from(container.querySelectorAll<HTMLElement>('[data-ptr-target]'));
  const out: Edge[] = [];
  for (let i = 0; i < ptrs.length; i++) {
    const p = ptrs[i]!;
    const target = p.getAttribute('data-ptr-target');
    if (!target || target === 'null') continue;
    const targetEl = resolveTarget(container, target);
    if (!targetEl) continue;
    const kind = p.getAttribute('data-ptr-kind') === 'ref' ? 'ref' : 'pointer';
    const s = p.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    // Source → its right edge horizontally; target → the nearer vertical
    // edge. For stack targets (which sit to the left of the heap) this
    // means arrows point left-to-right when the source is a heap field
    // and right-to-left when the source is also on the stack. The math
    // works out identically using the visually-nearer target x.
    const srcCenterX = s.left + s.width / 2;
    const tgtCenterX = t.left + t.width / 2;
    const targetX = srcCenterX < tgtCenterX ? t.left : t.right;
    const sourceX = srcCenterX < tgtCenterX ? s.right : s.left;
    out.push({
      key: `${i}:${target}`,
      kind,
      target,
      x1: sourceX - cRect.left,
      y1: s.top + s.height / 2 - cRect.top,
      x2: targetX - cRect.left,
      y2: t.top + t.height / 2 - cRect.top,
    });
  }
  return out;
}

function edgePath(e: Edge, routing: PointerRouting): string {
  if (routing === 'straight') {
    return `M ${e.x1},${e.y1} L ${e.x2},${e.y2}`;
  }
  if (routing === 'orthogonal') {
    // Two right-angle bends through a midpoint. If the endpoints are close in
    // y we bias the bend horizontally to keep the path readable.
    const midX = e.x1 + (e.x2 - e.x1) / 2;
    return `M ${e.x1},${e.y1} L ${midX},${e.y1} L ${midX},${e.y2} L ${e.x2},${e.y2}`;
  }
  const dx = Math.max(24, Math.abs(e.x2 - e.x1) * 0.5);
  const c1x = e.x1 + dx;
  const c2x = e.x2 - dx;
  return `M ${e.x1},${e.y1} C ${c1x},${e.y1} ${c2x},${e.y2} ${e.x2},${e.y2}`;
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/([\\"'\][#.:>+~*^$|()=@?!{},/])/g, '\\$1');
}
