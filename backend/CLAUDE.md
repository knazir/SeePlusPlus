# backend/

Express API. Accepts C++ source, orchestrates the code-runner, parses the
Valgrind output into a structured trace, returns JSON.

## Endpoints

- `POST /api/run` — primary: `{ code }` → `ProgramTrace` JSON.
- `POST /api/workspaces`, `GET /api/workspaces`, etc. — workspace CRUD +
  share links.
- `GET /api/flags` — public read of the feature-flags table.
- `GET /api/auth/*` — Google OAuth (plus the dev provider gated on
  `NODE_ENV=development` + `DEV_AUTH_ENABLED=true`).
- `GET /admin/*` — admin-only flag management, gated on `users.is_admin`.

## Trace shape

`src/parse_vg_trace.ts` is the canonical translator: Valgrind stdout in,
`ProgramTrace` out. The frontend runs its own Zod validator at
`frontend/src/trace/schema.ts`; drift between the two surfaces at validation
time rather than crashing mid-render.

## EXEC_MODE

- `local` — backend spawns a code-runner Docker container per request
  (`code-runner/local/Dockerfile`).
- `lambda` — backend invokes a Lambda function (`code-runner/lambda/`).

## Local DB

Postgres runs alongside the backend via `docker-compose.yml`. Connection
string is `DATABASE_URL`; defaults to `postgres://spp:spp@postgres:5432/seepp_main`
when unset. Schema is applied on boot from `backend/schema.sql` — no
migration tool yet.

## Don't

- Don't invent a parallel trace type. Extend `ProgramTrace` and mirror the
  change in the frontend's Zod validator.
- Don't commit Lambda deployment artifacts — they're built by CI.
