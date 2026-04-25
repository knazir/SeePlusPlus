import { useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { CutoverBanner } from './components/CutoverBanner';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { ConsolePane } from './components/ConsolePane';
import { ExecutionBar } from './components/ExecutionBar';
import { Splitter } from './components/Splitter';
import { TutorBreadcrumb } from './components/TutorBreadcrumb';
import { ExamplesModal } from './components/ExamplesModal';
import { SignInModal } from './components/SignInModal';
import { NamePromptModal } from './components/NamePromptModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { SaveFeedbackToast } from './components/SaveFeedbackToast';
import { MyWorkspaces } from './components/MyWorkspaces';
import { AdminPage } from './components/AdminPage';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useTheme } from './theme/useTheme';
import { DEFAULT_EDITOR_FRACTION, useAppStore } from './store';
import { HoverProvider } from './viz/hoverContext';

/**
 * Per-pane pixel minimums protect the layout from degenerate states when
 * the user drags an edge too far. Values are intentionally generous so
 * every pane always shows meaningful content; the splitter clamps dragged
 * and keyboard-nudged values against these bounds.
 */
const MIN_EDITOR_PX = 280;
const MIN_VIZ_PX = 280;
const MIN_MAIN_ABOVE_CONSOLE_PX = 140;
const MIN_CONSOLE_PX = 80;
/** Fallback console height when the user hasn't dragged it yet. */
const DEFAULT_CONSOLE_HEIGHT_PX = 128;

const SLUG_PATH_RE = /^\/w\/([A-Za-z0-9]{4,32})\/?$/;
const WORKSPACES_PATH_RE = /^\/workspaces\/?$/;
const ADMIN_PATH_RE = /^\/admin\/?$/;

type Route =
  | { kind: 'editor' }
  | { kind: 'workspaces' }
  | { kind: 'admin' }
  | { kind: 'loading-slug'; slug: string };

function routeFromLocation(): Route {
  const path = window.location.pathname;
  if (WORKSPACES_PATH_RE.test(path)) return { kind: 'workspaces' };
  if (ADMIN_PATH_RE.test(path)) return { kind: 'admin' };
  const slugMatch = SLUG_PATH_RE.exec(path);
  if (slugMatch) return { kind: 'loading-slug', slug: slugMatch[1]! };
  return { kind: 'editor' };
}

