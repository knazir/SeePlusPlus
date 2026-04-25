// Layout-engine factory. New engines plug in here without touching
// HeapGraph or EdgeLayer.

import { dagreEngine } from './dagre';
import { elkEngine } from './elk';
import type { LayoutEngine } from './types';

export type EngineName = LayoutEngine['name'];

/** Falls back to dagre on unknown names. */
export function getLayoutEngine(name: EngineName): LayoutEngine {
  switch (name) {
    case 'elk':
      return elkEngine;
    case 'dagre':
    default:
      return dagreEngine;
  }
}

export type {
  LayoutEngine,
  LayoutInput,
  LayoutResult,
  NodePosition,
  NodeSize,
  HeapDensity,
  RoutedLayoutEdge,
} from './types';
