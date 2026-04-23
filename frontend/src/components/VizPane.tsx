import { useAppStore } from '../store';
import { StackFrames } from './StackFrames';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);

  const totalSteps = trace?.trace.length ?? 0;
  const atStart = stepIndex <= 0;
  const atEnd = totalSteps === 0 || stepIndex >= totalSteps - 1;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-bg-0" data-testid="viz-pane">
      <header className="flex h-8 items-center justify-between border-b border-line-soft bg-bg-1 px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        <span>viz</span>
        {trace && (
          <div className="flex items-center gap-2" data-testid="step-controls">
            <button
              type="button"
              onClick={stepBackward}
              disabled={atStart}
              data-testid="step-back"
              className="rounded border border-line px-1.5 text-ink-1 disabled:cursor-not-allowed disabled:opacity-40 hover:text-ink-0"
              aria-label="previous step"
            >
              ◀
            </button>
            <span data-testid="step-counter" className="normal-case text-ink-1">
              {stepIndex + 1} / {totalSteps}
            </span>
            <button
              type="button"
              onClick={stepForward}
              disabled={atEnd}
              data-testid="step-forward"
              className="rounded border border-line px-1.5 text-ink-1 disabled:cursor-not-allowed disabled:opacity-40 hover:text-ink-0"
              aria-label="next step"
            >
              ▶
            </button>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {running && !trace ? (
          <p className="font-mono text-xs text-ink-2" data-testid="viz-running">
            running…
          </p>
        ) : trace ? (
          <div className="flex flex-col gap-4">
            <StackFrames />
            <details className="text-[11px]">
              <summary className="cursor-pointer font-mono uppercase tracking-wider text-ink-3">
                debug · raw trace
              </summary>
              <pre
                className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed text-ink-2"
                data-testid="viz-json"
              >
                {JSON.stringify(trace.trace[stepIndex], null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <p className="font-mono text-xs text-ink-3" data-testid="viz-empty">
            Click <span className="text-ink-1">Run</span> to fetch a trace.
          </p>
        )}
      </div>
    </section>
  );
}
