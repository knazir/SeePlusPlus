import { useAppStore, useCurrentStep } from '../store';

/**
 * Empty-state stub for the v1.5 tutor. Renders only when a trace exists and
 * there's no in-flight error. Gives users a glimpse of the forthcoming
 * affordance without pretending the backend is there.
 */
export function TutorBreadcrumb() {
  const step = useCurrentStep();
  const stepIndex = useAppStore((s) => s.stepIndex);
  const error = useAppStore((s) => s.error);

  if (!step || error) return null;

  return (
    <div
      data-testid="tutor-breadcrumb"
      className="flex items-center gap-2 border-t border-line-soft bg-bg-1 px-3 py-1.5 font-mono text-[11px] text-ink-2"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="text-ink-3 uppercase tracking-wider">tutor</span>
      <span className="text-ink-1">step {stepIndex + 1}</span>
      <span className="text-ink-3">·</span>
      <span>
        Explanation for this step <span className="text-ink-3">— coming in v1.5</span>
      </span>
    </div>
  );
}
