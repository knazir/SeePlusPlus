import { useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '../store';

export function SignInModal() {
  const close = useAppStore((s) => s.closeModal);
  const reason = useAppStore((s) => s.signInReason);

  const title =
    reason === 'save'
      ? 'Save this workspace'
      : reason === 'share'
        ? 'Create a shareable link'
        : 'Sign in';

  const subtitle =
    reason === 'save'
      ? 'Sign in to keep your code and its execution trace. You can share or fork later.'
      : reason === 'share'
        ? 'Sign in to share your workspace and its execution state as a permalink.'
        : 'Sign in to save workspaces and create shareable links. Anonymous use stays fully functional.';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

        <OAuthButton provider="GitHub" />
        <OAuthButton provider="Google" />

        <div className="flex items-center gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          <span className="h-px flex-1 bg-line-soft" />
          or
          <span className="h-px flex-1 bg-line-soft" />
        </div>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="signin-email"
          className="rounded border border-line bg-bg-0 px-3 py-2 font-mono text-sm text-ink-0 placeholder:text-ink-3 focus:border-accent-line focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="signin-password"
          className="rounded border border-line bg-bg-0 px-3 py-2 font-mono text-sm text-ink-0 placeholder:text-ink-3 focus:border-accent-line focus:outline-none"
        />

        <button
          type="button"
          disabled
          data-testid="signin-submit"
          title="Wired to real OAuth at backlog #16"
          className="rounded border border-accent-line bg-accent px-3 py-2 font-mono text-sm text-[#1b1209] transition-opacity duration-fast ease-out-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign in
        </button>

        <button
          type="button"
          onClick={close}
          data-testid="signin-skip"
          className="rounded px-3 py-2 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
        >
          Continue without signing in
        </button>

        <p className="pt-2 text-center font-mono text-[10px] text-ink-3">
          Sign-in wires to real OAuth (Google first) at backlog #16. No backend call yet.
        </p>
      </div>
    </Modal>
  );
}

function OAuthButton({ provider }: { provider: 'GitHub' | 'Google' }) {
  const dotColor = provider === 'GitHub' ? 'bg-ink-0' : 'bg-accent';
  return (
    <button
      type="button"
      disabled
      data-testid={`signin-${provider.toLowerCase()}`}
      title={`Wired at backlog #16 (${provider})`}
      className="flex items-center justify-center gap-2 rounded border border-line bg-bg-0 px-3 py-2 font-mono text-sm text-ink-1 transition-colors duration-fast ease-out-soft hover:border-line-strong hover:text-ink-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${dotColor}`} />
      Continue with {provider}
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
        soon
      </span>
    </button>
  );
}
