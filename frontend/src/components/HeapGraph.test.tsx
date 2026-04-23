import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeapGraph } from './HeapGraph';
import { useAppStore } from '../store';
import { LL_TRACE } from '../trace/fixtures';

beforeEach(() => {
  useAppStore.setState({ trace: LL_TRACE, stepIndex: 0 });
});

describe('HeapGraph', () => {
  it('renders one HeapNode per heap entry in the current step', () => {
    render(<HeapGraph />);
    const nodes = screen.getAllByTestId('heap-node');
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.getAttribute('data-heap-addr')).toBe('0xaaa');
    expect(nodes[1]!.getAttribute('data-heap-addr')).toBe('0xbbb');
  });

  it('emits data-ptr-target for pointer fields so EdgeLayer can anchor', () => {
    render(<HeapGraph />);
    const ptrValues = screen.getAllByTestId('ptr-value');
    // Only the first node's `next` points at a real address — the second
    // node's `next` is nullptr and renders as a chip instead.
    expect(ptrValues).toHaveLength(1);
    expect(ptrValues[0]!.getAttribute('data-ptr-target')).toBe('0xbbb');
  });

  it('renders nullptr as a slashed chip, not as a pointer edge source', () => {
    render(<HeapGraph />);
    const chips = screen.getAllByTestId('nullptr-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute('data-ptr-target')).toBe('null');
  });

  it('renders struct field values inline (non-pointer fields visible)', () => {
    render(<HeapGraph />);
    // `value` fields: 1 and 2.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the empty-state copy when the heap is empty', () => {
    // A step with an empty heap map.
    useAppStore.setState({
      trace: {
        code: '',
        trace: [
          {
            event: 'stepLine',
            line: 1,
            funcName: 'main',
            stackToRender: [],
            globals: {},
            heap: {},
            orderedGlobals: [],
            stdout: '',
          },
        ],
      },
      stepIndex: 0,
    });
    render(<HeapGraph />);
    expect(screen.getByTestId('heap-empty')).toBeInTheDocument();
  });
});
