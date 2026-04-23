import { useState } from 'react';
import { displayEncoded, isCData, type StackFrame } from '../trace/schema';
import { useCurrentStep } from '../store';
import { useHover } from '../viz/hoverContext';

export function StackFrames() {
  const step = useCurrentStep();

  if (!step) {
    return (
      <p className="px-3 py-2 font-mono text-[11px] text-ink-3" data-testid="stack-empty">
        Run to see stack frames.
      </p>
    );
  }

  // Top of stack first; mock puts the active frame first in the list.
  const frames = [...step.stackToRender].reverse();

  return (
    <ol className="flex flex-col gap-1.5 px-3 pb-5" data-testid="stack-frames">
      {frames.map((frame) => (
        <FrameCard key={frame.uniqueHash} frame={frame} />
      ))}
    </ol>
  );
}

function FrameCard({ frame }: { frame: StackFrame }) {
  const [expanded, setExpanded] = useState(frame.isHighlighted);
  const [pinned, setPinned] = useState(false);
  const active = frame.isHighlighted;
  const isExpanded = expanded || pinned;

  // Parse args from orderedVarNames for the function signature display. Names
  // that appear in encodedLocals at this step are real incoming args; anything
  // else is a local declared inside the body. Mock shows just the arg names
  // inside parens e.g. `reverse(head)`.
  const argNames = frame.orderedVarNames.filter((n) => n in frame.encodedLocals);

  return (
    <li
      data-testid="stack-frame"
      data-active={active || undefined}
      className={`overflow-hidden rounded-[3px] border transition-colors duration-med ease-out-soft ${
        active
          ? 'border-accent-line bg-bg-1 shadow-[inset_2px_0_0_var(--color-accent)]'
          : 'border-line bg-bg-1'
      }`}
    >
      {/* Using div + role="button" so the pin button can be a sibling child
          without triggering React's button-in-button DOM validation warning. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between px-2.5 py-2 text-left hover:bg-bg-2 focus:outline-none focus-visible:bg-bg-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`inline-block w-2.5 font-mono text-[9px] text-ink-3 transition-transform duration-fast ease-out-soft ${
              isExpanded ? 'rotate-90 text-accent' : ''
            }`}
          >
            ▸
          </span>
          <span className="font-mono text-[12px] text-ink-0" data-testid="frame-name">
            <span className="font-medium">{frame.funcName}</span>
            <span className="text-ink-2">({argNames.join(', ')})</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
          {typeof frame.line === 'number' && (
            <>
              <span>ln</span>
              <span className="text-ink-2">{frame.line}</span>
            </>
          )}
          <button
            type="button"
            title={pinned ? 'Unpin' : 'Pin expanded'}
            onClick={(e) => {
              e.stopPropagation();
              setPinned((p) => !p);
            }}
            className={`rounded p-0.5 hover:bg-bg-2 ${pinned ? 'text-accent' : 'text-ink-3 hover:text-accent'}`}
            data-testid="frame-pin"
            aria-pressed={pinned}
          >
            ⌯
          </button>
        </div>
      </div>
      {isExpanded && frame.orderedVarNames.length > 0 && (
        <div
          className="flex flex-col border-t border-line-soft px-2.5 pb-2.5 pt-1"
          data-testid="frame-locals"
        >
          {frame.orderedVarNames.map((name) => (
            <LocalRow key={name} name={name} value={frame.encodedLocals[name]} />
          ))}
        </div>
      )}
    </li>
  );
}

function LocalRow({ name, value }: { name: string; value: unknown }) {
  const ptr = pointerTarget(value);
  const type = isCData(value) ? String(value[2]) : null;
  const { hoveredAddr, setHoveredAddr } = useHover();
  const chipHot = ptr?.target !== null && ptr?.target !== undefined && hoveredAddr === ptr.target;

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-t border-line-soft py-1 font-mono text-[11px] first:border-t-0"
      data-testid={`local-${name}`}
    >
      <div className="flex min-w-0 items-baseline gap-1.5 truncate">
        <span className="text-ink-0">{name}</span>
        {type && <span className="text-[10px] text-ink-3">: {type}</span>}
      </div>
      {ptr === undefined ? (
        <span className="max-w-[110px] truncate rounded border border-line-soft bg-bg-0 px-1.5 py-[1px] text-[10.5px] text-ink-1">
          {displayEncoded(value)}
        </span>
      ) : ptr.target === null ? (
        <span
          data-ptr-target="null"
          data-ptr-kind={ptr.kind}
          className="relative max-w-[110px] truncate rounded border border-line-soft bg-bg-0 px-1.5 py-[1px] text-[10.5px] text-ink-3"
        >
          nullptr
          <span
            aria-hidden
            className="pointer-events-none absolute left-1 right-1 top-1/2 h-[1px] -rotate-[12deg] bg-ink-3/70"
          />
        </span>
      ) : (
        <span
          data-ptr-target={ptr.target}
          data-ptr-kind={ptr.kind}
          data-highlighted={chipHot || undefined}
          onMouseEnter={() => ptr.target && setHoveredAddr(ptr.target)}
          onMouseLeave={() => setHoveredAddr(null)}
          className={`max-w-[110px] truncate rounded border px-1.5 py-[1px] text-[10.5px] transition-colors duration-fast ease-out-soft ${
            chipHot
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-accent-line bg-bg-0 text-accent'
          }`}
        >
          {ptr.target}
        </span>
      )}
    </div>
  );
}

type PtrKind = 'pointer' | 'ref';
type PtrTarget = { kind: PtrKind; target: string | null };

function pointerTarget(v: unknown): PtrTarget | undefined {
  if (!isCData(v)) return undefined;
  const type = v[2];
  if (type !== 'pointer' && type !== 'ref') return undefined;
  const val = v[3];
  return { kind: type, target: val == null ? null : String(val) };
}
