import { useState } from 'react';
import { useAppStore, useCurrentStep, useFlag } from '../store';
import { FLAGS } from '../flags/names';

/**
 * Placeholder tutor breadcrumb. Real tutor (streaming, evidence-grounded) wires
 * at v1.5 (backlog beyond P20). The Explain / Ask affordances are UI-only; they
 * open a "coming in v1.5" toast via the SignIn modal routing isn't appropriate,
 * so they just flash a non-blocking note via disabled-title for now.
 */
export function TutorBreadcrumb() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const error = useAppStore((s) => s.error);
  const tutorEnabled = useFlag(FLAGS.TUTOR_PANEL);
  const [dismissed, setDismissed] = useState(false);

  if (!tutorEnabled || !step || error || dismissed) return null;

  const copy = breadcrumbCopy(step, stepIndex);

  return (
    <div
      data-testid="tutor-breadcrumb"
      className="flex shrink-0 items-center gap-3 border-t border-line-soft bg-bg-1 px-3.5 py-2 font-mono text-[11px] text-ink-1"
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <span aria-hidden className="text-accent">◈</span>
        tutor
      </span>
      <span className="min-w-0 flex-1 truncate">{copy}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled
          title="Tutor lands in v1.5"
          data-testid="tutor-explain"
          className="flex items-center gap-1 rounded border border-accent-line bg-accent-soft px-2 py-[3px] text-[10px] text-ink-0 opacity-80 hover:opacity-100 disabled:cursor-not-allowed"
        >
          <span aria-hidden>✦</span>
          Explain
        </button>
        <button
          type="button"
          disabled
          title="Tutor lands in v1.5"
          data-testid="tutor-ask"
          className="rounded border border-line px-2 py-[3px] text-[10px] text-ink-1 hover:border-line-strong hover:text-ink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="dismiss"
          data-testid="tutor-dismiss"
          className="flex h-5 w-5 items-center justify-center rounded text-ink-3 hover:bg-bg-2 hover:text-ink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Best-effort contextual copy. Falls back to a generic summary. */
function breadcrumbCopy(
  step: ReturnType<typeof useCurrentStep> extends infer T ? NonNullable<T> : never,
  stepIndex: number,
): string {
  const funcName = step.funcName;
  const line = step.line;
  const event = step.event;

  if (stepIndex === 0) {
    return `Entering ${funcName}() — line ${line}. Press → to step.`;
  }
  if (event === 'call') {
    return `Called ${funcName}() at line ${line}. A new frame was pushed on the stack.`;
  }
  if (event === 'return') {
    return `Returning from ${funcName}() at line ${line}. The frame is about to pop.`;
  }
  if (event === 'exception') {
    return `Exception in ${funcName}() at line ${line}. Execution halted.`;
  }
  if (event === 'instruction_limit_reached') {
    return `Instruction limit hit — trace truncated. Shorten the program or increase the step budget.`;
  }
  return `Step ${stepIndex + 1} · ${funcName}() at line ${line}.`;
}
