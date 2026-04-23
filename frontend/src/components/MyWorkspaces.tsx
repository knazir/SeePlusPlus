// "My Workspaces" page. Lists the signed-in user's owned workspaces;
// clicking one navigates to /w/<slug> which seeds the editor. Anonymous
// share links the user created while signed out aren't attributed and
// won't appear here — that's the expected cost of the anonymous path.
import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { listMyWorkspaces, type WorkspaceListing } from '../api/client';

export function MyWorkspaces() {
  const me = useAppStore((s) => s.me);
  const authChecked = useAppStore((s) => s.authChecked);
  const openModal = useAppStore((s) => s.openModal);

  const [workspaces, setWorkspaces] = useState<WorkspaceListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authChecked || !me) return;
    setLoading(true);
    listMyWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authChecked, me]);

  if (authChecked && !me) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-8" data-testid="workspaces-signed-out">
        <p className="mb-4 font-mono text-[13px] text-ink-1">
          Sign in to see your saved workspaces.
        </p>
        <button
          type="button"
          onClick={() => openModal('sign-in')}
          className="rounded border border-accent-line bg-accent px-3 py-2 font-mono text-sm text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6" data-testid="workspaces-page">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="font-mono text-[18px] text-ink-0">My workspaces</h1>
        <a
          href="/"
          className="font-mono text-[11px] text-ink-2 hover:text-ink-0"
          data-testid="workspaces-back"
        >
          ← Back to editor
        </a>
      </header>

      {loading && <p className="font-mono text-[12px] text-ink-3">Loading…</p>}
      {error && (
        <p className="font-mono text-[12px] text-err" data-testid="workspaces-error">
          {error}
        </p>
      )}

      {workspaces && workspaces.length === 0 && (
        <p className="font-mono text-[12px] text-ink-2" data-testid="workspaces-empty">
          No workspaces yet. Anything you share while signed in will show up here.
        </p>
      )}

      {workspaces && workspaces.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="workspaces-list">
          {workspaces.map((w) => (
            <li key={w.slug}>
              <a
                href={`/w/${w.slug}`}
                data-testid={`workspace-${w.slug}`}
                className="block rounded border border-line bg-bg-1 p-3 transition-colors duration-fast ease-out-soft hover:border-line-strong hover:bg-bg-2"
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12px] text-accent">{w.slug}</span>
                  <span className="font-mono text-[10px] text-ink-3">
                    {new Date(w.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="overflow-hidden truncate whitespace-pre-wrap break-words font-mono text-[11px] text-ink-2">
                  {w.preview}
                </pre>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
