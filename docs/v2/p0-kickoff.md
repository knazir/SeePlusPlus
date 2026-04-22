# See++ v2 — P0 Kickoff Plan

**Purpose.** The first acts of Phase 0 (Foundation & Conventions), captured here so they survive a session restart. Pairs with `docs/v2/plan.md` (the full phased plan) once that file is promoted.

**Status.** Ready to execute. All planning-phase decisions are locked (see `tmp/seepp-v2-plan.md` §8 or the promoted `docs/v2/plan.md` §8 once moved).

---

## Pre-kickoff context

- **Main clone:** `/Users/kashif/Development/SPP/SeePlusPlus/` (this directory).
- **Worktree siblings:** live alongside as `/Users/kashif/Development/SPP/SeePlusPlus-<feature>/` (e.g., `SeePlusPlus-spike-flip`).
- **Branch:** all P0 work lands on the `v2` branch via feature-branch PRs into `v2`. Cutover merge `v2` → `master` happens inside P7.
- **MCP:** Playwright MCP is to be installed during the upcoming session restart. Not used in P0/P1; will earn its keep starting P3 (frontend shell) and especially P4 (visual regression triage).

---

## P0 first acts — execute in this order

### 1. Promote the plan
- Move `tmp/seepp-v2-plan.md` → `docs/v2/plan.md`.
- Delete `tmp/seepp-v2-plan.md`.
- Commit: `docs(v2): promote phased plan to docs/v2/plan.md`.

### 2. Open the P0 feature branch
- Branch `p0/foundation` off `v2`.
- Open a draft PR titled "P0: foundation & conventions" pointing at `v2`. Keep it draft until all P0 criteria are green.

### 3. Scaffold `.agents/`
Create at repo root with first-draft content for each:
- `.agents/README.md` — entry point.
- `.agents/worktree-setup.md` — `git worktree add`, port allocation, `.env.local`, per-worktree DB.
- `.agents/subagent-patterns.md` — when to fan out vs. when to use a worktree.
- `.agents/golden-trace-runbook.md` — how to add a new `.cpp` + `.trace.json` pair.
- `.agents/visual-regression.md` — intentional vs. regression; how to update baselines.
- `.agents/pr-ready-checklist.md` — what a PR needs before leaving draft.
- `.agents/session-log/` (dir, `.gitkeep`) — for the future `Stop` hook to append to.

### 4. Seed the eight persona files
Each is a `.claude/agents/<name>.md` with scoped tools and a focused prompt. Locked roster (§4a of the plan):

1. `.claude/agents/trace-schema-steward.md` — tools: Read, Edit. Guards `packages/trace-schema/`.
2. `.claude/agents/test-author.md` — tools: Read, Write, Bash. Writes Vitest/Playwright from a spec.
3. `.claude/agents/viz-component.md` — tools: Read, Write, Bash. Component + story + visual baseline.
4. `.claude/agents/recognition-heuristic.md` — tools: Read, Write, Bash. Extends `packages/recognition/`.
5. `.claude/agents/golden-trace-curator.md` — tools: Read, Write, Bash. Curates `packages/golden-traces/`.
6. `.claude/agents/perf-profiler.md` — tools: Read, Bash. Runs the P1c harness, reports ceilings.
7. `.claude/agents/visual-regression-triager.md` — tools: Read, Bash. Triages snapshot diffs.
8. `.claude/agents/spec-writer.md` — tools: Read, Write. Drafts OpenAPI + Zod.

### 5. Starter hooks
In `.claude/settings.json` (or `.claude/settings.local.json` if per-user):
- `PostToolUse` on `Edit|Write` → run `prettier --write` + `eslint --fix` on the touched file. Fail fast.
- `SessionStart` → print the current worktree's assigned ports and DB name (reads from `.env.local`).

Nothing else until a pattern clearly emerges. No `PreCommit`, no `Stop` summaries yet.

### 6. Port allocator + docker-compose-per-worktree
- `scripts/worktree-ports.sh <worktree-name>` — deterministic 3000/4000-series allocation based on worktree name hash. Emits `.env.local` with:
  - `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT`
  - `DB_NAME=seepp_<worktree-slug>`
- `docker-compose.v2.yml` — reads the above from `.env.local`; brings up backend, Postgres (isolated DB), and the future frontend-v2 service.
- `CLAUDE.md` at repo root updated with the worktree + port convention and how to bootstrap a new one.

### 7. Monorepo tooling + shared packages
- Add `pnpm-workspace.yaml` covering `backend/`, `frontend/` (current), `frontend-v2/`, `code-runner/`, `packages/*`.
- Add a minimal `turbo.json`: tasks `build`, `test`, `lint`, `typecheck`; no custom pipeline beyond task deps.
- Create empty shared packages with stubs:
  - `packages/trace-schema/` — Zod schema + OpenAPI types (stubbed).
  - `packages/api-client/` — generated TS client (stubbed; generation wired later).
  - `packages/golden-traces/` — two placeholder programs (hello-world, linked-list-build) + runner.
  - `packages/recognition/` — empty stub, populated at P1b/P5.

### 8. Test harness — the <30s green invariant
Wire up with a placeholder test per layer, all green:
- Vitest unit — one trivial test per package.
- `@fast-check/vitest` — one property invariant ("trace steps non-empty; stack depth never negative").
- Golden trace runner — diffs two placeholder programs; passes.
- Trace JSON snapshot — one snapshot; passes.
- Playwright — ephemeral-server config; one smoke test that boots and tears down in <30s.

Then: `pnpm test` from any worktree must go green cold in <30s, warm in <10s. Tune cache + concurrency until it does.

### 9. CI workflow
Single GitHub Actions workflow:
- Matrix by package.
- Caches: pnpm store, Turbo, Playwright browsers.
- Draft PRs: unit + property + snapshot only.
- Ready-for-review PRs: add visual + E2E.
- Nightly (post-merge to `v2`): perf regression harness (informational).

### 10. CLAUDE.md hierarchy
Update or create:
- Root `CLAUDE.md` — worktree convention, ports, `pnpm test` and `docker compose up` commands.
- `backend/CLAUDE.md` — API surface, trace schema location, local DB setup.
- `code-runner/CLAUDE.md` — trace-emission flow, `traceVersion` bump protocol.
- `packages/trace-schema/CLAUDE.md` — the schema is the contract; extension protocol.
- `frontend-v2/CLAUDE.md` — created at P3; skip now.

### 11. Mark P0 done when all these are green
- `docker compose -f docker-compose.v2.yml up` works in main clone and at least one worktree on disjoint ports.
- `pnpm test` cold-green in <30s, warm in <10s, from any worktree.
- CI passes on the P0 PR.
- All eight persona files + all seven `.agents/` docs committed.
- Both starter hooks active.
- Docs reflect v2 reality.

Merge the P0 PR into `v2`. P1 (the three parallel spikes) starts the next day.

---

## After the restart — what to run first

```
# In main clone
git status                                     # confirm clean on v2 (or current branch)
cat docs/v2/p0-kickoff.md                      # this file
cat tmp/seepp-v2-plan.md || cat docs/v2/plan.md # full plan (whichever exists)
# Confirm Playwright MCP is registered:
# (agent will run /mcp or check mcpServers in .claude/settings)
# Then say: "go, start P0"
```

Or just: **"go"** — I'll execute steps 1–11 above in order, open the draft PR, and check back before declaring P0 done.

---

*End of P0 kickoff plan.*
