// CodeMirror extension: "the line currently being executed by the active trace
// step." Separate from the user's cursor line so both can be visible at once.
//
// State shape is a single number (1-based line) or null (no trace). The
// decoration updates via a dispatched effect from EditorPane when stepIndex
// changes in the store.
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

export const setTraceLine = StateEffect.define<number | null>();

const traceLineMark = Decoration.line({ attributes: { class: 'cm-trace-line' } });

export const traceLineField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setTraceLine)) return e.value;
    return value;
  },
  provide: (f) =>
    EditorView.decorations.compute([f], (state): DecorationSet => {
      const line = state.field(f);
      if (line === null || line < 1 || line > state.doc.lines) return Decoration.none;
      const pos = state.doc.line(line).from;
      return Decoration.set([traceLineMark.range(pos)]);
    }),
});
