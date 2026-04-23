import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StackFrames } from './StackFrames';
import { useAppStore } from '../store';
import type { ProgramTrace } from '../trace/schema';

// Two-frame trace: main() calls foo(). main is condensed (inactive), foo is
// active. Lets one test cover expanded-vs-condensed behavior without
// duplicating setup.
const TWO_FRAMES: ProgramTrace = {
  code: '',
  trace: [
    {
      event: 'call',
      line: 10,
      funcName: 'foo',
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['arg'],
          isHighlighted: false,
          frameId: '0x1',
          uniqueHash: 'main_0x1',
          encodedLocals: { arg: ['C_DATA', '0x10', 'int', 7] },
          line: 2,
        },
        {
          funcName: 'foo',
          orderedVarNames: ['x'],
          isHighlighted: true,
          frameId: '0x2',
          uniqueHash: 'foo_0x2',
          encodedLocals: { x: ['C_DATA', '0x20', 'int', 42] },
          line: 10,
        },
      ],
      globals: {},
      heap: {},
      orderedGlobals: [],
      stdout: '',
    },
  ],
};

beforeEach(() => {
  useAppStore.setState({ trace: TWO_FRAMES, stepIndex: 0 });
});

describe('StackFrames', () => {
  it('renders the top-of-stack frame first', () => {
    render(<StackFrames />);
    // Frame name now includes the function signature (args in parens).
    const names = screen.getAllByTestId('frame-name').map((el) => el.textContent);
    expect(names).toEqual(['foo(x)', 'main(arg)']);
  });

  it('marks only the active frame with data-active; only the active frame is expanded by default', () => {
    render(<StackFrames />);
    const frames = screen.getAllByTestId('stack-frame');
    expect(frames[0]).toHaveAttribute('data-active');
    expect(frames[1]).not.toHaveAttribute('data-active');
    // Active frame is auto-expanded; inactive is collapsed (no frame-locals).
    expect(screen.getAllByTestId('frame-locals')).toHaveLength(1);
    expect(screen.getByTestId('local-x')).toHaveTextContent('42');
    expect(screen.queryByTestId('local-arg')).toBeNull();
  });

  it('shows the empty-state copy before a trace is loaded', () => {
    useAppStore.setState({ trace: null, stepIndex: 0 });
    render(<StackFrames />);
    expect(screen.getByTestId('stack-empty')).toBeInTheDocument();
  });
});
