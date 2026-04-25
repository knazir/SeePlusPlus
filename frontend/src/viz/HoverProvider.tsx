import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { HoverCtx } from './hoverContext';

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoveredAddr, setHoveredAddrRaw] = useState<string | null>(null);
  const setHoveredAddr = useCallback((addr: string | null) => setHoveredAddrRaw(addr), []);
  const value = useMemo(
    () => ({ hoveredAddr, setHoveredAddr }),
    [hoveredAddr, setHoveredAddr],
  );
  return <HoverCtx.Provider value={value}>{children}</HoverCtx.Provider>;
}
