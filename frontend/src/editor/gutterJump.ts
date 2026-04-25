// Click-to-jump line-number gutter: clicking a number scrubs the trace
// to the next step executing that line.
import { lineNumbers } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

export function gutterJump(onJump: (line: number) => void) {
  return lineNumbers({
    domEventHandlers: {
      // Block the default focus transfer to CM's contenteditable so
      // Arrow-key scrubbing keeps working after a gutter click.
      mousedown(_view, _line, event) {
        event.preventDefault();
        return false;
      },
      click(view: EditorView, line) {
        const lineNum = view.state.doc.lineAt(line.from).number;
        onJump(lineNum);
        return true;
      },
    },
  });
}
