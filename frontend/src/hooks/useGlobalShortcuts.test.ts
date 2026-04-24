import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useAppStore } from '../store';
import { TINY_TRACE } from '../trace/fixtures';

beforeEach(() => {
  useAppStore.setState({
    code: '',
    running: false,
    trace: TINY_TRACE,
    lastRunCode: '',
    error: null,
    buildOutput: null,
    stepIndex: 0,
    playing: false,
    consoleOpen: true,
    modal: null,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

function press(key: string, target: EventTarget = window, init: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
}

describe('useGlobalShortcuts', () => {
  it('ArrowRight steps forward; ArrowLeft steps back', () => {
    renderHook(() => useGlobalShortcuts());
    act(() => press('ArrowRight'));
    expect(useAppStore.getState().stepIndex).toBe(1);
    act(() => press('ArrowLeft'));
    expect(useAppStore.getState().stepIndex).toBe(0);
  });

  it('Space toggles play', () => {
    renderHook(() => useGlobalShortcuts());
    act(() => press(' '));
    expect(useAppStore.getState().playing).toBe(true);
    act(() => press(' '));
    expect(useAppStore.getState().playing).toBe(false);
  });

  it('ignores keys while focus is in a text input', () => {
    renderHook(() => useGlobalShortcuts());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => press('ArrowRight', input));
    expect(useAppStore.getState().stepIndex).toBe(0); // unchanged
  });

  it('ignores keys while focus is inside the CodeMirror editor', () => {
    renderHook(() => useGlobalShortcuts());
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    const inner = document.createElement('div');
    editor.appendChild(inner);
    document.body.appendChild(editor);
    act(() => press(' ', inner));
    expect(useAppStore.getState().playing).toBe(false);
  });
});
