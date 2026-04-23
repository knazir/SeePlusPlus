import { useEffect } from 'react';
import { useAppStore, useCurrentStep } from '../store';

// Bottom strip: restart · step-back · play/pause · step-forward · scrub
// slider · NN/NN · LINE NN. Full-width, fixed height. Visible but inert
// when no trace is loaded yet — so the layout doesn't reflow after Run.

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

  // Play loop: after each step, schedule the next if still playing and not
  // at the last step. Auto-stops at the end.
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
      className="flex h-12 shrink-0 items-center gap-3 border-t border-line-soft bg-bg-1 px-3 font-mono text-[11px] text-ink-2"
      data-testid="exec-bar"
    >
      <div className="flex items-center gap-1">
        <IconButton
          label="Restart"
          onClick={() => stepTo(0)}
          disabled={disabled || atStart}
          data-testid="exec-restart"
        >
          ⏮
        </IconButton>
        <IconButton
          label="Step back"
          onClick={stepBackward}
          disabled={atStart}
          data-testid="exec-step-back"
        >
          ◀
        </IconButton>
        <IconButton
          label={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
          disabled={disabled}
          primary
          data-testid="exec-play"
        >
          {playing ? '⏸' : '⏵'}
        </IconButton>
        <IconButton
          label="Step forward"
          onClick={stepForward}
          disabled={atEnd}
          data-testid="exec-step-forward"
        >
          ▶
        </IconButton>
      </div>

      <span className="text-ink-3 uppercase tracking-wider">timeline</span>

      <input
        type="range"
        min={0}
        max={Math.max(0, totalSteps - 1)}
        value={disabled ? 0 : stepIndex}
        onChange={(e) => stepTo(Number(e.currentTarget.value))}
        disabled={disabled}
        aria-label="step"
        data-testid="exec-scrub"
        className="spp-scrub flex-1 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <div className="flex items-center gap-3 tabular-nums">
        <span data-testid="exec-counter">
          <span className="text-ink-0">
            {String(disabled ? 0 : stepIndex + 1).padStart(2, '0')}
          </span>
          <span className="mx-1 text-ink-3">/</span>
          <span>{String(totalSteps).padStart(2, '0')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-ink-3 uppercase tracking-wider">line</span>
          <span data-testid="exec-line" className="text-ink-1">
            {typeof step?.line === 'number' ? String(step.line).padStart(2, '0') : '—'}
          </span>
        </span>
      </div>
    </section>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
  'data-testid'?: string;
}

function IconButton({
  label,
  onClick,
  disabled,
  primary,
  children,
  'data-testid': testid,
}: IconButtonProps) {
  const base =
    'flex h-7 w-7 items-center justify-center rounded border font-mono text-[12px] leading-none transition-colors duration-fast ease-out-soft disabled:cursor-not-allowed disabled:opacity-40';
  const style = primary
    ? 'border-accent-line bg-accent-soft text-ink-0 hover:bg-accent hover:text-bg-0'
    : 'border-line text-ink-1 hover:border-line-strong hover:text-ink-0';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={`${base} ${style}`}
    >
      {children}
    </button>
  );
}
