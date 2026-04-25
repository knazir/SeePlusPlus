import { useRef, type ReactNode } from 'react';
import {
  EMPTY_HINTS,
  LayoutHintsCtx,
  type LayoutHints,
} from './layoutHintsContext';

export function LayoutHintsProvider({ children }: { children: ReactNode }) {
  const ref = useRef<LayoutHints>(EMPTY_HINTS);
  return <LayoutHintsCtx.Provider value={ref}>{children}</LayoutHintsCtx.Provider>;
}
