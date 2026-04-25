// Settings popover anchored to the cog button in the topbar. Close on outside
// click, Escape, or selecting a value (clicks within stay open so users can
// A/B preview options).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore, type HeapDensity, type PointerRouting } from '../store';
import type { ThemePreference } from '../theme/theme';

interface Option<V extends string> {
  value: V;
  label: string;
  hint: string;
  /** Optional inline icon for the left side of the row. */
  glyph?: ReactNode;
}

const THEME_OPTIONS: Array<Option<ThemePreference>> = [
  { value: 'dark', label: 'Dark', hint: 'Always dark', glyph: <span aria-hidden>☾</span> },
  { value: 'light', label: 'Light', hint: 'Always light', glyph: <span aria-hidden>☀</span> },
  { value: 'system', label: 'System', hint: 'Match OS', glyph: <span aria-hidden>◐</span> },
];

const ROUTING_OPTIONS: Array<Option<PointerRouting>> = [
  { value: 'curved', label: 'Curved', hint: 'Curved lines', glyph: <RoutingGlyph kind="curved" /> },
  { value: 'straight', label: 'Straight', hint: 'Direct lines', glyph: <RoutingGlyph kind="straight" /> },
  { value: 'orthogonal', label: 'Orthogonal', hint: 'Right-angle turns', glyph: <RoutingGlyph kind="orthogonal" /> },
];

const DENSITY_OPTIONS: Array<Option<HeapDensity>> = [
  { value: 'dense', label: 'Dense', hint: 'Tight spacing' },
  { value: 'normal', label: 'Normal', hint: 'Default spacing' },
  { value: 'airy', label: 'Airy', hint: 'Wide spacing' },
];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const themePreference = useAppStore((s) => s.themePreference);
  const setThemePreference = useAppStore((s) => s.setThemePreference);
  const pointerRouting = useAppStore((s) => s.pointerRouting);
  const setPointerRouting = useAppStore((s) => s.setPointerRouting);
  const heapDensity = useAppStore((s) => s.heapDensity);
  const setHeapDensity = useAppStore((s) => s.setHeapDensity);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="settings-toggle"
        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
      >
        <span aria-hidden>⚙</span>
      </button>
      {open && (
        // Not role="menu": menu semantics imply arrow-key navigation between
        // menuitems, which we don't provide. This is a popover containing
        // three independent radio groups, so semantically it's a dialog with
        // groups inside; AT will read each radio group on its own.
        <div
          role="dialog"
          aria-label="Settings"
          data-testid="settings-menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-64 rounded-[4px] border border-line bg-bg-1 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Settings
          </div>

          <Section
            title="Theme"
            description="How the UI renders light and dark surfaces."
            ariaLabel="Theme"
            options={THEME_OPTIONS}
            current={themePreference}
            onSelect={setThemePreference}
            testIdPrefix="settings-theme"
          />

          <Section
            title="Pointer routing"
            description="How heap edges are drawn in the visualization."
            ariaLabel="Pointer routing"
            options={ROUTING_OPTIONS}
            current={pointerRouting}
            onSelect={setPointerRouting}
            testIdPrefix="settings-routing"
          />

          <Section
            title="Heap spacing"
            description="How tightly heap nodes pack together."
            ariaLabel="Heap spacing"
            options={DENSITY_OPTIONS}
            current={heapDensity}
            onSelect={setHeapDensity}
            testIdPrefix="settings-density"
          />
        </div>
      )}
    </div>
  );
}

interface SectionProps<V extends string> {
  title: string;
  description: string;
  ariaLabel: string;
  options: Array<Option<V>>;
  current: V;
  onSelect: (v: V) => void;
  testIdPrefix: string;
}

function Section<V extends string>({
  title,
  description,
  ariaLabel,
  options,
  current,
  onSelect,
  testIdPrefix,
}: SectionProps<V>) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 font-mono text-[11px] text-ink-1">{title}</div>
      <div className="mb-2 font-mono text-[10px] text-ink-3">{description}</div>
      <div role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(opt.value)}
              data-testid={`${testIdPrefix}-${opt.value}`}
              className={`flex items-center justify-between gap-2 rounded-[3px] border px-2 py-1.5 text-left font-mono text-[11px] transition-colors duration-fast ease-out-soft ${
                active
                  ? 'border-accent-line bg-accent-soft text-accent'
                  : 'border-transparent text-ink-1 hover:bg-bg-2 hover:text-ink-0'
              }`}
            >
              <span className="flex items-center gap-2">
                {opt.glyph}
                {opt.label}
              </span>
              <span className="whitespace-nowrap text-right text-[10px] text-ink-3">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoutingGlyph({ kind }: { kind: PointerRouting }) {
  const stroke = 'currentColor';
  if (kind === 'curved')
    return (
      <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
        <path d="M 1 8 C 7 8 13 2 19 2" fill="none" stroke={stroke} strokeWidth="1.25" />
      </svg>
    );
  if (kind === 'straight')
    return (
      <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
        <path d="M 1 8 L 19 2" fill="none" stroke={stroke} strokeWidth="1.25" />
      </svg>
    );
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
      <path d="M 1 8 L 10 8 L 10 2 L 19 2" fill="none" stroke={stroke} strokeWidth="1.25" />
    </svg>
  );
}
