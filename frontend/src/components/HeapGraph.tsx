import { useCurrentStep } from '../store';
import { HeapNode } from './HeapNode';

export function HeapGraph() {
  const step = useCurrentStep();
  const entries = step ? Object.entries(step.heap) : [];

  if (!step) return null;
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-3" data-testid="heap-empty">
        (heap is empty)
      </p>
    );
  }

  // Naïve static layout: one block per row, in iteration order. Dagre-style
  // layering is a later polish — the point of #7 is to see the structure.
  return (
    <div className="flex flex-col gap-3" data-testid="heap-graph">
      {entries.map(([addr, block]) => (
        <HeapNode key={addr} addr={addr} block={block} />
      ))}
    </div>
  );
}
