# See++ v2 — Session checkpoint (2026-04-24)

Snapshot of the project's state for picking back up next session. Supersedes nothing; sits alongside `docs/v2/README.md` (which is the longer-term plan doc). If you're a new collaborator (or this session's Claude rebooted): read this first, then skim `docs/v2/README.md` + the ADRs.

---

## Git state

- **Branch:** `v2` (all work lands here via feature branches; cutover `v2 → master` is the last outstanding item).
- **Tip commit:** `9f63033 heap: simplify — keep enter + FLIP, drop exit animation`
- **Working tree:** clean.

Recent commits (most recent first):
```
9f63033 heap: simplify — keep enter + FLIP, drop exit animation
54b851b fix(flip): settleAnimations only cancels FLIP translate, not enter/exit
69c69f4 viz + editor polish: uninit pointers, stationary-card jitter, 4-space indent
9b95d55 flags: gate tutor UI + centralize flag names via FLAGS const
691b960 feature flags + admin role + /admin panel
d772446 dx: unify .env.local into .env; harden worktree-ports.sh against overwrites
2260878 auth: DevAuthProvider for one-click local sign-in
8169850 workspaces: Save/Share rewrite, rename+delete, named workspaces, stack arrows, brand link
```

---

## What v1 now has

- **Frontend** — Vite + TS + Tailwind + Zustand. Editor (CM6, 4-space indent), viz pane (StackFrames + HeapGraph with enter + FLIP animations; exit animation intentionally removed), exec bar, console pane, tutor breadcrumb (flag-gated), settings popover (pointer-routing modes), sign-in / name-prompt / share-link / delete-confirm modals.
- **Persistence** — Postgres via RDS addon. Schema lives in `backend/schema.sql` and is applied on every boot (no migration tool yet — ADR-0005). Tables: `workspaces`, `users`, `user_identities`, `sessions`, `feature_flags`.
- **Auth** — Google OAuth + a local-only `DevAuthProvider` (one-click sign-in as `dev@localhost`). Session cookies via `express-session` + `connect-pg-simple`. `is_admin` promoted from `ADMIN_EMAILS` env var and auto-on for the Dev User via `DEV_AUTH_IS_ADMIN`.
- **Workspaces** — Save/share with optional names. Fork-to-save for not-yours. Rename/delete on `/workspaces`. Anonymous share links still work.
- **Admin panel (`/admin`)** — Feature flags table with toggles, add, delete, reload. `users.is_admin`-gated; 404 to non-admins.
- **Feature flags** — Postgres-backed, load-once on boot, auto-create on first `isEnabled()` call. Centralized names in `backend/src/flags/names.ts` and `frontend/src/flags/names.ts` (mirrored — ADR-0001 keeps per-directory tooling, so no shared package). `tutor-panel` is the only real flag today; it gates the topbar Tutor button and `TutorBreadcrumb`.

---

## Deployment state

| Environment | What's running | Notes |
|---|---|---|
| **Local** | Latest `v2` via `./localdev.sh up` | All features work. Dev auth on if `DEV_AUTH_ENABLED=true` in `.env`. |
| **Test** (`frontend.test.spp.seepluspl.us`) | Behind latest `v2` | Last full deploy was around `8169850`. **Flags + admin + polish since then are NOT yet on test.** Needs a `copilot svc deploy --name backend --env test` + `--name frontend --env test` to catch up. Zero blocker — just hasn't happened. |
| **Prod** (`beta.seepluspl.us`) | `frontend-legacy` (untouched) | v2 has never been deployed to prod. RDS doesn't exist there yet. See "Cutover" below. |

---

## Running locally — quick start

```bash
# one-time setup
cp .env.example .env
# edit .env: paste GOOGLE_CLIENT_ID (63892591155-m7k6kl38eb8lrr68ne1jgq744a07bbsm.apps.googleusercontent.com),
# GOOGLE_CLIENT_SECRET, SESSION_SECRET (openssl rand -hex 32), DEV_AUTH_ENABLED=true, DEV_AUTH_IS_ADMIN=true.

# start the stack
./localdev.sh up -d

# changed .env? need --force-recreate to pick it up:
./localdev.sh up -d --force-recreate backend

# URLs
# Frontend: http://localhost:4000
# Backend:  http://localhost:3000/api
# Admin:    http://localhost:4000/admin (sign in first)
# Workspaces: http://localhost:4000/workspaces
```

`.env.local` was merged into `.env` — **do not recreate `.env.local`**. `worktree-ports.sh` now safe-merges a managed block into `.env` rather than overwriting the whole file.

---

## Outstanding pre-cutover list

The user was in the middle of a "decent number" of pre-cutover fixes when this session ended. What's been addressed vs. still open:

### Fixed in this session

- ✅ Uninitialized pointers render as `?`, not `→ <UNINITIALIZED>` (fix was ordering in `displayEncoded`; regression tests added).
- ✅ Heap card jitter when stationary between steps (`settleAnimations` cancels in-flight FLIP translate animations before measurement; filtered by `FLIP_ANIM_ID` so it doesn't kill enter animations).
- ✅ Editor indent: 4 spaces, soft tabs (`EditorState.tabSize.of(4)` + `indentUnit.of('    ')` + `keymap(indentWithTab)`).
- ✅ Heap card exit animation: **intentionally removed** (React unmount timing was fighting ghost-retention machinery; complexity wasn't worth the polish). Cards now vanish cleanly on delete; enter + FLIP carry the visual storytelling.

### Likely to come up next

No explicit backlog of further pre-cutover bugs yet. If the user continues, expect more "I'm noticing that…" feedback items. Treat them the same way: diagnose real root cause before patching, add a regression test when practical.

### The cutover itself (backlog #20)

1. **Push latest `v2` to test env** — `copilot svc deploy backend test` + `frontend test`. Brings test up to date with local.
2. **Bootstrap prod secrets** — `copilot secret init --name GOOGLE_CLIENT_SECRET --values prod:...`, same for `SESSION_SECRET` (generate fresh `openssl rand -hex 32`), and optionally `ADMIN_EMAILS`.
3. **Fill in `GOOGLE_CLIENT_ID` for prod** in `copilot/backend/manifest.yml` (currently empty string).
4. **Register `https://beta.seepluspl.us/api/auth/google/callback`** in the Google OAuth client's authorized redirect URIs.
5. **First prod deploy** — `copilot svc deploy backend prod` creates prod RDS (~10 min), then `copilot svc deploy frontend prod`. `beta.seepluspl.us` flips from legacy to v2.
6. **Retire legacy** — `copilot svc delete --name frontend-legacy --env prod` once we're confident.
7. **Squash-merge `v2` → `master`**, delete the `v2` branch.
8. **Relicense** — GPL-2.0 → MIT on orchestration code (per original cutover plan). The frontend v2 is a clean rewrite; MIT is clean.

Only two things I can't do alone: step 2's Google Client Secret (your hands only) and step 4 (Google Console access).

---

## Architecture map (where things live)

```
backend/
├── schema.sql                 — applied on boot (IF NOT EXISTS everywhere)
├── src/
│   ├── db.ts                  — pg Pool + schema application + graceful init
│   ├── flags/
│   │   ├── index.ts           — cache + isEnabled(name, default) + CRUD
│   │   └── names.ts           — FLAGS constant (source of truth backend-side)
│   ├── auth/
│   │   ├── providers/
│   │   │   ├── provider.ts    — AuthProvider interface
│   │   │   ├── google.ts      — Google OAuth impl
│   │   │   ├── dev.ts         — local-only dev provider (triple-gated)
│   │   │   └── index.ts       — registry (registerProviders + getProvider)
│   │   ├── session.ts         — express-session + connect-pg-simple
│   │   └── userRepo.ts        — upsert + ADMIN_EMAILS / DEV_AUTH_IS_ADMIN handling
│   ├── routes/
│   │   ├── auth.ts            — /me, /logout, /:provider/start, /:provider/callback, requireAuth + requireAdmin
│   │   ├── workspaces.ts      — POST/GET/PUT/PATCH/DELETE + /mine
│   │   ├── flags.ts           — public GET
│   │   └── admin.ts           — admin flag CRUD
│   └── index.ts               — wires it all together

frontend/
├── src/
│   ├── App.tsx                — route switching + mount-time loadMe + loadFlags
│   ├── flags/names.ts         — FLAGS constant (mirror of backend)
│   ├── anim/flip.ts           — enter + FLIP + settleAnimations (no exit)
│   ├── api/client.ts          — fetchMe, createWorkspace, fetchFlags, setAdminFlag, …
│   ├── store/index.ts         — Zustand store (single flat shape, useFlag hook here)
│   └── components/
│       ├── AdminPage.tsx      — /admin flag management
│       ├── MyWorkspaces.tsx   — /workspaces list + rename + delete
│       ├── HeapNode.tsx       — outer div (data-heap-addr, ref target) + inner <article> (animation target)
│       ├── HeapGraph.tsx      — simplified to ~70 lines (no ghost machinery)
│       ├── TopBar.tsx         — AccountMenu with conditional Admin link, gated Tutor button
│       └── …

copilot/
└── backend/
    ├── manifest.yml           — env vars + per-env GOOGLE_CLIENT_ID + secrets refs
    └── addons/
        ├── workspaces-db.yml  — RDS Postgres + SG + Secrets Manager
        ├── trace-store.yml    — S3 trace cache (pre-existing)
        └── lambda-permissions.yml
```

---

## Decisions worth carrying forward

These are in ADRs or live implicitly; restating here so a fresh read doesn't have to piece them together.

- **No monorepo / shared packages** (ADR-0001). Mirrored `FLAGS` constants in backend + frontend are the right tradeoff at this scale.
- **RDS over SQLite** (ADR-0005) for prod, explicitly because operational simplicity beats the $12/mo cost at this stage. Prod is single-AZ today; flip `MultiAZ: true` in the Mapping when an SLA demands it.
- **`schema.sql` on boot** (no migration tool). Graduate when the third schema change can't be expressed with `IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS`.
- **Fork-to-save workspaces**. PUT works on owned rows only. Anonymous workspaces are immutable (owner_id NULL cannot become non-NULL; that would let a later visitor hijack a permalink).
- **Provider-agnostic auth**. Adding GitHub is ~100 lines + `copilot secret init`; the abstraction is real.
- **Admin promotion via `ADMIN_EMAILS` env var**, never via UI (circular-trust problem). Existing admins never auto-demoted on re-sign-in — removal is a deliberate SQL step.
- **Feature flags don't have public/internal scope**. The flag *value* isn't a secret; the gated feature behind it is what `requireAdmin` protects. Keep the surface simple.
- **Exit animation dropped**, enter + FLIP kept. If it ever matters, use `react-transition-group`, don't hand-roll ghost retention.

---

## Known footguns + this-session learnings

Things that bit us and shouldn't bite future-you:

- **`.env` is precious** — it holds per-developer OAuth secrets. Never overwrite it blindly. `worktree-ports.sh` now uses a managed-block merge; don't regress that.
- **Copilot addon outputs** — names must be alphanumeric (CFN rejects underscores). Names ending in `Arn` are filtered out of auto-injection; use a non-`Arn` suffix if you want `secrets:` auto-wiring. Names ending in `AccessPolicy` auto-attach as ManagedPolicy on the task role.
- **nginx `proxy_set_header X-Forwarded-Proto $scheme`** would break OAuth callbacks (internal scheme is http; we need the ALB's https). Use the `$forwarded_proto` `map` already in `frontend/nginx.conf`.
- **`./localdev.sh restart`** does NOT re-read `.env` — you need `./localdev.sh up -d --force-recreate backend` to pick up env changes.
- **Vite proxy forwards** `/api/*` to `backend:3000` locally; in deployed envs `frontend/nginx.conf` does the same via Copilot Service Connect. Must use a static `proxy_pass` (not a `$variable` target), otherwise nginx bypasses `/etc/hosts` which is where Service Connect maps the short name.
- **SPP-Valgrind stack-walker quirk** — parser synthesizes a `main()` frame when the record arrives with empty stack. Documented in `backend/CLAUDE.md`. Proper upstream fix is out of scope.
- **Playwright MCP sessions** — the Chrome instance persists across tool calls and sometimes gets stuck (`Browser is already in use`). `pgrep -f mcp-chrome | xargs kill` fixes it.

---

## Follow-ups deferred to "when it matters"

Nothing in this list is urgent; they're here so the next session sees them in one place.

- **Multi-AZ prod RDS** — ADR-0005, flip when there's traffic to protect.
- **Real migration tool** (Drizzle or `node-pg-migrate`) — third schema change that can't be `IF NOT EXISTS`'d.
- **GitHub OAuth provider** — demand-signaled; abstraction ready.
- **`/v1/*` versioned API** — when there's a second client (mobile, CLI, external).
- **Soft-delete + undo on `/workspaces`** — if users ask.
- **Observability** — CloudWatch dashboards, alarms on RDS CPU / error rate — before the cutover is reasonable.
- **Rate-limit tuning** — only if abuse or cost becomes real.
- **Admin UI expansion** — user management, audit log, etc. Defer until a second admin surface is actually needed.

---

## Pending user actions (when next session starts)

If the user hasn't done these yet and they come up:

- Rebuild local `.env` with real values (see runbook + `.env.example`). Can't sign in locally without it.
- For cutover: create Google OAuth client redirect URI for `beta.seepluspl.us`, run `copilot secret init` for prod secrets.
- If the test env has been idle long enough that it was torn down via `copilot env delete test` to save cost, recreating it needs `copilot env init --name test --default-config` + `copilot env deploy --name test` + the two service deploys.

---

## How the user likes to work (carry this forward)

Captured from memory, but worth restating here:

- **Local-only commits, batch at task boundaries.** Don't ask before every commit; commit atomically at sensible checkpoints.
- **No merge commits on `v2`.** Squash-merge or rebase.
- **UI verification uses Playwright MCP**, not just screenshots. Screenshots alone lie about sub-pixel theme differences.
- **No short-sighted shortcuts.** If the proper solution is <1h extra, just do the proper one. The recent exit-animation simplification is an exception and it was the right call because the complexity was meaningful, not a corner cut.
- **No speculative scaffolding** — no `-v2` filenames, no pre-emptive hooks, no features designed for hypothetical needs.
- **Save screenshots to `tmp/screenshots/`**, not repo root.
