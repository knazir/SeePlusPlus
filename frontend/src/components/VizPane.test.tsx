import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { VizPane } from './VizPane';
import { HoverProvider } from '../viz/hoverContext';
import { useAppStore } from '../store';
import { LL_TRACE } from '../trace/fixtures';

// jsdom doesn't implement setPointerCapture (used by HeapViewport rendered
// inside VizPane). Stub it so rendering doesn't blow up.
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
  // Start each test from a clean, known-default store shape.
  useAppStore.setState({
    trace: null,
    error: null,
    buildOutput: null,
    running: false,
    stepIndex: 0,
    lastRunCode: null,
    code: 'int main(){}',
  });
});
afterEach(() => {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

function renderViz() {
  return render(
    <HoverProvider>
      <VizPane />
    </HoverProvider>,
  );
}

describe('VizPane — empty states', () => {
  it('shows the run-prompt when no trace, not running, and no error', () => {
    renderViz();
    expect(screen.getByTestId('viz-empty').textContent).toContain('Click');
    expect(screen.getByTestId('viz-empty').textContent).toContain('Run');
    // The run-cta hints at the keyboard shortcut alongside the Run label.
    expect(screen.queryByTestId('viz-empty-error')).toBeNull();
    expect(screen.queryByTestId('viz-running')).toBeNull();
  });

  it('shows "running…" when a run is in flight and no prior trace', () => {
    act(() => {
      useAppStore.setState({ running: true, trace: null });
    });
    renderViz();
    expect(screen.getByTestId('viz-running').textContent).toContain('running');
  });

  it('shows the build-error empty state (no trace) when the store has an error', () => {
    act(() => {
      useAppStore.setState({
        running: false,
        trace: null,
        error: "line 11: expected ';' before 'return'",
        buildOutput: "line 11: expected ';' before 'return'",
      });
    });
    renderViz();
    expect(screen.getByTestId('viz-empty-error').textContent).toContain('No trace');
    // Run-prompt must NOT render in this state.
    expect(screen.queryByTestId('viz-empty')).toBeNull();
  });
});

describe('VizPane — banners', () => {
  it('renders the build-failed banner with the error text + a re-run button', () => {
    const run = vi.fn();
    act(() => {
      useAppStore.setState({
        running: false,
        trace: null,
        error: 'expected semicolon',
        run,
      });
    });
    renderViz();
    const banner = screen.getByTestId('viz-error-banner');
    expect(banner.textContent).toContain('Build failed');
    expect(banner.textContent).toContain('expected semicolon');
    // Stale banner must not render at the same time (error wins).
    expect(screen.queryByTestId('viz-stale-banner')).toBeNull();
    fireEvent.click(screen.getByTestId('viz-error-run'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('renders the stale banner when trace exists but code has been edited', () => {
    const run = vi.fn();
    act(() => {
      useAppStore.setState({
        trace: LL_TRACE,
        lastRunCode: 'old code',
        code: 'new code',
        running: false,
        error: null,
        run,
      });
    });
    renderViz();
    const banner = screen.getByTestId('viz-stale-banner');
    expect(banner.textContent).toContain('Trace is stale');
    expect(screen.queryByTestId('viz-error-banner')).toBeNull();
    fireEvent.click(screen.getByTestId('viz-stale-run'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('shows neither banner on the happy path (trace fresh + no error)', () => {
    act(() => {
      useAppStore.setState({
        trace: LL_TRACE,
        lastRunCode: LL_TRACE.code,
        code: LL_TRACE.code,
        running: false,
        error: null,
      });
    });
    renderViz();
    expect(screen.queryByTestId('viz-stale-banner')).toBeNull();
    expect(screen.queryByTestId('viz-error-banner')).toBeNull();
  });
});

describe('VizPane — header', () => {
  it('renders the viz header label', () => {
    renderViz();
    expect(screen.getByTestId('viz-pane').textContent?.toLowerCase()).toContain('visualization');
  });

  it('hides the Recenter button when there is no trace', () => {
    renderViz();
    expect(screen.queryByTestId('heap-recenter')).toBeNull();
  });

  it('shows the Recenter button when a trace is loaded', () => {
    act(() => {
      useAppStore.setState({
        trace: LL_TRACE,
        lastRunCode: LL_TRACE.code,
        code: LL_TRACE.code,
      });
    });
    renderViz();
    expect(screen.getByTestId('heap-recenter')).toBeTruthy();
  });
});
