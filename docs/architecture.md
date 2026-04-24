# Architecture

See++ is a web tool for visualizing C++ program execution step by step. A
user types code in the browser; the backend compiles and runs it under a
modified Valgrind; the resulting trace is parsed into JSON; the frontend
renders the stack, heap, pointers, and variable state at each execution
point.

This document covers the moving parts and how they fit together. For
running it locally see [`development.md`](./development.md); for deploying
to AWS see [`deployment.md`](./deployment.md) and
[`infrastructure.md`](./infrastructure.md).

## Top-level shape

```
  Browser
     │
     ▼
  Frontend (React + Vite, served by nginx in prod)
     │  relative /api/* calls
     ▼
  Backend (Node + Express + TypeScript)
     ├──► Code runner ─ Lambda (prod) or Docker (local) ─ runs SPP-Valgrind
     └──► Postgres     ─ RDS (prod) or docker-compose (local)
```

All user-facing traffic hits the frontend; the frontend proxies `/api/*`
to the backend over an ALB. The backend is the sole orchestrator — it
compiles + runs user code via the code runner, parses the Valgrind trace,
and talks to Postgres for workspaces, sessions, and feature flags.

## Components

### Frontend — `frontend/`

React 18 + TypeScript, built with Vite and styled with Tailwind. State is
in a single Zustand store (`frontend/src/store/index.ts`). The editor is
CodeMirror 6 (`@uiw/react-codemirror` + the C++ language package). The
visualization (`frontend/src/components/VizPane.tsx`) renders a trace as
stack frames + a heap canvas; the heap uses [@dagrejs/dagre] for
automatic top-to-bottom layout of linked structures.

Traces arrive as JSON; `frontend/src/trace/schema.ts` is a Zod validator
that narrows them before any render-time code sees them. If the backend
and frontend ever drift on shape, validation fails at the boundary rather
than crashing deep in the render tree.

### Frontend (legacy) — `frontend-legacy/`

The original 2018 React 16 implementation, kept running alongside the
current frontend for reference and the small set of users who've
bookmarked it. Served at a secondary domain in production
(`old.seepluspl.us`). Not under active development.

### Backend — `backend/`

Node + Express + TypeScript. Responsibilities:

- Accept code via `POST /api/run`, preprocess it (prepends
  `#define union struct\n` as a Valgrind compatibility shim), invoke the
  code runner, parse the Valgrind trace into the frontend-visible shape.
- Serve `/api/workspaces/*` for persisting and sharing code snippets.
- Serve `/api/auth/*` for Google OAuth sign-in (+ an optional local-only
  dev provider).
- Serve `/api/flags` (public) and `/admin/*` (admin-gated) for feature
  flags.

`backend/src/parse_vg_trace.ts` is the canonical translator from
Valgrind's output to `ProgramTrace` JSON. The `ProgramTrace` interface
there is the authoritative server-side type; the frontend's Zod schema is
the authoritative client-side shape.

### Code runner — `code-runner/`

Runs user C++ code in an isolated environment and emits a Valgrind trace.

- `code-runner/lambda/` — AWS Lambda container image (Python handler,
  Amazon Linux 2023 base, 10 GB memory, 120 s timeout). Used when
  `EXEC_MODE=lambda`.
- `code-runner/local/` — Docker container, used when `EXEC_MODE=local`.
  Spawned fresh per request with no-internet network isolation.
- `code-runner/SPP-Valgrind/` — git submodule with the modified Valgrind
  that emits execution traces. Derivative of upstream Valgrind; remains
  GPL-licensed.

Both runners expose the same contract to the backend:
```
{ ccStdout, ccStderr, stdout, stderr, traceContent }
```

### Database — Postgres

Backs four concerns:

| Table | What's in it |
|---|---|
| `workspaces` | Saved code snippets with slug-based share URLs. Optional owner (FK to `users`); anonymous snippets are immutable. |
| `users` + `user_identities` | Signed-in users and their OAuth-provider linkages (Google today; the schema is provider-agnostic). |
| `sessions` | Signed session cookies via `express-session` + `connect-pg-simple`. |
| `feature_flags` | Runtime toggles for in-progress UI, managed via `/admin`. See [`feature-flags.md`](./feature-flags.md). |

Schema is defined in `backend/schema.sql` and applied on every backend
boot with `IF NOT EXISTS` semantics — there's no separate migration tool
yet. In deployed environments the database is an RDS Postgres instance
created by the `workspaces-db.yml` Copilot addon; locally it runs as a
sibling container in `docker-compose.yml`.

## Trace pipeline

```
  user code
      │ preprocessCode: prepend "#define union struct\n"
      ▼
  code runner (SPP-Valgrind)
      │ raw JSON lines per execution point
      ▼
  parse_vg_trace.ts
      │ ExecutionPoint[] (stack, heap, globals, …)
      ▼
  frontend Zod validator
      │ ProgramTrace
      ▼
  VizPane + StackFrames + HeapGraph
```

The `#define union struct` shim lets us render `union` types using the
existing struct layout code. It shifts source line numbers by one — the
frontend's Zod validator subtracts the offset at the boundary so every
downstream consumer sees user-source line numbers.

## Auth

Google OAuth is the primary provider. Sign-in flow:

1. Frontend opens `/api/auth/google/start`; backend generates a state
   cookie and redirects to Google.
2. Google redirects back to `/api/auth/google/callback`; backend exchanges
   the code for a token, fetches profile info, upserts into `users` +
   `user_identities`, establishes a session, redirects to the app.

The `AuthProvider` interface (`backend/src/auth/providers/provider.ts`)
is provider-agnostic; adding GitHub or another provider is ~100 lines
plus `copilot secret init` for its secret. See
[`oauth-setup.md`](./oauth-setup.md).

A local-only `DevAuthProvider` can sign the user in as `dev@localhost` in
one click, triple-gated server-side so it can't activate in a deployed
environment.

## Deployment topology (production)

```
        seepluspl.us            old.seepluspl.us
             │                         │
             ▼                         ▼
      ALB (frontend)           ALB (frontend-legacy)
             │                         │
             ▼                         ▼
         nginx ─────┐        nginx (static React 16 app)
         (serves    │
          React +   └── /api/* ─► ALB (backend)
          proxies)                      │
                                        ├─► Lambda (code runner)
                                        └─► RDS Postgres
```

Infrastructure is defined with AWS Copilot. See
[`infrastructure.md`](./infrastructure.md) for per-service config and
[`deployment.md`](./deployment.md) for the deploy workflow.

## Security model

- User code runs in isolated Lambda containers (prod) or a no-internet
  Docker network (local). No filesystem or network access to the rest of
  the app.
- The Valgrind binary is GPL-licensed. `code-runner/` therefore remains
  GPL; the rest of the repo is separately licensed (see `LICENSE`).
- Sessions are signed with a per-environment secret (SSM-backed) and
  stored in Postgres. CORS is pinned to `seepluspl.us` and subdomains via
  a regex on the backend.
- Admin promotion (`users.is_admin`) happens only via the `ADMIN_EMAILS`
  environment variable, never through the UI — avoiding a circular-trust
  footgun.
