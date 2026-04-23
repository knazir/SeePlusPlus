# ADR 0002 — Skip P1 risk-reduction spikes; fold their questions into P4

**Date:** 2026-04-23
**Status:** Accepted (overrides `docs/v2/plan.md` §3 P1 and §4a phase table)

## Context

The original plan earmarked 1–2 weeks for three parallel risk-reduction spikes (P1a FLIP, P1b recognition, P1c scrub) before committing their approaches to the mainline viz at P4. Each was to run in its own worktree and produce a go/no-go memo.

Re-reading the design mock (`tmp/design-spec/project/src/viz.jsx`) before kicking P1 off revealed that **all three "risks" already have working implementations in the mock**:

- **FLIP** — `viz.jsx:186-222` captures old rects with `getBoundingClientRect`, applies inverse transform via the Web Animations API, animates with a 520ms cubic-bezier. Handles both persisting and entering nodes. Runs smoothly on the maintainer's machine for the default 22-step linked-list trace.
- **Recognition** — `viz.jsx:230+` is a working topology-based heuristic for singly-linked lists with cycle detection. The extension surface (DLL, tree, cycle) is the incremental P5 scope.
- **Scrubbing** — the mock pre-bakes a 22-step trace and the scrubbar is wired to the same Web Animations API. No structural reason for stutter until DOM node count is genuinely high.

The spikes were manufactured risk-reduction for a plan that implicitly assumed we'd be building these subsystems from first principles. We're not; we're porting a working prototype.

## Decision

**Skip P1 entirely.** Proceed directly to P2 (trace format + backend API-first).

The residual concerns that justified P1 become characterization tasks inside P4:

- **"Does FLIP scale to 50+ nodes?"** — when P4 lands the production viz, generate a synthetic trace with 50 nodes, run it, measure. Inline. No separate spike.
- **"Can recognition hit acceptable precision on a ~30-program corpus?"** — this is P5's deliverable. We start with the mock's LL heuristic, extend as corpus grows. The §8 relaxation ("no zero-false-positive gate") already codified this.
- **"What's the scrub latency ceiling?"** — measure inside P4 once the real viz exists. Don't pre-measure something we haven't built.

## Consequences

Gains:

- 1–2 weeks reclaimed.
- No three-worktree overhead (three throwaway Vite scaffolds, three isolated dev loops, three memos).
- P4 is no longer gated on spike outputs — starts as soon as P2 + P3 are done.

Losses:

- No independent "is this feasible at all?" signal before we commit the production viz to these patterns. Judged acceptable because the mock already answers that question.
- If P4 discovers a performance wall at, say, 20 nodes (below expectations), we'll be rediscovering it under P4 pressure rather than in a throwaway spike. Mitigation: an early P4 sub-task is "port the mock's FLIP + scrub to the real stack and measure at 5 / 20 / 50 / 100 nodes." If that sub-task finds a wall, rescope P4 on the spot. We did not need a separate phase to learn that.

## What sections of `plan.md` this overrides

- §2 P1 row — remove.
- §3 P1a / P1b / P1c — remove; keep as historical context only.
- §4a phase-table row for P1 (worktree-parallelism demonstration) — supersede. Worktree parallelism will be exercised at P6 (auth / workspaces / shares) instead.
- §7 Dependency graph — `P0 → P2` directly. P4 still consumes "recognition + FLIP patterns" but sources them from the mock, not P1.

## Phasing after this ADR

```
P0 ──▶ P2 ──▶ P3 ──▶ P4 ──▶ P5 ──▶ P6 ──▶ P7 ──▶ P8 ──▶ P9
```

P1 removed. All other phases unchanged.
