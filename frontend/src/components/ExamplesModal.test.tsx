import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExamplesModal } from './ExamplesModal';
import { useAppStore } from '../store';

beforeEach(() => {
  useAppStore.setState({ code: '// old', modal: 'examples' });
});

describe('ExamplesModal', () => {
  it('renders the canned examples (post-expansion IDs)', () => {
    render(<ExamplesModal />);
    expect(screen.getByTestId('examples-list')).toBeInTheDocument();
    expect(screen.getByTestId('example-ll-reverse')).toBeInTheDocument();
    expect(screen.getByTestId('example-fact-rec')).toBeInTheDocument();
    expect(screen.getByTestId('example-hello')).toBeInTheDocument();
    expect(screen.getByTestId('example-bst-insert')).toBeInTheDocument();
    expect(screen.getByTestId('example-ptr-swap')).toBeInTheDocument();
    expect(screen.getByTestId('example-arr-dyn')).toBeInTheDocument();
  });

  it('picking an example loads its code and closes the modal', () => {
    render(<ExamplesModal />);
    fireEvent.click(screen.getByTestId('example-hello'));
    expect(useAppStore.getState().code).toMatch(/Hello, world!/);
    expect(useAppStore.getState().modal).toBeNull();
  });
});
