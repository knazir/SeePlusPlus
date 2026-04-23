import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore, useIsStale, DEFAULT_PROGRAM } from './index';
import { TINY_TRACE } from '../trace/fixtures';

beforeEach(() => {
  useAppStore.setState({
    code: DEFAULT_PROGRAM,
    running: false,
    trace: null,
    lastRunCode: null,
    error: null,
    stepIndex: 0,
    playing: false,
    recognitionOn: false,
    consoleOpen: true,
    modal: null,
  });
});

describe('useIsStale', () => {
  it('is false before any run', () => {
    const { result } = renderHook(() => useIsStale());
    expect(result.current).toBe(false);
  });

  it('is false when code matches the last run', () => {
    useAppStore.setState({ trace: TINY_TRACE, lastRunCode: DEFAULT_PROGRAM });
    const { result } = renderHook(() => useIsStale());
    expect(result.current).toBe(false);
  });

  it('is true after the user edits the code post-run', () => {
    useAppStore.setState({ trace: TINY_TRACE, lastRunCode: DEFAULT_PROGRAM });
    useAppStore.getState().setCode(DEFAULT_PROGRAM + '// edited\n');
    const { result } = renderHook(() => useIsStale());
    expect(result.current).toBe(true);
  });

  it('resets to false after a successful re-run', async () => {
    useAppStore.setState({ trace: TINY_TRACE, lastRunCode: 'old code' });
    // code differs from lastRunCode → stale
    expect(useAppStore.getState().trace !== null && useAppStore.getState().code !== 'old code').toBe(
      true,
    );
    // Re-run with the new code.
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(TINY_TRACE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await useAppStore.getState().run(fetchFn);
    expect(useAppStore.getState().lastRunCode).toBe(DEFAULT_PROGRAM);
    const { result } = renderHook(() => useIsStale());
    expect(result.current).toBe(false);
  });
});
