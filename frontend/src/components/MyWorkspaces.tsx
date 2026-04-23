// "My Workspaces" page. Lists the signed-in user's owned workspaces with
// inline rename and a delete-confirm modal. Anonymous share links created
// while signed out aren't attributed and don't appear here — expected cost
// of the anonymous path.
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { listMyWorkspaces, type WorkspaceListing } from '../api/client';
import { Modal } from './Modal';

export function MyWorkspaces() {
  const me = useAppStore((s) => s.me);
  const authChecked = useAppStore((s) => s.authChecked);
  const openModal = useAppStore((s) => s.openModal);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);

  const [workspaces, setWorkspaces] = useState<WorkspaceListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceListing | null>(null);

  const reload = () => {
    setLoading(true);
    listMyWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authChecked || !me) return;
    reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, me]);

  const handleRename = async (slug: string, name: string | null) => {
    await renameWorkspace(slug, name);
    setWorkspaces((prev) =>
      prev ? prev.map((w) => (w.slug === slug ? { ...w, name } : w)) : prev,
    );
  };

  const handleDelete = async (slug: string) => {
    await deleteWorkspace(slug);
    setWorkspaces((prev) => (prev ? prev.filter((w) => w.slug !== slug) : prev));
    setPendingDelete(null);
  };

  if (authChecked && !me) {
    return (
      <main
        className="flex min-h-0 flex-1 flex-col items-center justify-center p-8"
        data-testid="workspaces-signed-out"
      >
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
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
      data-testid="workspaces-page"
    >
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
          No workspaces yet. Anything you save or share while signed in will show up here.
        </p>
      )}

      {workspaces && workspaces.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="workspaces-list">
          {workspaces.map((w) => (
            <WorkspaceRow
              key={w.slug}
              workspace={w}
              onRename={(name) => handleRename(w.slug, name)}
              onRequestDelete={() => setPendingDelete(w)}
            />
          ))}
        </ul>
      )}

      {pendingDelete && (
        <Modal
          title="Delete workspace"
          onClose={() => setPendingDelete(null)}
          data-testid="delete-confirm-modal"
        >
          <div className="flex flex-col items-stretch gap-3">
            <p className="font-mono text-[12px] leading-relaxed text-ink-1">
              Delete <span className="font-semibold text-ink-0">
                {pendingDelete.name ?? pendingDelete.slug}
              </span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                data-testid="delete-cancel"
                className="rounded px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(pendingDelete.slug)}
                data-testid="delete-confirm"
                className="rounded border border-err bg-err-soft px-3 py-1.5 font-mono text-[11px] text-err transition-colors duration-fast ease-out-soft hover:brightness-110"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

interface RowProps {
  workspace: WorkspaceListing;
  onRename: (name: string | null) => Promise<void>;
  onRequestDelete: () => void;
}

function WorkspaceRow({ workspace, onRename, onRequestDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workspace.name ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(workspace.name ?? '');
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const commit = async () => {
    const trimmed = draft.trim();
    const nextName = trimmed.length === 0 ? null : trimmed;
    if (nextName === workspace.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(nextName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const displayName = workspace.name ?? workspace.slug;

  return (
    <li
      data-testid={`workspace-${workspace.slug}`}
      className="flex flex-col gap-2 rounded border border-line bg-bg-1 p-3 transition-colors duration-fast ease-out-soft hover:border-line-strong"
    >
      <div className="flex items-baseline justify-between gap-3">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            disabled={saving}
            data-testid="workspace-rename-input"
            className="flex-1 rounded border border-accent-line bg-bg-0 px-2 py-1 font-mono text-[13px] text-ink-0 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            data-testid="workspace-name"
            title="Click to rename"
            className="-ml-1 rounded px-1 py-0.5 text-left font-mono text-[13px] text-ink-0 hover:bg-bg-2"
          >
            {displayName}
          </button>
        )}
        <div className="flex items-center gap-1">
          <a
            href={`/w/${workspace.slug}`}
            aria-label="Open"
            title="Open"
            data-testid="workspace-open"
            className="rounded px-1.5 py-0.5 font-mono text-[11px] text-accent hover:bg-bg-2"
          >
            open ↗
          </a>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label="Delete"
            title="Delete"
            data-testid="workspace-delete"
            className="flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] text-ink-3 transition-colors duration-fast ease-out-soft hover:bg-err-soft hover:text-err"
          >
            ×
          </button>
        </div>
      </div>
      <pre className="overflow-hidden truncate whitespace-pre-wrap break-words font-mono text-[11px] text-ink-2">
        {workspace.preview}
      </pre>
      <div className="flex items-center gap-2 font-mono text-[10px] text-ink-3">
        <span>{workspace.slug}</span>
        <span>·</span>
        <span>created {new Date(workspace.createdAt).toLocaleDateString()}</span>
        {workspace.updatedAt !== workspace.createdAt && (
          <>
            <span>·</span>
            <span>edited {new Date(workspace.updatedAt).toLocaleString()}</span>
          </>
        )}
      </div>
    </li>
  );
}
