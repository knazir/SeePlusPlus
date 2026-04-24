// Platform-aware keyboard-shortcut hint formatting.
//
// On macOS the app-level shortcut modifier is ⌘ (Meta). Everywhere else it's
// Ctrl. The underlying shortcut handlers in `useGlobalShortcuts` already
// accept `metaKey || ctrlKey` so functionality is cross-platform — this
// helper just formats the *displayed* hint to match the modifier the user
// would actually press on their OS.

export const IS_MAC: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  // `navigator.platform` is deprecated but still the most reliable signal;
  // fall back to userAgent for browsers that have hollowed it out.
  const p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
  return /Mac|iPhone|iPad|iPod/i.test(p);
})();

/**
 * Format a keyboard shortcut hint like "K" or "↵" for the current platform.
 *   kbd('K')  →  "⌘K"  on macOS, "Ctrl+K"     elsewhere
 *   kbd('↵')  →  "⌘↵"  on macOS, "Ctrl+Enter" elsewhere
 */
export function kbd(key: string): string {
  if (IS_MAC) return `⌘${key}`;
  const pretty = key === '↵' ? 'Enter' : key;
  return `Ctrl+${pretty}`;
}
