import { describe, expect, it } from 'vitest';
import type { ExecutionPoint } from '../trace/schema';
import { orphanAddrs, reachableAddrs } from './reachability';

function step(partial: Partial<ExecutionPoint>): ExecutionPoint {
  return {
    event: 'stepLine',
    line: 1,
    funcName: 'main',
    stackToRender: [],
    globals: {},
    heap: {},
    orderedGlobals: [],
    stdout: '',
    ...partial,
  };
}

describe('reachability', () => {
  it('marks heap blocks reachable from a local pointer', () => {
    const s = step({
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['p'],
          isHighlighted: true,
          frameId: '0xm',
          uniqueHash: 'm',
          encodedLocals: { p: ['C_DATA', '0xloc', 'pointer', '0xa'] },
        },
      ],
      heap: {
        '0xa': ['C_ARRAY', '0xa', ['C_DATA', '0xa_v', 'int', 1]],
      },
    });
    expect([...reachableAddrs(s)]).toEqual(['0xa']);
    expect([...orphanAddrs(s)]).toEqual([]);
  });

  it('follows heap→heap pointers transitively', () => {
    const s = step({
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['head'],
          isHighlighted: true,
          frameId: '0xm',
          uniqueHash: 'm',
          encodedLocals: { head: ['C_DATA', '0xloc', 'pointer', '0xa'] },
        },
      ],
      heap: {
        '0xa': [
          'C_ARRAY',
          '0xa',
          [
            'C_STRUCT',
            '0xa',
            'Node',
            ['next', ['C_DATA', '0xa_n', 'pointer', '0xb']],
          ],
        ],
        '0xb': [
          'C_ARRAY',
          '0xb',
          [
            'C_STRUCT',
            '0xb',
            'Node',
            ['next', ['C_DATA', '0xb_n', 'pointer', null]],
          ],
        ],
      },
    });
    expect(reachableAddrs(s).has('0xa')).toBe(true);
    expect(reachableAddrs(s).has('0xb')).toBe(true);
    expect(orphanAddrs(s).size).toBe(0);
  });

  it('flags heap blocks with no incoming pointer as orphans', () => {
    const s = step({
      heap: {
        '0xleak': ['C_ARRAY', '0xleak', ['C_DATA', '0xleak_v', 'int', 7]],
      },
    });
    expect([...orphanAddrs(s)]).toEqual(['0xleak']);
  });

  it('does not chase null pointers', () => {
    const s = step({
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['p'],
          isHighlighted: true,
          frameId: '0xm',
          uniqueHash: 'm',
          encodedLocals: { p: ['C_DATA', '0xloc', 'pointer', null] },
        },
      ],
      heap: {
        '0xleak': ['C_ARRAY', '0xleak', ['C_DATA', '0xleak_v', 'int', 7]],
      },
    });
    expect(orphanAddrs(s).has('0xleak')).toBe(true);
  });
});
