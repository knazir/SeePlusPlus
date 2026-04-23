// Minimal but realistic ProgramTrace fixtures for tests. Mirror the shape
// backend's parse_vg_trace.ts emits. Kept small so failures read cleanly;
// extend inline when a test specifically needs more.
import type { ProgramTrace } from './schema';

/** Two Node heap blocks chained via `next`; main holds a pointer to the head.
 *  Exercises stack→heap and heap→heap edges, plus a nullptr tail chip. */
export const LL_TRACE: ProgramTrace = {
  code: 'struct Node { int value; Node* next; };\n',
  trace: [
    {
      event: 'stepLine',
      line: 10,
      funcName: 'main',
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['list'],
          isHighlighted: true,
          frameId: '0xmain',
          uniqueHash: 'main_0xmain',
          encodedLocals: {
            list: ['C_DATA', '0xlocal', 'pointer', '0xaaa'],
          },
          line: 10,
        },
      ],
      globals: {},
      heap: {
        '0xaaa': [
          'C_ARRAY',
          '0xaaa',
          [
            'C_STRUCT',
            '0xaaa',
            'Node',
            ['value', ['C_DATA', '0xaaa_val', 'int', 1]],
            ['next', ['C_DATA', '0xaaa_next', 'pointer', '0xbbb']],
          ],
        ],
        '0xbbb': [
          'C_ARRAY',
          '0xbbb',
          [
            'C_STRUCT',
            '0xbbb',
            'Node',
            ['value', ['C_DATA', '0xbbb_val', 'int', 2]],
            ['next', ['C_DATA', '0xbbb_next', 'pointer', null]],
          ],
        ],
      },
      orderedGlobals: [],
      stdout: '',
    },
  ],
};

export const TINY_TRACE: ProgramTrace = {
  code: 'int main() { int x = 42; return 0; }\n',
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
          frameId: '0xffff0000',
          uniqueHash: 'main_0xffff0000',
          encodedLocals: {},
          line: 1,
        },
      ],
      globals: {},
      heap: {},
      orderedGlobals: [],
      stdout: '',
    },
    {
      event: 'stepLine',
      line: 1,
      funcName: 'main',
      stackToRender: [
        {
          funcName: 'main',
          orderedVarNames: ['x'],
          isHighlighted: true,
          frameId: '0xffff0000',
          uniqueHash: 'main_0xffff0000',
          encodedLocals: {
            x: ['C_DATA', '0xffff0008', 'int', 42],
          },
          line: 1,
        },
      ],
      globals: {},
      heap: {},
      orderedGlobals: [],
      stdout: '',
    },
  ],
};
