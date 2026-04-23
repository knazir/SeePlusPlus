import { displayEncoded, isCArray, isCData, isCStruct } from '../trace/schema';
import { useHover } from '../viz/hoverContext';

interface Props {
  addr: string;
  block: unknown;
  orphan?: boolean;
  registerEl?: (el: HTMLElement | null) => void;
}

export function HeapNode({ addr, block, orphan, registerEl }: Props) {
  const { hoveredAddr, setHoveredAddr } = useHover();
  const highlighted = hoveredAddr === addr;
  const enter = () => setHoveredAddr(addr);
  const leave = () => setHoveredAddr(null);

  if (!isCArray(block)) {
    return (
      <article
        ref={registerEl}
        data-heap-addr={addr}
        data-orphan={orphan || undefined}
        data-highlighted={highlighted || undefined}
        onMouseEnter={enter}
        onMouseLeave={leave}
        className={`rounded-[3px] border px-2 py-1 font-mono text-[11px] transition-colors duration-fast ease-out-soft ${
          orphan
            ? 'border-dashed border-warn-line bg-warn-soft text-ink-1'
            : highlighted
              ? 'border-accent-line bg-accent-soft text-ink-0'
              : 'border-line bg-bg-1 text-ink-1'
        }`}
      >
        {addr}: {displayEncoded(block)}
      </article>
    );
  }

  const elements = block.slice(2) as readonly unknown[];
  const solo = elements.length === 1 ? elements[0] : null;
  const typeName = isCStruct(solo) ? String(solo[2]) : 'heap';

  return (
    <article
      ref={registerEl}
      data-heap-addr={addr}
      data-orphan={orphan || undefined}
      data-highlighted={highlighted || undefined}
      data-testid="heap-node"
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`flex min-w-[140px] flex-col overflow-hidden rounded-[3px] border font-mono text-[11px] transition-colors duration-fast ease-out-soft ${
        orphan
          ? 'border-dashed border-warn-line bg-warn-soft'
          : highlighted
            ? 'border-accent-line bg-accent-soft shadow-[0_0_0_1px_var(--color-accent-line)]'
            : 'border-line bg-bg-1'
      }`}
    >
      <header
        className={`flex items-center justify-between border-b px-2 py-1 ${
          orphan ? 'border-warn-line bg-warn-soft' : 'border-line-soft bg-bg-2'
        }`}
      >
        <span className={`flex items-center gap-1.5 text-[10px] tracking-[0.04em] ${orphan ? 'text-warn' : 'text-accent'}`}>
          {typeName}
          {orphan && (
            <span
              title="No pointer from stack/globals reaches this block (potential leak)"
              className="rounded-[2px] border border-warn-line bg-bg-0 px-1 py-[0.5px] text-[9px] uppercase tracking-[0.08em]"
            >
              orphan
            </span>
          )}
        </span>
        <span className="text-[10px] text-ink-3">{addr}</span>
      </header>
      <div className="flex flex-col">
        {isCStruct(solo) ? (
          <StructFields fields={solo.slice(3) as ReadonlyArray<readonly [string, unknown]>} />
        ) : (
          elements.map((el, i) => (
            <FieldRow key={i} name={`[${i}]`} value={el} />
          ))
        )}
      </div>
    </article>
  );
}

function StructFields({ fields }: { fields: ReadonlyArray<readonly [string, unknown]> }) {
  return (
    <>
      {fields.map(([name, value]) => (
        <FieldRow key={name} name={name} value={value} />
      ))}
    </>
  );
}

function FieldRow({ name, value }: { name: string; value: unknown }) {
  const type = isCData(value) ? String(value[2]) : null;
  const ptr = pointerTarget(value);
  const { hoveredAddr, setHoveredAddr } = useHover();
  const tgt = ptr?.target ?? null;
  const chipHot = tgt !== null && hoveredAddr === tgt;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line-soft px-2 py-1 first:border-t-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-ink-0">{name}</span>
        {type && <span className="text-[10px] text-ink-3">: {type}</span>}
      </div>
      {ptr === undefined ? (
        <span className="rounded border border-line-soft bg-bg-0 px-1.5 py-[1px] text-[10px] text-ink-1">
          {displayEncoded(value)}
        </span>
      ) : ptr.target === null ? (
        <span
          data-ptr-target="null"
          data-ptr-kind={ptr.kind}
          data-testid="nullptr-chip"
          className="relative rounded border border-line-soft bg-bg-0 px-1.5 py-[1px] text-[10px] text-ink-3"
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
          data-testid="ptr-value"
          data-highlighted={chipHot || undefined}
          onMouseEnter={() => ptr.target && setHoveredAddr(ptr.target)}
          onMouseLeave={() => setHoveredAddr(null)}
          className={`rounded border px-1.5 py-[1px] text-[10px] transition-colors duration-fast ease-out-soft ${
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
  // Uninitialized pointer: fall through so the caller renders `?` via
  // displayEncoded instead of a chip pointing at the literal string.
  if (val === '<UNINITIALIZED>') return undefined;
  // `0x0` is the wire representation of a null pointer (distinct from `null`
  // which SPP-Valgrind uses for "no known value"); collapse to nullptr so
  // the UI reads as a C++ programmer would expect.
  if (val === null || val === undefined || val === '0x0') {
    return { kind: type, target: null };
  }
  return { kind: type, target: String(val) };
}
