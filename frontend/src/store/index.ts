// App store. Single flat shape (workspace + execution + step). Nested slices
// would be ceremony at this size; split if it doubles.
import { create } from 'zustand';
import {
  createWorkspace,
  deleteWorkspace as deleteWorkspaceApi,
  fetchFlags,
  fetchMe,
  getWorkspace,
  logout as logoutApi,
  renameWorkspace as renameWorkspaceApi,
  runCode,
  RunError,
  updateWorkspace,
  WorkspaceError,
  type Me,
  type PublicFlags,
} from '../api/client';
import { ProgramTraceSchema, type ProgramTrace } from '../trace/schema';
import {
  applyTheme,
  persistPreference,
  readStoredPreference,
  resolvePreference,
  type ThemePreference,
} from '../theme/theme';

// SPP-Valgrind's stack walker primes late — the backend now synthesizes a
// main() frame when a record arrives with stack: [], so priming cout calls
// aren't required anymore. See backend/CLAUDE.md for the quirk.
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
  /**
   * Raw build output (gcc stderr) from the most recent failed run. Rendered
   * verbatim in the bottom console so users see the actual diagnostic instead
   * of just the banner one-liner. `null` when the last run succeeded or when
   * the failure had no captured build output (e.g. pure docker orchestration
   * failure).
   */
  buildOutput: string | null;
  run: (fetchFn?: RunFetch) => Promise<void>;

  // step navigation
  stepIndex: number;
  stepForward: () => void;
  stepBackward: () => void;
  stepTo: (n: number) => void;
  /** Jump to the next step whose trace line matches. Wraps around. */
  jumpToNextOccurrence: (line: number) => void;
  /** Advance to the next step whose stack is deeper than the current step (function entry). */
  stepInto: () => void;
  /** Advance to the next step whose stack is shallower than the current step (function return). */
  stepOut: () => void;

  // playback
  playing: boolean;
  setPlaying: (on: boolean) => void;
  togglePlay: () => void;

  // ui
  consoleOpen: boolean;
  toggleConsole: () => void;

  modal: ModalKind;
  signInReason: SignInReason;
  /** Pending action the save/share modals hand off to after the user picks
   *  a name (or skips). `null` when no modal is awaiting a name. */
  pendingWriteIntent: WriteIntent | null;
  openModal: (m: ModalKind, reason?: SignInReason) => void;
  closeModal: () => void;

  // sharing & saving
  /** Slug + name + owner_me of the workspace currently loaded in the editor,
   *  or null if we're on a fresh page that hasn't been saved yet. */
  loaded: LoadedWorkspace | null;
  /** Non-null while a share modal is open with a URL to copy. */
  shareUrl: string | null;
  /** Status of the most recent write (save/share/fork). Powers toasts. */
  writeStatus: 'idle' | 'writing' | 'saved' | 'nochange' | 'error';
  writeError: string | null;
  /** Decide what Save should do in the current state and dispatch it.
   *  See `WriteIntent` for the resolved actions. */
  requestSave: () => void;
  /** Decide what Share should do — always ends in a share-link modal. */
  requestShare: () => void;
  /** Called by the name-prompt modal once the user picks a name / skips. */
  completePendingWrite: (name: string | null) => Promise<void>;
  /** Fetch a workspace by slug and seed the editor. Called on app mount. */
  loadFromSlug: (slug: string) => Promise<void>;
  /** Close the share modal + clear the last write status. */
  dismissWriteFeedback: () => void;
  /** PATCH a workspace's name (from the /workspaces list). */
  renameWorkspace: (slug: string, name: string | null) => Promise<void>;
  /** DELETE a workspace. */
  deleteWorkspace: (slug: string) => Promise<void>;

  /** User's theme preference: what they *chose*. Resolved to dark/light by the theme hook. */
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;

  /** How edges between pointers and heap blocks are routed. Persisted. */
  pointerRouting: PointerRouting;
  setPointerRouting: (r: PointerRouting) => void;

  /** Spacing between heap nodes in the dagre layout. Persisted. */
  heapDensity: HeapDensity;
  setHeapDensity: (d: HeapDensity) => void;

  /**
   * Fraction of the editor+viz row allocated to the editor pane, in [0, 1].
   * Clamped against pixel minimums at render time so neither pane ever
   * disappears, even if a stored value would imply a collapsed pane on a
   * narrow window. Persisted.
   */
  editorFraction: number;
  setEditorFraction: (f: number) => void;

  /**
   * User-set console height in pixels when the console is expanded.
   * `null` means "use the default"; otherwise the stored value is clamped
   * against pixel minimums at render time so the console and the main area
   * can never collapse to zero. Persisted.
   */
  consoleHeightPx: number | null;
  setConsoleHeightPx: (h: number | null) => void;

  // auth
  /** Signed-in user, or null if anonymous / still loading. */
  me: Me | null;
  /** Has the initial /api/auth/me call completed? Controls skeleton UI. */
  authChecked: boolean;
  /** Provider names the backend has configured (e.g. ['google']). */
  authProviders: string[];
  /** Fetch the current session; called on app mount and after redirects. */
  loadMe: () => Promise<void>;
  /** POST /api/auth/logout, then clear local state. */
  signOut: () => Promise<void>;

  // feature flags — loaded once on mount, returned by `useFlag` hook below.
  flags: PublicFlags;
  loadFlags: () => Promise<void>;
}

