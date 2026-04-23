import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAppStore } from '../store';
import { FLIP_DURATION, FLIP_FOLLOW_MARGIN } from '../anim/flip';

interface Edge {
  key: string;
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
      className="pointer-events-none absolute inset-0 h-full w-full"
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
      {edges.map((e) => (
        <path
          key={e.key}
          d={edgePath(e)}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.25}
          markerEnd="url(#spp-arrow)"
        />
      ))}
    </svg>
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
    const selector = `[data-heap-addr="${cssEscape(target)}"]`;
    const targetEl = container.querySelector<HTMLElement>(selector);
    if (!targetEl) continue;
    const s = p.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    out.push({
      key: `${i}:${target}`,
      x1: s.right - cRect.left,
      y1: s.top + s.height / 2 - cRect.top,
      x2: t.left - cRect.left,
      y2: t.top + t.height / 2 - cRect.top,
    });
  }
  return out;
}

function edgePath(e: Edge): string {
  const dx = Math.max(24, Math.abs(e.x2 - e.x1) * 0.5);
  const c1x = e.x1 + dx;
  const c2x = e.x2 - dx;
  return `M ${e.x1},${e.y1} C ${c1x},${e.y1} ${c2x},${e.y2} ${e.x2},${e.y2}`;
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/([\\"'\][#.:>+~*^$|()=@?!{},/])/g, '\\$1');
}
