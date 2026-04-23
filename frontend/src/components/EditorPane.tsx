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
    // Fill the host pane even when the program is short, so the editor
    // surface (gutter + background) extends to the bottom instead of
    // revealing the layout's bg below line N. `.cm-scroller` owns overflow.
    '&': {
      backgroundColor: 'var(--color-bg-0)',
      color: 'var(--color-ink-0)',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      height: '100%',
    },
    '.cm-editor': { height: '100%' },
    // Scroller is the internal scroll root; explicit height + overflow is
    // what lets it actually scroll when content exceeds the pane.
    // min-height would break that by letting content push the scroller taller
    // than its parent.
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      height: '100%',
      overflow: 'auto',
    },
    // Content grows to its natural size but also fills when the program is
    // short, so the editor bg extends to the bottom of the pane.
    '.cm-content': {
      padding: '12px 0',
      minHeight: '100%',
      backgroundColor: 'var(--color-bg-0)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--color-bg-1)',
      color: 'var(--color-ink-3)',
      borderRight: '1px solid var(--color-line-soft)',
      minHeight: '100%',
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

  // Global shortcut handler owns ⌘↵; kept local too so the editor can still
  // catch it even when its own keydown handler would otherwise eat it.
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
      className="flex min-h-0 flex-1 flex-col border-b border-line-soft bg-bg-0 lg:border-b-0 lg:border-r"
      data-testid="editor-pane"
    >
      <div className="flex h-8 items-center border-b border-line-soft bg-bg-1 px-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
        main.cpp
      </div>
      <div className="min-h-0 flex-1" data-testid="editor-host">
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
          style={{ height: '100%' }}
        />
      </div>
    </section>
  );
}
