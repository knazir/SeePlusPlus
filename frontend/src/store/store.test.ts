import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, DEFAULT_PROGRAM } from './index';

// Reset the store between tests. Zustand's create() gives us setState at hand
// via the hook itself for the reset path.
beforeEach(() => {
  useAppStore.setState({
    code: DEFAULT_PROGRAM,
    running: false,
    trace: null,
    error: null,
  });
});

describe('useAppStore', () => {
  it('starts with the default program and no trace', () => {
    const s = useAppStore.getState();
    expect(s.code).toBe(DEFAULT_PROGRAM);
    expect(s.trace).toBeNull();
    expect(s.error).toBeNull();
    expect(s.running).toBe(false);
  });

  it('setCode updates the code', () => {
    useAppStore.getState().setCode('int main() { return 0; }');
    expect(useAppStore.getState().code).toBe('int main() { return 0; }');
  });

  it('run() posts the current code and stores the returned trace on success', async () => {
    const fakeTrace = { steps: [{ line: 1 }], stdout: 'hi\n' };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(fakeTrace), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    useAppStore.getState().setCode('int main(){}');

    await useAppStore.getState().run(fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/run');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: 'int main(){}' });

    const s = useAppStore.getState();
    expect(s.running).toBe(false);
    expect(s.trace).toEqual(fakeTrace);
    expect(s.error).toBeNull();
  });

  it('run() captures a backend error message when the response is not OK', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('compile barfed', { status: 500 }));

    await useAppStore.getState().run(fetchFn);

    const s = useAppStore.getState();
    expect(s.running).toBe(false);
    expect(s.trace).toBeNull();
    expect(s.error).toMatch(/500/);
    expect(s.error).toContain('compile barfed');
  });

  it('run() is reentrancy-safe while a previous run is in flight', async () => {
    let release: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchFn = vi.fn<typeof fetch>().mockReturnValue(pending);

    const first = useAppStore.getState().run(fetchFn);
    expect(useAppStore.getState().running).toBe(true);

    // Second run() should not trigger a second fetch.
    await useAppStore.getState().run(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    release(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await first;
    expect(useAppStore.getState().running).toBe(false);
  });
});
