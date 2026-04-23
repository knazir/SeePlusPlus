import { useAppStore, useIsStale } from '../store';

export function TopBar() {
  const running = useAppStore((s) => s.running);
  const run = useAppStore((s) => s.run);
  const openModal = useAppStore((s) => s.openModal);
  const trace = useAppStore((s) => s.trace);
  const error = useAppStore((s) => s.error);
  const stale = useIsStale();

  const stepsCount = trace?.trace.length ?? 0;
  const heapBytes = estimateHeapBytes(trace);

  return (
    <header
      className="flex h-11 shrink-0 items-stretch border-b border-line bg-bg-0"
      data-testid="topbar"
    >
      <Brand />

      <Section>
        <TopbarBtn
          onClick={() => openModal('examples')}
          kbd="⌘K"
          data-testid="examples-button"
        >
          <span aria-hidden className="text-ink-3">⊞</span>
          Examples
        </TopbarBtn>
        <TopbarBtn
          onClick={() => openModal('sign-in', 'save')}
          data-testid="save-button"
        >
          <span aria-hidden className="text-ink-3">⬇</span>
          Save
        </TopbarBtn>
        <TopbarBtn
          onClick={() => openModal('sign-in', 'share')}
          data-testid="share-button"
        >
          <span aria-hidden className="text-ink-3">↗</span>
          Share
        </TopbarBtn>
      </Section>

      <div className="flex-1" />

      <Section>
        <TopbarBtn
          primary
          kbd="⌘J"
          disabled
          title="Tutor lands in v1.5"
          data-testid="tutor-button"
        >
          <span aria-hidden>✦</span>
          Tutor
        </TopbarBtn>
      </Section>

      <Section>
        <IconBtn label="Toggle theme" disabled title="Light theme post-v1">
          <span aria-hidden>☾</span>
        </IconBtn>
        <IconBtn
          label="Account"
          onClick={() => openModal('sign-in')}
          data-testid="account-button"
        >
          <span aria-hidden>◉</span>
        </IconBtn>
      </Section>

      <div className="flex items-center gap-2.5 border-l border-line px-3.5 font-mono text-[11px] text-ink-2" data-testid="status-pill">
        <StatusDot kind={statusKind({ running, error, stale, trace: !!trace })} />
        <span className="uppercase tracking-[0.08em]">
          {statusLabel({ running, error, stale, trace: !!trace })}
        </span>
        {trace && !error && !running && (
          <>
            <span className="text-ink-3">·</span>
            <span>{stepsCount} steps</span>
            <span className="text-ink-3">·</span>
            <span>{formatBytes(heapBytes)} heap</span>
          </>
        )}
      </div>

      <div className="flex items-center border-l border-line px-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          data-testid="run-button"
          className={`inline-flex items-center gap-2 rounded-[4px] px-3.5 py-1.5 font-mono text-[12px] font-medium transition-all duration-fast ease-out-soft ${
            running
              ? 'cursor-wait border border-line bg-bg-2 text-ink-2'
              : 'bg-accent text-[#1b1209] shadow-[0_2px_0_rgba(217,119,87,0.2)] hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_4px_0_rgba(217,119,87,0.2)]'
          }`}
        >
          <span aria-hidden className={running ? 'text-ink-3' : 'text-[#59331e]'}>
            {running ? '◷' : '⚡'}
          </span>
          {running ? 'Running…' : 'Run'}
          <span
            className={`rounded-[2px] px-1.5 py-[1px] text-[10px] ${
              running ? 'bg-bg-3 text-ink-3' : 'bg-[rgba(27,18,9,0.12)] text-[#59331e]'
            }`}
          >
            ⌘↵
          </span>
        </button>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex min-w-[220px] items-center gap-2.5 border-r border-line px-4">
      <BrandMark />
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[13px] font-medium tracking-[0.01em] text-ink-0">
          see
          <span className="text-accent">++</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">v2</span>
      </div>
    </div>
  );
}

function BrandMark() {
  // Abstract 3-square mark evoking stack frames / debug bit-grid.
  return (
    <svg
      aria-hidden
      viewBox="0 0 22 22"
      className="h-[22px] w-[22px] shrink-0"
    >
      <rect x="1" y="1" width="8" height="8" fill="var(--color-accent)" />
      <rect x="13" y="1" width="8" height="8" fill="none" stroke="var(--color-line-strong)" strokeWidth="1" />
      <rect x="1" y="13" width="8" height="8" fill="none" stroke="var(--color-line-strong)" strokeWidth="1" />
      <rect x="13" y="13" width="8" height="8" fill="var(--color-accent-dim)" />
    </svg>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-r border-line px-3">
      {children}
    </div>
  );
}

interface TopbarBtnProps {
  onClick?: () => void;
  children: React.ReactNode;
  kbd?: string;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  'data-testid'?: string;
}

function TopbarBtn({
  onClick,
  children,
  kbd,
  primary,
  disabled,
  title,
  'data-testid': testid,
}: TopbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 font-mono text-[12px] transition-colors duration-fast ease-out-soft disabled:cursor-not-allowed disabled:opacity-60 ${
        primary ? 'text-accent hover:bg-bg-2' : 'text-ink-1 hover:bg-bg-2 hover:text-ink-0'
      }`}
    >
      {children}
      {kbd && (
        <span
          aria-hidden
          className="ml-1 rounded-[3px] border border-line px-1 py-[1px] font-mono text-[10px] text-ink-3"
        >
          {kbd}
        </span>
      )}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  title,
  children,
  'data-testid': testid,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      data-testid={testid}
      className="flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

type Status = 'idle' | 'running' | 'traced' | 'stale' | 'error';

function StatusDot({ kind }: { kind: Status }) {
  const base = 'inline-block h-1.5 w-1.5 rounded-full';
  if (kind === 'error') return <span className={`${base} bg-err`} aria-hidden />;
  if (kind === 'running')
    return (
      <span
        aria-hidden
        className={`${base} bg-accent shadow-[0_0_6px_var(--color-accent)] animate-pulse`}
      />
    );
  if (kind === 'stale')
    return <span aria-hidden className={`${base} bg-warn shadow-[0_0_6px_var(--color-warn)]`} />;
  if (kind === 'traced')
    return <span aria-hidden className={`${base} bg-ok shadow-[0_0_6px_var(--color-ok)]`} />;
  return <span aria-hidden className={`${base} bg-line-strong`} />;
}

function statusKind({
  running,
  error,
  stale,
  trace,
}: {
  running: boolean;
  error: string | null;
  stale: boolean;
  trace: boolean;
}): Status {
  if (error) return 'error';
  if (running) return 'running';
  if (stale) return 'stale';
  if (trace) return 'traced';
  return 'idle';
}

function statusLabel({
  running,
  error,
  stale,
  trace,
}: {
  running: boolean;
  error: string | null;
  stale: boolean;
  trace: boolean;
}): string {
  if (error) return 'error';
  if (running) return 'running';
  if (stale) return 'stale';
  if (trace) return 'traced';
  return 'ready';
}

/** Cheap heap-byte estimate by JSON-stringifying the heap blob. Not exact, but it's only a topbar badge. */
function estimateHeapBytes(trace: ReturnType<typeof useAppStore.getState>['trace']): number {
  if (!trace) return 0;
  let max = 0;
  for (const step of trace.trace) {
    try {
      const s = JSON.stringify(step.heap);
      if (s.length > max) max = s.length;
    } catch {
      // ignore
    }
  }
  return max;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / (1024 * 1024)).toFixed(1)} mb`;
}
