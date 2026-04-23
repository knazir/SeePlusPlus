import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { ConsolePane } from './components/ConsolePane';
import { ExecutionBar } from './components/ExecutionBar';
import { TutorBreadcrumb } from './components/TutorBreadcrumb';
import { ExamplesModal } from './components/ExamplesModal';
import { SignInModal } from './components/SignInModal';
import { ShareToast } from './components/ShareToast';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './theme/useTheme';
import { useAppStore } from './store';
import { HoverProvider } from './viz/hoverContext';

const SLUG_PATH_RE = /^\/w\/([A-Za-z0-9]{4,32})\/?$/;

export function App() {
  useGlobalShortcuts();
  useTheme();
  const modal = useAppStore((s) => s.modal);

  // On first mount, check if the URL is /w/:slug and seed the editor from
  // that workspace. Matches once; navigation happens via replaceState.
  useEffect(() => {
    const match = SLUG_PATH_RE.exec(window.location.pathname);
    if (!match) return;
    void useAppStore.getState().loadFromSlug(match[1]!);
  }, []);

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
        <ShareToast />
      </div>
    </HoverProvider>
  );
}
