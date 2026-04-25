// Layout-time hints, published by HeapGraph and consumed by EdgeLayer.
// Ref-backed (not state) because EdgeLayer has its own scheduler and
// publishes shouldn't trigger React re-renders.
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import type { RoutedLayoutEdge } from './layoutHeap';

export interface LayoutHints {
  /** Card centers in client coords. */
  centers: Map<string, { x: number; y: number }>;
  /** Engine-routed edge polylines (in world coords), keyed by
   *  `${source}->${target}`. Empty when the engine doesn't route edges. */
  edges: Map<string, RoutedLayoutEdge>;
  /** Heap-graph container top-left in document coords. Used to translate
   *  edge polyline points (which are in world coords) into client coords. */
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
