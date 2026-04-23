import { Modal } from './Modal';
import { useAppStore } from '../store';

export function SignInModal() {
  const close = useAppStore((s) => s.closeModal);

  return (
    <Modal title="Sign in" onClose={close} data-testid="signin-modal">
      <p className="mb-4 font-mono text-[11px] text-ink-2">
        Sign in to save workspaces and create shareable links. Anonymous use stays
        fully functional — accounts are opt-in.
      </p>
      <button
        type="button"
        disabled
        data-testid="signin-google"
        className="w-full rounded border border-line bg-bg-0 px-3 py-2 text-left font-mono text-sm text-ink-1 disabled:cursor-not-allowed disabled:opacity-60"
        title="Wired to real OAuth at backlog #16"
      >
        Continue with Google
        <span className="ml-2 text-[11px] uppercase tracking-wider text-ink-3">soon</span>
      </button>
      <p className="mt-4 font-mono text-[11px] text-ink-3">
        Sign-in wires to Google OAuth as part of accounts (backlog #16). No backend
        call yet.
      </p>
    </Modal>
  );
}
