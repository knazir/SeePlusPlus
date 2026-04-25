// Shared hover state for linking pointer chips ↔ heap cards ↔ edges. Lives
// outside the Zustand store because it's ephemeral UI-only state that changes
// on every mousemove; no need to trigger store subscribers app-wide.
import { createContext, useContext } from 'react';

export interface HoverState {
  hoveredAddr: string | null;
  setHoveredAddr: (addr: string | null) => void;
}

export const HoverCtx = createContext<HoverState>({
  hoveredAddr: null,
  setHoveredAddr: () => {},
});

export function useHover(): HoverState {
  return useContext(HoverCtx);
}
