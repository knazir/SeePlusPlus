import { TopBar } from './components/TopBar';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { ConsolePane } from './components/ConsolePane';

export function App() {
  return (
    <div className="flex h-screen flex-col bg-bg-0 text-ink-0" data-testid="app-root">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">
        {/* Editor + viz stack vertically on narrow widths, side-by-side at lg+. */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <EditorPane />
          <VizPane />
        </div>
        <ConsolePane />
      </main>
    </div>
  );
}
