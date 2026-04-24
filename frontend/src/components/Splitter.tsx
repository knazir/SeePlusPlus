import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

interface SplitterProps {
  orientation: 'horizontal' | 'vertical';
  /** Current value. Semantics are caller-defined (e.g. fraction, pixels). */
  value: number;
  onChange: (next: number) => void;
  /** Called on double-click and on Enter. Usually resets to default. */
  onReset?: () => void;
  /**
   * Convert a pointer event into a proposed value, in the same units as
   * `value`. Called during a drag. Caller is responsible for clamping;
   * the splitter just forwards the result through `clamp` before onChange.
   */
  computeValueFromPointer: (e: { clientX: number; clientY: number }) => number;
  /**
   * Clamp a proposed value to its valid range. Called for both drag and
   * keyboard paths so bounds are enforced consistently even when the
   * container dimensions change between events.
   */
  clamp: (v: number) => number;
  /** Keyboard nudge step, in the same units as `value`. */
  step: number;
  ariaLabel: string;
  'data-testid'?: string;
}

/**
 * Reusable drag-to-resize divider. The splitter itself owns pointer capture,
 * body-cursor / text-selection suppression during drag, and keyboard a11y;
 * the parent owns the math of turning clientX/Y into a domain value and
 * keeps it clamped against its own minimums. Two instances cover both the
 * horizontal (editor↔viz) and vertical (main↔console) splits in App.tsx.
 */
export function Splitter({
  orientation,
  value,
  onChange,
  onReset,
  computeValueFromPointer,
  clamp,
  step,
  ariaLabel,
  'data-testid': testid,
}: SplitterProps) {
  const draggingRef = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — capture can fail in edge cases (synthetic events, detached elements)
    }
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onChange(clamp(computeValueFromPointer(e)));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (orientation === 'horizontal') {
      if (e.key === 'ArrowLeft') next = value - step;
      else if (e.key === 'ArrowRight') next = value + step;
    } else {
      // Pulling a bottom-anchored splitter up grows its owning region, so
      // ArrowUp should increase `value` for our vertical usage.
      if (e.key === 'ArrowUp') next = value + step;
      else if (e.key === 'ArrowDown') next = value - step;
    }
    if (next !== null) {
      e.preventDefault();
      onChange(clamp(next));
      return;
    }
    if (e.key === 'Enter' && onReset) {
      e.preventDefault();
      onReset();
    }
  };

  // Subtle 1px seam with a generous invisible hit area. Outer element is
  // 6px wide/tall and fully transparent — just the drag target + cursor
  // zone. A centered pseudo-element renders the actual visible line at
  // 1px using the regular border color, matching surrounding chrome.
  // Hover/focus brightens the line to accent so the grab target is
  // discoverable without the seam dominating the layout.
  const cls =
    orientation === 'horizontal'
      ? [
          'group relative h-full w-1.5 shrink-0 cursor-col-resize bg-transparent focus:outline-none',
          'before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-line',
          'before:transition-colors before:duration-fast before:ease-out-soft',
          'hover:before:bg-accent-line focus-visible:before:bg-accent',
        ].join(' ')
      : [
          'group relative w-full h-1.5 shrink-0 cursor-row-resize bg-transparent focus:outline-none',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-line',
          'before:transition-colors before:duration-fast before:ease-out-soft',
          'hover:before:bg-accent-line focus-visible:before:bg-accent',
        ].join(' ');

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      aria-valuenow={value}
      tabIndex={0}
      data-testid={testid}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className={cls}
    />
  );
}
