import { useEffect, useRef, useState } from 'react';
import { useAppStore, useCurrentStep } from '../store';

const PLAY_INTERVAL_MS = 700;

export function ExecutionBar() {
  const trace = useAppStore((s) => s.trace);
  const stepIndex = useAppStore((s) => s.stepIndex);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);
  const stepTo = useAppStore((s) => s.stepTo);
  const step = useCurrentStep();

  const totalSteps = trace?.trace.length ?? 0;
  const disabled = !trace || totalSteps === 0;
  const atStart = disabled || stepIndex <= 0;
  const atEnd = disabled || stepIndex >= totalSteps - 1;

  // Play loop.
  useEffect(() => {
    if (!playing || disabled) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => stepForward(), PLAY_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [playing, stepIndex, atEnd, disabled, setPlaying, stepForward]);

  return (
    <section
      className="flex h-14 shrink-0 items-center gap-3.5 border-t border-line bg-bg-0 px-4"
      data-testid="exec-bar"
    >
      {/* Primary transport group */}
      <ButtonGroup>
        <XbButton label="Restart" onClick={() => stepTo(0)} disabled={atStart} data-testid="exec-restart">↶</XbButton>
        <XbButton label="Step back" onClick={stepBackward} disabled={atStart} data-testid="exec-step-back">◁</XbButton>
        <XbButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay} disabled={disabled} primary data-testid="exec-play">
          {playing ? '⏸' : '▶'}
        </XbButton>
        <XbButton label="Step forward" onClick={stepForward} disabled={atEnd} data-testid="exec-step-forward">▷</XbButton>
      </ButtonGroup>

      {/* Step in/out — UI only at v1; schema support lands later */}
      <ButtonGroup>
        <XbButton label="Step into" disabled title="Step-into arrives with schema metadata" data-testid="exec-step-in">↴</XbButton>
        <XbButton label="Step out" disabled title="Step-out arrives with schema metadata" data-testid="exec-step-out">↱</XbButton>
      </ButtonGroup>

      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">timeline</span>

      <Scrubbar
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        disabled={disabled}
        onSeek={stepTo}
      />

      <div className="flex items-baseline gap-2 font-mono text-[12px] text-ink-0" data-testid="exec-counter">
        <span className="text-[16px] font-medium text-accent">
          {String(disabled ? 0 : stepIndex + 1).padStart(2, '0')}
        </span>
        <span className="text-ink-3">/</span>
        <span className="text-ink-2">{String(totalSteps).padStart(2, '0')}</span>
      </div>

      <div className="ml-3 flex items-center gap-1.5 rounded-[3px] border border-line px-2 py-0.5 font-mono text-[11px] text-ink-1">
        <span className="text-ink-3">line</span>
        <span data-testid="exec-line">
          {typeof step?.line === 'number' ? String(step.line).padStart(2, '0') : '—'}
        </span>
      </div>
    </section>
  );
}

function ButtonGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[1px] rounded-[4px] border border-line bg-bg-2 p-0.5">
      {children}
    </div>
  );
}

interface XbButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

function XbButton({
  label,
  onClick,
  disabled,
  primary,
  title,
  children,
  'data-testid': testid,
}: XbButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      data-testid={testid}
      className={`flex h-7 w-[30px] items-center justify-center rounded-[3px] font-mono text-[11px] transition-colors duration-fast ease-out-soft disabled:cursor-not-allowed disabled:opacity-35 ${
        primary
          ? 'bg-accent text-accent-ink hover:brightness-110'
          : 'text-ink-1 hover:bg-bg-3 hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  );
}

interface ScrubbarProps {
  stepIndex: number;
  totalSteps: number;
  disabled: boolean;
  onSeek: (n: number) => void;
}

function Scrubbar({ stepIndex, totalSteps, disabled, onSeek }: ScrubbarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const pct = totalSteps <= 1 ? 0 : (stepIndex / (totalSteps - 1)) * 100;
  const majorEvery = totalSteps > 15 ? 5 : 2;

  function seekFromClient(clientX: number) {
    const el = ref.current;
    if (!el || totalSteps <= 1) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek(Math.round(p * (totalSteps - 1)));
  }

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => seekFromClient(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // seekFromClient reads latest state via ref each call; dragging alone is fine to key on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, totalSteps]);

  return (
    <div
      ref={ref}
      data-testid="exec-scrub"
      data-dragging={dragging || undefined}
      onPointerDown={(e) => {
        if (disabled) return;
        setDragging(true);
        seekFromClient(e.clientX);
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowLeft') onSeek(stepIndex - 1);
        if (e.key === 'ArrowRight') onSeek(stepIndex + 1);
      }}
      role="slider"
      aria-label="step"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={stepIndex + 1}
      tabIndex={disabled ? -1 : 0}
      className={`relative h-7 flex-1 cursor-pointer select-none rounded focus:outline focus:outline-1 focus:outline-accent-line ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      {/* Track */}
      <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-[3px] border border-line bg-bg-2">
        <div
          className="h-full bg-accent transition-[width] duration-[60ms] ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Ticks */}
      {totalSteps > 1 && totalSteps <= 200 && (
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`absolute top-0 h-3 w-[1px] ${
                i % majorEvery === 0 ? 'bg-ink-3 opacity-90' : 'bg-line-strong opacity-70'
              }`}
              style={{
                left: `${(i / (totalSteps - 1)) * 100}%`,
                height: i % majorEvery === 0 ? '16px' : '10px',
                top: i % majorEvery === 0 ? '-3px' : '0',
              }}
            />
          ))}
        </div>
      )}
      {/* Thumb */}
      <div
        className="absolute top-1/2 h-[18px] w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-accent-dim bg-accent"
        style={{ left: `${pct}%` }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-0.5 bottom-0.5 w-[1px] bg-accent-ink-soft"
        />
      </div>
    </div>
  );
}
