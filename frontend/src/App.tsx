import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { ConsolePane } from './components/ConsolePane';
import { ExecutionBar } from './components/ExecutionBar';
import { TutorBreadcrumb } from './components/TutorBreadcrumb';
import { ExamplesModal } from './components/ExamplesModal';
import { SignInModal } from './components/SignInModal';
import { NamePromptModal } from './components/NamePromptModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { SaveFeedbackToast } from './components/SaveFeedbackToast';
import { MyWorkspaces } from './components/MyWorkspaces';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './theme/useTheme';
import { useAppStore } from './store';
import { HoverProvider } from './viz/hoverContext';

const SLUG_PATH_RE = /^\/w\/([A-Za-z0-9]{4,32})\/?$/;
const WORKSPACES_PATH_RE = /^\/workspaces\/?$/;

type Route =
  | { kind: 'editor' }
  | { kind: 'workspaces' }
  | { kind: 'loading-slug'; slug: string };

function routeFromLocation(): Route {
  const path = window.location.pathname;
  if (WORKSPACES_PATH_RE.test(path)) return { kind: 'workspaces' };
  const slugMatch = SLUG_PATH_RE.exec(path);
  if (slugMatch) return { kind: 'loading-slug', slug: slugMatch[1]! };
  return { kind: 'editor' };
}

export function App() {
  useGlobalShortcuts();
  useTheme();
  const modal = useAppStore((s) => s.modal);
  const loadMe = useAppStore((s) => s.loadMe);
  const [route, setRoute] = useState<Route>(routeFromLocation);

  // Kick off /api/auth/me on mount so the topbar can show the signed-in
  // user (or the sign-in CTA) as early as possible.
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

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

  if (route.kind === 'workspaces') {
    return (
      <HoverProvider>
        <div className="flex h-screen flex-col bg-bg-0 text-ink-0" data-testid="app-root">
          <TopBar />
          <MyWorkspaces />
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
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <EditorPane />
            <VizPane />
          </div>
          <TutorBreadcrumb />
          <ConsolePane />
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
