import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Splitter } from './Splitter';

// jsdom lacks PointerEvent. Mirror the polyfill pattern used in
// HeapViewport.test.tsx so pointer events fire through to the component.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit & MouseEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
// @ts-expect-error jsdom polyfill
globalThis.PointerEvent = FakePointerEvent;

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  // Ensure body-cursor / userSelect are reset in case a test threw mid-drag.
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

function Harness({
  orientation = 'horizontal',
  min = 0.2,
  max = 0.8,
  step = 0.05,
  initial = 0.5,
  compute = (e: { clientX: number; clientY: number }) =>
    orientation === 'horizontal' ? e.clientX / 1000 : 1000 - e.clientY,
  onResetCalled,
}: {
  orientation?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  compute?: (e: { clientX: number; clientY: number }) => number;
  onResetCalled?: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <Splitter
      orientation={orientation}
      value={v}
      onChange={setV}
      onReset={() => {
        setV(initial);
        onResetCalled?.();
      }}
      computeValueFromPointer={compute}
      clamp={(x) => Math.max(min, Math.min(max, x))}
      step={step}
      ariaLabel="test splitter"
      data-testid="splitter"
    />
  );
}

// fireEvent.pointerDown / Move / Up go through React's synthetic-event
// pipeline, which is what Splitter listens on. Dispatching a raw PointerEvent
// bypasses React's listener and leaves draggingRef untouched.
const fire = {
  down: (el: Element, init: PointerEventInit & MouseEventInit = {}) =>
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, ...init }),
  move: (el: Element, init: PointerEventInit & MouseEventInit = {}) =>
    fireEvent.pointerMove(el, { pointerId: 1, ...init }),
  up: (el: Element, init: PointerEventInit & MouseEventInit = {}) =>
    fireEvent.pointerUp(el, { pointerId: 1, ...init }),
};

describe('Splitter — rendering + accessibility', () => {
  it('renders with role=separator and forwards orientation + aria-valuenow', () => {
    render(<Harness orientation="horizontal" initial={0.42} />);
    const sep = screen.getByTestId('splitter');
    expect(sep.getAttribute('role')).toBe('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('horizontal');
    expect(sep.getAttribute('aria-label')).toBe('test splitter');
    expect(sep.getAttribute('aria-valuenow')).toBe('0.42');
    expect(sep.getAttribute('tabindex')).toBe('0');
  });

  it('applies orientation-aware cursor class', () => {
    const { rerender } = render(<Harness orientation="horizontal" />);
    expect(screen.getByTestId('splitter').className).toContain('cursor-col-resize');
    rerender(<Harness orientation="vertical" />);
    expect(screen.getByTestId('splitter').className).toContain('cursor-row-resize');
  });
});

describe('Splitter — drag', () => {
  it('updates value on pointermove while dragging, and clamps into range', () => {
    render(<Harness orientation="horizontal" min={0.2} max={0.8} initial={0.5} />);
    const sep = screen.getByTestId('splitter');
    fire.down(sep, { clientX: 500, clientY: 10 });
    fire.move(sep, { clientX: 700, clientY: 10 });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.7');
    // Far off-range move should clamp at the max.
    fire.move(sep, { clientX: 5000, clientY: 10 });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.8');
    // Far negative should clamp at the min.
    fire.move(sep, { clientX: -500, clientY: 10 });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.2');
    fire.up(sep, { clientX: -500, clientY: 10 });
  });

  it('suppresses text selection + sets body cursor during drag, and restores on release', () => {
    render(<Harness orientation="horizontal" />);
    const sep = screen.getByTestId('splitter');
    fire.down(sep, { clientX: 500, clientY: 10 });
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
    fire.up(sep, { clientX: 500, clientY: 10 });
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('ignores pointer moves that happen without a preceding pointerdown', () => {
    render(<Harness orientation="horizontal" initial={0.5} />);
    const sep = screen.getByTestId('splitter');
    fire.move(sep, { clientX: 900, clientY: 10 });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.5');
  });

  it('ignores non-left mouse button pointerdowns', () => {
    render(<Harness orientation="horizontal" initial={0.5} />);
    const sep = screen.getByTestId('splitter');
    fire.down(sep, { button: 2, clientX: 500, clientY: 10 });
    fire.move(sep, { clientX: 900, clientY: 10 });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.5');
  });
});

describe('Splitter — keyboard', () => {
  it('ArrowRight / ArrowLeft nudge horizontally by step, clamped', () => {
    render(<Harness orientation="horizontal" min={0.2} max={0.8} step={0.05} initial={0.5} />);
    const sep = screen.getByTestId('splitter');
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.55');
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.5');
    // Drive to the top clamp
    for (let i = 0; i < 20; i++) fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.8');
  });

  it('ArrowUp / ArrowDown nudge vertically, with ArrowUp growing the value', () => {
    render(<Harness orientation="vertical" min={80} max={500} step={16} initial={200} />);
    const sep = screen.getByTestId('splitter');
    fireEvent.keyDown(sep, { key: 'ArrowUp' });
    expect(sep.getAttribute('aria-valuenow')).toBe('216');
    fireEvent.keyDown(sep, { key: 'ArrowDown' });
    expect(sep.getAttribute('aria-valuenow')).toBe('200');
  });

  it('Enter triggers onReset', () => {
    const onReset = vi.fn();
    render(<Harness orientation="horizontal" initial={0.5} onResetCalled={onReset} />);
    const sep = screen.getByTestId('splitter');
    // First nudge off the initial value, then press Enter.
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(sep.getAttribute('aria-valuenow')).toBe('0.55');
    fireEvent.keyDown(sep, { key: 'Enter' });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(sep.getAttribute('aria-valuenow')).toBe('0.5');
  });

  it('double-click triggers onReset', () => {
    const onReset = vi.fn();
    render(<Harness orientation="horizontal" onResetCalled={onReset} />);
    fireEvent.doubleClick(screen.getByTestId('splitter'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
