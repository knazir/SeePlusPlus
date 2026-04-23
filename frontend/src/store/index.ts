// App store. Two conceptual slices (workspace + execution) in one flat
// shape — they're small enough that nested slices would add ceremony
// without payoff. Split only if this doubles in size.
import { create } from 'zustand';
import { runCode, RunError, type RunResponse } from '../api/client';

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
  trace: RunResponse | null;
  error: string | null;
  run: (fetchFn?: RunFetch) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  code: DEFAULT_PROGRAM,
  setCode: (code) => set({ code }),

  running: false,
  trace: null,
  error: null,

  run: async (fetchFn) => {
    if (get().running) return;
    set({ running: true, error: null });
    try {
      const trace = await runCode(get().code, fetchFn);
      set({ trace, running: false });
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
}));
