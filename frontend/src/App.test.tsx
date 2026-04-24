import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { useAppStore, DEFAULT_PROGRAM } from './store';
import { TINY_TRACE } from './trace/fixtures';

// Integration test: real App (all panes + store) wired up, with fetch stubbed.
// Covers the end-to-end: seeded editor → click Run → validated trace reaches
// the viz pane → step controls move the frame view. Branch coverage (errors,
// reentrancy, shape drift, step clamping) lives in the store + schema tests;
// this test just verifies DOM wiring.

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
    me: null,
    authChecked: false,
    authProviders: [],
  });
  // Route-aware mock: /api/auth/me returns a no-user response; everything
  // else returns TINY_TRACE. Fresh Response per call so body streams aren't
  // reused across fetches (loadMe on mount + Run click = two fetches).
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url ?? '';
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ user: null, providers: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(TINY_TRACE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
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
    expect(screen.getByTestId('exec-bar')).toBeInTheDocument();
  });

  it('Run → renders stack frames from the validated trace and steps advance', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('run-button'));

    await waitFor(() => expect(screen.queryByTestId('stack-frames')).toBeInTheDocument());
    expect(screen.getByTestId('exec-counter')).toHaveTextContent(/01\s*\/\s*02/);

    fireEvent.click(screen.getByTestId('exec-step-forward'));
    expect(screen.getByTestId('exec-counter')).toHaveTextContent(/02\s*\/\s*02/);
    // Step 2 of TINY_TRACE has a local `x` = 42.
    expect(screen.getByTestId('local-x')).toHaveTextContent('42');
  });
});
