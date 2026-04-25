// Layout-time port hints, published by HeapGraph after each layout pass and
// consumed by EdgeLayer for stable edge-routing decisions.
//
// Why a ref-backed context (not state): we don't want a re-render every time
// the layout publishes new centers — EdgeLayer has its own MutationObserver
// + rAF scheduler that recomputes whenever the DOM moves. The ref simply
// gives EdgeLayer a way to read "the most recent layout's centers" at
// compute time, so its side-selection decisions don't flip mid-FLIP just
// because a rect happened to interpolate past the threshold.
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from 'react';

interface LayoutHints {
  /** Per-card center coordinates from the most recent dagre layout. */
  centers: Map<string, { x: number; y: number }>;
}

const EMPTY: LayoutHints = { centers: new Map() };

const LayoutHintsCtx = createContext<MutableRefObject<LayoutHints> | null>(null);

export function LayoutHintsProvider({ children }: { children: ReactNode }) {
  const ref = useRef<LayoutHints>(EMPTY);
  return <LayoutHintsCtx.Provider value={ref}>{children}</LayoutHintsCtx.Provider>;
}

/** Producer side: HeapGraph calls this after each layoutHeap() pass. */
export function usePublishLayoutHints(): (
  centers: Map<string, { x: number; y: number }>,
) => void {
  const ref = useContext(LayoutHintsCtx);
  return (centers) => {
    if (ref) ref.current = { centers };
  };
}

/** Consumer side: EdgeLayer reads at compute time. Returns null when no
 *  provider is mounted (e.g., in component-level unit tests that render
 *  EdgeLayer without VizPane). */
export function useLayoutHints(): MutableRefObject<LayoutHints> | null {
  return useContext(LayoutHintsCtx);
}
