import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStore, useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';
import { captureRects, playEnter, playFlip } from '../anim/flip';
import { orphanAddrs } from '../viz/reachability';
import { layoutHeap, type NodeSize } from '../viz/layoutHeap';

/**
 * Heap graph renderer. Uses @dagrejs/dagre (rankdir TB, acyclicer: greedy)
 * to lay out every heap block per step, applying `position: absolute;
 * left/top` imperatively in a layout effect so the measure→place→paint
 * sequence is invisible to the user.
 *
 * Positioning uses `left/top` so FLIP — which animates `transform` — stays
 * orthogonal and smoothly carries cards between step layouts. Enter
 * animations still apply to the inner article.
 */

/** Find the animation target inside a heap node's outer wrapper. */
function innerOf(outer: HTMLElement): HTMLElement {
  return outer.querySelector<HTMLElement>('[data-heap-inner]') ?? outer;
}

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const heapDensity = useAppStore((s) => s.heapDensity);

  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const orphans = useMemo(() => (step ? orphanAddrs(step) : new Set<string>()), [step]);
  const entries = useMemo(
    () => (step ? (Object.entries(step.heap) as Array<[string, unknown]>) : []),
    [step],
  );

  useLayoutEffect(() => {
    if (!step) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      return;
    }

    // Measure every mounted card, compute a dagre layout, then apply
    // top-left positions imperatively. Doing this in a layout effect keeps
    // the two-pass measure-then-place dance invisible — the browser only
    // paints the final positioned state.
    const sizes = new Map<string, NodeSize>();
    for (const [addr, el] of elsRef.current) {
      const r = el.getBoundingClientRect();
      sizes.set(addr, { w: r.width, h: r.height });
    }
    const { positions, width, height } = layoutHeap(entries, sizes, { density: heapDensity });
    for (const [addr, el] of elsRef.current) {
      const p = positions.get(addr);
      if (!p) {
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        continue;
      }
      el.style.position = 'absolute';
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    }
    if (containerRef.current) {
      containerRef.current.style.width = `${width}px`;
      containerRef.current.style.height = `${height}px`;
    }

    playFlip(prevRectsRef.current, elsRef.current);

    for (const [addr, el] of elsRef.current) {
      if (prevAddrsRef.current.has(addr)) continue;
      playEnter(innerOf(el));
    }

    prevRectsRef.current = captureRects(elsRef.current);
    prevAddrsRef.current = new Set(elsRef.current.keys());
  }, [stepIndex, step, entries, heapDensity]);

  if (!step) return null;
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-3" data-testid="heap-empty">
        (heap is empty)
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative" data-testid="heap-graph">
      {entries.map(([addr, block]) => (
        <HeapNode
          key={addr}
          addr={addr}
          block={block}
          orphan={orphans.has(addr)}
          registerEl={(el) => {
            if (el) elsRef.current.set(addr, el);
            else elsRef.current.delete(addr);
          }}
        />
      ))}
    </div>
  );
}
