// Custom line-number gutter with click-to-jump-to-next-occurrence behavior.
// Matches the legacy frontend's affordance: clicking a line number in the
// gutter jumps the trace to the next step executing that line (wraps around
// via the store's jumpToNextOccurrence).
import { lineNumbers } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

export function gutterJump(onJump: (line: number) => void) {
  return lineNumbers({
    domEventHandlers: {
      click(view: EditorView, line) {
        const lineNum = view.state.doc.lineAt(line.from).number;
        onJump(lineNum);
        return true; // handled — stops CM from moving the cursor
      },
    },
  });
}
