// Custom line-number gutter with click-to-jump-to-next-occurrence behavior.
// Matches the legacy frontend's affordance: clicking a line number in the
// gutter jumps the trace to the next step executing that line (wraps around
// via the store's jumpToNextOccurrence).
import { lineNumbers } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

export function gutterJump(onJump: (line: number) => void) {
  return lineNumbers({
    domEventHandlers: {
      // Browsers default to moving focus to the nearest contenteditable on
      // mousedown. For a gutter click we don't want that — it would steal
      // focus from the timeline and start swallowing Arrow-key scrubs into
      // CM's caret. preventDefault on mousedown stops the focus transfer
      // at its source; the subsequent click still fires normally.
      mousedown(_view, _line, event: MouseEvent) {
        event.preventDefault();
        return false; // don't claim handled — let click keep flowing
      },
      click(view: EditorView, line) {
        const lineNum = view.state.doc.lineAt(line.from).number;
        onJump(lineNum);
        return true; // handled — stops CM from moving the cursor
      },
    },
  });
}
