import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  DATA_ATTR,
  nextPreference,
  persistPreference,
  PREFERS_LIGHT_MQ,
  readStoredPreference,
  resolvePreference,
  STORAGE_KEY,
} from './theme';

// A tiny in-memory storage shim — avoids leaking between tests and lets us
// simulate quota / private-mode errors deterministically.
function memStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function mq(matches: boolean): MediaQueryList {
  return { matches } as MediaQueryList;
}

beforeEach(() => {
  document.documentElement.removeAttribute(DATA_ATTR);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStoredPreference', () => {
  it("returns 'system' when nothing is stored", () => {
    expect(readStoredPreference(memStorage())).toBe('system');
  });

  it("returns the stored preference when it's a known value", () => {
    expect(readStoredPreference(memStorage({ [STORAGE_KEY]: 'dark' }))).toBe('dark');
    expect(readStoredPreference(memStorage({ [STORAGE_KEY]: 'light' }))).toBe('light');
    expect(readStoredPreference(memStorage({ [STORAGE_KEY]: 'system' }))).toBe('system');
  });

  it("falls back to 'system' on junk values", () => {
    expect(readStoredPreference(memStorage({ [STORAGE_KEY]: 'neon' }))).toBe('system');
  });

  it("returns 'system' when storage is unavailable (private-mode / SSR)", () => {
    expect(readStoredPreference(null)).toBe('system');
  });
});

describe('resolvePreference', () => {
  it('passes dark and light through unchanged', () => {
    expect(resolvePreference('dark', mq(false))).toBe('dark');
    expect(resolvePreference('light', mq(true))).toBe('light');
  });

  it('follows prefers-color-scheme when system', () => {
    expect(resolvePreference('system', mq(true))).toBe('light');
    expect(resolvePreference('system', mq(false))).toBe('dark');
  });

  it("defaults system to dark when matchMedia is unavailable", () => {
    expect(resolvePreference('system', null)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme on <html>', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute(DATA_ATTR)).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.getAttribute(DATA_ATTR)).toBe('dark');
  });
});

describe('persistPreference', () => {
  it('writes to storage', () => {
    const s = memStorage();
    persistPreference('light', s);
    expect(s.getItem(STORAGE_KEY)).toBe('light');
  });

  it('does not throw when storage is null', () => {
    expect(() => persistPreference('dark', null)).not.toThrow();
  });

  it('swallows quota errors (private mode)', () => {
    const s = memStorage();
    const spy = vi.spyOn(s, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => persistPreference('dark', s)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('nextPreference', () => {
  it('cycles dark → light → system → dark', () => {
    expect(nextPreference('dark')).toBe('light');
    expect(nextPreference('light')).toBe('system');
    expect(nextPreference('system')).toBe('dark');
  });
});

it('PREFERS_LIGHT_MQ matches the standard media query', () => {
  expect(PREFERS_LIGHT_MQ).toBe('(prefers-color-scheme: light)');
});