export type PointerRouting = 'curved' | 'straight' | 'orthogonal';
const ROUTING_KEY = 'spp.pointerRouting';

function readRouting(): PointerRouting {
  try {
    const raw = localStorage.getItem(ROUTING_KEY);
    if (raw === 'straight' || raw === 'orthogonal' || raw === 'curved') return raw;
  } catch {
    // SSR / private-mode / disabled storage — fall through.
  }
  return 'curved';
}

export type HeapDensity = 'dense' | 'normal' | 'airy';
const DENSITY_KEY = 'spp.heapDensity';

function readDensity(): HeapDensity {
  try {
    const raw = localStorage.getItem(DENSITY_KEY);
    if (raw === 'dense' || raw === 'airy' || raw === 'normal') return raw;
  } catch {
    // SSR / private-mode / disabled storage — fall through.
  }
  return 'normal';
}

// Pane size persistence. Values get re-clamped against pixel minimums at
// render time; the storage layer just validates that what it reads is a
// plausible number.
const EDITOR_FRACTION_KEY = 'spp.editorFraction';
export const DEFAULT_EDITOR_FRACTION = 0.5;

function readEditorFraction(): number {
  try {
    const raw = localStorage.getItem(EDITOR_FRACTION_KEY);
    if (raw === null) return DEFAULT_EDITOR_FRACTION;
    const n = parseFloat(raw);
    // Broad outer guard rails; per-render clamp against pixel minimums
    // tightens this further depending on the actual viewport width.
    if (Number.isFinite(n) && n >= 0.1 && n <= 0.9) return n;
  } catch {
    // SSR / private-mode / disabled storage — fall through.
  }
  return DEFAULT_EDITOR_FRACTION;
}

const CONSOLE_HEIGHT_KEY = 'spp.consoleHeightPx';

function readConsoleHeightPx(): number | null {
  try {
    const raw = localStorage.getItem(CONSOLE_HEIGHT_KEY);
    if (raw === null || raw === '') return null;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 40 && n <= 2000) return n;
  } catch {
    // SSR / private-mode / disabled storage — fall through.
  }
  return null;
}

export type ModalKind =
  | 'examples'
  | 'sign-in'
  | 'name-prompt'
  | 'share-link'
  | null;

/** Reason context drives sign-in modal's title/copy. */
export type SignInReason = 'save' | 'share' | 'generic';

/** What the name-prompt modal is meant to do once the user submits a name. */
export type WriteIntent =
  | { kind: 'save-new' }   // create a new owned workspace from current code
  | { kind: 'fork' }       // create new from current /w/:slug (not yours)
  | { kind: 'share' };     // anonymous or owned — POST + show share modal

export interface LoadedWorkspace {
  slug: string;
  name: string | null;
  ownerMe: boolean;
  /** Code as loaded — used to tell "edited vs unchanged" so Save can be a
   *  no-op with a toast when there's nothing to write. */
  loadedCode: string;
}

function clampStep(n: number, total: number): number {
  if (total <= 0) return 0;
  if (n < 0) return 0;
  if (n >= total) return total - 1;
  return n;
}

