import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, DEFAULT_PROGRAM } from './index';
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
  });
});

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useAppStore — workspace + execution', () => {
  it('starts with the default program and no trace', () => {
    const s = useAppStore.getState();
    expect(s.code).toBe(DEFAULT_PROGRAM);
    expect(s.trace).toBeNull();
    expect(s.running).toBe(false);
    expect(s.stepIndex).toBe(0);
  });

  it('setCode updates the code', () => {
    useAppStore.getState().setCode('int main() { return 0; }');
    expect(useAppStore.getState().code).toBe('int main() { return 0; }');
  });

  it('run() posts the current code and stores the validated trace on success', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(okResponse(TINY_TRACE));
    useAppStore.getState().setCode('int main(){}');

    await useAppStore.getState().run(fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/run');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: 'int main(){}' });

    const s = useAppStore.getState();
    expect(s.running).toBe(false);
    expect(s.trace?.trace).toHaveLength(2);
    expect(s.error).toBeNull();
    expect(s.stepIndex).toBe(0);
  });

  it('run() surfaces a shape-drift error when the body does not match the schema', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(okResponse({ oops: true }));
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
    expect(s.trace).toBeNull();
    expect(s.error).toMatch(/unexpected trace shape/i);
  });

  it('run() captures a backend HTTP error with status + body', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('compile barfed', { status: 500 }));
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
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

    await useAppStore.getState().run(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    release(okResponse(TINY_TRACE));
    await first;
    expect(useAppStore.getState().running).toBe(false);
  });
});

describe('useAppStore — step navigation', () => {
  beforeEach(() => {
    // Seed a trace so the step actions have something to operate on.
    useAppStore.setState({ trace: TINY_TRACE, stepIndex: 0 });
  });

  it('stepForward / stepBackward clamp at the trace bounds', () => {
    const { stepForward, stepBackward } = useAppStore.getState();
    stepBackward();
    expect(useAppStore.getState().stepIndex).toBe(0); // already at start
    stepForward();
    expect(useAppStore.getState().stepIndex).toBe(1);
    stepForward();
    expect(useAppStore.getState().stepIndex).toBe(1); // clamped at last
  });

  it('stepTo clamps out-of-bounds values', () => {
    const { stepTo } = useAppStore.getState();
    stepTo(99);
    expect(useAppStore.getState().stepIndex).toBe(1);
    stepTo(-5);
    expect(useAppStore.getState().stepIndex).toBe(0);
  });

  it('step actions are no-ops before a trace is loaded', () => {
    useAppStore.setState({ trace: null, stepIndex: 0 });
    useAppStore.getState().stepForward();
    useAppStore.getState().stepTo(42);
    expect(useAppStore.getState().stepIndex).toBe(0);
  });
});
