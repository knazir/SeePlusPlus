// Mirrors backend/src/parse_vg_trace.ts ProgramTrace. Ported as a Zod schema so
// the frontend catches shape drift at the I/O boundary rather than via crashes
// deep in the render tree.
//
// Encoded values use the legacy OPT C tuple format (C_DATA / C_STRUCT / C_ARRAY
// / C_MULTIDIMENSIONAL_ARRAY). We treat them as `unknown` at the validator
// layer and narrow with the type guards below at render time — the tuple
// shapes are awkward to express as Zod but trivial to runtime-check.
import { z } from 'zod';

// --- encoded value type guards --------------------------------------------

export type EncodedValue = unknown;

export function isCData(
  v: unknown,
): v is readonly ['C_DATA', string, string, unknown] {
  return Array.isArray(v) && v[0] === 'C_DATA';
}

export function isCStruct(
  v: unknown,
): v is readonly ['C_STRUCT', string, string, ...Array<readonly [string, unknown]>] {
  return Array.isArray(v) && v[0] === 'C_STRUCT';
}

export function isCArray(v: unknown): v is readonly ['C_ARRAY', string, ...unknown[]] {
  return Array.isArray(v) && v[0] === 'C_ARRAY';
}

/** Compact, human-readable rendering for a local's value. Pointer→addr etc. */
export function displayEncoded(v: unknown): string {
  if (v === null || v === undefined) return '?';
  if (isCData(v)) {
    const type = v[2];
    const val = v[3];
    if (type === 'pointer' || type === 'ref') {
      return val == null ? 'nullptr' : `→ ${String(val)}`;
    }
    if (val === null || val === undefined) return '?';
    // SPP-Valgrind emits a literal '<UNINITIALIZED>' string for locals that
    // have been declared but not yet assigned. Rendering the marker verbatim
    // reads as noise; the legacy UI showed a '?' and it's much cleaner.
    if (val === '<UNINITIALIZED>') return '?';
    return typeof val === 'string' ? JSON.stringify(val) : String(val);
  }
  if (isCStruct(v)) {
    const typeName = v[2];
    const fields = v.slice(3) as ReadonlyArray<readonly [string, unknown]>;
    const body = fields
      .map(([name, fieldVal]) => `${name}: ${displayEncoded(fieldVal)}`)
      .join(', ');
    return `${typeName} { ${body} }`;
  }
  if (isCArray(v)) {
    const elts = v.slice(2) as readonly unknown[];
    return `[${elts.map(displayEncoded).join(', ')}]`;
  }
  return '?';
}

// --- schema ---------------------------------------------------------------

const EncodedValueSchema: z.ZodType<EncodedValue> = z.unknown();

const StackFrameSchema = z
  .object({
    funcName: z.string(),
    orderedVarNames: z.array(z.string()),
    isHighlighted: z.boolean(),
    frameId: z.string(),
    uniqueHash: z.string(),
    encodedLocals: z.record(z.string(), EncodedValueSchema),
    line: z.number().optional(),
  })
  .passthrough();

const ExecutionPointSchema = z
  .object({
    event: z.string(),
    line: z.number(),
    funcName: z.string(),
    stackToRender: z.array(StackFrameSchema),
    globals: z.record(z.string(), EncodedValueSchema),
    heap: z.record(z.string(), EncodedValueSchema),
    orderedGlobals: z.array(z.string()),
    stdout: z.string(),
    exceptionMsg: z.string().optional(),
  })
  .passthrough();

export const ProgramTraceSchema = z.object({
  code: z.string(),
  trace: z.array(ExecutionPointSchema),
});

export type StackFrame = z.infer<typeof StackFrameSchema>;
export type ExecutionPoint = z.infer<typeof ExecutionPointSchema>;
export type ProgramTrace = z.infer<typeof ProgramTraceSchema>;
