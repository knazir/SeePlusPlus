// Share modal: shows the permalink with a Copy button. Opened by requestShare()
// once the POST completes (or immediately when the current code already has a
// slug). Auto-copies to clipboard on open — button is a fallback if the
// browser denied the initial auto-copy (some browsers require gesture-time).
import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '../store';

export function ShareLinkModal() {
  const url = useAppStore((s) => s.shareUrl);
  // Use the share-only dismissal, not dismissWriteFeedback — closing this
  // modal must not clobber an in-flight or just-finished save toast.
  const dismiss = useAppStore((s) => s.dismissShareModal);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    // Best-effort auto-copy; swallow errors and let the user press Copy.
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
    // Select the URL so keyboard users can Cmd/Ctrl+C out of the input.
    inputRef.current?.select();
  }, [url]);

  if (!url) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Browsers without clipboard access fall back to manual selection.
      inputRef.current?.select();
    }
  };

  return (
    <Modal title="Share workspace" onClose={dismiss} data-testid="share-link-modal">
      <div className="flex flex-col items-stretch gap-3">
        <p className="font-mono text-[11px] leading-relaxed text-ink-2">
          Anyone with this link can view the workspace.
          {copied && (
            <span className="ml-1 text-accent" data-testid="share-copied-hint">
              Copied to clipboard.
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={url}
            data-testid="share-link-input"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded border border-line bg-bg-0 px-3 py-2 font-mono text-[12px] text-ink-0 focus:border-accent-line focus:outline-none"
          />
          <button
            type="button"
            onClick={copy}
            data-testid="share-link-copy"
            className="rounded border border-accent-line bg-accent px-3 py-2 font-mono text-[12px] text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <a
            href={url}
            data-testid="share-link-open"
            className="font-mono text-[11px] text-accent hover:underline"
          >
            Open link →
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="rounded px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
