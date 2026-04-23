# See++

Web tool for visualizing C++ execution step-by-step: stack frames, heap, pointers, variable state. Traces are produced by a modified Valgrind, parsed by the backend, and rendered in the browser.

## Layout

- `backend/` — Node/Express API. Parses Valgrind output into the trace JSON the frontend consumes. Single endpoint today (`POST /api/run`); versioned `/v1/**` surface with OpenAPI arrives at P2.
- `code-runner/` — sandboxed C++ execution. Two modes:
  - `local/` — Docker container (spawned by backend in `EXEC_MODE=local`).
  - `lambda/` — AWS Lambda (`EXEC_MODE=lambda`).
  - `SPP-Valgrind/` — git submodule, the modified Valgrind that emits traces.
- `frontend/` — rebuilt from scratch at P3. Absent until then.
- `frontend-legacy/` — original 2018 frontend, still functional. Reference for feature parity; do not modify unless asked.
- `copilot/` — AWS Copilot manifests for deployed environments.
- `docs/` — architecture, development, deployment, infrastructure guides.
  - `docs/v2/` — v2 README, backlog, and ADRs. Start at `docs/v2/README.md`.
- `.agents/` — conventions for human + Claude collaborators (worktree setup, PR checklist, subagent patterns).
- `.claude/` — Claude config. `settings.local.json` is user-local (gitignored).
- `localdev.sh` — wrapper around `docker compose` that loads `.env` if present.
- `scripts/worktree-ports.sh` — deterministic port + DB-name allocator for worktree siblings.

## Trace architecture (the contract)

The trace shape is effectively defined by **SPP-Valgrind's output format**, which we treat as dogma. `backend/src/parse_vg_trace.ts` is the canonical translator — Valgrind stdout in, structured JSON out. The `ProgramTrace` interface there is the backend's output type.

The frontend (at P3) defines its own Zod validator for what it consumes. If backend and frontend drift on the shape, golden-trace integration tests — which run the full `code → Valgrind → parse → JSON` pipeline — catch it.

There is **no shared schema package**. The backend owns parsing; the frontend owns its consumer types; goldens are the contract test.

## Running locally

```
./localdev.sh up
```

Starts backend, Postgres, frontend, and the code-runner image. Loads all config from `.env` (copy from `.env.example` on first setup). If `.env` is absent, compose uses defaults `3000 / 4000 / 5432`.

## Worktree convention

Every feature / spike gets its own sibling worktree with disjoint ports and DB so multiple streams can run side-by-side.

```
/Users/kashif/Development/SPP/
├── SeePlusPlus/                # main clone
├── SeePlusPlus-<slug>/         # feature / spike worktrees
```

Bootstrap:

```bash
# From the main clone
git worktree add ../SeePlusPlus-<slug> -b <branch-name>
cd ../SeePlusPlus-<slug>
./scripts/worktree-ports.sh <slug>   # merges deterministic ports + DB name into .env
./localdev.sh up
```

Ports: `BACKEND_PORT=3100+offset`, `FRONTEND_PORT=4100+offset`, `DB_PORT=5100+offset`, where `offset` is a hash of the slug in `[0, 899]`. Main clone (no worktree block in `.env`) uses `3000 / 4000 / 5432`.

See `.agents/worktree-setup.md` for the full runbook.

## Tooling

Each directory owns its own toolchain:

- `backend/` — npm + TypeScript (`npm install`, `npm run build`, `npm run dev`).
- `frontend/` — scaffolded fresh at P3. Its own package.json, own tsconfig.
- `code-runner/` — no JS tooling; Docker + the SPP-Valgrind submodule.

No monorepo, no root package.json, no shared tsconfig base. When the frontend lands and a genuine need for cross-package sharing appears, we'll revisit.

## Conventions

- No trailing whitespace; no leading whitespace on blank lines.
- Update docs in `docs/` only when a change makes existing content wrong.
- Cutover of `v2` → `master` is the final item on the v2 backlog (see `docs/v2/README.md`).
- Don't commit unless asked.
