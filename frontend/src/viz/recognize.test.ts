import { describe, expect, it } from 'vitest';
import { recognize } from './recognize';
import type { ExecutionPoint, EncodedValue } from '../trace/schema';

// Builders keep each case short + legible. Heap addresses are hex-ish; the
// field naming doesn't matter — recognition is structural, not nominal.

function node(addr: string, value: number, nextAddr: string | null): EncodedValue {
  return [
    'C_ARRAY',
    addr,
    [
      'C_STRUCT',
      addr,
      'Node',
      ['value', ['C_DATA', `${addr}_v`, 'int', value]],
      ['next', ['C_DATA', `${addr}_n`, 'pointer', nextAddr]],
    ],
  ];
}

function dllNode(
  addr: string,
  value: number,
  nextAddr: string | null,
  prevAddr: string | null,
): EncodedValue {
  return [
    'C_ARRAY',
    addr,
    [
      'C_STRUCT',
      addr,
      'Node',
      ['value', ['C_DATA', `${addr}_v`, 'int', value]],
      ['next', ['C_DATA', `${addr}_n`, 'pointer', nextAddr]],
      ['prev', ['C_DATA', `${addr}_p`, 'pointer', prevAddr]],
    ],
  ];
}

function step(opts: {
  stackLocals: Record<string, EncodedValue>;
  heap: Record<string, EncodedValue>;
}): ExecutionPoint {
  return {
    event: 'stepLine',
    line: 1,
    funcName: 'main',
    stackToRender: [
      {
        funcName: 'main',
        orderedVarNames: Object.keys(opts.stackLocals),
        isHighlighted: true,
        frameId: '0xmain',
        uniqueHash: 'main_0xmain',
        encodedLocals: opts.stackLocals,
      },
    ],
    globals: {},
    heap: opts.heap,
    orderedGlobals: [],
    stdout: '',
  };
}

describe('recognize — LL happy paths', () => {
  it('2-node chain head → tail → nullptr', () => {
    const r = recognize(
      step({
        stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
        heap: { '0xa': node('0xa', 1, '0xb'), '0xb': node('0xb', 2, null) },
      }),
    );
    expect(r).toEqual({ kind: 'LL', chain: ['0xa', '0xb'] });
  });

  it('3-node chain', () => {
    const r = recognize(
      step({
        stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
        heap: {
          '0xa': node('0xa', 1, '0xb'),
          '0xb': node('0xb', 2, '0xc'),
          '0xc': node('0xc', 3, null),
        },
      }),
    );
    expect(r).toEqual({ kind: 'LL', chain: ['0xa', '0xb', '0xc'] });
  });
});

describe('recognize — rejects', () => {
  it('empty heap', () => {
    expect(recognize(step({ stackLocals: {}, heap: {} }))).toBeNull();
  });

  it('single heap node (not interesting to recognize)', () => {
    expect(
      recognize(
        step({
          stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
          heap: { '0xa': node('0xa', 1, null) },
        }),
      ),
    ).toBeNull();
  });

  it('no stack-local points into the heap (no root)', () => {
    expect(
      recognize(
        step({
          stackLocals: {},
          heap: { '0xa': node('0xa', 1, '0xb'), '0xb': node('0xb', 2, null) },
        }),
      ),
    ).toBeNull();
  });

  it('node with multiple outgoing pointers (DLL prev+next) is not a singly-linked list', () => {
    // The mock and our v1 bar is LL-only; DLL has two pointer fields so
    // it fails singleOutgoingPointer even though the topology is valid.
    expect(
      recognize(
        step({
          stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
          heap: {
            '0xa': dllNode('0xa', 1, '0xb', null),
            '0xb': dllNode('0xb', 2, null, '0xa'),
          },
        }),
      ),
    ).toBeNull();
  });

  it('cycle', () => {
    expect(
      recognize(
        step({
          stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
          heap: {
            '0xa': node('0xa', 1, '0xb'),
            '0xb': node('0xb', 2, '0xa'), // cycle
          },
        }),
      ),
    ).toBeNull();
  });

  it('chain does not cover every heap block (dangling node)', () => {
    expect(
      recognize(
        step({
          stackLocals: { list: ['C_DATA', '0xl', 'pointer', '0xa'] },
          heap: {
            '0xa': node('0xa', 1, null),
            '0xb': node('0xb', 2, null), // unreachable from the root
          },
        }),
      ),
    ).toBeNull();
  });
});
