import { describe, expect, it } from 'vitest';
import {
  ProgramTraceSchema,
  displayEncoded,
  isCData,
  isCStruct,
  isCArray,
} from './schema';
import { TINY_TRACE } from './fixtures';

describe('ProgramTraceSchema', () => {
  it('accepts the realistic fixture', () => {
    expect(() => ProgramTraceSchema.parse(TINY_TRACE)).not.toThrow();
  });

  it('rejects a payload missing the trace array', () => {
    const bad = { code: 'int main(){}' };
    expect(ProgramTraceSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects when a frame is missing funcName (shape drift)', () => {
    const bad = {
      code: '',
      trace: [
        {
          event: 'call',
          line: 1,
          funcName: 'main',
          stackToRender: [
            { orderedVarNames: [], isHighlighted: true, frameId: 'x', uniqueHash: 'x', encodedLocals: {} },
          ],
          globals: {},
          heap: {},
          orderedGlobals: [],
          stdout: '',
        },
      ],
    };
    expect(ProgramTraceSchema.safeParse(bad).success).toBe(false);
  });

  it('passthrough preserves unknown frame fields (forward compat)', () => {
    const withExtras = {
      code: '',
      trace: [
        {
          event: 'call',
          line: 1,
          funcName: 'main',
          stackToRender: [
            {
              funcName: 'main',
              orderedVarNames: [],
              isHighlighted: true,
              frameId: 'x',
              uniqueHash: 'x',
              encodedLocals: {},
              brandNewField: 'hello',
            },
          ],
          globals: {},
          heap: {},
          orderedGlobals: [],
          stdout: '',
        },
      ],
    };
    const parsed = ProgramTraceSchema.parse(withExtras);
    // Unknown field preserved on the frame.
    expect((parsed.trace[0]!.stackToRender[0]! as Record<string, unknown>).brandNewField).toBe(
      'hello',
    );
  });
});

describe('encoded-value helpers', () => {
  it('narrows C_DATA / C_STRUCT / C_ARRAY via type guards', () => {
    const d: unknown = ['C_DATA', '0x1', 'int', 7];
    const s: unknown = ['C_STRUCT', '0x2', 'Point', ['x', ['C_DATA', '0x3', 'int', 1]]];
    const a: unknown = ['C_ARRAY', '0x4', ['C_DATA', '0x5', 'int', 1]];
    expect(isCData(d)).toBe(true);
    expect(isCStruct(s)).toBe(true);
    expect(isCArray(a)).toBe(true);
    expect(isCData(s)).toBe(false);
  });

  it('renders scalars, pointers, nullptr, structs, and arrays', () => {
    expect(displayEncoded(['C_DATA', '0x1', 'int', 42])).toBe('42');
    expect(displayEncoded(['C_DATA', '0x1', 'pointer', '0xabc'])).toBe('→ 0xabc');
    expect(displayEncoded(['C_DATA', '0x1', 'pointer', null])).toBe('nullptr');
    expect(displayEncoded(null)).toBe('uninitialized');
    expect(
      displayEncoded([
        'C_STRUCT',
        '0x1',
        'Point',
        ['x', ['C_DATA', '0x2', 'int', 1]],
        ['y', ['C_DATA', '0x3', 'int', 2]],
      ]),
    ).toBe('Point { x: 1, y: 2 }');
    expect(
      displayEncoded(['C_ARRAY', '0x1', ['C_DATA', '0x2', 'int', 1], ['C_DATA', '0x3', 'int', 2]]),
    ).toBe('[1, 2]');
  });
});
