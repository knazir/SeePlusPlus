// App store. Single flat shape (workspace + execution + step). Nested slices
// would be ceremony at this size; split if it doubles.
import { create } from 'zustand';
import { runCode, RunError } from '../api/client';
import { ProgramTraceSchema, type ProgramTrace } from '../trace/schema';
import {
  applyTheme,
  persistPreference,
  readStoredPreference,
  resolvePreference,
  type ThemePreference,
} from '../theme/theme';

// IMPORTANT: every traceable program MUST include <iostream> + a stdlib call
// (typically `cout << … << endl;`) as the first statement of main(). Without
// it, SPP-Valgrind's stack walker doesn't initialize on entry to main and
// every subsequent record comes back with an empty stack, which the backend
// filters out → empty trace. See backend/CLAUDE.md for the full quirk note.
export const DEFAULT_PROGRAM = `#include <iostream>
using namespace std;

struct Node {
    int value;
    Node* next;
};

Node* push_front(Node* head, int v) {
    Node* n = new Node{v, head};
    return n;
}

Node* reverse(Node* head) {
    Node* prev = nullptr;
    Node* curr = head;
    while (curr != nullptr) {
        Node* next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

int main() {
    cout << "linked list demo" << endl;
    Node* list = nullptr;
    list = push_front(list, 1);
    list = push_front(list, 2);
    list = push_front(list, 3);
    list = reverse(list);
    return 0;
}
`;

type RunFetch = typeof fetch;

export interface AppState {
  // workspace
  code: string;
  setCode: (code: string) => void;

  // execution
  running: boolean;
  trace: ProgramTrace | null;
  /** The code that produced the current trace. Derived-`stale` = code !== lastRunCode. */
  lastRunCode: string | null;
  error: string | null;
  run: (fetchFn?: RunFetch) => Promise<void>;

  // step navigation
  stepIndex: number;
  stepForward: () => void;
  stepBackward: () => void;
  stepTo: (n: number) => void;

  // playback
  playing: boolean;
  setPlaying: (on: boolean) => void;
  togglePlay: () => void;

  // ui
  recognitionOn: boolean;
  toggleRecognition: () => void;

  consoleOpen: boolean;
  toggleConsole: () => void;

  modal: ModalKind;
  signInReason: SignInReason;
  openModal: (m: ModalKind, reason?: SignInReason) => void;
  closeModal: () => void;

  /** User's theme preference: what they *chose*. Resolved to dark/light by the theme hook. */
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
}

export type ModalKind = 'examples' | 'sign-in' | null;

/** Reason context drives sign-in modal's title/copy. */
export type SignInReason = 'save' | 'share' | 'generic';

function clampStep(n: number, total: number): number {
  if (total <= 0) return 0;
  if (n < 0) return 0;
  if (n >= total) return total - 1;
  return n;
}

export const useAppStore = create<AppState>((set, get) => ({
  code: DEFAULT_PROGRAM,
  setCode: (code) => set({ code }),

  running: false,
  trace: null,
  lastRunCode: null,
  error: null,

  run: async (fetchFn) => {
    if (get().running) return;
    const sentCode = get().code;
    set({ running: true, error: null });
    try {
      const raw = await runCode(sentCode, fetchFn);
      const parsed = ProgramTraceSchema.safeParse(raw);
      if (!parsed.success) {
        set({
          error: `Backend returned an unexpected trace shape.\n${parsed.error.message}`,
          running: false,
        });
        return;
      }
      set({
        trace: parsed.data,
        lastRunCode: sentCode,
        stepIndex: 0,
        playing: false,
        running: false,
      });
    } catch (err) {
      const msg =
        err instanceof RunError
          ? `${err.message}${err.body ? `\n${err.body}` : ''}`
          : err instanceof Error
            ? err.message
            : String(err);
      set({ error: msg, running: false });
    }
  },

  stepIndex: 0,
  stepForward: () => {
    const { trace, stepIndex } = get();
    if (!trace) return;
    set({ stepIndex: clampStep(stepIndex + 1, trace.trace.length) });
  },
  stepBackward: () => {
    const { trace, stepIndex } = get();
    if (!trace) return;
    set({ stepIndex: clampStep(stepIndex - 1, trace.trace.length) });
  },
  stepTo: (n) => {
    const { trace } = get();
    if (!trace) return;
    set({ stepIndex: clampStep(n, trace.trace.length) });
  },

  playing: false,
  setPlaying: (on) => {
    const { trace, stepIndex } = get();
    if (on && trace && stepIndex >= trace.trace.length - 1) {
      // Starting from end? Rewind first so hitting play always plays.
      set({ stepIndex: 0, playing: true });
    } else {
      set({ playing: on });
    }
  },
  togglePlay: () => get().setPlaying(!get().playing),

  recognitionOn: false,
  toggleRecognition: () => set({ recognitionOn: !get().recognitionOn }),

  consoleOpen: true,
  toggleConsole: () => set({ consoleOpen: !get().consoleOpen }),

  modal: null,
  signInReason: 'generic',
  openModal: (modal, reason) =>
    set({ modal, ...(reason ? { signInReason: reason } : {}) }),
  closeModal: () => set({ modal: null }),

  // Seed from localStorage so the store agrees with the inline FOUC shim in
  // index.html. The shim already set data-theme; we just read and mirror.
  themePreference: readStoredPreference(),
  setThemePreference: (pref) => {
    persistPreference(pref);
    applyTheme(resolvePreference(pref));
    set({ themePreference: pref });
  },
}));

/** Select the ExecutionPoint at the current step, or null before any run. */
export function useCurrentStep() {
  return useAppStore((s) => {
    if (!s.trace) return null;
    return s.trace.trace[s.stepIndex] ?? null;
  });
}

/** True when a trace exists but its source has been edited since the run. */
export function useIsStale(): boolean {
  return useAppStore((s) => s.trace !== null && s.code !== s.lastRunCode);
}
