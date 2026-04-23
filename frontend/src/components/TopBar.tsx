import { useAppStore } from '../store';

export function TopBar() {
  const running = useAppStore((s) => s.running);
  const run = useAppStore((s) => s.run);

  return (
    <header
      className="flex h-12 items-center justify-between border-b border-line-soft bg-bg-1 px-4"
      data-testid="topbar"
    >
      <div className="flex items-center gap-2 font-semibold tracking-tight text-ink-0">
        See++
        <span className="font-mono text-xs text-ink-3">v2</span>
      </div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        data-testid="run-button"
        className="rounded-md border border-accent-line bg-accent-soft px-3 py-1 font-mono text-xs font-medium text-ink-0 transition-colors duration-fast ease-out-soft hover:bg-accent hover:text-bg-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? 'Running…' : 'Run ⌘↵'}
      </button>
    </header>
  );
}
