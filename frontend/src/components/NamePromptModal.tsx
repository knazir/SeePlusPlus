// Optional-name prompt, surfaced before save-new and fork. Blank default
// (no auto-derivation), Enter commits, Esc or Skip submits with no name.
//
// Kept uncontrolled-ish: the input owns its state, the modal only talks to
// the store on submit.
import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '../store';

const MAX_NAME = 80;

export function NamePromptModal() {
  const intent = useAppStore((s) => s.pendingWriteIntent);
  const closeModal = useAppStore((s) => s.closeModal);
  const complete = useAppStore((s) => s.completePendingWrite);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!intent) return null;

  const isFork = intent.kind === 'fork';
  const title = isFork ? 'Fork this workspace' : 'Save workspace';
  const subtitle = isFork
    ? "This workspace isn't yours — give your copy an optional name."
    : 'Give this workspace an optional name. Leave blank to use the auto-generated ID.';

  const submit = async (nameToSend: string | null) => {
    if (submitting) return;
    setSubmitting(true);
    await complete(nameToSend);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    void submit(trimmed.length === 0 ? null : trimmed);
  };

  return (
    <Modal title={title} onClose={closeModal} data-testid="name-prompt-modal">
      <form onSubmit={onSubmit} className="flex flex-col items-stretch gap-3">
        <p className="font-mono text-[11px] leading-relaxed text-ink-2">{subtitle}</p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled"
          data-testid="name-prompt-input"
          className="rounded border border-line bg-bg-0 px-3 py-2 font-mono text-sm text-ink-0 placeholder:text-ink-3 focus:border-accent-line focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            data-testid="name-prompt-submit"
            className="flex-1 rounded border border-accent-line bg-accent px-3 py-2 font-mono text-sm text-accent-ink transition-opacity duration-fast ease-out-soft hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {isFork ? 'Fork' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void submit(null)}
            disabled={submitting}
            data-testid="name-prompt-skip"
            className="rounded px-3 py-2 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0 disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </form>
    </Modal>
  );
}
