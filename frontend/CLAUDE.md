# frontend/

The v2 SPA. React 18 + Vite + Tailwind v4 + Zustand. CodeMirror 6 in the
editor pane. Talks to `backend/` via the same-origin `/api/*` proxy
(nginx in prod, Vite dev proxy locally).

## Layout

- `src/store/` — single flat Zustand store. Almost every action lives here.
- `src/components/` — top-level UI. `App.tsx` does the routing.
- `src/viz/` — heap visualization: `layoutHeap` (ELK), `routeEdges`
  (geometry pass for stack→heap arrows), reachability, FLIP helpers.
- `src/trace/schema.ts` — Zod schema that revalidates every trace at
  the I/O boundary. Mirror any change to `backend/src/parse_vg_trace.ts`
  here.
- `src/api/client.ts` — fetch wrappers. All routes go through
  `ensureOkWorkspace` / `ensureOkAdmin`.
- `src/flags/names.ts` — canonical flag names. Add an entry here when
  code calls `useFlag()` for a new flag; admin-only experiment flags
  don't need to live here.
- `src/anim/flip.ts` — FLIP transitions on heap-card moves between steps.

## Trace contract

Backend emits `ProgramTrace`; the Zod schema in `src/trace/schema.ts`
revalidates it at parse time. Drift surfaces at validation, not deep
in the render tree. The schema also shifts every reported `line` by
one to compensate for the `#define` the backend prepends.

## Tests

`npx vitest run` from this directory. Pure modules (`viz/layoutHeap`,
`viz/routeEdges`, `anim/flip`, `trace/schema`, `theme/theme`) carry
the most coverage; UI-shell tests use `@testing-library/react`.

## Don't

- Don't sprinkle `gtag` calls in components. Analytics lives in
  `src/analytics.ts`; call sites are Zustand actions or App-level
  effects.
- Don't add a route without updating `App.tsx`'s `routeFromLocation()`.
