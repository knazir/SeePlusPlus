import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExecutionBar } from './ExecutionBar';
import { useAppStore, DEFAULT_PROGRAM } from '../store';
import { TINY_TRACE } from '../trace/fixtures';

beforeEach(() => {
  useAppStore.setState({
    code: DEFAULT_PROGRAM,
    running: false,
    trace: TINY_TRACE,
    lastRunCode: DEFAULT_PROGRAM,
    error: null,
    stepIndex: 0,
    playing: false,
    recognitionOn: false,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExecutionBar', () => {
  it('disables step + play controls before a trace is loaded', () => {
    useAppStore.setState({ trace: null, stepIndex: 0, playing: false });
    render(<ExecutionBar />);
    expect(screen.getByTestId('exec-play')).toBeDisabled();
    expect(screen.getByTestId('exec-scrub')).toBeDisabled();
  });

  it('scrubs to a specific step via the range input', () => {
    render(<ExecutionBar />);
    fireEvent.change(screen.getByTestId('exec-scrub'), { target: { value: '1' } });
    expect(useAppStore.getState().stepIndex).toBe(1);
  });

  it('play advances one step per interval tick and auto-stops at the end', () => {
    render(<ExecutionBar />);
    // Starting state: step 0 of 2.
    fireEvent.click(screen.getByTestId('exec-play'));
    expect(useAppStore.getState().playing).toBe(true);

    // Advance past one interval → step 1.
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(useAppStore.getState().stepIndex).toBe(1);

    // At the last step, the play loop clears itself.
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(useAppStore.getState().playing).toBe(false);
    expect(useAppStore.getState().stepIndex).toBe(1);
  });

  it('hitting play when already at the end rewinds to 0 first', () => {
    useAppStore.setState({ stepIndex: 1 });
    render(<ExecutionBar />);
    fireEvent.click(screen.getByTestId('exec-play'));
    expect(useAppStore.getState().stepIndex).toBe(0);
    expect(useAppStore.getState().playing).toBe(true);
  });

  it('shows the current step line in the line indicator', () => {
    useAppStore.setState({ stepIndex: 1 });
    render(<ExecutionBar />);
    // TINY_TRACE step 1 is at line 1.
    expect(screen.getByTestId('exec-line')).toHaveTextContent('01');
  });
});
