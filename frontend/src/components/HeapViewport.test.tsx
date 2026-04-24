import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { HeapViewport } from './HeapViewport';
import { useAppStore } from '../store';
import { LL_TRACE } from '../trace/fixtures';

// jsdom doesn't implement PointerEvent or setPointerCapture. The component
// only exercises clientX/Y/button/pointerId, so we forward those on a plain
// MouseEvent; setPointerCapture gets stubbed as a no-op.
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
  useAppStore.setState({ trace: LL_TRACE, stepIndex: 0 });
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function fire(el: Element, type: string, x: number, y: number, buttons = 1) {
  el.dispatchEvent(
    new FakePointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
      pointerId: 1,
    }) as unknown as PointerEvent,
  );
}

describe('HeapViewport', () => {
  it('renders viewport + world wrappers with zero initial transform', () => {
    render(
      <HeapViewport>
        <div data-testid="child" />
      </HeapViewport>,
    );
    const viewport = screen.getByTestId('heap-viewport');
    const world = screen.getByTestId('heap-world');
    expect(viewport.contains(world)).toBe(true);
    expect(world.contains(screen.getByTestId('child'))).toBe(true);
    expect(world.style.transform).toBe('translate(0px, 0px)');
  });

  it('applies a pan transform after a drag that exceeds the threshold', () => {
    render(
      <HeapViewport>
        <div />
      </HeapViewport>,
    );
    const viewport = screen.getByTestId('heap-viewport');
    const world = screen.getByTestId('heap-world');
    fire(viewport, 'pointerdown', 100, 100);
    fire(viewport, 'pointermove', 150, 130); // Δ = 50, 30 → past 4px threshold
    fire(viewport, 'pointerup', 150, 130);
    expect(world.style.transform).toBe('translate(50px, 30px)');
  });

  it('ignores sub-threshold drags so card clicks still work', () => {
    render(
      <HeapViewport>
        <div />
      </HeapViewport>,
    );
    const viewport = screen.getByTestId('heap-viewport');
    const world = screen.getByTestId('heap-world');
    fire(viewport, 'pointerdown', 100, 100);
    fire(viewport, 'pointermove', 102, 101); // Δ = 2,1 → under threshold
    fire(viewport, 'pointerup', 102, 101);
    expect(world.style.transform).toBe('translate(0px, 0px)');
  });

  it('recenters (resets offset to 0,0) when the trace identity changes', () => {
    const { rerender } = render(
      <HeapViewport>
        <div />
      </HeapViewport>,
    );
    const viewport = screen.getByTestId('heap-viewport');
    const world = screen.getByTestId('heap-world');
    fire(viewport, 'pointerdown', 100, 100);
    fire(viewport, 'pointermove', 180, 150);
    fire(viewport, 'pointerup', 180, 150);
    expect(world.style.transform).toBe('translate(80px, 50px)');

    // Swap to a new trace — a new run. The effect should reset the world.
    act(() => {
      useAppStore.setState({ trace: { ...LL_TRACE, code: 'different code' }, stepIndex: 0 });
    });
    rerender(
      <HeapViewport>
        <div />
      </HeapViewport>,
    );
    expect(world.style.transform).toBe('translate(0px, 0px)');
  });
});
