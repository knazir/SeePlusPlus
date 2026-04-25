// LIFO stack of open modals. Used to scope Esc to the topmost modal and
// to let global keyboard shortcuts step out of the way while any modal
// is open.
import { useEffect, useState } from 'react';

export type ModalCloser = () => void;

const stack: ModalCloser[] = [];
const subscribers = new Set<() => void>();

function notify(): void {
  for (const s of subscribers) s();
}

export function pushModal(close: ModalCloser): void {
  stack.push(close);
  notify();
}

export function popModal(close: ModalCloser): void {
  const i = stack.lastIndexOf(close);
  if (i >= 0) stack.splice(i, 1);
  notify();
}

export function isTopOfStack(closer: ModalCloser): boolean {
  return stack[stack.length - 1] === closer;
}

/** True while any modal is mounted. Re-renders the caller on transitions. */
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
