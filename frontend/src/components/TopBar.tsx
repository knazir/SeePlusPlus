import { useEffect, useRef, useState } from 'react';
import { useAppStore, useFlag, useIsStale } from '../store';
import { FLAGS } from '../flags/names';
import { kbd } from '../platform/kbd';
import { SettingsMenu } from './SettingsMenu';

export function TopBar() {
  const running = useAppStore((s) => s.running);
  const run = useAppStore((s) => s.run);
  const openModal = useAppStore((s) => s.openModal);
  const trace = useAppStore((s) => s.trace);
  const error = useAppStore((s) => s.error);
  const stale = useIsStale();

  const stepsCount = trace?.trace.length ?? 0;
  const heapBytes = estimateHeapBytes(trace);
  const tutorEnabled = useFlag(FLAGS.TUTOR_PANEL);

  return (
    <header
      className="flex h-11 shrink-0 items-stretch border-b border-line bg-bg-0"
      data-testid="topbar"
    >
      <Brand />

      <Section>
        <TopbarBtn
          onClick={() => openModal('examples')}
          kbd={kbd('K')}
          data-testid="examples-button"
        >
          <span aria-hidden className="text-ink-3">⊞</span>
          Examples
        </TopbarBtn>
        <TopbarBtn
          onClick={() => useAppStore.getState().requestSave()}
          data-testid="save-button"
        >
          <span aria-hidden className="text-ink-3">⬇</span>
          Save
        </TopbarBtn>
        <TopbarBtn
          onClick={() => useAppStore.getState().requestShare()}
          data-testid="share-button"
        >
          <span aria-hidden className="text-ink-3">↗</span>
          Share
        </TopbarBtn>
      </Section>

      <div className="flex-1" />

      {tutorEnabled && (
        <Section>
          <TopbarBtn
            primary
            kbd={kbd('J')}
            disabled
            title="Tutor lands in v1.5"
            data-testid="tutor-button"
          >
            <span aria-hidden>✦</span>
            Tutor
          </TopbarBtn>
        </Section>
      )}

      <Section>
        <GitHubLink />
        <SettingsMenu />
        <AccountMenu />
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
              : 'bg-accent text-accent-ink shadow-[0_2px_0_var(--color-accent-shadow)] hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_4px_0_var(--color-accent-shadow)]'
          }`}
        >
          <span aria-hidden className={running ? 'text-ink-3' : 'text-accent-dim'}>
            {running ? '◷' : '⚡'}
          </span>
          {running ? 'Running…' : 'Run'}
          <span
            className={`rounded-[2px] border px-1.5 py-[1px] text-[10px] ${
              running
                ? 'border-line bg-bg-3 text-ink-3'
                : 'border-accent-ink-soft text-accent-ink'
            }`}
          >
            {kbd('↵')}
          </span>
        </button>
      </div>
    </header>
  );
}

function AccountMenu() {
  const me = useAppStore((s) => s.me);
  const openModal = useAppStore((s) => s.openModal);
  const signOut = useAppStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) {
    return (
      <button
        type="button"
        aria-label="Sign in"
        title="Sign in"
        onClick={() => openModal('sign-in')}
        data-testid="account-button"
        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
      >
        <span aria-hidden>◉</span>
      </button>
    );
  }

  const initials = (me.displayName ?? me.email).slice(0, 2).toUpperCase();

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        aria-label={`Account — ${me.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="account-button"
        className="flex h-7 items-center gap-1.5 rounded-[4px] border border-line bg-bg-1 pl-1 pr-2 font-mono text-[11px] text-ink-1 transition-colors duration-fast ease-out-soft hover:border-line-strong hover:text-ink-0"
      >
        {me.avatarUrl ? (
          <img src={me.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
        ) : (
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent"
          >
            {initials}
          </span>
        )}
        <span className="max-w-[120px] truncate">{me.displayName ?? me.email}</span>
      </button>
      {open && (
        <div
          role="menu"
          data-testid="account-menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-56 rounded-[4px] border border-line bg-bg-1 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-1 px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Signed in as
          </div>
          <div className="mb-2 px-2 pb-1 font-mono text-[11px] text-ink-2">
            <span className="block truncate">{me.email}</span>
          </div>
          <a
            href="/workspaces"
            role="menuitem"
            data-testid="account-workspaces"
            className="block rounded px-2 py-1.5 font-mono text-[11px] text-ink-1 hover:bg-bg-2 hover:text-ink-0"
          >
            My workspaces
          </a>
          {me.isAdmin && (
            <a
              href="/admin"
              role="menuitem"
              data-testid="account-admin"
              className="block rounded px-2 py-1.5 font-mono text-[11px] text-ink-1 hover:bg-bg-2 hover:text-ink-0"
            >
              Admin
            </a>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await signOut();
              setOpen(false);
            }}
            data-testid="account-signout"
            className="w-full rounded px-2 py-1.5 text-left font-mono text-[11px] text-ink-1 hover:bg-bg-2 hover:text-ink-0"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function GitHubLink() {
  return (
    <a
      href="https://github.com/knazir/SeePlusPlus"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View source on GitHub"
      title="View source on GitHub"
      data-testid="github-link"
      className="flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>
  );
}

function Brand() {
  return (
    <a
      href="/"
      aria-label="See++ — home"
      data-testid="brand-link"
      className="flex min-w-[220px] cursor-default items-center gap-2.5 border-r border-line px-4 transition-opacity duration-fast ease-out-soft hover:opacity-80"
    >
      <BrandMark />
      <span className="font-mono text-[13px] font-medium tracking-[0.01em] text-ink-0">
        see
        <span className="text-accent">++</span>
      </span>
    </a>
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
