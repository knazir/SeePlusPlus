import { useRef } from 'react';
import { useAppStore, useCurrentStep, useIsStale } from '../store';
import { StackFrames } from './StackFrames';
import { HeapGraph } from './HeapGraph';
import { HeapViewport, type HeapViewportHandle } from './HeapViewport';
import { EdgeLayer } from './EdgeLayer';
import { LayoutHintsProvider } from '../viz/layoutHintsContext';
import { kbd } from '../platform/kbd';

export function VizPane() {
  const trace = useAppStore((s) => s.trace);
  const running = useAppStore((s) => s.running);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const error = useAppStore((s) => s.error);
  const run = useAppStore((s) => s.run);
  const step = useCurrentStep();
  const stale = useIsStale();
  const buildFailed = !!error && !running;
  const vizBodyRef = useRef<HTMLDivElement | null>(null);
  const heapViewportElRef = useRef<HTMLDivElement | null>(null);
  const heapViewportHandleRef = useRef<HeapViewportHandle>(null);

  const stackCount = step?.stackToRender.length ?? 0;
  const heapCount = step ? Object.keys(step.heap).length : 0;
  const heapOn = heapCount;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-bg-0"
      data-testid="viz-pane"
    >
      <header className="flex h-[34px] items-center justify-between border-b border-line-soft bg-bg-0 px-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <div className="flex items-center gap-4">
          <span>visualization</span>
          {step && (
            <span className="normal-case tracking-normal" data-testid="viz-counts">
              <span className="text-ink-2">{heapOn} on heap</span>
            </span>
          )}
        </div>
        {trace && (
          <button
            type="button"
            onClick={() => heapViewportHandleRef.current?.reset()}
            data-testid="heap-recenter"
            title="Recenter heap"
            className="rounded-[3px] border border-line px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-1 hover:text-ink-0"
          >
            recenter
          </button>
        )}
      </header>

      {buildFailed ? (
        <div
          data-testid="viz-error-banner"
          className="flex items-start justify-between gap-3 border-b border-warn-line bg-warn-soft px-3.5 py-1.5 font-mono text-[11px] text-warn"
        >
          <span className="flex items-start gap-2">
            <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
            <span>
              <strong className="font-semibold">Build failed</strong>
              <span className="text-ink-1"> — {error}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => void run()}
            data-testid="viz-error-run"
            className="shrink-0 rounded-[3px] border border-warn-line bg-warn-soft px-2 py-0.5 uppercase tracking-[0.1em] text-warn transition-colors duration-fast ease-out-soft hover:brightness-110"
          >
            re-run
          </button>
        </div>
      ) : stale && trace ? (
        <div
          data-testid="viz-stale-banner"
          className="flex items-center justify-between gap-3 border-b border-warn-line bg-warn-soft px-3.5 py-1.5 font-mono text-[11px] text-warn"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
            <span>
              <strong className="font-semibold">Trace is stale</strong>
              <span className="text-ink-1"> — code has been edited since the last run.</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => void run()}
            data-testid="viz-stale-run"
            className="rounded-[3px] border border-warn-line bg-warn-soft px-2 py-0.5 uppercase tracking-[0.1em] text-warn transition-colors duration-fast ease-out-soft hover:brightness-110"
          >
            re-run
          </button>
        </div>
      ) : null}
      <div
        ref={vizBodyRef}
        className={`relative flex min-h-0 flex-1 transition-opacity duration-fast ease-out-soft ${stale ? 'opacity-60 saturate-[0.55]' : ''}`}
        data-testid="viz-body"
        data-stale={stale || undefined}
      >
        {running && !trace ? (
          <p className="p-3 font-mono text-xs text-ink-2" data-testid="viz-running">
            running…
          </p>
        ) : trace ? (
          // LayoutHintsProvider lets HeapGraph publish layout-time card
          // centers and EdgeLayer read them for stable side-selection
          // across FLIP animations. Scoped to the trace branch so the
          // ref resets cleanly between trace identities.
          <LayoutHintsProvider>
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
              <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
                <SectionLabel label="heap" count={heapCount} />
                <HeapViewport ref={heapViewportHandleRef} elRef={heapViewportElRef}>
                  <HeapGraph />
                </HeapViewport>
              </div>
            </div>
            <EdgeLayer containerRef={vizBodyRef} clipRef={heapViewportElRef} />
          </LayoutHintsProvider>
        ) : buildFailed ? (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-mono text-xs text-ink-3" data-testid="viz-empty-error">
              No trace — fix the errors above and re-run.
            </p>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-mono text-xs text-ink-3" data-testid="viz-empty">
              Click <span className="text-ink-1">Run</span>
              <span className="text-ink-3"> or press </span>
              <span className="text-ink-1">{kbd('↵')}</span>
              <span className="text-ink-3"> to visualize.</span>
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
