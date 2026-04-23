import { useLayoutEffect, useRef } from 'react';
import { useAppStore, useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';
import { captureRects, playEnter, playFlip } from '../anim/flip';

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);

  // Ref maps for FLIP coordination. Keyed by heap addr.
  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    if (!step) {
      // Leaving the "has trace" state resets tracking so a subsequent run
      // starts fresh (no spurious enter animations from a dead cache).
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      return;
    }

    // Persisting addrs (present in both the previous render and now) → FLIP.
    playFlip(prevRectsRef.current, elsRef.current);

    // Brand-new addrs (in now but not prev) → entrance animation.
    for (const [addr, el] of elsRef.current) {
      if (!prevAddrsRef.current.has(addr)) playEnter(el);
    }

    // Store post-layout rects so the next render's effect has a "before"
    // snapshot to compute FLIP deltas against.
    prevRectsRef.current = captureRects(elsRef.current);
    prevAddrsRef.current = new Set(elsRef.current.keys());
    // step covers heap reference identity; stepIndex covers step-to-step
    // transitions where the reference could theoretically be equal.
  }, [stepIndex, step]);

  if (!step) return null;
  const entries = Object.entries(step.heap);
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-3" data-testid="heap-empty">
        (heap is empty)
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="heap-graph">
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
