// Reachability analysis over the heap. An address is *reachable* if a pointer
// in the stack/globals transitively leads to it. Anything in `heap` that isn't
// reachable is an orphan — classic "you forgot to free this" territory that
// the legacy frontend highlighted visually.
import { isCArray, isCData, isCStruct } from '../trace/schema';
import type { ExecutionPoint } from '../trace/schema';

/** Collect all addresses referenced by a (possibly nested) encoded value. */
export function collectPointers(v: unknown, out: Set<string>): void {
  if (v === null || v === undefined) return;
  if (isCData(v)) {
    const type = v[2];
    const val = v[3];
    if ((type === 'pointer' || type === 'ref') && val != null) out.add(String(val));
    return;
  }
  if (isCStruct(v)) {
    for (const f of v.slice(3) as ReadonlyArray<readonly [string, unknown]>) {
      collectPointers(f[1], out);
    }
    return;
  }
  if (isCArray(v)) {
    for (const el of v.slice(2) as readonly unknown[]) collectPointers(el, out);
  }
}

/** Set of heap addresses reachable from stack locals + globals via BFS. */
export function reachableAddrs(step: ExecutionPoint): Set<string> {
  const reachable = new Set<string>();
  const frontier: string[] = [];

  const seed = (roots: Iterable<unknown>) => {
    const s = new Set<string>();
    for (const v of roots) collectPointers(v, s);
    for (const a of s) if (!reachable.has(a) && step.heap[a] !== undefined) {
      reachable.add(a);
      frontier.push(a);
    }
  };

  // Seed from every frame's locals and every global.
  for (const frame of step.stackToRender) {
    seed(Object.values(frame.encodedLocals));
  }
  seed(Object.values(step.globals));

  // BFS: walk the heap block, collect outgoing pointers, enqueue any that
  // land on another heap address.
  while (frontier.length > 0) {
    const addr = frontier.pop()!;
    const block = step.heap[addr];
    if (block === undefined) continue;
    const next = new Set<string>();
    collectPointers(block, next);
    for (const n of next) {
      if (!reachable.has(n) && step.heap[n] !== undefined) {
        reachable.add(n);
        frontier.push(n);
      }
    }
  }

  return reachable;
}

/** Addresses in `heap` not reachable from any root. */
export function orphanAddrs(step: ExecutionPoint): Set<string> {
  const reachable = reachableAddrs(step);
  const orphans = new Set<string>();
  for (const addr of Object.keys(step.heap)) {
    if (!reachable.has(addr)) orphans.add(addr);
  }
  return orphans;
}
