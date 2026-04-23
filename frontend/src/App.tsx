import { TopBar } from './components/TopBar';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { ConsolePane } from './components/ConsolePane';
import { ExecutionBar } from './components/ExecutionBar';
import { TutorBreadcrumb } from './components/TutorBreadcrumb';
import { ExamplesModal } from './components/ExamplesModal';
import { SignInModal } from './components/SignInModal';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './theme/useTheme';
import { useAppStore } from './store';

export function App() {
  useGlobalShortcuts();
  useTheme();
  const modal = useAppStore((s) => s.modal);
  return (
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
    </div>
  );
}
