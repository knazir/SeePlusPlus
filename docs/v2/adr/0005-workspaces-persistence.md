# ADR 0005 — Workspaces persistence: RDS Postgres, `schema.sql` on boot, fork-to-save

**Date:** 2026-04-23
**Status:** Accepted.

## Context

Shareable URLs are the cheapest retention mechanism for a tool like See++ — a link in a Slack thread outperforms any single feature. The backend was stateless; there was no way to persist a workspace and hand someone a URL.

We considered four storage options:

1. **RDS `db.t4g.micro`** (single-AZ) — ~$12/mo/env. AWS-standard, managed backups, straight path to scale.
2. **Aurora Serverless v2 with scale-to-zero** — ~$0.50–$2/mo with cold-start on first request. More complex to reason about; cold-start hits the "Save" button users tap most.
3. **SQLite on EFS, mounted into the backend task** — ~$0 extra. Works only while backend is one-writer; NFS + SQLite locking is historically flaky; not a pattern AWS reference architectures reach for.
4. **SQLite on EBS** — ~$0.08/mo, same one-writer constraint as EFS plus manual CFN.

## Decision

**Storage:** RDS Postgres `db.t4g.micro`, single-AZ, 20 GB gp3, encrypted, 7-day backups in prod / 1-day in test. Provisioned via a Copilot addon (`copilot/backend/addons/workspaces-db.yml`) that uses `Fn::ImportValue` to pull the env's VPC and shared security group.

**Why RDS over SQLite:** For a service we want people to use, "never having to think about file locking, corruption, or NFS edge cases" is cheap at $12/mo. SQLite+EFS would have been a minor pattern in Copilot deployments and locks us out of scaling past one backend task without a data-layer rewrite.

**Why single-AZ, not Multi-AZ:** True best practice for prod is Multi-AZ (~$24/mo with a failover target). We have no availability SLA yet; RDS single-AZ still provides automated backups and point-in-time recovery. The upgrade is a one-line flip in the CFN `Mappings` when traffic justifies it.

**Credential flow:** Secrets Manager holds a JSON secret with `username`/`password`; `AWS::SecretsManager::SecretTargetAttachment` injects `host`/`port`/`dbname` after the DB is created. The addon outputs the secret's ARN as `workspacesDbSecret`. Copilot auto-detects that the value is a Secrets Manager ARN and wires it as a `secrets:` entry on the task, resolving the JSON into the container as `WORKSPACES_DB_SECRET` on boot. `backend/src/db.ts` parses the JSON and builds `DATABASE_URL` — no AWS SDK call needed. Locally, docker-compose sets `DATABASE_URL` directly and the secret path is skipped.

**Caveat found during first deploy:** Copilot's auto-wiring heuristic skipped an output originally named `workspacesDbSecretArn` — dropping the `Arn` suffix is what made it inject. Un-documented; keep the output name as `workspacesDbSecret` unless you want to fall back to an explicit manifest `secrets:` block.

**Same-origin API via nginx proxy.** Each Copilot Load Balanced Web Service gets its own ALB hostname (`frontend.test.spp.seepluspl.us` and `backend.test.spp.seepluspl.us`). The frontend uses relative `/api/*` URLs so the browser treats it as same-origin (no CORS, cookies work for future auth); nginx in the frontend container proxies those requests to the backend via Copilot Service Connect's short name `backend`. Important: nginx must use libc resolution (static `proxy_pass http://backend:3000`) — using a `resolver` directive + `$variable` target bypasses `/etc/hosts`, which is where Service Connect sets up the short-name mapping.

**No migration tool.** A single `backend/schema.sql` runs on every boot (idempotent via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`). When we need the 3rd–4th schema change, a `DROP`, or a data backfill, we graduate to a real tool. Until then, a migration system would be ceremony for one table.

**Fork-to-save over edit tokens.** POST creates a new slug every time; GET fetches it; no PUT, no DELETE. This gets shareable URLs shipped without any auth and without the footgun of "edit tokens in localStorage that you lose if you clear browser data." Mutable slugs become a real feature when accounts land (P6).

**Rate-limit + size cap.** 20 creates per IP per 10 minutes via `express-rate-limit`. 64 KB source cap — rejected with 413.

**Slug shape.** 10-char URL-safe alphabet (omitting ambiguous 0/O, 1/l/I) — ~10^17 combinations. Bounded collision-retry on insert (5 attempts) handles the astronomical edge case.

## Consequences

**Gains.** See++ produces real permalinks. Prod DB is $12/mo, test DB comes and goes with the environment. The path to Multi-AZ, read replicas, or real migrations is standard AWS work when we need it, not prophylactic work now.

**Losses.** Two new moving parts: an RDS instance per environment and a Secrets Manager secret per environment. Copilot handles both lifecycles; no manual ops work required.

**Deferred / follow-ups.**

- Multi-AZ in prod — flip `EnvConfig.prod.MultiAZ: true` when there's traffic to protect.
- Mutable workspaces — add `PUT /api/workspaces/:slug` + owner check when accounts land (P6).
- A real migration tool — bring in Drizzle or `node-pg-migrate` when the second schema change needs a real plan.
- Cleanup of abandoned workspaces — add `DELETE FROM workspaces WHERE created_at < now() - interval '1 year' AND last_viewed_at IS NULL` on a cron when storage becomes a concern.

**Reversibility.** All three pieces (addon, backend module, frontend UI) are isolated enough to rip out as a single revert if we change direction. The workspaces router 503s when the DB isn't configured, so the backend stays bootable without it.
