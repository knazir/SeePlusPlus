import { displayEncoded, isCData, type StackFrame } from '../trace/schema';
import { useCurrentStep } from '../store';

// Stack-of-frames view. The active frame (isHighlighted: true, the top of the
// stack) is expanded + accent-bordered and shows its locals; inactive frames
// condense to just func + line so long call chains don't drown the view.
//
// Pin-to-keep-expanded, hover-anchor to heap edges, and stack-depth step-in/out
// affordances are deliberately deferred — they land with the HeapGraph (backlog
// #7) and scrubbar polish (#9) respectively.

export function StackFrames() {
  const step = useCurrentStep();

  if (!step) {
    return (
      <p className="font-mono text-xs text-ink-3" data-testid="stack-empty">
        Run the program to see stack frames.
      </p>
    );
  }

  const frames = [...step.stackToRender].reverse(); // top of stack first

  return (
    <ol className="flex flex-col gap-2" data-testid="stack-frames">
      {frames.map((frame) => (
        <FrameCard key={frame.uniqueHash} frame={frame} />
      ))}
    </ol>
  );
}

function FrameCard({ frame }: { frame: StackFrame }) {
  const active = frame.isHighlighted;
  return (
    <li
      data-testid="stack-frame"
      data-active={active || undefined}
      className={
        active
          ? 'rounded-md border border-accent-line bg-accent-soft px-3 py-2'
          : 'rounded-md border border-line-soft bg-bg-1 px-3 py-1.5'
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-ink-0" data-testid="frame-name">
          {frame.funcName}
        </span>
        {typeof frame.line === 'number' && (
          <span className="font-mono text-[11px] text-ink-3">line {frame.line}</span>
        )}
      </div>
      {active && frame.orderedVarNames.length > 0 && (
        <dl
          className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
          data-testid="frame-locals"
        >
          {frame.orderedVarNames.map((name) => (
            <LocalRow key={name} name={name} value={frame.encodedLocals[name]} />
          ))}
        </dl>
      )}
    </li>
  );
}

function LocalRow({ name, value }: { name: string; value: unknown }) {
  const ptrTarget = pointerTarget(value);
  return (
    <>
      <dt className="font-mono text-[11px] text-ink-2">{name}</dt>
      <dd className="font-mono text-[11px] text-ink-0" data-testid={`local-${name}`}>
        {ptrTarget !== undefined ? (
          ptrTarget === null ? (
            <span
              data-ptr-target="null"
              className="inline-flex items-center rounded border border-line px-1 text-ink-3 line-through decoration-ink-3/60"
            >
              nullptr
            </span>
          ) : (
            <span data-ptr-target={ptrTarget} className="text-accent">
              → {ptrTarget}
            </span>
          )
        ) : (
          displayEncoded(value)
        )}
      </dd>
    </>
  );
}

/** Return addr string for a pointer, null for nullptr, or undefined if the value isn't a pointer. */
function pointerTarget(v: unknown): string | null | undefined {
  if (!isCData(v)) return undefined;
  const type = v[2];
  if (type !== 'pointer' && type !== 'ref') return undefined;
  const val = v[3];
  if (val === null || val === undefined) return null;
  return String(val);
}
