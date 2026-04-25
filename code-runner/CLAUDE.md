# code-runner/

Sandboxed C++ execution. Compiles user code and runs it under the modified Valgrind in `SPP-Valgrind/`. Emits raw trace output to stdout; the backend parses it.

## Layout

- `local/` — Docker container spawned by backend in `EXEC_MODE=local`.
- `lambda/` — AWS Lambda (`EXEC_MODE=lambda`).
- `SPP-Valgrind/` — git submodule, our fork of Valgrind that emits trace events.

## Pipeline

`g++ -g -O0 -std=c++17` → `valgrind --tool=spp ./a.out` → raw events on stdout → `backend/src/parse_vg_trace.ts` → `ProgramTrace` JSON → frontend. This package does **not** shape the trace JSON.

## Invariant

`local/` and `lambda/` must produce identical raw trace output for the same input. Divergence is a bug in an emitter, not acceptable variance.

## Don't

- Don't modify SPP-Valgrind via patches in this repo. Patch the submodule upstream, bump the pointer.
- Don't massage the trace output here. The backend owns parsing; keep this package a thin runner.
