# backend/

Node + Express backend. Single responsibility: accept C++ source, orchestrate the code-runner, parse the Valgrind output into a structured trace, return it as JSON.

## API surface

| Endpoint                   | Status       | Purpose                                                                                                             |
| -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `POST /api/run`            | current      | Used by frontend-legacy and (at P3) by the new frontend. Returns the parsed trace JSON.                             |
| `POST /v1/runs`            | planned (P2) | Versioned endpoint. Accepts `{ files, entrypoint }`, returns `{ traceVersion, steps, diagnostics, meta }`.          |
| `GET /v1/auth/*`           | planned (P6) | OAuth routes (Google + GitHub).                                                                                     |
| `POST /v1/workspaces` etc. | planned (P6) | Workspace CRUD + share links.                                                                                       |
| `POST /v1/tutor/ask`       | planned (P8) | Tutor streaming endpoint.                                                                                           |

OpenAPI spec: `backend/openapi.yaml` (generated starting at P2).

## Trace shape

The trace shape is effectively defined by **SPP-Valgrind's output format**, which we treat as dogma. `src/parse_vg_trace.ts` is the canonical translator: it consumes Valgrind's raw lines and produces the `ProgramTrace` interface exported from that file.

The backend does not own a portable schema package. The frontend defines its own Zod validator for what it consumes (lands at P3 in `frontend/src/trace/`). If the two drift, golden-trace integration tests — which run the full `code → Valgrind → parse → JSON` pipeline and diff against committed expected outputs — catch the drift. This is the contract: runtime-validated, integration-test-guarded.

### Schema changes

1. Change `src/parse_vg_trace.ts` (the parser) and/or `SPP-Valgrind/` (the source).
2. Regenerate golden traces (see `code-runner/CLAUDE.md` once P2 wires the regen command).
3. Update the frontend's Zod validator to match.
4. CI's end-to-end test catches any missed step.

## EXEC_MODE

- `local` — backend spawns the code-runner Docker container per request (`code-runner/local/Dockerfile`).
- `lambda` — backend invokes a Lambda function (`code-runner/lambda/`).

See `code-runner/CLAUDE.md` for trace-emission flow.

## Local DB

Postgres runs alongside backend via `docker-compose.yml`. Connection string is read from `DATABASE_URL`; in-container it's `postgres://spp:spp@postgres:5432/${DB_NAME}` where `DB_NAME` comes from `.env` (set by `scripts/worktree-ports.sh` in a worktree, or defaults to `seepp_main`).

DB schema + migrations land at P6.

## Adding an endpoint

1. Implement the Express route in `src/`.
2. Add (or extend) a golden-trace integration test if the endpoint touches the code-runner. At P2 this becomes the primary gate; until then, unit-test the parser separately.
3. Coordinate with the frontend's Zod validator if you change a response shape.
4. Update this file's API table.

## Known quirk — SPP-Valgrind stack walker priming (worked around)

Empirically, SPP-Valgrind only starts walking the user-code stack after a
libstdc++ entry point runs. If `main()` contains no stdlib calls, early trace
records arrive with `stack: []`.

**Workaround:** `processJsonObject` in `parse_vg_trace.ts` synthesizes a
single `main()` frame when the incoming record's `stack` is empty. This keeps
those records in the final trace instead of dropping them during the "skip
everything before main" pass. The fallback is deliberately narrow and
contained to one block; revert that block if SPP-Valgrind is patched upstream
to emit stack records from the first instruction of `main`.

Examples no longer need a priming `cout` — keep them because they're useful,
not because the parser will break without them.

## Don't

- Don't invent a new trace type. Extend `ProgramTrace` in `parse_vg_trace.ts` and mirror the change in the frontend's validator.
- Don't commit Lambda deployment artifacts. They're built by CI.
