// Non-modal toast that surfaces the share URL (or error) after the Share
// button runs. Auto-dismisses after a short delay on success; on error the
// user closes it explicitly so the message is read.
import { useEffect } from 'react';
import { useAppStore } from '../store';

const AUTO_DISMISS_MS = 4500;

export function ShareToast() {
  const shareStatus = useAppStore((s) => s.shareStatus);
  const shareUrl = useAppStore((s) => s.shareUrl);
  const shareError = useAppStore((s) => s.shareError);
  const dismissShare = useAppStore((s) => s.dismissShare);

  useEffect(() => {
    if (shareStatus !== 'shared') return;
    const id = window.setTimeout(dismissShare, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [shareStatus, dismissShare]);

  if (shareStatus === 'idle') return null;

  if (shareStatus === 'sharing') {
    return (
      <div
        data-testid="share-toast"
        data-state="sharing"
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-[4px] border border-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <span aria-hidden className="animate-pulse text-accent">◷</span>
        Creating share link…
      </div>
    );
  }

  if (shareStatus === 'error') {
    return (
      <div
        data-testid="share-toast"
        data-state="error"
        role="alert"
        className="fixed bottom-4 right-4 z-30 flex items-start gap-3 rounded-[4px] border border-err bg-err-soft px-3 py-2 font-mono text-[11px] text-err shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <span>{shareError ?? 'Share failed.'}</span>
        <button
          type="button"
          onClick={dismissShare}
          aria-label="Dismiss"
          className="-mr-1 flex h-4 w-4 items-center justify-center rounded-[2px] text-err hover:bg-err/20"
        >
          ×
        </button>
      </div>
    );
  }

  // shared
  return (
    <div
      data-testid="share-toast"
      data-state="shared"
      className="fixed bottom-4 right-4 z-30 flex items-center gap-3 rounded-[4px] border border-accent-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-0 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <span aria-hidden className="text-accent">✓</span>
      <span>
        Link copied:{' '}
        <a href={shareUrl!} className="text-accent underline-offset-2 hover:underline">
          {shareUrl}
        </a>
      </span>
      <button
        type="button"
        onClick={dismissShare}
        aria-label="Dismiss"
        className="flex h-4 w-4 items-center justify-center rounded-[2px] text-ink-3 hover:bg-bg-3 hover:text-ink-0"
      >
        ×
      </button>
    </div>
  );
}
