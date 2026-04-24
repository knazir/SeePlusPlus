# Feature flags

Runtime-toggleable knobs for gating in-progress UI (and occasional backend
behavior) so unfinished work can sit on `master` without reaching users.

## How it's wired

- **Names** live in `backend/src/flags/names.ts` and
  `frontend/src/flags/names.ts` as a mirrored `FLAGS` constant. Import
  `FLAGS.SOMETHING` instead of string literals.
- **Storage** is the `feature_flags` Postgres table (see
  `backend/schema.sql`). One row per flag.
- **Backend cache** (`backend/src/flags/index.ts`) loads every row on boot.
  The first call to `isEnabled(name, defaultValue)` for a new name inserts
  a row automatically, so the admin UI surfaces it immediately.
- **Public endpoint** `GET /api/flags` returns the cache. No auth — the
  flag *value* isn't a secret; what's gated behind it is what you protect.
- **Frontend hook** `useFlag(FLAGS.TUTOR_PANEL)` returns the cached
  boolean. `store.loadFlags()` runs once on app mount.
- **Admin UI** at `/admin`. Gated on `users.is_admin`. Non-admins 404.

## Adding a flag

1. Add the name to both `FLAGS` constants.
2. Gate the code:
   - Frontend: `const on = useFlag(FLAGS.MY_FLAG);` then branch.
   - Backend: `if (await isEnabled(FLAGS.MY_FLAG, false)) { … }`. The
     default (second arg) decides what the flag means before anyone has
     toggled it; use `false` for new-user-facing work, `true` for kill-
     switches on existing behavior.
3. Toggle it at `/admin`. Changes take effect immediately; no reload.

## Removing a flag

Delete the code branch, drop the entry from both `FLAGS` constants,
optionally `DELETE FROM feature_flags WHERE name = '…'` for housekeeping.

## Gotchas

- Frontend flags load on app mount. A flag toggled mid-session won't flip
  in an already-loaded tab until reload.
- Admin promotion is via the `ADMIN_EMAILS` env var, never through the UI.
- Once a row exists, changing the code's default value doesn't update the
  row — `UPDATE` it manually if you need to flip the default.
