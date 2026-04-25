import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useAnyModalOpen } from '../components/Modal';

/**
 * Global keyboard shortcuts for trace navigation. Attaches to window;
 * skipped when focus is inside the editor / any input so typing isn't
 * captured. Suppressed entirely while any modal is open. ⌘↵/Ctrl↵
 * re-runs (EditorPane has its own copy for when CM is focused).
 */
export function useGlobalShortcuts() {
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const run = useAppStore((s) => s.run);
  const openModal = useAppStore((s) => s.openModal);
  const anyModalOpen = useAnyModalOpen();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyModalOpen) return;

      // ⌘K opens Examples from anywhere, including inside the editor.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openModal('examples');
        return;
      }

      if (shouldIgnore(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
        return;
      }

      // Don't grab keys modifier'd for browser shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepForward, stepBackward, togglePlay, run, openModal, anyModalOpen]);
}

function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('.cm-editor')) return true;
  return false;
}
