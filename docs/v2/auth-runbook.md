# Google OAuth — setup runbook

One-time setup. After this, hand the Client ID to whoever's integrating,
confirm the Copilot secrets are set, and the backend + frontend take over.

## 1. Create or pick a Google Cloud project

Go to **https://console.cloud.google.com/**. Create a project called
**"See++"** or reuse one you already have.

## 2. Configure the OAuth consent screen

Navigate: **APIs & Services → OAuth consent screen**.

- **User type:** External
- **App name:** See++
- **User support email:** your email
- **Authorized domains:** add `seepluspl.us`
- **Developer contact email:** your email
- **Scopes** — add these three non-sensitive scopes:
  - `openid`
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
- **Test users** (while the app is in "Testing" mode): add your own email and
  anyone beta-testing before you Publish.

Save.

## 3. Create the OAuth client

Navigate: **APIs & Services → Credentials → Create credentials →
OAuth client ID**.

- **Application type:** Web application
- **Name:** `See++ (local + test + prod)`
- **Authorized JavaScript origins:**
  - `http://localhost:4000`
  - `https://frontend.test.spp.seepluspl.us`
  - `https://beta.seepluspl.us`
- **Authorized redirect URIs:**
  - `http://localhost:4000/api/auth/google/callback`
  - `https://frontend.test.spp.seepluspl.us/api/auth/google/callback`
  - `https://beta.seepluspl.us/api/auth/google/callback`

Click **Create**. Copy the **Client ID** and **Client Secret** — the secret
is shown once. If you lose it, regenerate and repeat step 5.

## 4. Generate two session-signing secrets

Signs session cookies. One for test, one for local:

```bash
openssl rand -hex 32   # test env
openssl rand -hex 32   # local dev
```

## 5. Store secrets in the test environment (Copilot)

From the repo root:

```bash
copilot secret init --name GOOGLE_CLIENT_SECRET --values test=PASTE_CLIENT_SECRET_HERE
copilot secret init --name SESSION_SECRET       --values test=PASTE_TEST_SESSION_HEX_HERE
```

That creates SSM SecureString parameters at
`/copilot/spp/test/secrets/GOOGLE_CLIENT_SECRET` and `…/SESSION_SECRET`.
`copilot/backend/manifest.yml` references them via the `secrets:` block.

The **Client ID** is not secret — it's committed in `manifest.yml` as a
plain env variable for each environment.

## 6. Local dev setup

If you don't already have a `.env` at the repo root:

```bash
cp .env.example .env
```

Fill in (at minimum) the auth vars:

```
GOOGLE_CLIENT_ID=PASTE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=PASTE_CLIENT_SECRET_HERE
SESSION_SECRET=PASTE_LOCAL_SESSION_HEX_HERE   # openssl rand -hex 32
```

`docker-compose.yml` reads `.env` for variable interpolation and forwards
these values into the backend container.

### Optional: one-click local sign-in

Add this to `.env` to enable a `DevAuthProvider` that signs you in as
`dev@localhost` in one click — no Google round-trip, no network:

```
DEV_AUTH_ENABLED=true
```

The sign-in modal will show a second "Sign in as Dev User (local only)"
button alongside Google. Clicking it runs the full session flow
(state cookie → callback → user upsert → session cookie) — only the
"consent" step is skipped. Ownership checks, PATCH/DELETE, `/workspaces`
attribution all behave identically to the Google path.

**Safety.** The dev provider is triple-gated server-side. All three
conditions must hold for it to register:

1. `NODE_ENV === "development"`
2. `DEV_AUTH_ENABLED === "true"` (explicit opt-in)
3. `AWS_EXECUTION_ENV` unset (ECS/Fargate always sets this)

If any one fails the provider is invisible, `/api/auth/dev/start` returns
404, and the sign-in modal simply doesn't render the button. Setting the
flag in a deployed environment is a no-op — the `AWS_EXECUTION_ENV` check
blocks it. Still, treat the flag like a secret: never commit it, never set
it in `copilot/backend/manifest.yml`.

## Adding a second provider (e.g. GitHub)

The backend's `AuthProvider` interface is provider-agnostic. To add GitHub:

1. Register an OAuth app in GitHub settings; reuse the three callback URL
   patterns from step 3 with `google` → `github`.
2. Copy `backend/src/auth/providers/google.ts` → `github.ts`; implement the
   interface against the GitHub API.
3. Register it in `backend/src/auth/providers/index.ts`.
4. Run `copilot secret init` for `GITHUB_CLIENT_SECRET`.
5. Add `GITHUB_CLIENT_ID` env var to `manifest.yml`.

No route plumbing, session logic, or schema changes required.

## Revoking / rotating

- **Client secret rotation:** regenerate in Google Console → run step 5
  again for the new value → redeploy backend (`copilot svc deploy`).
- **Session secret rotation:** regenerate → step 5 → redeploy. Rotating
  invalidates every active session (logs everyone out). Fine; sign-in is
  one click.
- **Revoking a user's access:** delete them from the `users` table. Active
  sessions are invalidated on next request since the session `user_id`
  won't resolve.
