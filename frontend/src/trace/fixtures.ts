// Minimal but realistic ProgramTrace for tests. Mirrors the shape backend's
// parse_vg_trace.ts emits for a 2-step program: `main()` enters, then
// executes a line that defines an int local. Kept tiny so test failures read
// cleanly; extend inline when a test specifically needs more.
import type { ProgramTrace } from './schema';

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
