import { useEffect, useMemo, useRef } from 'react';
import { useAppStore, useCurrentStep, useFlag } from '../store';
import { HeapNode } from './HeapNode';
import { captureRects, playEnter, playFlip } from '../anim/flip';
import { orphanAddrs } from '../viz/reachability';
import {
  getLayoutEngine,
  type EngineName,
  type NodeSize,
  type RoutedLayoutEdge,
} from '../viz/layout';
import { usePublishLayoutHints } from '../viz/layoutHintsContext';
import { FLAGS } from '../flags/names';

/**
 * Heap graph renderer. Measures every heap card, runs the configured
 * layout engine (dagre by default; ELK behind the LAYOUT_ENGINE_ELK flag),
 * applies `position: absolute; left/top` imperatively, and runs FLIP for
 * step-to-step continuity.
 *
 * Layout is async (the engine interface is `Promise<LayoutResult>` —
 * dagre resolves immediately, ELK runs in a Web Worker). The first frame
 * after a step change still has cards at their previous-step positions
 * via inline style, so async resolve doesn't show a flash of unpositioned
 * cards. FLIP captures `prev` rects in the same effect run, before
 * applying new positions, so animation continues to work.
 */

/** Find the animation target inside a heap node's outer wrapper. */
function innerOf(outer: HTMLElement): HTMLElement {
  return outer.querySelector<HTMLElement>('[data-heap-inner]') ?? outer;
}

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const heapDensity = useAppStore((s) => s.heapDensity);
  const trace = useAppStore((s) => s.trace);
  const elkOn = useFlag(FLAGS.LAYOUT_ENGINE_ELK, false);
  const engineName: EngineName = elkOn ? 'elk' : 'dagre';

  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());
  const prevTraceRef = useRef<typeof trace>(trace);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const publishLayoutHints = usePublishLayoutHints();

  const orphans = useMemo(() => (step ? orphanAddrs(step) : new Set<string>()), [step]);
  const entries = useMemo(
    () => (step ? (Object.entries(step.heap) as Array<[string, unknown]>) : []),
    [step],
  );

  useEffect(() => {
    if (!step) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      return;
    }

    // Trace identity changed: clear the FLIP state. Valgrind reuses
    // allocator addresses across runs, so without this the first render of
    // a new trace would FLIP-animate cards "from" stale prior-run positions.
    if (prevTraceRef.current !== trace) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      prevTraceRef.current = trace;
    }

    // Measure every mounted card BEFORE awaiting layout — this captures
    // current sizes for the engine and the "from" rects for FLIP.
    const sizes = new Map<string, NodeSize>();
    for (const [addr, el] of elsRef.current) {
      const r = el.getBoundingClientRect();
      sizes.set(addr, { w: r.width, h: r.height });
    }
    const fromRects = captureRects(elsRef.current);

    // We deliberately do NOT clear the previous layout's hints here.
    // Doing so caused a visible curved↔straight flicker on every step
    // change: between this synchronous render and ELK's async resolve,
    // EdgeLayer would fall back to geometry-routed beziers, then snap
    // back to ELK polylines a frame later. EdgeLayer's per-edge
    // endpoint sanity check handles individual stale polylines (drops
    // any whose last point doesn't land inside the target's current
    // rect), so leaving the previous hints in place during the async
    // window is the right tradeoff.

    // Cancel-on-unmount or on dependency change: if the layout resolves
    // after we've moved on, ignore its result.
    let cancelled = false;
    const engine = getLayoutEngine(engineName);
    void engine
      .layout({ entries, sizes, density: heapDensity })
      .then((result) => {
        if (cancelled) return;

        // Publish layout-time hints for EdgeLayer to consume. The engine
        // emits centers in HEAP-LOCAL coords (origin = heap container's
        // top-left); routeEdges compares them against the chip's CLIENT-
        // coord center, so we translate centers into client coords before
        // publishing. ELK-routed edge polylines stay in world coords —
        // EdgeLayer applies the worldOrigin offset itself for those.
        const containerRect = containerRef.current?.getBoundingClientRect() ?? null;
        const clientCenters = new Map<string, { x: number; y: number }>();
        if (containerRect) {
          for (const [addr, c] of result.centers) {
            clientCenters.set(addr, {
              x: c.x + containerRect.left,
              y: c.y + containerRect.top,
            });
          }
        }
        publishLayoutHints({
          centers: clientCenters,
          edges: result.edges ?? new Map<string, RoutedLayoutEdge>(),
          worldOrigin: containerRect
            ? { x: containerRect.left, y: containerRect.top }
            : null,
        });

        for (const [addr, el] of elsRef.current) {
          const p = result.positions.get(addr);
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
          containerRef.current.style.width = `${result.width}px`;
          containerRef.current.style.height = `${result.height}px`;
        }

        playFlip(fromRects, elsRef.current);

        for (const [addr, el] of elsRef.current) {
          if (prevAddrsRef.current.has(addr)) continue;
          playEnter(innerOf(el));
        }

        prevRectsRef.current = captureRects(elsRef.current);
        prevAddrsRef.current = new Set(elsRef.current.keys());
      })
      .catch((err) => {
        if (cancelled) return;
        // Log and leave existing positions in place; better to keep stale
        // layout than crash the visualisation.
        console.error('[HeapGraph] layout failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [stepIndex, step, entries, heapDensity, trace, engineName, publishLayoutHints]);

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
