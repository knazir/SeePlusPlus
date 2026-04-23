// App store. Single flat shape (workspace + execution + step). Nested slices
// would be ceremony at this size; split if it doubles.
import { create } from 'zustand';
import { runCode, RunError } from '../api/client';
import { ProgramTraceSchema, type ProgramTrace } from '../trace/schema';

export const DEFAULT_PROGRAM = `struct Node {
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
}

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
