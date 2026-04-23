// Provider-agnostic sign-in modal. The store exposes `authProviders` (from
// /api/auth/me) so each available provider renders a button. Clicking one
// hard-redirects to /api/auth/<provider>/start?redirect=<current path>,
// which hands the user off to Google, then back to us.
//
// The legacy email/password UI was design-mock only and never wired; dropped
// now that we have a real auth path.
import { Modal } from './Modal';
import { useAppStore } from '../store';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
};

export function SignInModal() {
  const close = useAppStore((s) => s.closeModal);
  const reason = useAppStore((s) => s.signInReason);
  const providers = useAppStore((s) => s.authProviders);

  const title =
    reason === 'save'
      ? 'Save this workspace'
      : reason === 'share'
        ? 'Create a shareable link'
        : 'Sign in';

  const subtitle =
    reason === 'save'
      ? 'Sign in to keep your workspaces in one place. Anonymous share links keep working.'
      : reason === 'share'
        ? 'Sign in so the share link stays attributed to your account.'
        : 'Sign in to save workspaces and see them on your My Workspaces page.';

  const startAuth = (provider: string) => {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.assign(`/api/auth/${provider}/start?redirect=${redirect}`);
  };

  return (
    <Modal title="Sign in" onClose={close} data-testid="signin-modal">
      <div className="flex flex-col items-stretch gap-3">
        <div className="flex flex-col items-center gap-2 pb-1">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-accent"
          >
            {reason === 'share' ? '↗' : reason === 'save' ? '⬇' : '◉'}
          </span>
          <h3 className="font-mono text-[15px] text-ink-0">{title}</h3>
          <p className="max-w-sm text-center font-mono text-[11px] leading-relaxed text-ink-2">
            {subtitle}
          </p>
        </div>

        {providers.length === 0 ? (
          <p
            data-testid="signin-no-providers"
            className="rounded border border-line bg-bg-0 px-3 py-2 text-center font-mono text-[11px] text-ink-2"
          >
            Sign-in is not configured in this environment.
          </p>
        ) : (
          providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => startAuth(p)}
              data-testid={`signin-${p}`}
              className="flex items-center justify-center gap-2 rounded border border-line bg-bg-0 px-3 py-2 font-mono text-sm text-ink-1 transition-colors duration-fast ease-out-soft hover:border-line-strong hover:text-ink-0"
            >
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${p === 'github' ? 'bg-ink-0' : 'bg-accent'}`}
              />
              {PROVIDER_LABEL[p] ?? `Continue with ${p}`}
            </button>
          ))
        )}

        <button
          type="button"
          onClick={close}
          data-testid="signin-skip"
          className="rounded px-3 py-2 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
        >
          Continue without signing in
        </button>
      </div>
    </Modal>
  );
}