export function App() {
  useGlobalShortcuts();
  useTheme();
  const modal = useAppStore((s) => s.modal);
  const loadMe = useAppStore((s) => s.loadMe);
  const loadFlags = useAppStore((s) => s.loadFlags);
  const editorFraction = useAppStore((s) => s.editorFraction);
  const setEditorFraction = useAppStore((s) => s.setEditorFraction);
  const consoleOpen = useAppStore((s) => s.consoleOpen);
  const consoleHeightPx = useAppStore((s) => s.consoleHeightPx);
  const setConsoleHeightPx = useAppStore((s) => s.setConsoleHeightPx);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const rowRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const [route, setRoute] = useState<Route>(routeFromLocation);

  // Kick off /api/auth/me + /api/flags on mount so the topbar + gated UI
  // can render immediately. Both are fire-and-forget; failures leave the
  // store in its default state (null user, empty flags).
  useEffect(() => {
    void loadMe();
    void loadFlags();
  }, [loadMe, loadFlags]);

  // Renormalize the persisted console height against the live viewport.
  // Runs once after mount (so a stored value from a tall window is clamped
  // down when reopened on a short window) and on every resize (so shrinking
  // the browser self-corrects the stored value instead of leaving stale
  // state around). No-op when the user hasn't dragged yet (null).
  useEffect(() => {
    const renormalize = () => {
      if (consoleHeightPx === null) return;
      const clamped = clampConsoleHeight(consoleHeightPx, mainRef.current);
      if (clamped !== consoleHeightPx) setConsoleHeightPx(clamped);
    };
    renormalize();
    window.addEventListener('resize', renormalize);
    return () => window.removeEventListener('resize', renormalize);
  }, [consoleHeightPx, setConsoleHeightPx]);

  // Seed editor from /w/:slug if the page loaded on that route.
  useEffect(() => {
    if (route.kind !== 'loading-slug') return;
    void useAppStore.getState().loadFromSlug(route.slug);
  }, [route]);

  // Keep the route in sync with browser navigation (back/forward buttons).
  useEffect(() => {
    const sync = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (route.kind === 'workspaces' || route.kind === 'admin') {
    return (
      <HoverProvider>
        <div className="flex h-screen flex-col bg-bg-0 text-ink-0" data-testid="app-root">
          <CutoverBanner />
          <TopBar />
          {route.kind === 'workspaces' ? <MyWorkspaces /> : <AdminPage />}
          {modal === 'examples' && <ExamplesModal />}
          {modal === 'sign-in' && <SignInModal />}
          {modal === 'name-prompt' && <NamePromptModal />}
          {modal === 'share-link' && <ShareLinkModal />}
          <SaveFeedbackToast />
        </div>
      </HoverProvider>
    );
  }

  return (
    <HoverProvider>
      <div className="flex h-screen flex-col bg-bg-0 text-ink-0" data-testid="app-root">
        <CutoverBanner />
        <TopBar />
        <main ref={mainRef} className="flex min-h-0 flex-1 flex-col">
          <div
            ref={rowRef}
            className="flex min-h-0 flex-1 flex-col lg:flex-row"
          >
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-[var(--min-editor-px)] lg:flex-initial"
              style={
                isDesktop
                  ? { flexBasis: `${editorFraction * 100}%`, minWidth: MIN_EDITOR_PX }
                  : undefined
              }
            >
              <EditorPane />
            </div>
            {isDesktop && (
              <Splitter
                orientation="horizontal"
                value={editorFraction}
                onChange={setEditorFraction}
                onReset={() => setEditorFraction(DEFAULT_EDITOR_FRACTION)}
                step={0.02}
                ariaLabel="Resize editor and visualization"
                data-testid="editor-viz-divider"
                computeValueFromPointer={(e) => {
                  const r = rowRef.current?.getBoundingClientRect();
                  if (!r || r.width === 0) return editorFraction;
                  return (e.clientX - r.left) / r.width;
                }}
                clamp={(f) => {
                  const w = rowRef.current?.getBoundingClientRect().width ?? 0;
                  if (w <= 0) return f;
                  const minFrac = MIN_EDITOR_PX / w;
                  const maxFrac = Math.max(minFrac, 1 - MIN_VIZ_PX / w);
                  return Math.max(minFrac, Math.min(maxFrac, f));
                }}
              />
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <VizPane />
            </div>
          </div>
          <TutorBreadcrumb />
          {consoleOpen && (
            <Splitter
              orientation="vertical"
              value={consoleHeightPx ?? DEFAULT_CONSOLE_HEIGHT_PX}
              onChange={setConsoleHeightPx}
              onReset={() => setConsoleHeightPx(null)}
              step={16}
              ariaLabel="Resize console"
              data-testid="console-divider"
              computeValueFromPointer={(e) => {
                // Console is anchored at the bottom of <main>; dragging up
                // grows it. value = distance from pointer to main's bottom,
                // minus the fixed-height ExecutionBar so the user drags the
                // top edge of the console body itself.
                const r = mainRef.current?.getBoundingClientRect();
                if (!r) return consoleHeightPx ?? DEFAULT_CONSOLE_HEIGHT_PX;
                const execBarPx = execBarHeight(mainRef.current);
                return r.bottom - e.clientY - execBarPx;
              }}
              clamp={(px) => {
                const r = mainRef.current?.getBoundingClientRect();
                if (!r) return Math.max(MIN_CONSOLE_PX, px);
                const execBarPx = execBarHeight(mainRef.current);
                const maxPx = Math.max(
                  MIN_CONSOLE_PX,
                  r.height - execBarPx - MIN_MAIN_ABOVE_CONSOLE_PX,
                );
                return Math.max(MIN_CONSOLE_PX, Math.min(maxPx, px));
              }}
            />
          )}
          <ConsolePane
            height={
              consoleOpen
                ? clampConsoleHeight(
                    consoleHeightPx ?? DEFAULT_CONSOLE_HEIGHT_PX,
                    mainRef.current,
                  )
                : undefined
            }
          />
          <ExecutionBar />
        </main>
        {modal === 'examples' && <ExamplesModal />}
        {modal === 'sign-in' && <SignInModal />}
        {modal === 'name-prompt' && <NamePromptModal />}
        {modal === 'share-link' && <ShareLinkModal />}
        <SaveFeedbackToast />
      </div>
    </HoverProvider>
  );
}

/**
 * Measure the ExecutionBar's current height so console resize math stays
 * correct if the bar's layout ever changes. Falls back to a sane default
 * when the ref isn't wired yet (first paint) so clamping never misbehaves.
 */
function execBarHeight(mainEl: HTMLElement | null): number {
  if (!mainEl) return 36;
  const el = mainEl.querySelector<HTMLElement>('[data-testid="exec-bar"]');
  return el ? el.getBoundingClientRect().height : 36;
}

/**
 * Clamp a proposed console height against the live main rect so a resized
 * window (or a stale persisted value) can never push either the console or
 * the main content below their pixel minimums.
 */
function clampConsoleHeight(px: number, mainEl: HTMLElement | null): number {
  if (!mainEl) return Math.max(MIN_CONSOLE_PX, px);
  const r = mainEl.getBoundingClientRect();
  const execBarPx = execBarHeight(mainEl);
  const maxPx = Math.max(
    MIN_CONSOLE_PX,
    r.height - execBarPx - MIN_MAIN_ABOVE_CONSOLE_PX,
  );
  return Math.max(MIN_CONSOLE_PX, Math.min(maxPx, px));
}
