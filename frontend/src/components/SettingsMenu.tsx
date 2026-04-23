// Lightweight settings popover anchored to the cog button in the topbar.
// First and only setting today: pointer edge routing. Close on outside click,
// Escape, or selecting a value (clicks within stay open so users can A/B).
import { useEffect, useRef, useState } from 'react';
import { useAppStore, type PointerRouting } from '../store';

const ROUTING_OPTIONS: Array<{ value: PointerRouting; label: string; hint: string }> = [
  { value: 'curved', label: 'Curved', hint: 'Bezier curves — default' },
  { value: 'straight', label: 'Straight', hint: 'Direct lines' },
  { value: 'orthogonal', label: 'Orthogonal', hint: 'Right-angle turns' },
];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const pointerRouting = useAppStore((s) => s.pointerRouting);
  const setPointerRouting = useAppStore((s) => s.setPointerRouting);
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="settings-toggle"
        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-2 transition-colors duration-fast ease-out-soft hover:bg-bg-2 hover:text-ink-0"
      >
        <span aria-hidden>⚙</span>
      </button>
      {open && (
        <div
          role="menu"
          data-testid="settings-menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-64 rounded-[4px] border border-line bg-bg-1 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Settings
          </div>
          <div className="mb-1 font-mono text-[11px] text-ink-1">Pointer routing</div>
          <div className="mb-2 font-mono text-[10px] text-ink-3">
            How heap edges are drawn in the visualization.
          </div>
          <div
            role="radiogroup"
            aria-label="Pointer routing"
            className="flex flex-col gap-0.5"
          >
            {ROUTING_OPTIONS.map((opt) => {
              const active = pointerRouting === opt.value;
              return (
                <button
                  key={opt.value}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => setPointerRouting(opt.value)}
                  data-testid={`settings-routing-${opt.value}`}
                  className={`flex items-center justify-between gap-2 rounded-[3px] border px-2 py-1.5 text-left font-mono text-[11px] transition-colors duration-fast ease-out-soft ${
                    active
                      ? 'border-accent-line bg-accent-soft text-accent'
                      : 'border-transparent text-ink-1 hover:bg-bg-2 hover:text-ink-0'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <RoutingGlyph kind={opt.value} />
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-ink-3">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
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
