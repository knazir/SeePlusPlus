// Minimal Zustand store. Slices (workspace, execution, UI) expand as the
// frontend grows — see docs/v2/README.md backlog items #6+.
import { create } from 'zustand';

export interface AppState {
  /** Placeholder so the store type is non-empty and we have somewhere to grow. */
  readonly bootedAt: number;
}

export const useAppStore = create<AppState>(() => ({
  bootedAt: Date.now(),
}));
