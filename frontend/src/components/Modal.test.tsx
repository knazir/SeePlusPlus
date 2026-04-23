import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders title + children', () => {
    render(
      <Modal title="Hi" onClose={() => {}}>
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('Esc closes', () => {
    const onClose = vi.fn();
    render(
      <Modal title="x" onClose={onClose}>
        x
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking the overlay closes; clicking the card does not', () => {
    const onClose = vi.fn();
    render(
      <Modal title="x" onClose={onClose} data-testid="m">
        <p>body</p>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByTestId('m'));
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.mouseDown(screen.getByText('body'));
    expect(onClose).toHaveBeenCalledOnce(); // unchanged
  });
});
