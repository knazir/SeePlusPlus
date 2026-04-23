import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { useAppStore, DEFAULT_PROGRAM } from './store';

// Integration test: renders the real App (all four panes + store) and
// exercises a Run click end-to-end with a stubbed global fetch. This covers
// the wiring we care about:
//   - default program is seeded in the editor
//   - clicking Run fires POST /api/run
//   - the returned trace appears in the viz pane
//   - stdout/stderr appear in the console
// Store-level branch coverage (errors, reentrancy) lives in store.test.ts;
// no need to re-run those assertions through the DOM.

const fakeTrace = { steps: [{ line: 1 }], stdout: 'hi\n' };

beforeEach(() => {
  useAppStore.setState({
    code: DEFAULT_PROGRAM,
    running: false,
    trace: null,
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(fakeTrace), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the four layout regions', () => {
    render(<App />);
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    expect(screen.getByTestId('viz-pane')).toBeInTheDocument();
    expect(screen.getByTestId('console-pane')).toBeInTheDocument();
  });

  it('clicking Run posts the code and renders the returned trace + stdout', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('run-button'));

    await waitFor(() => expect(screen.queryByTestId('viz-json')).toBeInTheDocument());
    expect(screen.getByTestId('viz-json').textContent).toContain('"line": 1');
    expect(screen.getByTestId('console-stdout').textContent).toContain('hi');
  });
});
