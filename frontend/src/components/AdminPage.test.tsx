import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminPage } from './AdminPage';
import { useAppStore } from '../store';

beforeEach(() => {
  useAppStore.setState({
    me: { id: 'u1', email: 'x@y.z', displayName: 'X', avatarUrl: null, isAdmin: true },
    authChecked: true,
    flags: {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPage — server-denied 403 collapses to neutral empty state', () => {
  // Regression: a forged me.isAdmin=true (e.g. via DevTools) renders the
  // panel until the first fetch lands. The first fetch must hit a real 403
  // and flip the page into the SAME neutral empty state we show signed-out
  // visitors — no admin table, no leaked error body.
  it('renders the unified empty state when fetchAdminFlags returns 403', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('forbidden — admin only', { status: 403 }),
    );

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-forbidden')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
    // Server body must NOT leak into the UI.
    expect(screen.queryByText(/forbidden — admin only/)).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  // Same neutral state for 401 (session expired) and 404 (which is what
  // requireAdmin returns to non-admins to avoid advertising the route).
  it('treats 401 and 404 the same as 403 — no leakage', async () => {
    for (const status of [401, 404]) {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(`leak me — ${status}`, { status }),
      );
      const { unmount } = render(<AdminPage />);
      await waitFor(() => {
        expect(screen.getByTestId('admin-forbidden')).toBeInTheDocument();
      });
      expect(screen.queryByText(new RegExp(`leak me — ${status}`))).not.toBeInTheDocument();
      unmount();
      fetchSpy.mockRestore();
    }
  });

  // A network or 5xx error is NOT a permissions signal — it should keep the
  // page mounted and show a sanitized message rather than the raw body.
  it('shows a sanitized message on 500 (no admin-forbidden flip)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Internal stack trace blob', { status: 500 }),
    );

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-forbidden')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-error').textContent).toBe(
      'Could not load flags. Please try again.',
    );
    expect(screen.queryByText(/Internal stack trace blob/)).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });
});
