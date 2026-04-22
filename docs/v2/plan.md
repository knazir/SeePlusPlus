# See++ v2 — Phased Milestone Plan

**Author:** Claude Code
**Date:** 2026-04-22
**Status:** Draft 1 — awaiting Kashif review
**Inputs:** `tmp/seepp-v2-phase-planning-handoff.md`, `tmp/design-spec/` (Claude Design handoff)

---

## 1. Executive Summary

The plan sequences v2 in **nine phases** grouped into three arcs: **Foundation (P0–P1)**, **v1 build-out (P2–P7)**, **v1.5 build-out (P8–P9)**. Foundation front-loads test infrastructure, `.agents/` conventions, per-worktree docker-compose, and — critically — timeboxed spikes for the three delight-critical risks (FLIP relayout, recognition heuristics, scrub perf) before committing them to the mainline. Each v1 phase ships something independently meaningful: a versioned trace API, a running app shell, a working visualization, recognition, and finally accounts/sharing. v1 cutover is Phase 7; v1.5 is additive and does not block v1 launch. Design is treated as canonical — a fidelity pass at the end of each visualization phase against the design-spec prototype is the primary oracle.

**The plan is also a multi-agent workflow exercise.** §4a catalogs the concrete orchestration patterns (custom personas, subagent fanout, worktree parallelism, headless CI agents, scheduled agents, hooks, `/ultrareview`, Agent SDK in-product) and maps each to the phase where it earns its keep. Not all patterns are worth adopting — that section is the menu, not a commitment. Pick what you want on.

Open-question defaults are proposed in §6 so we can start without a decision-storm; flag any you want to override.

---

## 2. Phasing At A Glance

| # | Phase | Ships | Primary validation |
|---|---|---|---|
| P0 | Foundation & conventions | Green `docker compose up && npm test` in <30s on any worktree; `.agents/`, CLAUDE.md, CI, monorepo tooling | Agent feedback loop is fast and parallelizable |
| P1 | Risk-reduction spikes | Three throwaway prototypes (FLIP, recognition, scrub) with go/no-go memos | The hardest technical assumptions hold up |
| P2 | Trace format v2 + backend API-first | `POST /v1/runs` returns a versioned trace JSON; OpenAPI spec; golden traces | Backend/frontend decoupling is real; latency parity |
| P3 | Frontend app shell | Topbar, file tree, editor, console, exec bar, state scaffolding — no viz yet | Layout, theming, keyboard shortcuts, multi-file workspace model |
| P4 | Visualization core | Stack frames + raw heap graph + pointers + FLIP + scrub + play + edit-during-trace | Visual parity with v1; FLIP animation feels right |
| P5 | Recognition heuristics | LL / DLL / tree / cycle detection + toggle; silent fallback | Confident-or-silent recognition; no false positives on corpus |
| P6 | Persistence & auth | Postgres; workspaces; shareable links; Google/GitHub OAuth; anonymous preserved | Save/load, share, sign-in flows end-to-end |
| P7 | v1 polish, CI hardening, cutover | Perf tuning, visual-regression gates, observability, launch checklist; v2 branch becomes main | Public users get v2 without regressions |
| P8 | v1.5 tutor infrastructure | Tutor API, native tutor MVP, BYOAI mode, inline breadcrumb, tier gating hooks | Adaptive explanation quality at a fixed cost budget |
| P9 | v1.5 monetization | Stripe, tier enforcement, anonymous→paid upgrade path | Payments, tier transitions, anonymous-first UX preserved |

---

## 3. Phase-by-Phase Detail

### P0 — Foundation & Conventions *(1 week target; blocks everything)*

**Goal.** The agent-workflow is only as fast as the slowest feedback loop. Establish that loop first.

