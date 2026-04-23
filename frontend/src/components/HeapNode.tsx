import { displayEncoded, isCArray, isCData, isCStruct } from '../trace/schema';

interface Props {
  addr: string;
  block: unknown;
  registerEl?: (el: HTMLElement | null) => void;
}

export function HeapNode({ addr, block, registerEl }: Props) {
  if (!isCArray(block)) {
    return (
      <article
        ref={registerEl}
        data-heap-addr={addr}
        className="rounded-[3px] border border-line bg-bg-1 px-2 py-1 font-mono text-[11px] text-ink-1"
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
      data-testid="heap-node"
      className="flex min-w-[140px] flex-col overflow-hidden rounded-[3px] border border-line bg-bg-1 font-mono text-[11px]"
    >
      <header className="flex items-center justify-between border-b border-line-soft bg-bg-2 px-2 py-1">
        <span className="text-[10px] tracking-[0.04em] text-accent">{typeName}</span>
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
  const ptrTarget = pointerTarget(value);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line-soft px-2 py-1 first:border-t-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-ink-0">{name}</span>
        {type && <span className="text-[10px] text-ink-3">: {type}</span>}
      </div>
      {ptrTarget === undefined ? (
        <span className="rounded border border-line-soft bg-bg-0 px-1.5 py-[1px] text-[10px] text-ink-1">
          {displayEncoded(value)}
        </span>
      ) : ptrTarget === null ? (
        <span
          data-ptr-target="null"
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
          data-ptr-target={ptrTarget}
          data-testid="ptr-value"
          className="rounded border border-accent-line bg-bg-0 px-1.5 py-[1px] text-[10px] text-accent"
        >
          {ptrTarget}
        </span>
      )}
    </div>
  );
}

function pointerTarget(v: unknown): string | null | undefined {
  if (!isCData(v)) return undefined;
  const type = v[2];
  if (type !== 'pointer' && type !== 'ref') return undefined;
  const val = v[3];
  if (val === null || val === undefined) return null;
  return String(val);
}
