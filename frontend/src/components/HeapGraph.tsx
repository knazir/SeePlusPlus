import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStore, useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';
import { captureRects, playEnter, playFlip } from '../anim/flip';
import { recognize } from '../viz/recognize';

export function HeapGraph() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const recognitionOn = useAppStore((s) => s.recognitionOn);

  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevAddrsRef = useRef<Set<string>>(new Set());

  // If recognition is on and the heap is recognizable, order nodes along
  // the detected chain so the visual follows head → tail. Otherwise keep
  // the backend's map order. Either way the SAME DOM keys — FLIP will
  // interpolate the visual move for the user.
  const recognized = step && recognitionOn ? recognize(step) : null;
  const entries = useMemo(() => {
    if (!step) return [] as Array<[string, unknown]>;
    if (recognized) {
      return recognized.chain.map(
        (addr) => [addr, step.heap[addr]] as [string, unknown],
      );
    }
    return Object.entries(step.heap);
  }, [step, recognized]);

  useLayoutEffect(() => {
    if (!step) {
      prevRectsRef.current = new Map();
      prevAddrsRef.current = new Set();
      return;
    }
    playFlip(prevRectsRef.current, elsRef.current);
    for (const [addr, el] of elsRef.current) {
      if (!prevAddrsRef.current.has(addr)) playEnter(el);
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
          registerEl={(el) => {
            if (el) elsRef.current.set(addr, el);
            else elsRef.current.delete(addr);
          }}
        />
      ))}
    </div>
  );
}
