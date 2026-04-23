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

Add to `.env.local` at the repo root (gitignored):

```
GOOGLE_CLIENT_ID=PASTE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=PASTE_CLIENT_SECRET_HERE
SESSION_SECRET=PASTE_LOCAL_SESSION_HEX_HERE
OAUTH_CALLBACK_BASE_URL=http://localhost:4000
```

`docker-compose.yml` picks these up and forwards them to the backend
container.

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
