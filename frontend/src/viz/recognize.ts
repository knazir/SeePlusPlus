// Topology-only data-structure recognition. v1 detects singly-linked lists
// only; DLL / tree / cycle are v1.5 scope per ADR-0003 (relaxed precision
// bar + toggle-means-recoverable).
//
// Ported in spirit from tmp/design-spec/project/src/viz.jsx:230-280; adapted
// to our typed trace model.
import { isCArray, isCData, isCStruct, type EncodedValue, type ExecutionPoint } from '../trace/schema';

export interface RecognizedLL {
  kind: 'LL';
  /** Ordered heap addresses, head → tail. */
  chain: string[];
}

export type RecognizedShape = RecognizedLL;

/**
 * Returns a RecognizedLL if the heap is exactly a single linked list rooted
 * at some stack-local pointer and covering every heap block. Returns null if:
 *   - heap is empty or a single node (not interesting),
 *   - no stack local points into the heap (no root),
 *   - any node has zero or multiple outgoing pointer fields,
 *   - the chain contains a cycle,
 *   - the chain doesn't cover every heap block (dangling heap blocks).
 */
export function recognize(step: ExecutionPoint): RecognizedShape | null {
  const heap = step.heap;
  const heapAddrs = Object.keys(heap);
  if (heapAddrs.length < 2) return null;

  const rootCandidates = collectStackPointerTargets(step, heap);

  for (const root of rootCandidates) {
    const chain = walkChain(heap, root);
    if (chain && chain.length === heapAddrs.length) {
      return { kind: 'LL', chain };
    }
  }
  return null;
}

function collectStackPointerTargets(
  step: ExecutionPoint,
  heap: Record<string, EncodedValue>,
): Set<string> {
  const out = new Set<string>();
  for (const frame of step.stackToRender) {
    for (const localVal of Object.values(frame.encodedLocals)) {
      const addr = readPointerTarget(localVal);
      if (typeof addr === 'string' && heap[addr]) out.add(addr);
    }
  }
  return out;
}

function walkChain(
  heap: Record<string, EncodedValue>,
  start: string,
): string[] | null {
  const chain: string[] = [];
  const visited = new Set<string>();
  let cur: string | null = start;
  while (cur !== null) {
    if (visited.has(cur)) return null;
    if (!heap[cur]) return null;
    visited.add(cur);
    chain.push(cur);

    const next = singleOutgoingPointer(heap[cur]);
    if (next === undefined) return null;
    cur = next;
  }
  return chain;
}

/**
 * Inspects a heap block (C_ARRAY wrapping one C_STRUCT typically). Returns:
 *   - a string addr if the struct has exactly one outgoing pointer field to
 *     another heap addr,
 *   - null if the one pointer is nullptr (end of chain),
 *   - undefined if the shape is anything other than a single-pointer-field
 *     struct (zero / multiple pointer fields, or not a C_STRUCT at all).
 */
function singleOutgoingPointer(block: EncodedValue): string | null | undefined {
  if (!isCArray(block)) return undefined;
  const elements = block.slice(2) as readonly unknown[];
  if (elements.length !== 1) return undefined;
  const struct = elements[0];
  if (!isCStruct(struct)) return undefined;

  const fields = struct.slice(3) as ReadonlyArray<readonly [string, unknown]>;
  const pointers: Array<string | null> = [];
  for (const [, fieldVal] of fields) {
    const target = readPointerTarget(fieldVal);
    if (target !== undefined) pointers.push(target);
  }
  if (pointers.length !== 1) return undefined;
  return pointers[0];
}

/** Returns addr string, null for nullptr, or undefined if value isn't a pointer. */
function readPointerTarget(v: unknown): string | null | undefined {
  if (!isCData(v)) return undefined;
  const type = v[2];
  if (type !== 'pointer' && type !== 'ref') return undefined;
  const val = v[3];
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return undefined;
}
