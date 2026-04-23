# code-runner/

Sandboxed C++ execution. Compiles user code and runs it under the modified Valgrind in `SPP-Valgrind/`. Returns Valgrind's raw trace output (plus stdout/stderr) to the backend, which parses it.

## Layout

```
code-runner/
├── local/           # Docker container spawned by backend in EXEC_MODE=local
│   └── Dockerfile
├── lambda/          # AWS Lambda (EXEC_MODE=lambda)
└── SPP-Valgrind/    # git submodule — our fork of Valgrind that emits trace events
```

## Trace-emission flow

```
user C++ source
    ↓ (g++ -g -O0 -std=c++17 inside the sandbox)
a.out
    ↓ (valgrind --tool=spp ./a.out)
raw trace events (SPP-specific protocol)   ── stdout ──▶  backend
                                                          │
                                                          ▼
                                          backend/src/parse_vg_trace.ts
                                          produces ProgramTrace JSON
                                                          │
                                                          ▼
                                                      frontend
```

This package produces raw Valgrind output. It does **not** shape the trace JSON — that's the backend's job (`backend/src/parse_vg_trace.ts`).

## SPP-Valgrind submodule

`SPP-Valgrind/` is our fork. Bumps to it are rare but disruptive:

```bash
git submodule update --remote code-runner/SPP-Valgrind
# Rebuild local image:
docker build -f code-runner/local/Dockerfile -t spp-code-runner-local:dev .
```

After a submodule bump, regenerate the golden traces (P2+) and review the diff — cosmetic changes (paths, temp names) are acceptable; semantic changes (step counts, heap shape) need justification.

## Local vs. lambda parity

`local/` and `lambda/` must produce identical raw trace output for the same input. If they diverge, the divergence is a bug in one of the emitters, not acceptable variance.

## Don't

- Don't modify SPP-Valgrind via patches in this repo. Patch the submodule upstream, bump the pointer.
- Don't massage the trace output here. The backend owns parsing; keep this package a thin runner.
