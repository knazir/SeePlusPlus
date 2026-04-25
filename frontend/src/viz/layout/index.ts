// Layout-engine factory. The whole point of this module is to make the
// engine swappable behind one interface — the flag isn't a kill switch,
// it's a forcing function for the abstraction. New engines can be added
// here without touching HeapGraph or EdgeLayer.

import { dagreEngine } from './dagre';
import { elkEngine } from './elk';
import type { LayoutEngine } from './types';

export type EngineName = LayoutEngine['name'];

/** Returns the engine matching `name`. Falls back to dagre on unknown
 *  names so a typo'd flag value doesn't crash the visualisation. */
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
