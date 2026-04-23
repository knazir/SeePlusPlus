# ADR 0001 — No monorepo; per-directory tooling; trace schema owned by frontend

**Date:** 2026-04-23
**Status:** Accepted (overrides `docs/v2/plan.md` §4 and §6)

## Context

The initial plan (`docs/v2/plan.md`) assumed a pnpm workspaces + Turborepo monorepo with five shared packages under `packages/*` — `trace-schema`, `api-client`, `recognition`, `golden-traces`, `e2e`. The motivating assumption was that a Zod trace schema would be shared between backend and frontend as a compile-time contract.

Implementation (P0) exposed the cost:

- Root cluttered with 11 monorepo-tooling files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `pnpm-lock.yaml`, `node_modules/` hoist, plus derivative CI config).
- Of the five "shared" packages, only `trace-schema` is genuinely multi-consumer. The other four are single-consumer code that was packaged because the plan committed to a monorepo shape.
- The `trace-schema` contract is actually driven by SPP-Valgrind's output format (which we treat as dogma) and by what the frontend needs to render. The backend is a translator, not an independent source of truth.

## Decision

**No monorepo.** Each top-level directory owns its own toolchain:

- `backend/` keeps its existing `npm` + `tsc` setup.
- `frontend/` (scaffolded fresh at P3) gets its own `package.json` + tooling.
- `code-runner/` has no JS tooling.

**No shared schema package.** `backend/src/parse_vg_trace.ts` is the canonical translator; its `ProgramTrace` interface is the backend's output type. The frontend (P3+) defines its own Zod validator for what it consumes. Drift is caught by end-to-end golden-trace integration tests.

**Goldens, recognition, api-client, e2e** are not packages. They live where they're used:

- Goldens: `backend/tests/fixtures/goldens/` (wired at P2).
- Recognition: `frontend/src/recognition/` (scaffolded at P5).
- API client: `frontend/src/api/` (a plain `fetch` wrapper at P3).
- E2E: either `tests/e2e/` at repo root or `frontend/tests/e2e/` (decide at P3).

## Consequences

Gains:

- Root stays un-cluttered. No lockfile / turbo cache / hoisted `node_modules` at root.
- Backend and frontend can evolve their toolchains independently. A React/Vite frontend doesn't drag in backend devDeps.
- CI is per-directory matrix; each runs its own `install` + `test`.
- Removed the entire category of "schema bump propagation" ceremony described in the original plan.

Losses:

- No compile-time type safety across the backend/frontend boundary. Drift surfaces at runtime (Zod parse failure) or in golden-trace integration tests, not at `tsc`.
- If a future feature (e.g. the P8 tutor backend wanting to reuse the frontend's step-serialization logic) genuinely needs shared code, we'll need to reintroduce a package boundary at that point. Estimated cost: ~30 minutes to stand up a minimal shared package when the need is concrete.

Judgment: for a one-developer project with good integration tests, runtime-validated decoupling is adequate and the ergonomic gain is large.

## What sections of `plan.md` this overrides

- §2 P0 row — "Green `docker compose up && npm test` in <30s" still holds, but the `npm test` is per-directory, not monorepo-wide.
- §3 P0 "Key tasks" — #2 (packages/trace-schema), #5 (packages/golden-traces), and all monorepo mentions are superseded.
- §4 "Monorepo layout" diagram — disregard. See root `CLAUDE.md` layout section for current reality.
- §4 Test layering table — keep as aspirational test types; the tool choice is per-directory, not unified Vitest.
- §4a "Custom subagent personas" — the `trace-schema-steward`, `recognition-heuristic`, `golden-trace-curator`, `spec-writer`, `test-author`, `viz-component`, `perf-profiler`, `visual-regression-triager` seed personas are not in the repo. Reintroduce if a phase earns it.
- §6 #4 "Monorepo tooling → pnpm workspaces + Turborepo" — rejected.

## Related feedback

Personal memory: `~/.claude/projects/.../memory/feedback_avoid_speculative_scaffolding.md` captures the broader lesson ("no scaffolding that anticipates future pain; add it when pain shows up").
