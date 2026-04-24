# Deployment

How to deploy See++ to AWS. Assumes you're using [AWS Copilot](https://aws.github.io/copilot-cli/)
(the repo ships Copilot manifests under `copilot/`) and you've read
[`infrastructure.md`](./infrastructure.md) for the overall shape.

## Prerequisites

- AWS account + CLI, credentials configured.
- `copilot --version` available (v1.27+).
- Docker running locally (needed for building the Lambda image).
- `code-runner/SPP-Valgrind` submodule checked out (`git submodule update --init`).
- Your own domain with a Route53 hosted zone, if you want custom domain
  aliases. Otherwise Copilot assigns auto-generated ALB hostnames.

## First-time environment setup

Pick an environment name — `test`, `prod`, or anything else.

```bash
copilot env init --name <env> --profile default --default-config
copilot env deploy --name <env>
```

This creates the VPC, subnets, ALB-ready infra, and ECS cluster. Takes
about 3–5 minutes.

### Bootstrap secrets

The backend needs two secrets before it can start auth flows. Without
them, auth routes return 503 but the app still serves non-auth features.

```bash
# Google OAuth client secret — from the Google Cloud Console. See
# docs/oauth-setup.md for creating the client in the first place.
copilot secret init --name GOOGLE_CLIENT_SECRET \
  --values <env>=<client-secret>

# Session signing secret — generate a fresh one per environment.
copilot secret init --name SESSION_SECRET \
  --values <env>=$(openssl rand -hex 32)
```

Both land in SSM at `/copilot/spp/<env>/secrets/`. The backend manifest
references them via its `secrets:` block.

### Fill in the Client ID

Unlike the secrets, the OAuth **Client ID** is not sensitive and lives
directly in `copilot/backend/manifest.yml` as a plain env var under the
per-env `variables:` block. Set it before the first backend deploy.

## Deploy the Lambda code runner

The Lambda function isn't Copilot-managed — it's built and pushed
directly.

```bash
cd code-runner/lambda
./deploy-to-aws.sh <env> us-west-2
```

The script:

1. Creates the ECR repo `spp-lambda-trace` if it doesn't exist.
2. Builds the Lambda container image (~394 MB) from `Dockerfile.prod`.
3. Pushes with tag `<env>` (e.g. `test`, `prod`).
4. Creates / updates the Lambda function `spp-trace-executor-<env>` with
   memory = 10 GB, timeout = 120 s, x86_64.
5. Creates the execution role `spp-lambda-execution-role-<env>`.

First run takes 8–12 minutes (mostly the Docker build + push). Subsequent
runs are faster since the base image layers are cached.

## Deploy the backend

```bash
copilot svc deploy --name backend --env <env>
```

**On the first deploy of a fresh environment**, this also provisions the
RDS Postgres instance (via the `workspaces-db.yml` addon) and the S3
trace-store bucket. Expect ~10 minutes the first time; subsequent
deploys are 2–3 minutes.

The backend applies `backend/schema.sql` on startup with `IF NOT EXISTS`
semantics, so the first boot after provisioning creates all tables. No
separate migration step.

## Deploy the frontends

```bash
copilot svc deploy --name frontend --env <env>
copilot svc deploy --name frontend-legacy --env <env>
```

These are static React apps served by nginx, with `/api/*` proxied to
the backend over Copilot Service Connect.

## Custom domains

If you want your ECS services behind your own domain (instead of the
auto-generated `*.spp.<your-domain>` hostnames Copilot creates), add an
`http.alias` to the service manifest:

```yaml
# copilot/frontend/manifest.yml
environments:
  prod:
    http:
      alias: ["your-domain.com"]
```

Copilot provisions an ACM cert and Route53 alias record automatically,
provided the application was initialized against a hosted zone you
control (`copilot app init --domain your-domain.com`).

### Moving an alias between services

If an alias currently points at service A and you want it on service B
(e.g. moving the apex from `frontend-legacy` to `frontend`):

1. Remove the alias from A's manifest.
2. `copilot svc deploy --name A --env <env>` — this releases the
   Route53 record.
3. Add the alias to B's manifest.
4. `copilot svc deploy --name B --env <env>` — this claims it.

Expect a minutes-long window between steps 2 and 4 where the alias
returns NXDOMAIN. Don't do both deploys in parallel or CloudFormation
will conflict on the shared record.

## Verifying a deploy

### Backend

```bash
copilot svc status --name backend --env <env>
copilot svc logs --name backend --env <env> --since 5m
```

The health check at `/api` should return `See++ backend online`. From an
internal host (e.g. via `copilot svc exec`):

```bash
curl http://backend.<env>.spp.<your-domain>/api
```

### Lambda

```bash
aws lambda invoke --function-name spp-trace-executor-<env> \
  --payload '{"code":"int main(){return 0;}"}' response.json
cat response.json
```

Expect `traceContent`, `ccStdout`, `ccStderr`, `stdout`, `stderr` keys.

### Database

Schema should have been applied on first backend boot. To confirm:

```bash
copilot svc exec --name backend --env <env> --command "sh"
# then inside the container:
node -e "const {Pool}=require('pg'); const p=new Pool(); p.query('\\dt').then(r=>console.log(r.rows))"
```

Expect rows for `workspaces`, `users`, `user_identities`, `sessions`,
`feature_flags`.

## Updating a deployed environment

Normal update cycle:

```bash
# Code changes in backend/src or frontend/src
copilot svc deploy --name backend --env <env>
copilot svc deploy --name frontend --env <env>

# Lambda / SPP-Valgrind changes
cd code-runner/lambda && ./deploy-to-aws.sh <env> us-west-2
```

Lambda updates take effect on the next invocation — no service restart
needed.

## ALB idle timeout

If you see `504 Gateway Timeout` on slow-to-compile programs, the ALB's
default idle timeout (60 s) is too short. Bump to 300 s:

```bash
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn <your-lb-arn> \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

`copilot/deploy-environment.sh` does this automatically when used.

## Common issues

**"Function not found" on `/api/run`.** The Lambda wasn't deployed for
this env, or `LAMBDA_FUNCTION_NAME` in the manifest doesn't match.
Check with:

```bash
aws lambda get-function --function-name spp-trace-executor-<env>
```

**"Not authorized to perform: lambda:InvokeFunction".** The backend's
task role doesn't have the Lambda-invoke policy attached. Verify
`copilot/backend/addons/lambda-permissions.yml` is present, then
redeploy the backend.

**Database not reachable on first boot.** RDS takes ~10 minutes to
provision. The backend crashes until it can connect; Copilot's rolling
deploy re-tries on its own. Watch
`copilot svc logs --name backend --env <env>` to confirm the pool
eventually connects.

**Sign-in fails with "redirect_uri_mismatch".** The OAuth client's
authorized redirect URIs don't include this environment's backend
callback. Add it in the Google Cloud Console — see
[`oauth-setup.md`](./oauth-setup.md).

## Tearing down

```bash
# Delete one service
copilot svc delete --name frontend-legacy --env <env>

# Delete the whole environment (all services, ECS, RDS, S3, VPC)
copilot env delete --name <env>
```

`env delete` is destructive and takes ~15 minutes. The RDS instance is
deleted with a final snapshot by default (`DeletionProtection: true` on
prod); you'll be prompted.

## Cost notes

See [`infrastructure.md#cost-levers`](./infrastructure.md#cost-levers)
for per-service knobs. The single biggest lever for a low-traffic
deployment is deleting the test env when not in use.
