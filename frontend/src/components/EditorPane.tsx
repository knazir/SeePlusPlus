// CM6 chosen over Monaco for v1; revisit at multi-file (backlog #17+).
// See docs/v2/adr/0004-editor-cm6.md.
import { useEffect, useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { useAppStore } from '../store';

// Theme derived from our design tokens. Kept small — just the bits the editor
// actually renders — and pulled from CSS vars so it tracks --color-* changes.
const sppTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--color-bg-0)',
      color: 'var(--color-ink-0)',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      height: '100%',
    },
    '.cm-scroller': { fontFamily: 'var(--font-mono)' },
    '.cm-content': { padding: '12px 0' },
    '.cm-gutters': {
      backgroundColor: 'var(--color-bg-1)',
      color: 'var(--color-ink-3)',
      borderRight: '1px solid var(--color-line-soft)',
    },
    '.cm-activeLine': { backgroundColor: 'var(--color-bg-1)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--color-bg-2)' },
    '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-accent-soft)',
    },
  },
  { dark: true },
);

export function EditorPane() {
  const code = useAppStore((s) => s.code);
  const setCode = useAppStore((s) => s.setCode);
  const run = useAppStore((s) => s.run);

  const extensions = useMemo(() => [cpp(), sppTheme], []);

  // ⌘↵ / Ctrl+↵ to run from anywhere in the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col border-r border-line-soft bg-bg-0"
      data-testid="editor-pane"
    >
      <div className="flex h-8 items-center border-b border-line-soft bg-bg-1 px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        main.cpp
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-testid="editor-host">
        <CodeMirror
          value={code}
          onChange={setCode}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
          }}
          theme="dark"
          height="100%"
        />
      </div>
    </section>
  );
}
