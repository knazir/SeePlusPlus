import { useRef } from 'react';
import { useAppStore } from '../store';
import { StackFrames } from './StackFrames';
import { HeapGraph } from './HeapGraph';
import { EdgeLayer } from './EdgeLayer';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);

  const vizBodyRef = useRef<HTMLDivElement | null>(null);

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
      <div className="relative flex min-h-0 flex-1 flex-col" ref={vizBodyRef}>
        {running && !trace ? (
          <p className="p-3 font-mono text-xs text-ink-2" data-testid="viz-running">
            running…
          </p>
        ) : trace ? (
          <>
            <div className="flex min-h-0 flex-1 gap-4 overflow-auto p-3">
              <div className="min-w-[14rem] flex-shrink-0">
                <StackFrames />
              </div>
              <div className="flex-1">
                <HeapGraph />
              </div>
            </div>
            <details className="border-t border-line-soft px-3 py-1 text-[11px]">
              <summary className="cursor-pointer font-mono uppercase tracking-wider text-ink-3">
                debug · raw trace
              </summary>
              <pre
                className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed text-ink-2"
                data-testid="viz-json"
              >
                {JSON.stringify(trace.trace[stepIndex], null, 2)}
              </pre>
            </details>
            <EdgeLayer containerRef={vizBodyRef} />
          </>
        ) : (
          <p className="p-3 font-mono text-xs text-ink-3" data-testid="viz-empty">
            Click <span className="text-ink-1">Run</span> to fetch a trace.
          </p>
        )}
      </div>
    </section>
  );
}
