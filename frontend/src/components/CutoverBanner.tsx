import { useEffect, useState } from 'react';
import { useFlag } from '../store';
import { FLAGS } from '../flags/names';

const STORAGE_KEY = 'spp.banner.v2-cutover.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage can throw in private mode / quota errors; the banner
    // simply won't persist its dismissal in that case.
  }
}

export function CutoverBanner() {
  const enabled = useFlag(FLAGS.BANNER_V2_CUTOVER, true);
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  // Re-read on mount in case localStorage was written by a different tab.
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (!enabled || dismissed) return null;

  const onDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <div
      role="status"
      data-testid="cutover-banner"
      className="flex items-center justify-center gap-3 border-b border-accent-line bg-accent-soft px-3.5 py-1 font-mono text-[11px] text-ink-1"
    >
      <span>
        <span className="text-accent">welcome to the new see++</span>
        <span className="mx-2 text-ink-3">·</span>
        <a
          href="https://old.seepluspl.us"
          className="cursor-default text-ink-1 underline decoration-accent-line underline-offset-2 transition-colors duration-fast ease-out-soft hover:text-accent"
        >
          need the old version?
        </a>
        <span className="mx-2 text-ink-3">·</span>
        <a
          href="https://github.com/knazir/SeePlusPlus/issues/new?labels=v2-feedback&title=%5Bv2%5D+"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-default text-ink-1 underline decoration-accent-line underline-offset-2 transition-colors duration-fast ease-out-soft hover:text-accent"
        >
          report an issue
        </a>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss banner"
        data-testid="cutover-banner-dismiss"
        className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-3 transition-colors duration-fast ease-out-soft hover:bg-accent/20 hover:text-ink-0"
      >
        ✕
      </button>
    </div>
  );
}
