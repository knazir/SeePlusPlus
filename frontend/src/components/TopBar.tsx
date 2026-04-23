import { useAppStore, useIsStale } from '../store';

export function TopBar() {
  const running = useAppStore((s) => s.running);
  const run = useAppStore((s) => s.run);
  const stale = useIsStale();

  return (
    <header
      className="flex h-12 items-center justify-between border-b border-line-soft bg-bg-1 px-4"
      data-testid="topbar"
    >
      <div className="flex items-center gap-2 font-semibold tracking-tight text-ink-0">
        See++
        <span className="font-mono text-xs text-ink-3">v2</span>
      </div>
      <div className="flex items-center gap-3">
        {stale && (
          <span
            data-testid="stale-indicator"
            title="Source edited since the last run — press ⌘↵ to re-run"
            className="flex items-center gap-1.5 rounded border border-warn-line bg-warn-soft px-2 py-0.5 font-mono text-[11px] text-warn"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
            edited · ⌘↵ to re-run
          </span>
        )}
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          data-testid="run-button"
          className="rounded-md border border-accent-line bg-accent-soft px-3 py-1 font-mono text-xs font-medium text-ink-0 transition-colors duration-fast ease-out-soft hover:bg-accent hover:text-bg-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run ⌘↵'}
        </button>
      </div>
    </header>
  );
}
