import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';
import {
  captureRects,
  EXIT_DURATION,
  playEnter,
  playExit,
  playFlip,
} from '../anim/flip';
import { recognize } from '../viz/recognize';

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const recognitionOn = useAppStore((s) => s.recognitionOn);

  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());
  /** Snapshot of the PREVIOUS step's heap — used to render nodes that just
   *  left while their exit animation plays. */
  const prevSnapshotRef = useRef<Map<string, unknown>>(new Map());

  /** Addresses currently playing their exit animation; we keep rendering them
   *  so `element.animate` has a live DOM node to animate. */
  const [exiting, setExiting] = useState<Map<string, unknown>>(new Map());
  const exitTimerRef = useRef<number | null>(null);

  const recognized = step && recognitionOn ? recognize(step) : null;

  // Render list = live entries from this step + still-animating exiting entries.
  const entries = useMemo(() => {
    if (!step) return [] as Array<[string, unknown]>;
    const live: Array<[string, unknown]> = recognized
      ? recognized.chain.map((addr) => [addr, step.heap[addr]])
      : Object.entries(step.heap);
    const liveAddrs = new Set(live.map(([a]) => a));
    const exitOnly: Array<[string, unknown]> = [];
    for (const [addr, block] of exiting) {
      if (!liveAddrs.has(addr)) exitOnly.push([addr, block]);
    }
    return [...live, ...exitOnly];
  }, [step, recognized, exiting]);

  useLayoutEffect(() => {
    if (!step) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      prevSnapshotRef.current = new Map();
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      return;
    }

    // Identify what's leaving on this step: in the previous step's heap but
    // not in the current one.
    const currentAddrs = new Set(Object.keys(step.heap));
    const leaving = new Set<string>();
    for (const addr of prevAddrsRef.current) {
      if (!currentAddrs.has(addr)) leaving.add(addr);
    }

    // FLIP any node whose layout moved (covers persisting + still-exiting nodes).
    playFlip(prevRectsRef.current, elsRef.current);

    // Enter: nodes mounted this render that weren't in the previous set.
    for (const [addr, el] of elsRef.current) {
      if (!prevAddrsRef.current.has(addr)) playEnter(el);
    }

    // Exit: start the animation now (element is still in the DOM), and stash
    // the block in `exiting` state so it keeps rendering for EXIT_DURATION.
    if (leaving.size > 0) {
      for (const addr of leaving) {
        const el = elsRef.current.get(addr);
        if (el) playExit(el);
      }
      setExiting((prev) => {
        const next = new Map(prev);
        for (const addr of leaving) {
          const block = prevSnapshotRef.current.get(addr);
          if (block !== undefined) next.set(addr, block);
        }
        return next;
      });
      if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = window.setTimeout(() => {
        setExiting(new Map());
        exitTimerRef.current = null;
      }, EXIT_DURATION + 40);
    } else if (exiting.size > 0) {
      // A later step re-alloced into an address that was exiting — drop those
      // from the exit set so we don't double-render.
      setExiting((prev) => {
        const next = new Map<string, unknown>();
        for (const [addr, block] of prev) {
          if (!currentAddrs.has(addr)) next.set(addr, block);
        }
        return next;
      });
    }

    prevRectsRef.current = captureRects(elsRef.current);
    prevAddrsRef.current = new Set(elsRef.current.keys());
    prevSnapshotRef.current = new Map(Object.entries(step.heap));
    // `exiting` is intentionally not a dep — reading it in the effect lets us
    // prune stale exits, but re-running the effect every time we *set* it
    // would loop. Effect only needs to run when the step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          registerEl={(el) => {
            if (el) elsRef.current.set(addr, el);
            else elsRef.current.delete(addr);
          }}
        />
      ))}
    </div>
  );
}
