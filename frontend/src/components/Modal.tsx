import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

// Registry of open modals, in LIFO order. Used so:
//   (1) only the top-of-stack modal handles Esc — without this, two stacked
//       modals would both respond and the underlying one would close while
//       the visible one stayed open;
//   (2) global keyboard shortcuts (Space/Arrow/Cmd+K) can detect that a
//       modal is open and step out of the way.
type ModalCloser = () => void;
const stack: ModalCloser[] = [];
const subscribers = new Set<() => void>();
function notify() {
  for (const s of subscribers) s();
}
function pushModal(close: ModalCloser) {
  stack.push(close);
  notify();
}
function popModal(close: ModalCloser) {
  const i = stack.lastIndexOf(close);
  if (i >= 0) stack.splice(i, 1);
  notify();
}

/** Returns true if any modal is currently mounted. Subscribes the calling
 *  hook to changes so it re-runs when the stack flips empty/non-empty. */
export function useAnyModalOpen(): boolean {
  const [open, setOpen] = useState(stack.length > 0);
  useEffect(() => {
    const update = () => setOpen(stack.length > 0);
    subscribers.add(update);
    update();
    return () => {
      subscribers.delete(update);
    };
  }, []);
  return open;
}

/** Simple overlay + centered card, rendered through a portal so the modal
 *  isn't trapped by `transform`/`overflow:hidden` on an ancestor. Click-
 *  outside + Esc close. Esc only fires for the top-of-stack modal. Traps
 *  focus inside the card while open and restores focus to the previously-
 *  focused element when closed. Uses `aria-labelledby` against the visible
 *  heading so screen readers don't double-announce the title. */
export function Modal({ title, onClose, children, 'data-testid': testid, size = 'md' }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Register this modal in the stack on mount so Esc + other-modal-checks
  // know about it. The same `closer` reference is used both for stack
  // identity (top-of-stack check) and for the Esc handler so the stack-top
  // comparison lines up.
  const closerRef = useRef<ModalCloser | null>(null);
  if (closerRef.current === null) {
    closerRef.current = () => onCloseRef.current();
  }
  useEffect(() => {
    const closer = closerRef.current!;
    pushModal(closer);
    return () => popModal(closer);
  }, []);

  // Esc handler: only fires on the top-of-stack modal. Without this guard,
  // two stacked modals both call onClose on Esc and the underlying one
  // closes while the user expected only the visible one to.
  useEffect(() => {
    const closer = closerRef.current!;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stack[stack.length - 1] !== closer) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus management: on mount, move focus to the first focusable element
  // inside the card (falling back to the card itself). On unmount, restore
  // focus to whatever was focused before the modal opened — so dismissing
  // doesn't dump the user back at <body>, mid-keyboard-flow.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    if (!card) return;
    const focusables = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/70 backdrop-blur-sm"
      data-testid={testid}
      onMouseDown={(e) => {
        // Click on overlay (not on card) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={onCardKeyDown}
        className={`w-full overflow-hidden rounded-lg border border-line bg-bg-1 shadow-2xl focus:outline-none ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 id={titleId} className="font-mono text-xs uppercase tracking-wider text-ink-2">
            {title}
          </h2>
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

  // Portal to <body> so the modal escapes any transformed/overflow-hidden
  // ancestor. SSR-safe guard: createPortal needs a DOM target.
  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
