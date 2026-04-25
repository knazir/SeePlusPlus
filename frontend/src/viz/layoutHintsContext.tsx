// Layout-time hints, published by HeapGraph after each layout pass and
// consumed by EdgeLayer for stable / pre-routed edge geometry.
//
// Two pieces of data:
//   - centers: per-card center coords. Stable across FLIP (computed at
//     layout time, not interpolated DOM rects). EdgeLayer uses these for
//     side-selection decisions.
//   - edges: per-edge routed polylines from layout-aware engines (ELK).
//     When present, EdgeLayer prefers them over its geometry-based
//     routing.
//
// Why a ref-backed context (not state): we don't want a re-render every
// time the layout publishes — EdgeLayer has its own MutationObserver +
// rAF scheduler that recomputes when the DOM moves.
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import type { RoutedLayoutEdge } from './layout';

export interface LayoutHints {
  /** Per-card center coordinates from the most recent layout. */
  centers: Map<string, { x: number; y: number }>;
  /** ELK-routed edge polylines, keyed by `${source}->${target}`. Empty
   *  when the active engine doesn't route edges (dagre). */
  edges: Map<string, RoutedLayoutEdge>;
  /** Top-left of the heap-graph container in document coordinates. ELK
   *  emits polyline points in world (layout-local) coords; EdgeLayer
   *  needs an offset to convert into client coords for SVG rendering. */
  worldOrigin: { x: number; y: number } | null;
}

const EMPTY: LayoutHints = {
  centers: new Map(),
  edges: new Map(),
  worldOrigin: null,
};

const LayoutHintsCtx = createContext<MutableRefObject<LayoutHints> | null>(null);

export function LayoutHintsProvider({ children }: { children: ReactNode }) {
  const ref = useRef<LayoutHints>(EMPTY);
  return <LayoutHintsCtx.Provider value={ref}>{children}</LayoutHintsCtx.Provider>;
}

/** Producer side: HeapGraph calls this after each layoutHeap() pass. */
export function usePublishLayoutHints(): (hints: LayoutHints) => void {
  const ref = useContext(LayoutHintsCtx);
  return (hints) => {
    if (ref) ref.current = hints;
  };
}

/** Consumer side: EdgeLayer reads at compute time. Returns null when no
 *  provider is mounted (e.g., in component-level unit tests that render
 *  EdgeLayer without VizPane). */
export function useLayoutHints(): MutableRefObject<LayoutHints> | null {
  return useContext(LayoutHintsCtx);
}
