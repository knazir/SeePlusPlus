# See++ v2

v2 rebuilds the frontend from scratch and adds accounts + shareable links. The backend (Node/Express/TypeScript, rewritten 2025) is a solid foundation — keep building on it.

## Current state

- `backend/` — Node + Express + TypeScript. `POST /api/run` runs user code through the code-runner and returns parsed trace JSON. `src/parse_vg_trace.ts` is the canonical translator. Solid; extend in place.
- `code-runner/` — Docker + Lambda sandboxes running the modified Valgrind in `SPP-Valgrind/`. No v2 changes planned.
- `frontend/` — absent. Rebuilt from scratch as part of v2.
- `frontend-legacy/` — 2018 reference. Untouched.
- `tmp/design-spec/` — Claude Design prototype. **Canonical visual + interaction reference; NOT a code starting point** (in-browser Babel, `window.*` globals, no TS, no build). Lift specific patterns; don't lift the shell.

## v1 goals

1. Working frontend matching the design mock's look and behavior.
2. Accounts (one OAuth provider) + shareable links.
3. Cutover `v2` → `master`.

v1.5 (tutor + monetization) is out of scope until v1 ships. Plan v1.5 from user feedback, not from speculation.

## Frontend strategy: lift the keepers

Scaffold `frontend/` fresh — **Vite + TypeScript + Tailwind + Zustand**. From the mock:

- **Lift directly** (with TS adaptation): FLIP animation (`viz.jsx:186-222`), recognition heuristic (`viz.jsx:230-280`), keyboard shortcuts, token/syntax rendering helpers.
- **Port as structural reference**: component decomposition and prop surfaces (`StackFrames`, `HeapGraph`, `TopBar`, `ConsolePanel`, `ExecutionBar`, etc.).
- **Rewrite**: App shell (Zustand, not 17 `useState` in one component), module system (real imports, no `window.*`), trace source (fetch from `/api/run`, never hardcoded).
- **Port design**: `styles.css` → Tailwind `@theme` + component styles. Self-host Geist + JetBrains Mono; no Google Fonts CDN.

Use `tmp/design-spec/project/screenshots/` as the visual-parity reference. Delete `tmp/design-spec/` at cutover.

## Backlog

Flat, ordered, small. Each a PR of a few days at most.

1. Scaffold `frontend/` — Vite + TS + Tailwind + Zustand + lint/format. Boots to an empty page.
2. Port `styles.css` → Tailwind theme + base component styles. Self-host fonts.
3. Top-level layout shell — topbar, editor pane, viz pane, console pane. No behavior yet.
4. Editor component — CodeMirror 6 + C++ language pack, wired to Zustand.
5. Wire `POST /api/run`. Run button executes real code; raw trace visible in a debug panel.
6. `StackFrames` component — active frame expanded, inactive condensed, pin-to-keep-expanded.
7. `HeapGraph` component — static layout, no animation yet. Pointer edges between stack locals and heap nodes.
8. Lift FLIP animation — heap nodes relayout smoothly between steps.
9. Scrubbar + play/step keyboard controls.
10. Lift recognition heuristic — LL only. Toggle in viz header.
11. Console panel, execution bar, tutor breadcrumb (empty-state stub).
12. Examples modal + sign-in modal (UI only; sign-in wires up at #16).
13. Edit-during-trace staling (editor flips to stale, viz dims, ⌘↵ re-runs).
14. Visual parity spot-check vs. mock screenshots; fix gaps.
15. Postgres schema — users, workspaces, shares. Drizzle migrations.
16. One OAuth provider (Google). Sign-in flow end-to-end.
17. Save workspace / load workspace.
18. Share-link generation + resolution (regenerate-on-demand; no S3 cache until latency demands it).
19. Anonymous-flow preservation E2E — no account needed to run, scrub, visualize.
20. Cutover — promote `frontend/` as canonical, update Copilot manifests, squash-merge `v2` → `master`. Relicense (GPL-2.0 → MIT on orchestration code) lands in this same PR.

Items past #20 are v1.5; do not pre-plan.

## Conventions

- **Linear git history.** Rebase or squash-merge feature branches into `v2`; never a merge commit. See `~/.claude/projects/.../memory/feedback_linear_history.md` (Claude) and `.agents/pr-ready-checklist.md` (humans).
- **Per-directory tooling.** No monorepo, no shared packages, no root `package.json`. See `adr/0001-no-monorepo.md`.
- **No speculative infrastructure.** No hooks, persona files, scheduled agents, perf harnesses, OpenAPI generation, Storybook, property-based tests, visual-regression CI, Sentry, Redis, evaluation harnesses. Add each only when a concrete pain earns it.
- **Worktrees + ports** for parallel streams — see `.agents/worktree-setup.md`.
- **Don't commit unless asked.**

## ADRs

- [0001 — no monorepo](adr/0001-no-monorepo.md) — per-directory tooling; frontend owns its Zod validator; goldens are the contract test.
- [0002 — skip P1 spikes](adr/0002-skip-p1-spikes.md) — the mock already implements FLIP + recognition + scrub, so their "will this work?" questions already have answers.
- [0003 — aggressive scope cut; lift-the-keepers frontend](adr/0003-scope-cut.md) — replaces the phased plan with this flat backlog; documents the ~28 feature/infrastructure cuts vs. the original plan.