**Completion criteria.**
- `./localdev-v2.sh up` (or `docker compose up`) works in the main clone **and** in any worktree sibling under `SPP/`, on unique ports per worktree.
- `npm test` from any worktree runs the full unit + property + snapshot suites green in <30s cold, <10s warm.
- CI runs on every PR: unit + property + snapshot as gating; visual + E2E as gating-or-post-merge per perf.
- `CLAUDE.md` at repo root, `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `.agents/` conventions documented.
- Monorepo tooling chosen and wired (proposed default: **pnpm workspaces + Turborepo**; existing top-level dirs retained: `backend/`, `frontend/`, `code-runner/`, `copilot/`, `docs/`; add `packages/trace-schema/` shared package).
- Port allocation script: `scripts/worktree-ports.sh <worktree-name>` emits `.env.local` with deterministic 3000/4000-series ports.

**Key tasks.**
1. Choose and commit frontend stack skeleton (React + TS + Vite + Tailwind v4 — see §6). Leave `frontend/` (legacy) alone; scaffold `frontend-v2/` at first, rename at P7.
2. Create `packages/trace-schema/` with Zod + generated TS types + OpenAPI-derived types (trace format v2 will inhabit this package).
3. Write `docker-compose.v2.yml` with per-worktree overrides: DB name = `seepp_${WORKTREE}`, port ranges driven by `.env.local`. Document in `CLAUDE.md`.
4. CI workflow (GitHub Actions): matrix across packages; cache pnpm store + Turbo cache.
5. Golden-trace harness stub: a `packages/golden-traces/` directory with `<program>.cpp` + `<program>.trace.json` pairs; a Vitest runner that diffs. Start with two programs (hello-world, linked-list-build).
6. Property-based test harness stub: `@fast-check/vitest` wired; one placeholder invariant ("trace.steps is non-empty and stack depth never goes negative") to prove the loop works.
7. Playwright harness with ephemeral-server config (boots & kills per run).
8. `.agents/` directory with: PR-ready checklist, subagent-use patterns, "how to add a golden trace" runbook, worktree-setup runbook.
9. Relicense prep work (header updates, LICENSE file draft) happens incrementally during the v2 branch's life; the actual license flip ships with the public cutover at P7.

**Risks.** Turborepo over-engineering for current scale — mitigate by keeping the turbo.json minimal (build, test, lint, typecheck only). Port conflicts across worktrees — mitigate with the allocation script.

**What's being validated.** That the infrastructure investment is real and agents can work in parallel without stepping on each other.

---

### P1 — Risk-Reduction Spikes *(1–2 weeks; parallelizable across three worktrees)*

**Goal.** Burn down the three delight-critical risks *before* they're entangled with production code. Each spike is throwaway; the artifact is a go/no-go memo and a reference implementation.

Run the three spikes **in parallel, each in its own worktree** (`SPP/seepp-spike-flip/`, `SPP/seepp-spike-recognition/`, `SPP/seepp-spike-scrub/`). This is the model case for the multi-worktree pattern.

#### P1a — FLIP heap relayout animation

- **Question.** Does the FLIP-based per-step relayout from the design-spec prototype (`viz.jsx`, 520ms cubic-bezier) scale to heaps of 50+ nodes without jank, and compose correctly with SVG pointer-edge rerouting?
- **Shape.** Standalone Vite page, synthetic trace generator producing 1/5/20/50/100-node steps with varied topologies. Instrument frame timing via `performance.measure`.
- **Pass criteria.** Subjectively smooth on the maintainer's dev machine up through ~50 nodes; pointer arrows remain visually coherent during transitions (no tearing from the old layout to the new). Characterize — don't gate on — behavior at 100+ nodes.
- **Output.** A memo answering: (1) target ceiling for node count, (2) whether SVG or Canvas is the better primitive for the edge layer at the ceiling, (3) whether we need an opt-out for huge traces.

#### P1b — Data structure recognition

- **Question.** Can a confident-or-silent heuristic correctly classify LL / DLL / tree / cycle on a corpus of ~30 pedagogical programs with **zero** false positives?
- **Shape.** Pure function: `recognize(heap, edges) -> RecognizedShape | null`. Corpus lives in `packages/golden-traces/` with annotated expected-recognition results.
- **Pass criteria.** Reasonable precision + recall on the corpus. We are not holding shipping on a zero-false-positive bar — the user has a raw/recognized toggle in the UI, so wrong recognition is recoverable. Flag egregious misses in the memo; don't gate on them.
- **Output.** The heuristic (keep it), the corpus (keep it), and a memo on known weak spots + which additional shapes are cheap to add later.

#### P1c — Live scrubbing performance

- **Question.** Does holding the full trace in memory and scrubbing with per-frame layout+animation stay responsive for traces of 500 / 5k / 50k steps? What's the threshold at which we have to stream, decimate, or server-paginate?
- **Shape.** Synthetic trace generator; wired scrubbar; measure input-to-paint latency at each trace size.
- **Pass criteria.** Subjectively smooth scrubbing on the maintainer's dev machine at traces of realistic size (up to a few thousand steps). Characterize behavior at 5k/50k to know where we need to decimate or stream, but don't gate on it.
- **Output.** Memo on trace-size ceiling, decision on whether FLIP is disabled during active scrubbing (vs. stepping) to preserve responsiveness.

**Completion criterion.** Three memos merged to `docs/v2/spikes/`, referenced by the canonical phase plan. Green-light or revised-scope decisions made before P4 starts. The spike code itself can be discarded; the heuristic from P1b and the synthetic-trace generators from P1a/c should be preserved as test inputs.

**What's being validated.** That the design's three load-bearing animations/heuristics are achievable at scale — and if they're not, we know *now* and can rescope rather than discovering it in P4.

---

### P2 — Trace format v2 + Backend API-first *(2 weeks)*

**Goal.** A backend that treats the frontend as an external consumer: versioned trace schema, OpenAPI spec, contract tests. No frontend changes.

**Completion criteria.**
- `POST /v1/runs` accepts `{ files: [{path, content}], entrypoint }` (multi-file from day one, even though P3 UI uses one file).
- Response: `{ traceVersion: "2.0.0", steps: [...], diagnostics: {...}, meta: {...} }`. Trace schema lives in `packages/trace-schema/` as Zod + OpenAPI.
- OpenAPI spec committed at `backend/openapi.yaml`; TS client auto-generated into `packages/api-client/`.
- Latency: p50 under 1.5s, p95 under 3s on warm Lambda, matching v1 parity.
- Golden-trace suite: 6 programs (hello-world, LL-build, LL-reverse, BST-insert, recursive-fact, pointer-swap) with full expected traces. Run on every PR.
- Property-based tests for trace invariants: stack grows-then-collapses, every heap alloc has an alloc step, every edge `.to` resolves to a live node or `null`, no duplicate step lines without a change.
- Backwards-compat: the legacy `POST /api/run` endpoint remains functional for the current frontend until P7 cutover.

**Key tasks.**
1. Define trace schema v2 (Zod) — accommodate everything the design-spec `trace.js` carries: `line`, `frames[{name, line, locals[], id}]`, `heap[{id, type, fields[]}]`, `edges[{from, to, kind}]`, plus `output`, `diagnostics`, and forward-compat `ext` blob.
2. Port/extend current Valgrind-output-parser to emit schema v2; keep v1 emitter available under a flag.
3. Add `traceVersion` negotiation header so clients can request a specific version; 2.0.0 is the v2 default.
4. Add OpenAPI spec and Redoc preview served at `/docs` in dev.
5. Write the contract tests (schema validation on every golden trace; schema validation as a property-test invariant).
6. Auth stubs: routes for `/v1/auth/*` return 501; placeholder middleware for bearer-token extraction. No real auth yet.

**Risks.** Trace-format churn during P4/P5 — mitigate by treating the `ext` blob as the place experimental fields live until promoted. Valgrind output drift — mitigate with golden-trace regression.

**What's being validated.** Backend/frontend decoupling is structural (not just aspirational) and latency parity is achievable with the new schema.

---

### P3 — Frontend app shell *(2 weeks)*

**Goal.** Pixel-faithful shell of the design — everything from the design-spec *except* the stack/heap visualization itself. Editor, console, execution bar, topbar, tweaks panel, modals.

**Completion criteria.**
- Every screen in `tmp/design-spec/project/screenshots/` renders at visual-regression parity (±1% pixel diff) for the non-viz regions.
- React + TS + Vite + Tailwind v4 + Zustand scaffolding; CSS-variable bridge so the design-spec's `--bg-0 / --ink-0 / --accent / ...` vars drive Tailwind utilities (via `@theme` in Tailwind v4).
- Fonts (Geist, JetBrains Mono) self-hosted, not CDN.
- Keyboard shortcuts from the prototype work (⌘↵ run, ⌘K examples, ⌘J tutor, arrows step, space play).
- Multi-file workspace data model in state even with a single file — `workspace: { files: File[], activeTab: string }` from day one.
- "Run" calls the real P2 backend and surfaces compile errors in the console and inline gutter squiggles for the error scenario.
- `TweaksPanel` wired behind a query-param flag (`?tweaks=1`) for the design-review workflow.
- Tutor panel renders with mocked responses (P8 will make it real); inline tutor breadcrumb renders above console in non-error states.
- Storybook (or Ladle) set up for visual-regression anchors on every leaf component.

**Key tasks.**
1. Port `styles.css` to a Tailwind v4 `@theme` block + a minimal global layer. Don't copy the prototype's structure — recreate in idiomatic React components.
2. Build leaf components with Storybook stories: `TopBar`, `FileTree`, `EditorTabs`, `Editor` (CodeMirror 6 — see §6), `ConsolePanel`, `ExecutionBar`, `TutorPanel`, `ExamplesModal`, `SignInModal`, `TweaksPanel`.
3. State: Zustand slices — `workspace`, `execution` (step, playing, stale), `ui` (panels open, tutor open), `tweaks`. URL state for step index and workspace id via `nuqs` or similar.
4. Wire up `POST /v1/runs` via the generated client; show running/error/normal/stale scenarios driven by real backend responses.
5. Playwright E2E: code-in → run-click → console output + stale→re-run loop (viz is not yet rendered; stub).

**Risks.** CodeMirror 6 bundle size — mitigate with only the C++ language package + minimal theme. Tailwind v4 maturity — fallback is Tailwind v3 with CSS vars layer.

**What's being validated.** The app's interactive shell at production quality, decoupled from visualization. A user could "run" a program and see compile output, which is already a shippable thing internally.

---

### P4 — Visualization core *(3 weeks)*

**Goal.** The visualization panel — stack frames, heap graph, pointers, FLIP animation, scrubbing, play, edit-during-trace staling — at visual parity with the design-spec prototype.

**Completion criteria.**
- Visual-regression snapshots match the prototype's `01-v2.png`, `02-v2.png`, `v3.png` within tolerance.
- FLIP animation per spike result (P1a) integrated; runs at the agreed FPS ceiling.
- Pointer routing: curved (default), straight, orthogonal modes. Solid for `*` pointers, dashed for `&` refs; uniform accent color; arrow markers; nullptr specially rendered as a slashed chip with no arrow.
- Orphaned memory dimmed with warn-colored border; clicking jumps timeline to the orphaning step (requires trace metadata: `orphanedAt` step index per node — added to schema).
- Stack frames: active frame expanded + accent-bordered; inactive condensed; pin-to-keep-expanded persists across steps.
- Scrubbing is live (per spike P1c); stepping keyboard-shortcut-driven; play interval 700ms per prototype.
- Edit-during-trace: editor flips to `stale`, viz dims with overlay, previous trace remains scrubbable, `⌘↵` re-runs.
- "Step into" / "step out" semantics defined and wired (stack frame depth changes between steps = step-into when deeper, step-out when shallower).
- Visual regression tests on representative steps of every golden trace.

**Key tasks.**
1. `StackFrames` component with expand/pin state in store; `HeapGraph` with FLIP animation layer per P1a output.
2. SVG edge layer with marker-end arrows; edge hover highlights the matching stack local and vice versa (bidirectional hover anchor via edge IDs).
3. Timeline/ticks on the scrub bar based on step metadata; line-number-click-to-jump-to-first-step-on-that-line.
4. Trace-schema extension for orphan detection: add `orphanedAt` on heap node entries.
5. Perf harness: run P1c synthetic traces through the full component tree on every PR; fail CI on regression.

**Risks.** FLIP + SVG edge co-animation tearing — mitigate by rerouting edges only at animation end, or by interpolating endpoints based on FLIP delta (P1a memo dictates). Step-into/step-out semantics could diverge from Valgrind output — define in schema, validate against golden traces.

**What's being validated.** v1 visualization parity and the delight bar. This is the phase that proves v2 is visibly better than v1.

---

### P5 — Recognition heuristics *(1 week; pulls in P1b output)*

**Goal.** Ship LL, DLL, tree, and cycle recognition + the raw/recognized toggle.

**Completion criteria.**
- Heuristic from P1b integrated as `packages/recognition/` — frontend-only, no backend dependency.
- Toggle in viz header (per prototype); when no shape matches, toggle is disabled with a tooltip ("no recognized structure at this step").
- Corpus is checked in and run in CI, but it informs rather than gates: flag regressions, don't block on precision targets.
- Visual-regression snapshots for each recognized shape on representative steps.

**Key tasks.**
1. Promote P1b heuristic from spike to package.
2. Add "recognized" rendering modes for LL (chain), DLL (chain with back-arrows), tree (layered tree layout), cycle (circular layout).
3. Extend the golden-trace corpus with one new program per shape (BST already covers tree; add DLL-build and a cycle program).

**Risks.** Cycle rendering geometry is the trickiest — mitigate by keeping it simple (circular layout, no overlap optimization) in v1.

**What's being validated.** The recognition claim holds: when we say "this is a linked list", we are not wrong.

---

### P6 — Persistence, auth, shareable links *(2 weeks)*

**Goal.** Users can sign in, save workspaces, create share links. Anonymous usage remains fully functional.

**Completion criteria.**
- Postgres provisioned (RDS in prod, a local container in dev).
- Schema (proposed): `users(id, email, provider, provider_id, created_at)`, `workspaces(id, user_id?, title, files_jsonb, created_at, updated_at)`, `shares(id, workspace_id, slug, permissions, code_hash, trace_ref?, created_at)`, `sessions` as needed for auth provider.
- Trace persistence strategy: **regenerate-on-demand** by default; when a user creates a share link, snapshot `(code_hash, files_hash)` and regenerate on first view, then cache to S3 keyed by `code_hash`. Share links are stable so long as Valgrind is deterministic on the inputs. (This keeps DB small.)
- OAuth: Google and GitHub. Auth library: **Auth.js (NextAuth) with Postgres adapter** if we end up SSR-capable; otherwise a plain **Lucia**-based session flow — decide during P6 once the frontend stack is concrete.
- Anonymous flow preserved: no account required to run, scrub, or visualize. Save/Share prompt sign-in modal per design-spec.
- E2E: sign-up → create workspace → save → log out → reopen share link anonymously → content renders.

**Key tasks.**
1. DB migration tooling (Drizzle or Prisma; Drizzle preferred — thinner abstractions, agent-friendlier SQL).
2. Auth routes on backend (`/v1/auth/google`, `/v1/auth/github`, `/v1/auth/session`); cookie session.
3. Workspace CRUD endpoints; share-link endpoints.
4. Frontend wiring: sign-in modal, Save/Share flows, "Open from share link" route.
5. Rate-limit anonymous `POST /v1/runs` at the API layer (design-document, not implement fully, if rate-limit infra is a bigger lift).

**Risks.** Trace-cache invalidation if Valgrind output drifts between versions — mitigate by keying cache on `(code_hash, valgrind_version, compiler_flags)`. OAuth redirect URIs across worktree ports — mitigate by using a dev-only forwarder or Google/GitHub's localhost-permissive settings.

**What's being validated.** Account-gated features work without degrading anonymous UX; share links are permalinks.

---

### P7 — v1 polish, CI hardening, cutover *(2 weeks)*

**Goal.** v2 becomes production. The `v2` branch is merged to `main`; `seepluspl.us` serves v2.

**Completion criteria.**
- Full visual-regression suite green; Playwright E2E green; lighthouse perf budget set and met.
- Observability: structured logs, request tracing, error reporting (Sentry or equivalent).
- `frontend-v2/` renamed to `frontend/`; legacy moved to `frontend-legacy/` if not already there (it is — so this is just swapping which one is active in Copilot manifests).
- Launch checklist: rollback plan documented, monitoring alarms set, seed content migrated, announcement drafted.
- Relicense (GPL-2.0 → MIT on orchestration code; SPP-Valgrind stays GPL-2.0) lands as part of the cutover.

**Key tasks.**
1. Visual-regression CI on every PR with a committed baseline; flake triage.
2. Lambda cold-start tuning (keep a warm container; review bundle size).
3. Copilot manifest updates for v2 service routing.
4. Cutover runbook; dry-run in staging.

**What's being validated.** The cutover is non-disruptive and reversible.

---

### P8 — v1.5 Tutor infrastructure *(3 weeks)*

**Goal.** Adaptive AI tutor delivers the features defined in the v1.5 done criteria. BYOAI mode exists (free, no backend cost); native tutor is Pro-gated (backend Claude API calls).

**Completion criteria.**
- Backend route `/v1/tutor/ask` accepts `{ workspaceId, stepIndex, message, history, bringYourOwnKey? }` and streams responses.
- Prompt construction includes: code, current step's `{ frames, heap, edges, line, note }`, a trailing window of prior steps, and `consoleOutput`. Aggressive prompt caching (cache the code + step context; the user question varies).
- Native tutor uses Claude (default: `claude-sonnet-4-6`; upgrade path to `claude-opus-4-7` for reasoning-heavy questions behind a feature flag).
- BYOAI mode lets the user paste an API key / use OpenRouter / use their Claude API key; stored client-side only; backend sees no key on that path.
- Suggested-prompt strip per prototype's `suggestions` array is adaptive to step range.
- Inline tutor breadcrumb above console; `[[step:N]]` and `[[code:x]]` replacements in rendered responses with jump affordance.
- Tier gating hooks in place: `user.tier` determines whether native tutor is available or upsells.

**Key tasks.**
1. Tutor service in backend with prompt templates, step-context serializer, streaming response.
2. Redis (or Postgres-as-queue) for rate limit and short-term conversation memory.
3. Frontend tutor panel wired to real backend; BYOAI composer wired to whichever providers we support in v1.5 (start with Claude + OpenAI-compatible).
4. Evaluation harness: a set of "tutor evals" — canned student questions per golden trace with rubric-graded expected answer traits. Run periodically, not per-PR.

**Risks.** Prompt cost at scale — mitigate with prompt caching and trace-context truncation. Hallucination despite trace grounding — mitigate with explicit system-prompt language and a "what the tutor can see" disclosure.

**What's being validated.** Grounded-on-trace explanation is higher quality than generic LLM answers about C++ code.

---

### P9 — v1.5 monetization *(1 week)*

**Goal.** Stripe is wired; Pro tier is enforced; anonymous→paid path works.

**Completion criteria.**
- Stripe Checkout integrated via hosted pages; webhook updates `users.tier`.
- Paywall on native tutor when `tier != 'pro'`; BYOAI free mode remains.
- Upgrade CTA placed per (updated) design.
- E2E test for the full subscribe flow (using Stripe test mode).

**Key tasks.** Straightforward Stripe integration; prioritize the webhook handling and the anonymous-first UX (don't gate anything that's free in v1).

**What's being validated.** Payments work; the free tier remains legitimately free.

---

## 4. Foundational Setup Recommendations

### `.agents/` conventions

```
.agents/
├── README.md                # entry point
├── worktree-setup.md        # how to create a new worktree, port allocation, .env.local
├── subagent-patterns.md     # when to use Explore vs general-purpose vs specialists
├── golden-trace-runbook.md  # how to add a new golden trace (cpp + expected json)
├── visual-regression.md     # how to update snapshots intentionally vs. accidentally
├── pr-ready-checklist.md    # what a PR must have before "ready for review"
└── prompts/                 # reusable prompt fragments for common agent tasks
```

### CLAUDE.md hierarchy

- `/CLAUDE.md` — already exists; update at P0 to reflect v2 reality (worktree convention, ports, test commands).
- `/backend/CLAUDE.md` — API contract, trace schema, how to add an endpoint, how to run the DB locally.
- `/frontend-v2/CLAUDE.md` (later `/frontend/CLAUDE.md`) — component conventions, store conventions, how to add a Storybook story, visual-regression protocol.
- `/code-runner/CLAUDE.md` — how trace emission works, how to bump `traceVersion`.
- `/packages/trace-schema/CLAUDE.md` — the schema is the contract; how to extend it safely.

### Test layering

| Layer | Runtime | Runs | Gating |
|---|---|---|---|
| Unit (Vitest) | <10s | every PR | yes |
| Property (fast-check) | <30s | every PR | yes |
| Golden trace (Vitest) | <30s | every PR | yes |
| Snapshot (trace JSON) | <10s | every PR | yes |
| Visual regression (Playwright + snapshots) | <2min | every PR | yes (with flake quarantine) |
| E2E (Playwright) | <3min | every PR | yes |
| Tutor evals (P8+) | ~5min | nightly | no |
| Perf regression (P1c harness) | <1min | nightly | no (informational only) |

### Monorepo layout (proposed)

```
SeePlusPlus/
├── backend/
├── code-runner/
├── frontend-v2/              # P3 onward; renamed to frontend/ at P7
├── frontend/                 # current — kept until P7 cutover
├── frontend-legacy/          # already exists
├── copilot/
├── docs/
│   └── v2/
│       ├── plan.md           # this doc, promoted after review
│       ├── spikes/           # P1 memos
│       └── adr/              # architecture decision records
├── packages/
│   ├── trace-schema/         # Zod + OpenAPI types
│   ├── api-client/           # generated TS client
│   ├── recognition/          # P5
│   └── golden-traces/        # corpus + runner
├── scripts/
│   └── worktree-ports.sh
├── docker-compose.yml
├── docker-compose.v2.yml
├── turbo.json
└── pnpm-workspace.yaml
```

### CI

- Single GitHub Actions workflow, matrix by package.
- Caches: pnpm store, Turbo cache, Playwright browsers.
- Draft PRs run unit + property + snapshot only; ready-for-review PRs add visual + E2E.
- Post-merge to `v2`: perf regression + tutor evals (nightly).

---

## 4a. Agent Orchestration — What We Can Exercise Here

This project is fertile ground for multi-agent workflows. Below is the menu of patterns, each with a concrete fit for this codebase. Feasible on this project: **all eight**. Worth adopting on this project: see the "Proposal" at the end.

### The patterns

**(1) Custom subagent personas** — `.claude/agents/*.md` committed to the repo. Each persona is a specialized Claude with scoped tools and a focused prompt. Proposed starter set:

| Persona | Tools | Purpose |
|---|---|---|
| `trace-schema-steward` | Read, Edit | Guards `packages/trace-schema/`; reviews any PR touching it |
| `test-author` | Read, Write, Bash | Writes Vitest/Playwright tests given a spec |
| `viz-component` | Read, Write, Bash, Storybook | Builds a single component + its story + its visual baseline |
| `recognition-heuristic` | Read, Write, Bash | Extends `packages/recognition/` against the corpus |
| `golden-trace-curator` | Read, Write, Bash | Adds/regenerates programs in `packages/golden-traces/` |
| `perf-profiler` | Read, Bash | Runs the P1c harness on a branch; reports ceilings |
| `visual-regression-triager` | Read, Bash | Triages snapshot diffs as "intentional update" vs. "regression" |
| `spec-writer` | Read, Write | Drafts OpenAPI + Zod from informal notes |

**(2) Within-session subagent fanout** — the Agent tool. Best for tightly-coupled but independently-scoped work: build a component + its tests + its story, or update schema + regen client + update tests, all in parallel within a single session. Zero setup; just document the patterns in `.agents/subagent-patterns.md`.

**(3) Worktree-per-feature parallelism** — already in the plan. One agent, one worktree, one long-running stream. P1 (three spikes across three worktrees) is the textbook exercise; P4 (heap / stack / pointers) and P6 (auth / workspaces / shares) are natural follow-ups.

**(4) Headless Claude Code in CI** — `claude -p` inside GitHub Actions. Concrete uses for this project:
- Auto-triage failing CI runs: an agent reads test output and leaves a diagnostic comment with a hypothesis.
- Flaky-snapshot triage: on visual-regression diff, agent decides intentional vs. regression and suggests action.
- Golden-trace auto-regen: on Valgrind bump, regenerate and open a PR.
- Formatter/lint auto-fix commits.

**(5) Scheduled agents** — `/schedule` + CronCreate for recurring work that doesn't fit a PR flow:
- Nightly tutor evals on the canonical rubric (P8+).
- Weekly dependency-bump PR (npm-check-updates + smoke test).
- Weekly perf-regression snapshot (P1c harness vs. main).
- Post-Valgrind-bump: regenerate goldens and open a PR.

**(6) Hooks** — `.claude/settings.json` deterministic automations the harness runs (not Claude). Candidates:
- `PostToolUse` on Edit → prettier/eslint; fail fast.
- `PreCommit` → block commits with `TODO-BLOCKING` markers.
- `SessionStart` → print worktree's port assignment and DB name.
- `Stop` → append session summary to `.agents/session-log/`.

**(7) `/ultrareview`** — human-triggered multi-agent cloud review on high-blast-radius PRs. Not cheap; reserve for P4/P5/P6/P7 PRs touching user-visible behavior.

**(8) Agent SDK inside the product** — the P8 tutor backend itself can be built on the Claude Agent SDK rather than bare API calls, giving the tutor real tool use: `get_step(n)`, `get_heap_node(id)`, `get_edges_from_frame(i)`, `jump_user_to(n)`. This makes tutor answers provably grounded on the trace (it *must* call a tool to cite a step) and unlocks the `[[step:N]]` / `[[code:x]]` jump affordances from the design cleanly. **This is the meta-loop: we're using agents to build an agent-powered product.**

### What each phase exercises

| Phase | Patterns exercised |
|---|---|
| P0 | (1) seed persona set, (2) document fanout patterns, (3) worktree convention, (6) starter hooks |
| P1 | (3) three parallel worktree-agent pairs — the canonical demonstration |
| P2 | (1) `spec-writer` + `trace-schema-steward` + `test-author` working in concert; (4) CI auto-triage goes live |
| P3 | (1) `viz-component` per leaf component; (2) fanout for component+test+story; (4) visual-baseline capture |
| P4 | (3) optional split into viz sub-worktrees; (7) `/ultrareview` on merge-worthy viz PRs |
| P5 | (1) `recognition-heuristic` + `golden-trace-curator` as a pair; (5) scheduled corpus-regen after Valgrind bumps |
| P6 | (3) worktrees for auth / workspaces / shares |
| P7 | (7) `/ultrareview` gate on the cutover PR |
| P8 | (5) nightly tutor evals; revisit (8) Agent SDK adoption once tool surface is concrete |
| P9 | (4) headless agent for Stripe-webhook smoke test in CI |

### Proposal: what to adopt, what to skip

**Adopt at P0:**
- (1) Persona set — seed the seven above as first drafts.
- (2) Subagent fanout — document, no setup needed.
- (3) Worktree convention — already in plan.
- (6) Minimal hooks — start with `PostToolUse(prettier)` + `SessionStart(port-info)`; grow as patterns emerge.

**Adopt when the phase arrives:**
- (4) Headless CI agents — introduce at P2 (auto-triage); expand to flaky-snapshot triage at P4.
- (5) Scheduled agents — introduce at P5 (golden regen), P8 (tutor evals).
- (7) `/ultrareview` — maintainer-triggered on P4+ visual/behavioral PRs.

**Deferred (not a v1/v1.5 assumption):**
- (8) Agent SDK in-product — decision punted. Build the P8 tutor on bare API calls first; re-evaluate SDK adoption when the tutor's tool-use surface is concrete enough to justify it.

**Deliberately skip for v1/v1.5:**
- Fully-autonomous issue→PR bots (review overhead outweighs benefit at this scale).
- Cross-worktree coordination beyond what `git` + shared lockfiles already provide.
- Agent-managed deploys (Copilot is scripted; Lambda deploys are deterministic — no value add).

### Metrics to judge the experiment

Since this is partly a learning project, track:
- **Time-to-green-PR** per phase (median draft→merged).
- **Review-pass rate** — fraction of agent PRs that land without human code changes.
- **Flake rate** — visual/E2E test flakes per 100 CI runs.
- **Agent-hours per phase** vs. the phase's time estimate — discovers which patterns save time vs. create ceremony.

Numbers get reported at phase close in a one-paragraph retrospective committed to `docs/v2/retros/P<n>.md`.

---

## 5. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | FLIP relayout animation doesn't scale past trivial heaps | medium | high (kills a signature delight feature) | **P1a spike** before P4 commits; fallback is no-animation mode for large heaps with a ceiling communicated in UI |
| R2 | Recognition heuristic produces false positives | medium | high (one wrong recognition destroys trust) | **P1b spike** with zero-false-positive bar; silent-by-default until met; maintain the corpus forever |
| R3 | Live scrub perf degrades on long traces | medium | medium | **P1c spike** establishes ceiling; degrade gracefully (disable FLIP during active scrub, only animate on release) |
| R4 | Trace schema churn during P4/P5 forces backward-incompat changes | medium | medium | Ship v2.0.0 with an `ext` blob for experimental fields; promote to named fields only when stable; version negotiation from day one |
| R5 | Lambda cold-start latency regresses vs. v1 | low | medium | Measure continuously from P2; keep bundle small; warm-instance configuration as last resort |
| R6 | CodeMirror 6 bundle dominates frontend size | low | low | Lazy-load language pack; measure; Monaco is a fallback but ~3× the size |
| R7 | Agent workflow friction — flaky/slow tests collapse parallel work into a queue | medium | high | **P0 is the mitigation**: the <30s green-tests invariant is the single most-important bet in this plan |
| R8 | Tutor cost-per-user exceeds $10/mo ceiling | medium (v1.5) | high (breaks monetization) | Prompt caching aggressively; truncate context; model tiering (Sonnet default, Opus only on demand); BYOAI free tier pushes usage off our bill |
| R9 | OAuth dev-loop friction across worktree ports | low | low | Dev-only auth bypass (`DEV_FAKE_USER=...`) + a single shared OAuth app pointed at `localhost` with wildcard-ish redirect handling in a dev forwarder |
| R10 | Agent-orchestration ceremony outpaces its benefit | medium | medium | §4a's adopt/skip list is explicit; retros at phase close (per-phase metrics) kill any pattern that isn't earning time — the catalog is the menu, not a contract |

---

## 6. Proposed Defaults for Handoff §8 Open Questions

These are proposals — flag any you want to override.

1. **Frontend framework** → **React 18 + TypeScript + Vite + Tailwind v4**. Design-spec is React; Tailwind v4's `@theme` makes CSS-var bridging natural; Vite is the agent-friendliest dev server.
2. **State management** → **Zustand** for app state (workspace, execution, UI) + **nuqs** for URL-serialized step/workspace + **TanStack Query** for server-backed data (workspaces, share resolution, tutor streams). No Redux.
3. **Database** → **Postgres on AWS RDS** (industry standard; scales; fits the existing Copilot footprint without introducing a new vendor). Local container in dev. **Drizzle ORM** (thin, SQL-forward, agent-friendly).
4. **Monorepo tooling** → **pnpm workspaces + Turborepo**. Retain existing top-level layout; add `packages/` for shared schema/client/recognition/goldens.
5. **Auth** → **Auth.js + Postgres adapter** if the frontend remains CSR-only with a Node backend doing cookie sessions; otherwise **Lucia**. Decide concretely during P6 kickoff. Reasoning: vendor cost compounds; OAuth-with-a-library is tractable at this scale.
6. **Trace persistence** → **Regenerate-on-demand by default**; cache blob to S3 keyed by `(code_hash, valgrind_version, compiler_flags)` when a share link is created. Workspaces store `files` + `code_hash` + optional `trace_ref`. Shares are stable because Valgrind on the same inputs is deterministic enough for the use case; cache invalidates on Valgrind bump.
7. **Code editor** (not in §8 but load-bearing) → **CodeMirror 6** with the C++ language package. Smaller than Monaco; better headless-test story; we don't need Monaco's IntelliSense.

---

## 7. Dependency Graph

```
P0 ──────────┐
             ├── P1a (FLIP) ─┐
             ├── P1b (Recog) ┤
             ├── P1c (Scrub) ┤
             │               │
             └── P2 ────────── P3 ── P4 ── P5 ── P6 ── P7 ── P8 ── P9
                                      ↑     ↑
                                      │     └─ needs P1b
                                      └─ needs P1a, P1c

Relicense lands inside P7 (public cutover), not as a parallel track.
```

- P0 gates everything.
- P1 spikes run in parallel once P0 is done. Each targets a different phase (P1a→P4, P1b→P5, P1c→P4).
- P2 is independent of P1 and can run in parallel with the spikes.
- P3 needs P2 (for real backend calls) but no P1 output.
- P4 consumes P1a and P1c outputs.
- P5 consumes P1b output.
- P6 is largely independent of P4/P5 and could start as soon as P3 is done, but sequencing it after P5 avoids touching too many surfaces at once.
- P7 is the cutover gate.
- P8/P9 are v1.5 and do not block v1.

---

## 8. Decisions Locked

- **Local-dev perf ceiling** — not a concern. P1a/P1c pass criteria are qualitative ("smooth on the maintainer's machine"); spikes characterize but don't gate.
- **Database** — Postgres on AWS RDS.
- **Tutor model default** — `claude-sonnet-4-6` with prompt caching; `opus-4-7` behind a flag.
- **Relicense** — lands with the public cutover at P7.
- **Visual-regression baseline source** — the design-spec HTML prototype is canonical. Baselines are captured by rendering `tmp/design-spec/project/See++ v2.html` at **1440×900** (larger real estate than the prototype's `meta viewport=1280`, to match the production aspiration) and saved as the reference PNGs. The Vite build must match those references, not the other way around.
- **BYOAI scope (v1.5)** — Claude direct + OpenAI-compatible only. No Gemini/Azure in v1.5.
- **Preview environments** — nice-to-have; not required for v1.
- **Recognition bar** — relax. Ship reasonable heuristics at P5 without the zero-false-positive gate; use the corpus to catch egregious misses, not to block shipping. User-facing toggle means wrong recognition is recoverable.
- **Agent personas seeded at P0** — all eight listed in §4a.
- **Agent SDK in-product (tutor)** — deferred. Decision punted; do not assume either way until P8.
- **Starter hooks** — minimum: (a) `PostToolUse` on Edit/Write → prettier + eslint `--fix` auto-format; (b) `SessionStart` → print the worktree's assigned ports and DB name. Nothing else until a pattern emerges.
- **Worktree sibling layout** — main clone: `/Users/kashif/Development/SPP/SeePlusPlus/`. Siblings live alongside as `/Users/kashif/Development/SPP/SeePlusPlus-<feature>/` (e.g., `SeePlusPlus-spike-flip`, `SeePlusPlus-auth`).
- **Plan file** — promoted to `docs/v2/plan.md` as the first commit of P0; `tmp/seepp-v2-plan.md` deleted.
- **Git flow** — all v2 work lands on the `v2` branch via feature-branch PRs into `v2`. Cutover merge `v2` → `master` happens inside P7.

All planning-phase questions are now resolved. Implementation can begin.

---

## 9. What This Plan Does Not Cover

Per handoff §9, this plan deliberately does not:
- prescribe UX (design is canonical),
- rescope v1 or v1.5 (done criteria are locked),
- propose institutional-tier, compile-time-viz, or multi-language work (architecturally accommodated but not v1/v1.5),
- write implementation code.

Anything not in scope above should be raised as a new open question rather than added.

---

*End of plan. Awaiting review.*
