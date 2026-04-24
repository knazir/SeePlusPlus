// Admin panel: table of feature flags with inline toggles. Intentionally
// minimal — add / toggle / delete / reload, nothing else. If a second kind
// of admin surface lands (user management, audit log), make this a subpage.
//
// Route-gated: /admin returns a 403-ish "not found" for non-admins. We
// render the same empty state for "signed out" and "signed in but not
// admin" so we don't advertise the existence of the panel to passers-by.
import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import {
  deleteAdminFlag,
  fetchAdminFlags,
  reloadAdminFlags,
  setAdminFlag,
  type AdminFlag,
} from '../api/client';
import { Modal } from './Modal';

export function AdminPage() {
  const me = useAppStore((s) => s.me);
  const authChecked = useAppStore((s) => s.authChecked);
  const openModal = useAppStore((s) => s.openModal);
  const loadFlagsStore = useAppStore((s) => s.loadFlags);

  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminFlag | null>(null);

  const reload = () => {
    setLoading(true);
    fetchAdminFlags()
      .then((f) => {
        setFlags(f);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authChecked || !me?.isAdmin) return;
    reload();
  }, [authChecked, me?.isAdmin]);

  // Lock render if we don't know yet whether the user is an admin.
  if (!authChecked) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="font-mono text-[12px] text-ink-3">Checking session…</p>
      </main>
    );
  }

  // Unified empty state — signed-out or signed-in-but-not-admin both
  // land here. We don't leak "you're just not an admin" publicly.
  if (!me?.isAdmin) {
    return (
      <main
        className="flex min-h-0 flex-1 flex-col items-center justify-center p-8"
        data-testid="admin-forbidden"
      >
        <p className="mb-4 font-mono text-[13px] text-ink-1">
          This page isn't available.
        </p>
        {!me && (
          <button
            type="button"
            onClick={() => openModal('sign-in')}
            className="rounded border border-accent-line bg-accent px-3 py-2 font-mono text-sm text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110"
          >
            Sign in
          </button>
        )}
        <a
          href="/"
          className="mt-4 font-mono text-[11px] text-ink-3 transition-colors duration-fast ease-out-soft hover:text-ink-1"
        >
          ← Back to editor
        </a>
      </main>
    );
  }

  const handleToggle = async (flag: AdminFlag, next: boolean) => {
    // Optimistic — revert on error.
    setFlags((prev) =>
      prev ? prev.map((f) => (f.name === flag.name ? { ...f, enabled: next } : f)) : prev,
    );
    try {
      await setAdminFlag(flag.name, next, undefined);
      // Refresh the public flags cache so the rest of the app sees the change.
      void loadFlagsStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFlags((prev) =>
        prev ? prev.map((f) => (f.name === flag.name ? { ...f, enabled: !next } : f)) : prev,
      );
    }
  };

  const handleDelete = async (name: string) => {
    await deleteAdminFlag(name);
    setPendingDelete(null);
    setFlags((prev) => (prev ? prev.filter((f) => f.name !== name) : prev));
    void loadFlagsStore();
  };

  const handleReload = async () => {
    await reloadAdminFlags();
    reload();
    void loadFlagsStore();
  };

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
      data-testid="admin-page"
    >
      <header className="mb-6 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-[18px] text-ink-0">Admin · Feature flags</h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            {flags?.length ?? 0} flag{(flags?.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            data-testid="admin-add-flag"
            className="rounded border border-accent-line bg-accent px-3 py-1.5 font-mono text-[12px] text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110"
          >
            + New flag
          </button>
          <button
            type="button"
            onClick={handleReload}
            data-testid="admin-reload"
            className="rounded border border-line px-3 py-1.5 font-mono text-[12px] text-ink-1 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
          >
            Reload
          </button>
          <a
            href="/"
            className="font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:text-ink-0"
          >
            ← Back to editor
          </a>
        </div>
      </header>

      {loading && <p className="font-mono text-[12px] text-ink-3">Loading…</p>}
      {error && (
        <p className="mb-3 font-mono text-[12px] text-err" data-testid="admin-error">
          {error}
        </p>
      )}

      {flags && flags.length === 0 && !loading && (
        <p className="font-mono text-[12px] text-ink-2" data-testid="admin-empty">
          No flags yet. They'll appear here automatically the first time code
          calls <code>isEnabled()</code> with a new name, or use "+ New flag"
          to create one manually.
        </p>
      )}

      {flags && flags.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="admin-flags-list">
          {flags.map((f) => (
            <li
              key={f.name}
              data-testid={`admin-flag-${f.name}`}
              className="flex items-start justify-between gap-4 rounded border border-line bg-bg-1 p-3 transition-colors duration-fast ease-out-soft hover:border-line-strong"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <code className="font-mono text-[13px] text-ink-0">{f.name}</code>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                      f.enabled
                        ? 'bg-accent-soft text-accent'
                        : 'bg-bg-2 text-ink-3'
                    }`}
                    data-testid={`admin-flag-${f.name}-state`}
                  >
                    {f.enabled ? 'on' : 'off'}
                  </span>
                </div>
                {f.description && (
                  <p className="font-mono text-[11px] text-ink-2">{f.description}</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-ink-3">
                  updated {new Date(f.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.enabled}
                  onClick={() => void handleToggle(f, !f.enabled)}
                  data-testid={`admin-flag-${f.name}-toggle`}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-fast ease-out-soft ${
                    f.enabled
                      ? 'border-accent-line bg-accent'
                      : 'border-line bg-bg-2'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-fast ease-out-soft ${
                      f.enabled ? 'translate-x-5 bg-accent-ink' : 'translate-x-1 bg-ink-3'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(f)}
                  data-testid={`admin-flag-${f.name}-delete`}
                  aria-label={`Delete ${f.name}`}
                  title="Delete"
                  className="flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] text-ink-3 transition-colors duration-fast ease-out-soft hover:bg-err-soft hover:text-err"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen && <AddFlagModal onClose={() => setAddOpen(false)} onCreated={reload} />}
      {pendingDelete && (
        <Modal
          title="Delete flag"
          onClose={() => setPendingDelete(null)}
          data-testid="admin-flag-delete-modal"
        >
          <div className="flex flex-col items-stretch gap-3">
            <p className="font-mono text-[12px] leading-relaxed text-ink-1">
              Delete <code className="text-ink-0">{pendingDelete.name}</code>? Any
              code still calling <code>isEnabled()</code> on this name will auto-
              create it again (disabled by default).
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(pendingDelete.name)}
                data-testid="admin-flag-delete-confirm"
                className="rounded border border-err bg-err-soft px-3 py-1.5 font-mono text-[11px] text-err transition-opacity duration-fast ease-out-soft hover:brightness-110"
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

function AddFlagModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setAdminFlag(name.trim(), enabled, description.trim() || undefined);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New flag" onClose={onClose} data-testid="admin-add-flag-modal">
      <form onSubmit={submit} className="flex flex-col items-stretch gap-3">
        <label className="flex flex-col gap-1 font-mono text-[11px] text-ink-2">
          Name (kebab-case)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            pattern="^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$"
            data-testid="admin-add-name"
            className="rounded border border-line bg-bg-0 px-2 py-1.5 font-mono text-[12px] text-ink-0 focus:border-accent-line focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] text-ink-2">
          Description (optional)
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            data-testid="admin-add-description"
            className="rounded border border-line bg-bg-0 px-2 py-1.5 font-mono text-[12px] text-ink-0 focus:border-accent-line focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] text-ink-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="admin-add-enabled"
          />
          Enabled on create
        </label>
        {error && (
          <p className="font-mono text-[11px] text-err" data-testid="admin-add-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="admin-add-submit"
            className="rounded border border-accent-line bg-accent px-3 py-1.5 font-mono text-[11px] text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
