# See++ — AI assistant context

Context notes for AI coding assistants (Claude Code, Cursor, etc.). A
human reader can safely ignore this file.

## Layout

- `backend/` — Node/Express API. Parses Valgrind output into the trace JSON
  the frontend consumes. Main endpoint is `POST /api/run`.
- `code-runner/` — sandboxed C++ execution.
  - `local/` — Docker container (spawned by backend when `EXEC_MODE=local`).
  - `lambda/` — AWS Lambda (`EXEC_MODE=lambda`).
  - `SPP-Valgrind/` — git submodule, the modified Valgrind that emits
    traces.
- `frontend/` — React + Vite + Tailwind + Zustand. CM6 editor + the
  visualization pane.
- `frontend-legacy/` — original 2018 frontend. Reference only; do not
  modify unless explicitly asked.
- `copilot/` — AWS Copilot manifests for deployed environments.
- `docs/` — architecture, deployment, guides, etc.
- `localdev.sh` — thin `docker compose` wrapper.

## Trace contract

`backend/src/parse_vg_trace.ts` translates Valgrind stdout into the
`ProgramTrace` JSON the frontend consumes. The frontend revalidates with a
Zod schema at `frontend/src/trace/schema.ts` — drift surfaces at the
boundary, not deep in the render tree. The two sides are deliberately
decoupled (no shared package).

## Running locally

```
./localdev.sh up
```

Starts backend, Postgres, frontend, and the code-runner image. Config
loaded from `.env` (copy from `.env.example`). Defaults to
`3000 / 4000 / 5432` when `.env` is absent.

## Conventions

- No trailing whitespace; no leading whitespace on blank lines.
- Tests live next to the code (`foo.ts` + `foo.test.ts`). Run with
  `npx vitest run` in `frontend/` or `npm test` in `backend/`.
- Keep per-directory tooling self-contained — no root `package.json`.
- Don't commit unless asked.
