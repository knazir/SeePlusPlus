import { useRef } from 'react';
import { useAppStore } from '../store';
import { StackFrames } from './StackFrames';
import { HeapGraph } from './HeapGraph';
import { EdgeLayer } from './EdgeLayer';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const vizBodyRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-bg-0" data-testid="viz-pane">
      <header className="flex h-8 items-center border-b border-line-soft bg-bg-1 px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        viz
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
