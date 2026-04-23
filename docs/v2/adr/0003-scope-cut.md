# ADR 0003 — Aggressive scope cut; plan replaced with backlog; lift-the-keepers frontend

**Date:** 2026-04-23
**Status:** Accepted. Supersedes the original phased plan (now deleted).

## Context

The original `docs/v2/plan.md` was written for a greenfield project — nine phases, weekly estimates, dependency graph, risk register, agent-orchestration catalog, multiple categories of committed infrastructure. We are not greenfield:

- `backend/` is a clean 900-line Node/Express TypeScript rewrite with a working trace parser. Extend in place.
- `tmp/design-spec/` is a comprehensive React-based design prototype demonstrating every screen, interaction, FLIP animation, and a working recognition heuristic.
- The plan's risk-reduction spikes (ADR-0002) turned out to have `yes` answers already sitting in the mock.
- The plan's foundational monorepo (ADR-0001) turned out to be ceremony for a contract the frontend can own alone.

Continuing to execute against the plan produced obvious waste: the first seven P0 acts built an elaborate monorepo-test-harness-persona-hooks apparatus, all of which we ripped out. Reading the rest of the plan with the same skepticism revealed ~28 more items worth cutting or deferring.

## Decision

Replace the phased plan with a short `docs/v2/README.md`: current state + v1 goals + lift-the-keepers frontend strategy + flat ordered backlog. No weekly estimates, no phases, no "what's being validated." The work is the work.

**Frontend strategy**: scaffold `frontend/` fresh (Vite + TS + Tailwind + Zustand). From the mock, lift the working logic (FLIP, recognition, style tokens, keyboard shortcuts) and use the component decomposition as a structural reference. Rewrite the shell (the mock uses in-browser Babel, `window.*` globals, no TS, no build — unsuitable as a production scaffold).

**Aggressive scope cut** against the old plan:

### Kill outright

From the P0-era monorepo work (already done):
- pnpm workspaces, Turborepo, `packages/*` with five shared packages, root config files, starter hooks, eight speculative agent personas, `-v2` filename suffixes. (See ADR-0001.)
- Three risk-reduction spikes (FLIP / recognition / scrub). (See ADR-0002.)

From the rest of the plan:
- OpenAPI spec + auto-generated TS client + Redoc preview. One frontend, zero external consumers.
- `traceVersion` negotiation header. One client, no compat matrix.
- Multi-file request shape `{ files: [], entrypoint }` before multi-file UI exists.
- `fast-check` property-based tests at P2.
- `/v1/auth/*` stubs returning 501 before P6 needs them.
- Storybook / Ladle on every leaf component.
- `nuqs` URL state for step index / workspace id during frontend shell work.
- Multi-file workspace state model before multi-file UI.
- Tutor panel with "mocked responses" before the real tutor exists.
- Perf harness in CI with regression gating (no baseline to compare against).
- Three pointer routing modes (curved / straight / orthogonal) — ship curved only.
- S3 trace cache keyed by `(code_hash, valgrind_version, compiler_flags)`. Valgrind is deterministic; regenerate on demand.
- `trace_ref` column in the workspaces schema (tied to above).
- Sentry / third-party error reporting. CloudWatch + server logs already there.
- Lambda warm-container tuning. Costs money without evidence of cold-start pain.
- Full visual-regression CI suite with quarantine-flake-triage workflow. Ad-hoc spot-checks against mock screenshots are enough for v1.
- Redis for tutor rate-limit + short-term conversation memory. Postgres is enough at v1.5 scale.
- Tutor evaluation harness before shipping the tutor. Ship, watch, then build evals if needed.
- Headless Claude Code CI agents (formatter auto-fix, golden regen, dep bumps — deterministic scripts or Dependabot do these).
- Scheduled agents (all four — nightly tutor evals, weekly dep-bump PR, weekly perf regression, post-Valgrind-bump regen — either deferred or replaceable).
- Agent-workflow metrics (time-to-green-PR, review-pass rate, flake rate, agent-hours per phase).

### Scope down

- **LL + DLL + tree + cycle recognition at launch** → **LL + tree only**. DLL + cycle incremental or v1.5.
- **Google + GitHub OAuth** → **Google only** at launch. GitHub later if demand signals it.

### Keep with minor revision

- `POST /api/run` (the existing endpoint) remains the primary API — no `/v1/runs` prefix churn.
- Golden-trace corpus at 6 programs is reasonable; lives in `backend/tests/fixtures/goldens/` when added (not a package).
- Postgres schema shape is reasonable; cut `trace_ref`.
- Stripe wiring at v1.5 is straightforward; kept as a single-PR task when v1.5 arrives.
- Visual parity against `tmp/design-spec/project/screenshots/` via ad-hoc Playwright tests on a handful of key screens, not every leaf component.

## Consequences

**Gains.** The v2 scope becomes: build the frontend, add accounts + shares, cutover. Probably 4–6 weeks of focused work vs. the plan's 13+ weeks of gold-plated P0–P7. Every item on the backlog is small enough to ship in a few days; decisions happen when the code demands them, not in advance.

**Losses.** No planning artifact to reference for "what comes after this." Lose the illusion of predictability — but that illusion is what produced the gold-plating in the first place. v1.5 scope stays unplanned until v1 users teach us what it should be.

**Discipline required.** Without phase boundaries, scope creep has no natural friction point. Counter by refusing any "while we're here, let's also…" unless it's on the backlog or a justified bug fix.

## What gets deleted

- `docs/v2/p0-kickoff.md`
- `docs/v2/plan.md`

ADRs 0001 and 0002 stay as decision history. Their "overrides §X of plan.md" language becomes archaeological, not actionable — preserved for context.
