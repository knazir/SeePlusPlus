import { useAppStore } from '../store';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-bg-0"
      data-testid="viz-pane"
    >
      <div className="flex h-8 items-center border-b border-line-soft bg-bg-1 px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        viz · debug
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {running && !trace ? (
          <p className="font-mono text-xs text-ink-2" data-testid="viz-running">
            running…
          </p>
        ) : trace ? (
          <pre
            className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-ink-1"
            data-testid="viz-json"
          >
            {JSON.stringify(trace, null, 2)}
          </pre>
        ) : (
          <p className="font-mono text-xs text-ink-3" data-testid="viz-empty">
            Click <span className="text-ink-1">Run</span> to fetch a trace. Real visualization lands
            with a later ticket; for now this pane shows the raw backend JSON.
          </p>
        )}
      </div>
    </section>
  );
}
