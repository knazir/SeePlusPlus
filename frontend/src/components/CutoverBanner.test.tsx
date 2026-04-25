import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CutoverBanner } from './CutoverBanner';
import { useAppStore } from '../store';
import { FLAGS } from '../flags/names';

const STORAGE_KEY = 'spp.banner.v2-cutover.dismissed';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  useAppStore.setState({ flags: {} });
});

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('CutoverBanner', () => {
  it('renders by default — flag default is true and nothing is dismissed', () => {
    render(<CutoverBanner />);
    expect(screen.getByTestId('cutover-banner')).toBeInTheDocument();
  });

  it('does not render when the flag is explicitly off', () => {
    useAppStore.setState({ flags: { [FLAGS.BANNER_V2_CUTOVER]: false } });
    render(<CutoverBanner />);
    expect(screen.queryByTestId('cutover-banner')).not.toBeInTheDocument();
  });

  it('does not render when localStorage marks it dismissed', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<CutoverBanner />);
    expect(screen.queryByTestId('cutover-banner')).not.toBeInTheDocument();
  });

  it('clicking ✕ hides the banner and persists to localStorage', () => {
    const { rerender } = render(<CutoverBanner />);
    fireEvent.click(screen.getByTestId('cutover-banner-dismiss'));
    expect(screen.queryByTestId('cutover-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');

    rerender(<CutoverBanner />);
    expect(screen.queryByTestId('cutover-banner')).not.toBeInTheDocument();
  });

  it('issue link points at /issues/new with prefilled label and title', () => {
    render(<CutoverBanner />);
    const link = screen.getByText('report an issue').closest('a');
    expect(link?.getAttribute('href')).toContain('/issues/new');
    expect(link?.getAttribute('href')).toContain('labels=v2-feedback');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('legacy link points at old.seepluspl.us', () => {
    render(<CutoverBanner />);
    const link = screen.getByText('need the old version?').closest('a');
    expect(link?.getAttribute('href')).toBe('https://old.seepluspl.us');
  });
});
