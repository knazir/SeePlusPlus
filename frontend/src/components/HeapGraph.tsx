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
 * layout engine, applies positions imperatively, and runs FLIP for
 * step-to-step continuity. Engine selection is flag-controlled; the
 * engine interface is async, so cards keep their previous positions
 * (via inline style) until the new layout resolves.
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

    // Reset FLIP state on trace change — Valgrind reuses heap addresses
    // across traces, so prior-run rects keyed by addr would mislead.
    if (prevTraceRef.current !== trace) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      prevTraceRef.current = trace;
    }

    // Measure before awaiting layout: captures both the sizes the engine
    // needs and the "from" rects FLIP needs.
    const sizes = new Map<string, NodeSize>();
    for (const [addr, el] of elsRef.current) {
      const r = el.getBoundingClientRect();
      sizes.set(addr, { w: r.width, h: r.height });
    }
    const fromRects = captureRects(elsRef.current);

    // Cancel resolutions that arrive after the deps have changed.
    let cancelled = false;
    const engine = getLayoutEngine(engineName);
    void engine
      .layout({ entries, sizes, density: heapDensity })
      .then((result) => {
        if (cancelled) return;

        // routeEdges compares centers to chip rects in client coords, so
        // translate the engine's heap-local centers before publishing.
        // Edge polylines stay in world coords; EdgeLayer applies the
        // worldOrigin offset when consuming them.
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
        // Leave existing positions in place — stale layout beats a crash.
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
