// Public layout API. Delegates to the named engine; new code can
// import directly from `./layout` instead.

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
  /** Defaults to 'normal'. */
  density?: HeapDensity;
  /** Defaults to 'dagre'. */
  engine?: 'dagre' | 'elk';
}

export function layoutHeap(
  entries: ReadonlyArray<readonly [string, unknown]>,
  sizes: ReadonlyMap<string, NodeSize>,
  opts: LayoutHeapOptions = {},
): Promise<LayoutResult> {
  const engine = getLayoutEngine(opts.engine ?? 'dagre');
  return engine.layout({ entries, sizes, density: opts.density ?? 'normal' });
}
