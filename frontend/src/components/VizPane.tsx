import { useMemo, useRef } from 'react';
import { useAppStore, useCurrentStep, useIsStale } from '../store';
import { StackFrames } from './StackFrames';
import { HeapGraph } from './HeapGraph';
import { EdgeLayer } from './EdgeLayer';
import { recognize } from '../viz/recognize';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const recognitionOn = useAppStore((s) => s.recognitionOn);
  const toggleRecognition = useAppStore((s) => s.toggleRecognition);
  const step = useCurrentStep();
  const stale = useIsStale();
  const vizBodyRef = useRef<HTMLDivElement | null>(null);

  const canRecognize = useMemo(() => (step ? recognize(step) !== null : false), [step]);
  const stackCount = step?.stackToRender.length ?? 0;
  const heapCount = step ? Object.keys(step.heap).length : 0;
  const heapOn = heapCount;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col border-l border-line bg-bg-0"
      data-testid="viz-pane"
    >
      <header className="flex h-[34px] items-center justify-between border-b border-line-soft bg-bg-0 px-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <div className="flex items-center gap-4">
          <span>execution visualization</span>
          {step && (
            <span className="normal-case tracking-normal" data-testid="viz-counts">
              <span className="text-ink-2">{heapOn} on heap</span>
            </span>
          )}
        </div>
        {trace && (
          <div
            role="group"
            aria-label="visualization mode"
            className="inline-flex overflow-hidden rounded-[3px] border border-line"
            data-testid="recognize-toggle-group"
          >
            <button
              type="button"
              onClick={() => recognitionOn && toggleRecognition()}
              data-testid="recognize-raw"
              data-active={!recognitionOn || undefined}
              className="px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-1 hover:text-ink-0 data-[active]:bg-accent-soft data-[active]:text-accent"
            >
              raw
            </button>
            <button
              type="button"
              onClick={() => !recognitionOn && toggleRecognition()}
              disabled={!canRecognize && !recognitionOn}
              data-testid="recognize-toggle"
              data-active={recognitionOn || undefined}
              title={
                canRecognize
                  ? 'Show recognized structure'
                  : 'No recognizable structure at this step'
              }
              className="border-l border-line px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-1 hover:text-ink-0 disabled:cursor-not-allowed disabled:opacity-40 data-[active]:bg-accent-soft data-[active]:text-accent"
            >
              recognized
            </button>
          </div>
        )}
      </header>

      <div
        ref={vizBodyRef}
        className={`relative flex min-h-0 flex-1 transition-opacity duration-fast ease-out-soft ${stale ? 'opacity-70' : ''}`}
        data-testid="viz-body"
        data-stale={stale || undefined}
      >
        {running && !trace ? (
          <p className="p-3 font-mono text-xs text-ink-2" data-testid="viz-running">
            running…
          </p>
        ) : trace ? (
          <>
            <div
              className="grid h-full min-h-0 w-full"
              style={{ gridTemplateColumns: '240px 1fr' }}
            >
              <div className="flex min-h-0 min-w-0 flex-col overflow-auto border-r border-line-soft">
                <SectionLabel label="stack" count={stackCount} />
                <div className="pt-2">
                  <StackFrames />
                </div>
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col overflow-auto">
                <SectionLabel label="heap" count={heapCount} />
                <div className="px-3 pb-5 pt-2">
                  <HeapGraph />
                </div>
              </div>
            </div>
            <EdgeLayer containerRef={vizBodyRef} />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-mono text-xs text-ink-3" data-testid="viz-empty">
              Click <span className="text-ink-1">Run</span> to fetch a trace.
            </p>
          </div>
        )}
      </div>

      {trace && (
        <details className="border-t border-line-soft px-3 py-1 text-[11px]">
          <summary className="cursor-pointer font-mono uppercase tracking-[0.12em] text-ink-3">
            debug · raw trace
          </summary>
          <pre
            className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed text-ink-2"
            data-testid="viz-json"
          >
            {JSON.stringify(trace.trace[stepIndex], null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-[2] flex items-center justify-between bg-gradient-to-b from-bg-0 to-transparent px-3 pb-2 pt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
      <span>{label}</span>
      <span className="rounded-[2px] border border-line-soft px-1.5 py-[1px] normal-case tracking-normal text-ink-2">
        {count}
      </span>
    </div>
  );
}
