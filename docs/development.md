# Local development

## Prerequisites

- **Docker Desktop** — everything runs under `docker compose`.
- **Git** — `code-runner/SPP-Valgrind` is a submodule, so clone with
  `--recurse-submodules` or run `git submodule update --init` after
  cloning.

Optional, only if you plan to deploy:

- **AWS CLI** and **Copilot CLI** — for pushing to an AWS environment.

## First-time setup

```bash
git clone --recurse-submodules https://github.com/knazir/SeePlusPlus.git
cd SeePlusPlus
cp .env.example .env
./localdev.sh up
```

`localdev.sh` is a thin wrapper around `docker compose` that loads
`.env`. The first `up` builds the images — 5–10 minutes cold. After
that, `up -d` is a few seconds.

You'll end up with four running services:

| Service | URL | What it does |
|---|---|---|
| Frontend (current) | http://localhost:4000 | React 18 + Vite dev server |
| Frontend (legacy) | http://localhost:8000 | Kept for reference |
| Backend | http://localhost:3000/api | Express API |
| Postgres | localhost:5432 (user `spp`, pw `spp`, db `seepp_main`) | Persistence for workspaces, sessions, flags |

Open the current frontend at http://localhost:4000.

## `.env` essentials

The only thing you *must* set for local dev is the execution mode and
session secret. `cp .env.example .env` gets you most of the way; fill in
the rest as needed.

| Variable | Purpose |
|---|---|
| `EXEC_MODE` | `local` to run user code in a Docker container; `lambda` to invoke a deployed Lambda. Local is the default. |
| `SESSION_SECRET` | Any random hex string for signing session cookies. Generate with `openssl rand -hex 32`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Required to sign in with Google. See [`oauth-setup.md`](./oauth-setup.md). Skip both if you use `DEV_AUTH_ENABLED`. |
| `DEV_AUTH_ENABLED` | Set to `true` to enable a one-click local-only sign-in as `dev@localhost`. Triple-gated server-side; can't activate in deployed environments. |
| `DEV_AUTH_IS_ADMIN` | Defaults to `true`. When set, the dev user has `is_admin = true` so you can exercise `/admin`. |
| `ADMIN_EMAILS` | Comma-separated. Listed emails get `is_admin` on sign-in. |

`.env` changes don't hot-reload into already-running containers — restart
the affected service:

```bash
./localdev.sh up -d --force-recreate backend
```

## Common commands

```bash
./localdev.sh up                # start / resume
./localdev.sh up -d             # detached
./localdev.sh down              # stop
./localdev.sh logs -f backend   # tail backend logs
./localdev.sh ps                # show service state
./localdev.sh exec backend sh   # shell into a container
./localdev.sh build backend     # rebuild one image
./localdev.sh down -v           # stop + drop postgres volume (nuclear)
```

Any `docker compose` subcommand works — `localdev.sh` just forwards
arguments with `.env` loaded.

## Running tests

Frontend (Vitest):

```bash
cd frontend
npx vitest run
npx vitest            # watch mode
npx vitest run src/components/VizPane.test.tsx
```

Backend (Jest via the `npm test` script; add the first test before you
rely on it):

```bash
cd backend
npm test
```

Type-check without emitting:

```bash
cd frontend && npx tsc --noEmit
cd backend  && npx tsc --noEmit
```

## Signing in locally

The quick path: add `DEV_AUTH_ENABLED=true` to `.env`, restart the
backend, and the sign-in modal will show a "Sign in as Dev User (local
only)" button that completes the full session flow without a Google
round-trip.

The real path: register a Google OAuth client (see
[`oauth-setup.md`](./oauth-setup.md)), drop the Client ID + Secret into
`.env`, and use the regular Google button.

## Feature flags locally

Flags are in Postgres. Toggle them at http://localhost:4000/admin — the
page is admin-gated, which is why `DEV_AUTH_IS_ADMIN=true` exists.
Changes take effect immediately; no reload needed. See
[`feature-flags.md`](./feature-flags.md) for how to add one.

## Working on the code runner

`code-runner/local/Dockerfile` builds an image that compiles SPP-Valgrind
from source. The first build is slow (~5 min). After that the backend
spawns a container per `/api/run` request; the image itself is rebuilt
only when you change its Dockerfile or submodule contents.

If you change the SPP-Valgrind submodule:

```bash
./localdev.sh build code-runner-build
./localdev.sh up -d --force-recreate backend
```

If you change the Lambda handler (`code-runner/lambda/handler.py`) and
want to test it locally, set `EXEC_MODE=lambda` and use the
`deploy-to-aws.sh` script in that directory — the backend will invoke
your deployed Lambda.

## Debugging

**Frontend** — browser devtools. Vite hot-reloads on save. The Zustand
store is introspectable via a debugger statement anywhere (e.g.
`useAppStore.getState()`).

**Backend** — `./localdev.sh logs -f backend`. `console.log` is the
current baseline.

**Trace pipeline** — the `/api/run` response includes compile stdout +
stderr alongside the trace. If a program compiles but produces a weird
trace, `backend/src/parse_vg_trace.ts` is where the translation happens
— add `JSON.stringify` logging to the input `obj` to see Valgrind's raw
output.

## Troubleshooting

**Frontend comes up but API calls fail.** Backend probably didn't start
cleanly. `./localdev.sh logs backend` — the most common cause is a DB
connection failure on first boot (Postgres takes a few seconds longer
than the backend to be ready).

**"Cannot connect to the Docker daemon".** Docker Desktop isn't running
or hasn't finished starting.

**Editor highlights the wrong line during scrubbing.** Usually a sign
that the `#define union struct` offset isn't being compensated
correctly. See `backend/src/valgrind_utils.ts::preprocessCode` for the
prepend and `frontend/src/trace/schema.ts` for the offset.

**`.env` changes don't take effect.** `./localdev.sh up -d` without
`--force-recreate` keeps existing containers. Use
`./localdev.sh up -d --force-recreate <service>`.

**Port conflicts (3000 / 4000 / 5432 / 8000).** Something else is
listening on those ports. Either stop it or override in `.env`:

```
BACKEND_PORT=3100
FRONTEND_PORT=4100
DB_PORT=5100
```

The container-internal ports stay the same; only the host mapping changes.
