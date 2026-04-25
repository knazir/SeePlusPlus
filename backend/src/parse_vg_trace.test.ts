import { describe, it, expect } from "vitest";
import { finalizeTrace } from "./parse_vg_trace";

// Minimal helper to build the shape `finalizeTrace` consumes: a flat list of
// ExecutionPoints where each `stackToRender` entry has at least `frameId`,
// `funcName`, and (optionally) `line`. We mirror the real shape produced by
// `processJsonObject` so the post-processing passes see realistic data.
type Frame = { frameId: string; funcName: string; line?: number };
function ep(line: number, funcName: string, stack: Frame[]): any {
  return {
    event: "stepLine",
    line,
    funcName,
    stackToRender: stack.map((f) => ({ ...f, isHighlighted: false })),
    globals: {},
    heap: {},
    orderedGlobals: [],
    stdout: "",
  };
}

describe("finalizeTrace — pass 5 (skip extraneous step after return)", () => {
  // The frameId guard exists so a "return from f(); call g() on the same
  // line" sequence — legitimate, not extraneous — is preserved.
  it("does NOT delete a step when the post-return frame is a *different* frame on the same line", () => {
    const points = [
      // main(line=10) calls f()
      ep(10, "main", [{ frameId: "0xMAIN", funcName: "main", line: 10 }]),
      // inside f
      ep(20, "f", [
        { frameId: "0xMAIN", funcName: "main", line: 10 },
        { frameId: "0xF", funcName: "f", line: 20 },
      ]),
      // back in main on the SAME line (line 10) — but we're about to call g(),
      // not "extraneous post-return"
      ep(10, "main", [{ frameId: "0xMAIN", funcName: "main", line: 10 }]),
      // inside g — different funcName, so cur(2).funcName !== nxt(3).funcName
      // is the existing guard. We rely on the frameId guard for the case where
      // funcNames coincidentally match (e.g., recursion).
      ep(30, "g", [
        { frameId: "0xMAIN", funcName: "main", line: 10 },
        { frameId: "0xG", funcName: "g", line: 30 },
      ]),
    ];

    const out = finalizeTrace(points as any);

    // Should have 4 steps; the post-return main step is NOT extraneous.
    expect(out).toHaveLength(4);
    const lines = out.map((p) => `${p.funcName}:${p.line}`);
    expect(lines).toEqual(["main:10", "f:20", "main:10", "g:30"]);
  });

  // Locks in the actual optimisation: when the post-return step lands at
  // the same caller frame and line as a genuinely extraneous follow-up,
  // it should be dropped.
  it("DOES delete the extraneous post-return step when caller frame + line match and funcNames coincide", () => {
    // main(line=5) calls helper f(line=8); on return we land back at line 5
    // in main, and the follow-up step is also in main. The middle "main:5"
    // step is the extraneous one.
    const points = [
      // returning from inner f back into main at line 5 — pre-mark as the
      // call/return detection in pass 2 would have produced
      ep(5, "main", [
        { frameId: "0xMAIN", funcName: "main", line: 5 },
        { frameId: "0xF", funcName: "f", line: 8 },
      ]),
      // post-return step in main, same line as the call site — extraneous
      ep(5, "main", [{ frameId: "0xMAIN", funcName: "main", line: 5 }]),
      // next step still in main (funcName coincides → triggers the opt)
      ep(6, "main", [{ frameId: "0xMAIN", funcName: "main", line: 6 }]),
    ];
    points[0].event = "return";

    const out = finalizeTrace(points as any);
    const sequence = out.map((p) => `${p.event}:${p.funcName}:${p.line}`);
    expect(sequence).toContain("return:main:5");
    // The extraneous post-return main:5 stepLine is dropped.
    expect(sequence).not.toContain("stepLine:main:5");
  });

  // Discriminating case: line + funcName guards both pass, but the
  // top frames differ. The frameId guard must preserve cur.
  it("does NOT delete cur when curTop and prevCaller are different frames at the same line", () => {
    // Post-return shape with a frame swap: prev's caller frame had id 0xA,
    // but cur's top frame has id 0xB at the same line. (Synthetic — bypasses
    // pass 2's call/return detection by pre-marking the event.)
    const points = [
      ep(7, "main", [
        { frameId: "0xA", funcName: "main", line: 7 },
        { frameId: "0xINNER", funcName: "main", line: 9 },
      ]),
      // cur — top frame is a *different* frame (0xB) at the same line (7);
      // funcName "main" coincides with nxt.funcName so the funcName guard
      // alone would let pass 5 fire. Only the frameId check distinguishes.
      ep(7, "main", [{ frameId: "0xB", funcName: "main", line: 7 }]),
      ep(8, "main", [{ frameId: "0xB", funcName: "main", line: 8 }]),
    ];
    points[0].event = "return";

    const out = finalizeTrace(points as any);
    const sequence = out.map((p) => `${p.event}:${p.funcName}:${p.line}`);
    // With the fix: cur is preserved (frameId 0xB ≠ 0xA).
    // With the typo: cur is wrongly deleted because undefined === undefined.
    expect(sequence).toContain("stepLine:main:7");
  });
});
