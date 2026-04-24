import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional testid on the root overlay for component tests. */
  'data-testid'?: string;
  /** Width class. Default 'max-w-md' for sign-in-size; 'lg' for content-heavy modals. */
  size?: 'md' | 'lg';
}

/**
 * Focusable selector used by the Tab-cycle logic. Matches what browsers
 * consider "keyboard navigable" — inputs, buttons, links with href, and
 * anything with an explicit positive-or-zero tabindex.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Simple overlay + centered card. Click-outside + Esc close. Traps focus
 *  inside the card while open, and restores focus to the previously-focused
 *  element when closed. */
export function Modal({ title, onClose, children, 'data-testid': testid, size = 'md' }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus management: on mount, move focus to the first focusable element
  // inside the card (falling back to the card itself). On unmount, restore
  // focus to whatever was focused before the modal opened — so dismissing
  // doesn't dump the user back at <body>, mid-keyboard-flow.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    if (!card) return;
    const focusables = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    // Prefer the first form control / button; fall back to the card itself.
    const first = focusables[0];
    if (first) first.focus();
    else card.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  // Tab / Shift+Tab cycle: trap focus within the card.
  const onCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/70 backdrop-blur-sm"
      data-testid={testid}
      onMouseDown={(e) => {
        // Click on overlay (not on card) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={onCardKeyDown}
        className={`w-full overflow-hidden rounded-lg border border-line bg-bg-1 shadow-2xl focus:outline-none ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-ink-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-1 text-ink-3 hover:text-ink-0"
          >
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
