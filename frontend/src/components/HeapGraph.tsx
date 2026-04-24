import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStore, useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';
import { captureRects, playEnter, playFlip } from '../anim/flip';
import { recognize } from '../viz/recognize';
import { orphanAddrs } from '../viz/reachability';

/**
 * Heap graph renderer with enter + FLIP animations only.
 *
 * We deliberately don't animate cards OUT — React unmounts them before any
 * useLayoutEffect can fire, and the contortions needed to keep a ghost DOM
 * alive past the step change added more complexity than the exit animation
 * was worth. Cards that leave the heap just disappear. Enter and FLIP
 * carry the weight of communicating "something changed here."
 *
 * HeapNode wraps its animated content in an outer div that carries the ref
 * and data-heap-addr. Enter animations apply to the inner article via
 * [data-heap-inner], so the outer's bounding rect stays layout-accurate
 * and arrow endpoints don't lurch while a card fades in.
 */

/** Find the animation target inside a heap node's outer wrapper. */
function innerOf(outer: HTMLElement): HTMLElement {
  return outer.querySelector<HTMLElement>('[data-heap-inner]') ?? outer;
}

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const recognitionOn = useAppStore((s) => s.recognitionOn);

  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());

  const recognized = step && recognitionOn ? recognize(step) : null;
  const orphans = useMemo(() => (step ? orphanAddrs(step) : new Set<string>()), [step]);

  const entries = useMemo(() => {
    if (!step) return [] as Array<[string, unknown]>;
    return recognized
      ? recognized.chain.map((addr): [string, unknown] => [addr, step.heap[addr]])
      : Object.entries(step.heap);
  }, [step, recognized]);

  useLayoutEffect(() => {
    if (!step) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      return;
    }

    // FLIP any node whose layout moved.
    playFlip(prevRectsRef.current, elsRef.current);

    // Enter: nodes mounted this render that weren't in the previous set.
    for (const [addr, el] of elsRef.current) {
      if (prevAddrsRef.current.has(addr)) continue;
      playEnter(innerOf(el));
    }

    prevRectsRef.current = captureRects(elsRef.current);
    prevAddrsRef.current = new Set(elsRef.current.keys());
  }, [stepIndex, step, recognitionOn]);

  if (!step) return null;
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-3" data-testid="heap-empty">
        (heap is empty)
      </p>
    );
  }

  const layoutClass = recognized
    ? 'flex flex-row flex-wrap items-start gap-3'
    : 'flex flex-col gap-3';

  return (
    <div className={layoutClass} data-testid="heap-graph" data-recognized={recognized?.kind}>
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
