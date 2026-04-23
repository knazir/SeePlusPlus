// Shared hover state for linking pointer chips ↔ heap cards ↔ edges. Lives
// outside the Zustand store because it's ephemeral UI-only state that changes
// on every mousemove; no need to trigger store subscribers app-wide.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Ctx {
  hoveredAddr: string | null;
  setHoveredAddr: (addr: string | null) => void;
}

const HoverCtx = createContext<Ctx>({ hoveredAddr: null, setHoveredAddr: () => {} });

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoveredAddr, setHoveredAddrRaw] = useState<string | null>(null);
  const setHoveredAddr = useCallback((addr: string | null) => setHoveredAddrRaw(addr), []);
  const value = useMemo(() => ({ hoveredAddr, setHoveredAddr }), [hoveredAddr, setHoveredAddr]);
  return <HoverCtx.Provider value={value}>{children}</HoverCtx.Provider>;
}

export function useHover() {
  return useContext(HoverCtx);
}
