// Bottom-right toast for Save-button outcomes: saved ✓, no-change, error.
// Share has its own modal now (ShareLinkModal). Auto-dismisses after a short
// delay on success; explicit dismiss on error so the message is read.
import { useEffect } from 'react';
import { useAppStore } from '../store';

const AUTO_DISMISS_MS = 2500;

export function SaveFeedbackToast() {
  const status = useAppStore((s) => s.writeStatus);
  const error = useAppStore((s) => s.writeError);
  const dismiss = useAppStore((s) => s.dismissWriteFeedback);

  useEffect(() => {
    if (status !== 'saved' && status !== 'nochange') return;
    const id = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [status, dismiss]);

  if (status === 'idle' || status === 'writing') return null;

  if (status === 'error') {
    return (
      <div
        role="alert"
        data-testid="save-toast"
        data-state="error"
        className="fixed bottom-4 right-4 z-30 flex items-start gap-3 rounded-[4px] border border-err bg-err-soft px-3 py-2 font-mono text-[11px] text-err shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <span>{error ?? 'Save failed.'}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 flex h-4 w-4 items-center justify-center rounded-[2px] text-err hover:bg-err/20"
        >
          ×
        </button>
      </div>
    );
  }

  if (status === 'nochange') {
    return (
      <div
        data-testid="save-toast"
        data-state="nochange"
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-[4px] border border-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <span aria-hidden className="text-ink-3">•</span>
        No changes to save.
      </div>
    );
  }

  return (
    <div
      data-testid="save-toast"
      data-state="saved"
      className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-[4px] border border-accent-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-0 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <span aria-hidden className="text-accent">✓</span>
      Saved.
    </div>
  );
}
