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
    buildOutput: null,
    stepIndex: 0,
    playing: false,
    consoleOpen: true,
    modal: null,
    themePreference: 'dark',
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

  it('run() surfaces a parsed `{"error": "..."}` body as the user-facing error', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'undefined reference to main' }), { status: 500 }));
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
    expect(s.trace).toBeNull();
    expect(s.error).toBe('undefined reference to main');
  });

  it('run() swaps noisy `Command failed: docker …` bodies for a generic message', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'Command failed: docker run --rm --network spp_no-internet …' }), { status: 500 }));
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
    expect(s.error).toBe('Build or runtime failure. Check the console for details.');
  });

  it('run() falls back to generic message when the body is non-JSON or empty', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 500 }));
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
    expect(s.error).toBe('Build or runtime failure. Check the console for details.');
  });

  it('run() leaves lastRunCode null when the user types between dispatch and resolution', async () => {
    // Race between run-in-flight and user editing. The resolved trace IS for
    // sentCode, but the editor has moved on. useIsStale must fire true so the
    // stale banner shows — even if the user happened to type back to a value
    // that coincidentally matches some prior lastRunCode.
    let release: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchFn = vi.fn<typeof fetch>().mockReturnValue(pending);

    useAppStore.getState().setCode('int main(){return 1;}');
    const inFlight = useAppStore.getState().run(fetchFn);
    // User types during the run.
    useAppStore.getState().setCode('int main(){return 2;}');

    release(okResponse(TINY_TRACE));
    await inFlight;

    const s = useAppStore.getState();
    expect(s.trace).not.toBeNull();
    expect(s.lastRunCode).toBeNull();
    // Derived staleness should reflect the race.
    expect(s.code !== s.lastRunCode).toBe(true);
  });

  it('run() sets lastRunCode to sentCode when the user did not type during the run', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(okResponse(TINY_TRACE));
    useAppStore.getState().setCode('int main(){}');
    await useAppStore.getState().run(fetchFn);
    const s = useAppStore.getState();
    expect(s.lastRunCode).toBe('int main(){}');
    expect(s.code === s.lastRunCode).toBe(true);
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

  it('jumpToNextOccurrence walks forward then wraps', () => {
    // TINY_TRACE has two steps both at line 1, so we build a bespoke trace
    // with varied lines to exercise the search.
    const trace = {
      code: '',
      trace: [
        { ...TINY_TRACE.trace[0]!, line: 10 },
        { ...TINY_TRACE.trace[0]!, line: 20 },
        { ...TINY_TRACE.trace[0]!, line: 10 },
        { ...TINY_TRACE.trace[0]!, line: 30 },
      ],
    };
    useAppStore.setState({ trace, stepIndex: 0 });
    const { jumpToNextOccurrence } = useAppStore.getState();

    jumpToNextOccurrence(10); // from 0, skip self, find next 10 at idx 2
    expect(useAppStore.getState().stepIndex).toBe(2);

    jumpToNextOccurrence(10); // from 2, wrap to idx 0
    expect(useAppStore.getState().stepIndex).toBe(0);

    jumpToNextOccurrence(30); // from 0, find 30 at idx 3
    expect(useAppStore.getState().stepIndex).toBe(3);

    jumpToNextOccurrence(999); // no match — stays put
    expect(useAppStore.getState().stepIndex).toBe(3);
  });

  it('jumpToNextOccurrence is a no-op before a trace is loaded', () => {
    useAppStore.setState({ trace: null, stepIndex: 0 });
    useAppStore.getState().jumpToNextOccurrence(1);
    expect(useAppStore.getState().stepIndex).toBe(0);
  });

  it('step actions are no-ops before a trace is loaded', () => {
    useAppStore.setState({ trace: null, stepIndex: 0 });
    useAppStore.getState().stepForward();
    useAppStore.getState().stepTo(42);
    expect(useAppStore.getState().stepIndex).toBe(0);
  });

  it('stepInto advances to the next step with a deeper stack', () => {
    const base = TINY_TRACE.trace[0]!;
    const deeperFrame = { ...base.stackToRender[0]!, funcName: 'inner' };
    const trace = {
      code: '',
      trace: [
        { ...base, stackToRender: [base.stackToRender[0]!] }, // depth 1
        { ...base, stackToRender: [base.stackToRender[0]!] }, // depth 1 (skipped)
        { ...base, stackToRender: [base.stackToRender[0]!, deeperFrame] }, // depth 2
        { ...base, stackToRender: [base.stackToRender[0]!] }, // depth 1
      ],
    };
    useAppStore.setState({ trace, stepIndex: 0 });
    useAppStore.getState().stepInto();
    expect(useAppStore.getState().stepIndex).toBe(2);
  });

  it('stepOut advances to the next step with a shallower stack', () => {
    const base = TINY_TRACE.trace[0]!;
    const deeperFrame = { ...base.stackToRender[0]!, funcName: 'inner' };
    const trace = {
      code: '',
      trace: [
        { ...base, stackToRender: [base.stackToRender[0]!, deeperFrame] }, // depth 2
        { ...base, stackToRender: [base.stackToRender[0]!, deeperFrame] }, // depth 2 (skipped)
        { ...base, stackToRender: [base.stackToRender[0]!] }, // depth 1 (target)
      ],
    };
    useAppStore.setState({ trace, stepIndex: 0 });
    useAppStore.getState().stepOut();
    expect(useAppStore.getState().stepIndex).toBe(2);
  });

  it('stepInto / stepOut are no-ops when no matching depth exists', () => {
    useAppStore.setState({ trace: TINY_TRACE, stepIndex: 0 });
    useAppStore.getState().stepInto();
    expect(useAppStore.getState().stepIndex).toBe(0);
    useAppStore.getState().stepOut();
    expect(useAppStore.getState().stepIndex).toBe(0);
  });
});
