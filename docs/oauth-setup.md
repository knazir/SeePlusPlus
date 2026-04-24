# Google OAuth setup

See++ authenticates via Google OAuth (with an optional local-only dev
provider). This document walks through wiring up a new deployment; it's
one-time work per environment.

## 1. Create or pick a Google Cloud project

Go to https://console.cloud.google.com/ and either create a new project
for your See++ deployment or reuse an existing one.

## 2. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen.**

- **User type:** External (unless you have a Google Workspace org).
- **App name:** whatever you want users to see on the consent page.
- **User support email** and **developer contact email:** your own.
- **Authorized domains:** the domain your deployment lives on (e.g.
  `example.com`).
- **Scopes:** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
- **Test users:** while the app is in "Testing" mode, only listed users
  can sign in. Add your own email plus anyone beta-testing before
  publishing.

## 3. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID.**

- **Application type:** Web application.
- **Authorized JavaScript origins:** each frontend host you run on, e.g.
  `http://localhost:4000` and whatever your deployed domains are.
- **Authorized redirect URIs:** `<frontend-host>/api/auth/google/callback`
  for each of the above.

Click **Create**. Copy the **Client ID** and **Client Secret**. The secret
is shown only once — if you lose it, regenerate.

## 4. Generate a session-signing secret

Used to sign session cookies. Generate one per environment:

```bash
openssl rand -hex 32
```

## 5. Store secrets for deployed environments

With AWS Copilot, from the repo root:

```bash
copilot secret init --name GOOGLE_CLIENT_SECRET --values <env>=<secret>
copilot secret init --name SESSION_SECRET       --values <env>=<hex>
```

`copilot/backend/manifest.yml` references the SSM parameters by path. The
Client *ID* is not secret — commit it to `manifest.yml` as a plain env var.

## 6. Local development

```bash
cp .env.example .env
# fill in at minimum:
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# SESSION_SECRET=$(openssl rand -hex 32)
```

`docker-compose.yml` reads `.env` and forwards these to the backend
container.

### Optional: one-click local sign-in

If you don't want to set up Google OAuth just to poke at the app:

```
DEV_AUTH_ENABLED=true
```

The sign-in modal then shows a "Sign in as Dev User (local only)" button
that runs the full session flow skipping only the Google consent step.

The dev provider is **triple-gated server-side**:

1. `NODE_ENV === 'development'`
2. `DEV_AUTH_ENABLED === 'true'`
3. `AWS_EXECUTION_ENV` unset (ECS/Fargate always sets this)

Setting the flag in a deployed environment is a no-op. Still, treat it
like a secret — never commit it, never set it in `copilot/backend/manifest.yml`.

## Adding a second provider

The backend's `AuthProvider` interface is provider-agnostic. To add
GitHub (or any other OAuth provider):

1. Register an OAuth app with that provider; reuse the callback URL
   patterns from step 3 with `google` → `<provider>`.
2. Implement the interface (model on `backend/src/auth/providers/google.ts`).
3. Register it in `backend/src/auth/providers/index.ts`.
4. Store its client secret via `copilot secret init`.
5. Add its Client ID to `copilot/backend/manifest.yml`.

No route plumbing, session logic, or schema changes required.

## Rotation + revocation

- **Client secret:** regenerate in Google Console → rerun step 5 →
  redeploy.
- **Session secret:** regenerate → rerun step 5 → redeploy. Rotation
  invalidates every active session; sign-in is one click, so it's cheap.
- **Revoking a user:** delete the row from the `users` table. Active
  sessions invalidate on next request since their `user_id` no longer
  resolves.
