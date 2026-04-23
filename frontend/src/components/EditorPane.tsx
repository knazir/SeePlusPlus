// CM6 chosen over Monaco for v1; revisit at multi-file (backlog #17+).
// See docs/v2/adr/0004-editor-cm6.md.
import { useEffect, useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { cpp } from '@codemirror/lang-cpp';
import { useAppStore, useIsStale } from '../store';

const sppTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--color-bg-0)',
      color: 'var(--color-ink-0)',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      height: '100%',
    },
    '.cm-editor': { height: '100%' },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      height: '100%',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '10px 0',
      minHeight: '100%',
      backgroundColor: 'var(--color-bg-0)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--color-bg-0)',
      color: 'var(--color-ink-3)',
      borderRight: '1px solid var(--color-line-soft)',
      minHeight: '100%',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--color-accent-soft)',
      boxShadow: 'inset 0 1px 0 var(--color-accent-line), inset 0 -1px 0 var(--color-accent-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--color-accent)',
    },
    '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-accent-soft)',
    },
  },
  { dark: true },
);

// Syntax palette — all hex values live as CSS tokens (see index.css @theme
// and html[data-theme='light'] overrides), so the editor re-themes for free
// when the user flips light/dark. No JS theme-aware logic in here.
const sppHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword], color: 'var(--color-syntax-kw)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--color-syntax-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--color-syntax-fn)' },
  { tag: [t.string, t.character, t.special(t.string)], color: 'var(--color-syntax-str)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--color-syntax-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--color-ink-3)', fontStyle: 'italic' },
  { tag: [t.punctuation, t.bracket, t.derefOperator], color: 'var(--color-ink-1)' },
  { tag: [t.operator, t.logicOperator, t.arithmeticOperator], color: 'var(--color-ink-1)' },
  { tag: [t.processingInstruction, t.meta], color: 'var(--color-syntax-preproc)' },
  { tag: [t.variableName, t.propertyName], color: 'var(--color-ink-0)' },
]);

export function EditorPane() {
  const code = useAppStore((s) => s.code);
  const setCode = useAppStore((s) => s.setCode);
  const run = useAppStore((s) => s.run);
  const stale = useIsStale();

  const extensions = useMemo(() => [cpp(), syntaxHighlighting(sppHighlight), sppTheme], []);

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
      className="flex min-h-0 flex-1 flex-col border-b border-line bg-bg-0 lg:border-b-0 lg:border-r"
      data-testid="editor-pane"
    >
      {/* Tab bar */}
      <div
        className="flex h-[34px] shrink-0 items-stretch border-b border-line bg-bg-0"
        data-testid="editor-tab-bar"
      >
        <div
          data-testid="editor-tab"
          data-active
          className="relative flex items-center gap-2 border-r border-line-soft bg-bg-1 px-3.5 font-mono text-[12px] text-ink-0"
        >
          <span aria-hidden className="text-ink-3">▸</span>
          <span>main.cpp</span>
          {stale && (
            <span
              data-testid="editor-stale-dot"
              title="Edited since the last run"
              className="inline-block h-1.5 w-1.5 rounded-full bg-warn"
            />
          )}
          <span
            className="ml-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-[2px] text-[11px] text-ink-3 hover:bg-bg-3 hover:text-ink-1"
            aria-label="close (disabled in single-file mode)"
          >
            ×
          </span>
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-accent"
          />
        </div>
        <div className="flex-1 border-b border-line" />
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
          // No `theme="dark"` prop — it would apply CM's built-in dark theme
          // ON TOP of sppTheme and hardcode gutter / scroller backgrounds for
          // dark, defeating the light-theme override. Our sppTheme already
          // reads everything from --color-* vars.
          height="100%"
          style={{ height: '100%' }}
        />
      </div>
    </section>
  );
}
