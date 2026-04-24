# `copilot/`

AWS Copilot manifests and addons for See++. For the full deploy workflow
and end-to-end architecture, see [`docs/deployment.md`](../docs/deployment.md)
and [`docs/infrastructure.md`](../docs/infrastructure.md). This README is
an orientation for reading and editing the files in this directory.

## Layout

```
copilot/
├── .workspace                       # Copilot application: "spp"
├── deploy-environment.sh            # Convenience wrapper for env bootstrap
├── environments/
│   ├── test/manifest.yml
│   └── prod/manifest.yml
├── backend/
│   ├── manifest.yml                 # ECS Load Balanced Web Service
│   └── addons/
│       ├── workspaces-db.yml        # RDS Postgres + Secrets Manager
│       ├── trace-store.yml          # S3 bucket (reserved for trace cache)
│       └── lambda-permissions.yml   # IAM: backend → Lambda invoke
├── frontend/manifest.yml            # Primary frontend ECS service
└── frontend-legacy/manifest.yml     # Legacy frontend ECS service
```

## Services at a glance

| Service | Port | Prod alias |
|---|---|---|
| `backend` | 3000 | (internal, via Service Connect) |
| `frontend` | 80 | `seepluspl.us` |
| `frontend-legacy` | 80 | `old.seepluspl.us` |

All three run on Fargate, 256 CPU / 512 MB, `linux/x86_64`. Prod auto-
scales 1–10 on CPU > 70%; test is pinned to a single instance.

The Lambda code runner (`spp-trace-executor-<env>`) is **not** Copilot-
managed — it's built and pushed by `code-runner/lambda/deploy-to-aws.sh`.
The backend's `lambda-permissions.yml` addon grants the task role
permission to invoke it.

## Addons

Three CloudFormation templates attached to the backend stack. Copilot
auto-wires any `AWS::IAM::ManagedPolicy` output to the service's task
role and any `secrets` output into the container env.

- **`workspaces-db.yml`** — RDS Postgres 16.13, `db.t4g.micro`, private
  subnet, gp3 encrypted storage. A Secrets Manager secret holds the
  generated `{ username, password, host, port, dbname }` JSON and is
  attached to the instance so the backend reads credentials without
  hardcoding them. Per-env knobs (backup retention, MultiAZ, deletion
  protection) are in the top-of-file `Mappings` block.
- **`trace-store.yml`** — S3 bucket (versioned, encrypted, no public
  access, 30-day non-current expiry). Currently unused at runtime; kept
  for a future trace-cache layer. The backend task role has full CRUD on
  it.
- **`lambda-permissions.yml`** — minimal IAM policy granting
  `lambda:InvokeFunction` on `*`. Separate from the backend manifest's
  `task_role.policy` block because Copilot doesn't apply inline
  manifest-level IAM — addons are the supported path.

## Secrets

Backend secrets live in SSM at `/copilot/spp/<env>/secrets/` and are
referenced in `backend/manifest.yml` under the `secrets:` block. The
backend's task role is generated with read permission on that SSM path
prefix automatically.

| Name | Notes |
|---|---|
| `GOOGLE_CLIENT_SECRET` | From the Google Cloud Console. Rotate via the same `copilot secret init` command. |
| `SESSION_SECRET` | Per-environment random hex — generate with `openssl rand -hex 32`. Rotation invalidates every active session. |

The `GOOGLE_CLIENT_ID` is not sensitive and lives directly in
`backend/manifest.yml` as a per-env `variables:` entry.

RDS credentials live in **Secrets Manager**, not SSM — they're generated
by CloudFormation inside `workspaces-db.yml` and never need manual
rotation.

### Initialize secrets for a new environment

```bash
copilot secret init --name GOOGLE_CLIENT_SECRET --values <env>=<value>
copilot secret init --name SESSION_SECRET      --values <env>=$(openssl rand -hex 32)
```

### Inspect what's there

```bash
aws ssm get-parameters-by-path \
  --path "/copilot/spp/<env>/secrets" \
  --with-decryption
```

## Common operations

```bash
# Status
copilot env show --name <env>
copilot svc status --name backend --env <env>

# Logs
copilot svc logs --name backend --env <env> --follow
copilot svc logs --name frontend --env <env> --since 1h

# Deploy one service
copilot svc deploy --name backend --env <env>

# Delete one service (e.g. retiring frontend-legacy)
copilot svc delete --name frontend-legacy --env <env>

# Destroy an entire environment (takes ~15 minutes)
copilot env delete --name <env>
```

## Per-environment differences

| | test | prod |
|---|---|---|
| ECS count | 1 (fixed) | 1–10 auto-scale |
| Deployment strategy | `rolling: recreate` | default rolling |
| RDS backups | 1 day | 7 days |
| RDS deletion protection | off | on |
| Custom domain aliases | none (use auto-generated hostnames) | `seepluspl.us`, `old.seepluspl.us` |
| Container Insights | off | off (flip on in `environments/<env>/manifest.yml` when needed) |

## Gotchas specific to this directory

- **Addon output names are alphanumeric only.** CloudFormation rejects
  underscores. Names ending in `Arn` get filtered out of auto-wiring; use
  a different suffix (e.g. `AccessPolicy`) if you want Copilot to attach
  the output as a ManagedPolicy.
- **nginx proxy headers.** The frontend nginx config uses
  `$forwarded_proto` (not `$scheme`) because Service Connect uses HTTP
  internally while the ALB terminates HTTPS; setting
  `X-Forwarded-Proto` to `$scheme` breaks OAuth callbacks.
- **Service Connect requires static `proxy_pass` targets.** nginx bypasses
  `/etc/hosts` when given a `resolver` directive + `$variable` target —
  which is where Service Connect maps short names. Keep `proxy_pass`
  literal.
- **ALB idle timeout.** The Copilot default is 60 seconds, but some user
  programs take longer to compile + run. `deploy-environment.sh` bumps it
  to 300; if deploying manually, see [`docs/deployment.md`](../docs/deployment.md#alb-idle-timeout).