function writeErrorMessage(err: unknown): string {
  if (err instanceof WorkspaceError) {
    if (err.status === 413) return 'Your code is too big (64KB limit).';
    if (err.status === 429) return 'Too many saves — try again in a few minutes.';
    if (err.status === 401) return 'Please sign in to save.';
    if (err.status === 403) return 'You do not own this workspace.';
    if (err.status === 404) return 'Workspace not found.';
    return `Save failed (${err.status}).`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** PUT the current code to the loaded workspace (owner-edited path). Kept
 *  out of the store declaration to keep the `set`-using bodies terse. */
async function updateOwnedWorkspace(): Promise<void> {
  const { loaded, code } = useAppStore.getState();
  if (!loaded) return;
  useAppStore.setState({ writeStatus: 'writing', writeError: null });
  try {
    await updateWorkspace(loaded.slug, code);
    useAppStore.setState({
      loaded: { ...loaded, loadedCode: code },
      writeStatus: 'saved',
      writeError: null,
    });
  } catch (err) {
    useAppStore.setState({
      writeStatus: 'error',
      writeError: writeErrorMessage(err),
    });
  }
}

/** One-shot flow for the Share button: create (or reuse loaded) + open the
 *  share modal with a copyable URL. */
async function createAndOpenShareModal(): Promise<void> {
  const { loaded, code } = useAppStore.getState();
  // Already loaded from a slug → reuse it rather than creating a duplicate.
  if (loaded && loaded.loadedCode === code) {
    useAppStore.setState({
      shareUrl: `${window.location.origin}/w/${loaded.slug}`,
      modal: 'share-link',
    });
    return;
  }
  useAppStore.setState({ writeStatus: 'writing', writeError: null });
  try {
    const { slug } = await createWorkspace(code, loaded?.name ?? null);
    window.history.replaceState(null, '', `/w/${slug}`);
    useAppStore.setState({
      loaded: {
        slug,
        name: loaded?.name ?? null,
        ownerMe: Boolean(useAppStore.getState().me),
        loadedCode: code,
      },
      shareUrl: `${window.location.origin}/w/${slug}`,
      modal: 'share-link',
      writeStatus: 'idle',
    });
  } catch (err) {
    useAppStore.setState({
      writeStatus: 'error',
      writeError: writeErrorMessage(err),
    });
  }
}

/**
 * Turn a `runCode` failure into a user-facing string.
 *
 * The backend's /api/run error body is typically `{"error": "<raw message>"}`.
 * For genuine user-facing problems (compile errors, runtime traps) that's
 * already reasonable. For orchestration failures — most commonly
 * `Command failed: docker run …` when the code-runner container exits
 * non-zero — the raw message leaks docker command-line internals that are
 * useless to a student. We swap those for a generic "build or runtime
 * failure, check the console" message; the actual diagnostics show up in
 * the console pane (stdout/stderr/build tabs) either way.
 */
function friendlyRunErrorMessage(err: unknown): string {
  if (err instanceof RunError) {
    // Try to parse `{"error": "..."}`. If the body isn't JSON, fall through.
    let rawMsg = err.body;
    try {
      const parsed = JSON.parse(err.body) as { error?: unknown };
      if (typeof parsed?.error === 'string') rawMsg = parsed.error;
    } catch {
      // Body wasn't JSON — use it as-is (may be empty).
    }
    const trimmed = rawMsg.trim();
    // Swap the noisy docker-shell failure for something actionable.
    if (/^Command failed: docker\b/i.test(trimmed) || trimmed === '') {
      return 'Build or runtime failure. Check the console for details.';
    }
    return trimmed;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const useAppStore = create<AppState>((set, get) => ({
  code: DEFAULT_PROGRAM,
  setCode: (code) => set({ code }),

  running: false,
  trace: null,
  lastRunCode: null,
  error: null,
  buildOutput: null,

  run: async (fetchFn) => {
    if (get().running) return;
    const sentCode = get().code;
    set({ running: true, error: null, buildOutput: null });
    try {
      const raw = await runCode(sentCode, fetchFn);
      const parsed = ProgramTraceSchema.safeParse(raw);
      if (!parsed.success) {
        set({
          trace: null,
          lastRunCode: null,
          stepIndex: 0,
          playing: false,
          error: `Backend returned an unexpected trace shape.\n${parsed.error.message}`,
          buildOutput: null,
          running: false,
        });
        return;
      }
      // Compile-failure traces arrive as a single ExecutionPoint with
      // event: "uncaughtException" and an empty stack/heap. Hoist them into
      // the error + buildOutput channels so VizPane renders the build-failed
      // empty state and ConsolePane renders the raw gcc diagnostic.
      const firstStep = parsed.data.trace[0];
      const isBuildFailure =
        parsed.data.trace.length === 1 &&
        firstStep?.event === 'uncaughtException';
      if (isBuildFailure) {
        set({
          trace: null,
          lastRunCode: null,
          stepIndex: 0,
          playing: false,
          error: firstStep?.exceptionMsg || 'Build failed.',
          buildOutput: parsed.data.buildOutput ?? firstStep?.exceptionMsg ?? null,
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
      // A failed run (compile error, docker failure, schema mismatch) invalidates
      // the old visualization — keeping the stale trace around would mislead
      // users into thinking their edit is reflected. Clear it so VizPane drops
      // into its build-error empty state.
      set({
        trace: null,
        lastRunCode: null,
        stepIndex: 0,
        playing: false,
        error: friendlyRunErrorMessage(err),
        buildOutput: null,
        running: false,
      });
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

  jumpToNextOccurrence: (line) => {
    const { trace, stepIndex } = get();
    if (!trace || trace.trace.length === 0) return;
    const N = trace.trace.length;
    // Start from the step AFTER the current one and wrap around so that
    // repeated clicks on the same line walk through every occurrence.
    for (let i = 1; i <= N; i++) {
      const idx = (stepIndex + i) % N;
      if (trace.trace[idx]!.line === line) {
        set({ stepIndex: idx });
        return;
      }
    }
    // No occurrence of this line in the trace — silent no-op.
  },

  stepInto: () => {
    const { trace, stepIndex } = get();
    if (!trace) return;
    const steps = trace.trace;
    const here = steps[stepIndex]?.stackToRender.length ?? 0;
    for (let i = stepIndex + 1; i < steps.length; i++) {
      if ((steps[i]!.stackToRender.length ?? 0) > here) {
        set({ stepIndex: i });
        return;
      }
    }
    // No deeper call ahead — no-op (caller typically disables the button).
  },

  stepOut: () => {
    const { trace, stepIndex } = get();
    if (!trace) return;
    const steps = trace.trace;
    const here = steps[stepIndex]?.stackToRender.length ?? 0;
    for (let i = stepIndex + 1; i < steps.length; i++) {
      if ((steps[i]!.stackToRender.length ?? 0) < here) {
        set({ stepIndex: i });
        return;
      }
    }
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

  consoleOpen: true,
  toggleConsole: () => set({ consoleOpen: !get().consoleOpen }),

  modal: null,
  signInReason: 'generic',
  pendingWriteIntent: null,
  openModal: (modal, reason) =>
    set({ modal, ...(reason ? { signInReason: reason } : {}) }),
  closeModal: () => set({ modal: null, pendingWriteIntent: null }),

  loaded: null,
  shareUrl: null,
  writeStatus: 'idle',
  writeError: null,

  requestSave: () => {
    const { me, loaded, code, writeStatus } = get();
    if (writeStatus === 'writing') return;

    // Signed out → sign-in prompt.
    if (!me) {
      set({ modal: 'sign-in', signInReason: 'save' });
      return;
    }

    // Fresh page (no workspace loaded) → create a new one, prompt for name.
    if (!loaded) {
      set({ modal: 'name-prompt', pendingWriteIntent: { kind: 'save-new' } });
      return;
    }

    // Loaded an owned workspace.
    if (loaded.ownerMe) {
      if (code === loaded.loadedCode) {
        // No edits — short-circuit with a toast.
        set({ writeStatus: 'nochange', writeError: null });
        return;
      }
      // Update in place.
      void updateOwnedWorkspace();
      return;
    }

    // Loaded someone else's (or an anonymous) workspace → fork.
    set({ modal: 'name-prompt', pendingWriteIntent: { kind: 'fork' } });
  },

  requestShare: () => {
    if (get().writeStatus === 'writing') return;
    // Share is always a quick flow — no name prompt; it creates a new
    // workspace (anonymous or attributed depending on auth) and opens the
    // share-link modal with the URL.
    void createAndOpenShareModal();
  },

  completePendingWrite: async (name: string | null) => {
    const intent = get().pendingWriteIntent;
    if (!intent) return;
    set({ pendingWriteIntent: null, modal: null, writeStatus: 'writing', writeError: null });
    try {
      if (intent.kind === 'save-new' || intent.kind === 'fork') {
        const { code } = get();
        const { slug } = await createWorkspace(code, name);
        window.history.replaceState(null, '', `/w/${slug}`);
        set({
          loaded: { slug, name, ownerMe: true, loadedCode: code },
          writeStatus: 'saved',
        });
      } else if (intent.kind === 'share') {
        const { code } = get();
        const { slug } = await createWorkspace(code, name);
        window.history.replaceState(null, '', `/w/${slug}`);
        set({
          loaded: {
            slug,
            name,
            ownerMe: Boolean(get().me),
            loadedCode: code,
          },
          shareUrl: `${window.location.origin}/w/${slug}`,
          writeStatus: 'idle',
          modal: 'share-link',
        });
      }
    } catch (err) {
      set({ writeStatus: 'error', writeError: writeErrorMessage(err) });
    }
  },

  loadFromSlug: async (slug) => {
    try {
      const ws = await getWorkspace(slug);
      set({
        code: ws.code,
        loaded: { slug, name: ws.name, ownerMe: ws.ownerMe, loadedCode: ws.code },
        trace: null,
        lastRunCode: null,
        stepIndex: 0,
        playing: false,
        error: null,
        buildOutput: null,
      });
    } catch (err) {
      const msg =
        err instanceof WorkspaceError
          ? err.status === 404
            ? `Workspace "${slug}" not found.`
            : `Could not load workspace (${err.status}).`
          : err instanceof Error
            ? err.message
            : String(err);
      set({ error: msg });
      window.history.replaceState(null, '', '/');
    }
  },

  dismissWriteFeedback: () =>
    set({ writeStatus: 'idle', writeError: null, shareUrl: null, modal: null }),

  renameWorkspace: async (slug, name) => {
    await renameWorkspaceApi(slug, name);
    // If the currently-loaded workspace is the one being renamed, mirror
    // the new name in the editor state too.
    const { loaded } = get();
    if (loaded?.slug === slug) set({ loaded: { ...loaded, name } });
  },

  deleteWorkspace: async (slug) => {
    await deleteWorkspaceApi(slug);
    // If the user deleted the workspace they're currently viewing, drop
    // them back to the fresh-page state.
    const { loaded } = get();
    if (loaded?.slug === slug) {
      set({ loaded: null });
      window.history.replaceState(null, '', '/');
    }
  },

  // Seed from localStorage so the store agrees with the inline FOUC shim in
  // index.html. The shim already set data-theme; we just read and mirror.
  themePreference: readStoredPreference(),
  setThemePreference: (pref) => {
    persistPreference(pref);
    applyTheme(resolvePreference(pref));
    set({ themePreference: pref });
  },

  pointerRouting: readRouting(),
  setPointerRouting: (r) => {
    try {
      localStorage.setItem(ROUTING_KEY, r);
    } catch {
      // Ignore — persistence is best-effort.
    }
    set({ pointerRouting: r });
  },

  heapDensity: readDensity(),
  setHeapDensity: (d) => {
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      // Ignore — persistence is best-effort.
    }
    set({ heapDensity: d });
  },

  editorFraction: readEditorFraction(),
  setEditorFraction: (f) => {
    // Broad outer guard rails (per-render clamp tightens further).
    const clamped = Math.max(0.1, Math.min(0.9, f));
    try {
      localStorage.setItem(EDITOR_FRACTION_KEY, String(clamped));
    } catch {
      // Ignore — persistence is best-effort.
    }
    set({ editorFraction: clamped });
  },

  consoleHeightPx: readConsoleHeightPx(),
  setConsoleHeightPx: (h) => {
    try {
      if (h === null) localStorage.removeItem(CONSOLE_HEIGHT_KEY);
      else localStorage.setItem(CONSOLE_HEIGHT_KEY, String(h));
    } catch {
      // Ignore — persistence is best-effort.
    }
    set({ consoleHeightPx: h });
  },

  me: null,
  authChecked: false,
  authProviders: [],
  loadMe: async () => {
    try {
      const resp = await fetchMe();
      set({ me: resp.user, authProviders: resp.providers, authChecked: true });
    } catch {
      set({ me: null, authChecked: true });
    }
  },
  signOut: async () => {
    try {
      await logoutApi();
    } finally {
      set({ me: null });
    }
  },

  flags: {},
  loadFlags: async () => {
    try {
      const flags = await fetchFlags();
      set({ flags });
    } catch {
      // Flag fetch failure is non-fatal — we keep whatever's in memory
      // (probably {}) and code paths fall through to their defaults.
    }
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

/** Read a feature flag. Defaults to `false` if unknown (because the flags
 *  haven't loaded yet, the server is down, or the flag truly doesn't exist).
 *  Pair with `useAppStore(s => s.loadFlags)` called on App mount. */
export function useFlag(name: string, defaultValue = false): boolean {
  return useAppStore((s) => s.flags[name] ?? defaultValue);
}
