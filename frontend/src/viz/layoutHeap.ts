// Public layout API. Delegates to the engine selected via the
// `layout-engine-elk` feature flag in HeapGraph. Kept as a thin
// re-export so existing imports of `layoutHeap` types stay valid;
// new code can import directly from `./layout`.

export {
  getLayoutEngine,
  type EngineName,
  type LayoutEngine,
  type LayoutInput,
  type LayoutResult,
  type NodePosition,
  type NodeSize,
  type HeapDensity,
  type RoutedLayoutEdge,
} from './layout';

import { getLayoutEngine } from './layout';
import type { HeapDensity, LayoutResult, NodeSize } from './layout';

export interface HeapLayout extends LayoutResult {}

export interface LayoutHeapOptions {
  /** Spacing preset. Defaults to 'normal'. */
  density?: HeapDensity;
  /** Engine to use. Defaults to 'dagre' — HeapGraph picks this from the
   *  feature flag. */
  engine?: 'dagre' | 'elk';
}

/**
 * Compute a layout for a set of heap entries. Async — both engines
 * resolve through the same `Promise<LayoutResult>` interface (dagre
 * resolves synchronously, ELK runs in a Web Worker).
 */
export function layoutHeap(
  entries: ReadonlyArray<readonly [string, unknown]>,
  sizes: ReadonlyMap<string, NodeSize>,
  opts: LayoutHeapOptions = {},
): Promise<LayoutResult> {
  const engine = getLayoutEngine(opts.engine ?? 'dagre');
  return engine.layout({ entries, sizes, density: opts.density ?? 'normal' });
}
