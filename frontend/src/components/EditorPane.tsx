import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { cpp } from '@codemirror/lang-cpp';
import { useAppStore, useCurrentStep, useIsStale } from '../store';
import { setTraceLine, traceLineField } from '../editor/traceLine';
import { gutterJump } from '../editor/gutterJump';

// Four spaces per indent level, with Tab key inserting an indent (spaces,
// not \t). Matches the default program's formatting and the legacy See++
// editor's convention. indentUnit accepts either spaces or \t — we emit
// spaces so copied code pastes cleanly into anywhere.
const FOUR_SPACES = '    ';

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
    // Gutter line numbers are clickable — gutterJump jumps the trace to the
    // next step executing that line. Pointer cursor signals that clickability.
    '.cm-lineNumbers .cm-gutterElement': {
      cursor: 'pointer',
    },
    // Cursor's line — subtle so it doesn't fight the trace-line highlight
    // when both are on the same physical row.
    '.cm-activeLine': {
      backgroundColor: 'var(--color-bg-1)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--color-bg-1)',
      color: 'var(--color-ink-1)',
    },
    // Executing trace line — prominent accent strip + soft background.
    // Intentionally louder than the cursor highlight; wins when both land
    // on the same line (rendered after .cm-activeLine in the cascade).
    '.cm-trace-line': {
      backgroundColor: 'var(--color-accent-soft)',
      boxShadow: 'inset 3px 0 0 var(--color-accent)',
    },
    '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-accent-soft)',
    },
  },
  { dark: true },
);

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
  const jumpToNextOccurrence = useAppStore((s) => s.jumpToNextOccurrence);
  const step = useCurrentStep();
  const stale = useIsStale();
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => [
      cpp(),
      syntaxHighlighting(sppHighlight),
      // Custom line numbers with click-to-jump-to-next-occurrence. Replaces
      // basicSetup's lineNumbers (disabled below) to keep a single gutter.
      gutterJump((line) => jumpToNextOccurrence(line)),
      traceLineField,
      // 4-space indentation. tabSize controls visual column width for any
      // literal tab characters; indentUnit controls what gets INSERTED on
      // new lines / Tab press (4 spaces). indentWithTab rebinds Tab to the
      // indent command so it inserts an indent unit instead of a literal tab.
      EditorState.tabSize.of(4),
      indentUnit.of(FOUR_SPACES),
      // Mod-Enter runs the trace. @uiw/react-codemirror's basicSetup binds
      // Mod-Enter to insertBlankLine by default — Prec.highest pulls our
      // binding ahead of it so we get the run() action instead of a blank
      // line being inserted. Zustand actions are stable references, so we
      // can read it from the store at the moment of dispatch — no ref
      // forwarding indirection needed. indentWithTab keeps its normal
      // precedence.
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              void useAppStore.getState().run();
              return true;
            },
          },
        ]),
      ),
      keymap.of([indentWithTab]),
      sppTheme,
    ],
    [jumpToNextOccurrence],
  );

  // Sync the current trace step's line into the editor's StateField.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setTraceLine.of(step?.line ?? null) });
  }, [step]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col border-b border-line bg-bg-0 lg:border-b-0"
      data-testid="editor-pane"
    >
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
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          extensions={extensions}
          basicSetup={{
            // We provide our own gutter so the click handler can wire the
            // jump-to-next-occurrence affordance.
            lineNumbers: false,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
          }}
          height="100%"
          style={{ height: '100%' }}
        />
      </div>
    </section>
  );
}
