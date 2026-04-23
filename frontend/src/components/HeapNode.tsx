import { displayEncoded, isCArray, isCData, isCStruct } from '../trace/schema';

// One heap block. The backend wraps every allocation in a C_ARRAY tuple; the
// inner element is typically a C_STRUCT (for `new T{}`) or one-or-more scalars
// (for `new int[N]`). We render each case idiomatically and tag any pointer
// value with data-ptr-target so the EdgeLayer can anchor an arrow from it.

interface Props {
  addr: string;
  block: unknown;
}

export function HeapNode({ addr, block }: Props) {
  if (!isCArray(block)) {
    return (
      <article
        data-heap-addr={addr}
        className="rounded-md border border-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-1"
      >
        {addr}: {displayEncoded(block)}
      </article>
    );
  }

  const elements = block.slice(2) as readonly unknown[];
  const solo = elements.length === 1 ? elements[0] : null;

  return (
    <article
      data-heap-addr={addr}
      data-testid="heap-node"
      className="flex min-w-[8rem] flex-col rounded-md border border-line bg-bg-1 font-mono text-[11px]"
    >
      <header className="flex items-baseline justify-between border-b border-line-soft px-2 py-1 text-ink-3">
        <span>{isCStruct(solo) ? solo[2] : 'heap'}</span>
        <span>{addr}</span>
      </header>
      <div className="flex flex-col gap-1 px-2 py-1.5">
        {isCStruct(solo) ? (
          <StructFields fields={solo.slice(3) as ReadonlyArray<readonly [string, unknown]>} />
        ) : (
          elements.map((el, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-ink-3">[{i}]</span>
              <EncodedInline value={el} />
            </div>
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
        <div key={name} className="flex items-baseline gap-2">
          <span className="text-ink-2">{name}</span>
          <EncodedInline value={value} />
        </div>
      ))}
    </>
  );
}

/** Inline render of a value. Pointers get data-ptr-target for the edge layer. */
function EncodedInline({ value }: { value: unknown }) {
  if (isCData(value)) {
    const type = value[2];
    const val = value[3];
    if (type === 'pointer' || type === 'ref') {
      if (val === null || val === undefined) {
        return (
          <span
            data-ptr-target="null"
            data-testid="nullptr-chip"
            className="inline-flex items-center rounded border border-line px-1 text-ink-3 line-through decoration-ink-3/60"
          >
            nullptr
          </span>
        );
      }
      return (
        <span
          data-ptr-target={String(val)}
          data-testid="ptr-value"
          className="text-accent"
        >
          → {String(val)}
        </span>
      );
    }
    return <span className="text-ink-0">{displayEncoded(value)}</span>;
  }
  // Structs / arrays rendered compactly via displayEncoded fallback; we don't
  // expect nested heap blocks inside a single cell commonly enough to build
  // richer nested rendering yet.
  return <span className="text-ink-0">{displayEncoded(value)}</span>;
}
