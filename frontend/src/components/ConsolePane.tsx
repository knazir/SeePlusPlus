import { useAppStore, useCurrentStep } from '../store';

export function ConsolePane() {
  const error = useAppStore((s) => s.error);
  const step = useCurrentStep();

  // Backend emits cumulative stdout on each step (see parse_vg_trace.ts's
  // shiftStdout pass), so showing the current step's `stdout` Just Works —
  // no manual concatenation across steps.
  const stdout = step?.stdout ?? '';
  const exception = step?.exceptionMsg ?? '';
  const hasContent = error || stdout || exception;

  return (
    <section
      className="flex h-24 min-h-0 shrink-0 flex-col border-t border-line-soft bg-bg-1 lg:h-32"
      data-testid="console-pane"
    >
      <div className="flex h-8 items-center border-b border-line-soft px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        console
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {error && (
          <pre
            className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-err"
            data-testid="console-error"
          >
            {error}
          </pre>
        )}
        {stdout && (
          <pre
            className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-0"
            data-testid="console-stdout"
          >
            {stdout}
          </pre>
        )}
        {exception && (
          <pre
            className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-warn"
            data-testid="console-exception"
          >
            {exception}
          </pre>
        )}
        {!hasContent && (
          <p className="font-mono text-xs text-ink-3" data-testid="console-empty">
            (no output yet)
          </p>
        )}
      </div>
    </section>
  );
}
