import { useAppStore, useCurrentStep } from '../store';

export function ConsolePane() {
  const error = useAppStore((s) => s.error);
  const step = useCurrentStep();
  const consoleOpen = useAppStore((s) => s.consoleOpen);
  const toggleConsole = useAppStore((s) => s.toggleConsole);

  const stdout = step?.stdout ?? '';
  const exception = step?.exceptionMsg ?? '';
  const hasContent = Boolean(error || stdout || exception);

  return (
    <section
      className={`flex shrink-0 flex-col border-t border-line-soft bg-bg-1 ${
        consoleOpen ? 'h-24 lg:h-32' : 'h-8'
      }`}
      data-testid="console-pane"
      data-open={consoleOpen || undefined}
    >
      <button
        type="button"
        onClick={toggleConsole}
        data-testid="console-toggle"
        aria-expanded={consoleOpen}
        className="flex h-8 shrink-0 items-center justify-between border-b border-line-soft px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink-1"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="inline-block w-2 text-ink-3">
            {consoleOpen ? '▾' : '▸'}
          </span>
          console
          {error && <span className="normal-case text-err">· 1 error</span>}
          {!error && hasContent && <span className="normal-case text-ink-2">· output</span>}
        </span>
        <span className="flex items-center gap-2 text-ink-3">
          <span>stdout</span>
          <span>·</span>
          <span>stderr</span>
          <span>·</span>
          <span>build</span>
        </span>
      </button>
      {consoleOpen && (
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
      )}
    </section>
  );
}
