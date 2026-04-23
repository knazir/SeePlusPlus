// OAuth routes.
//
//   GET  /api/auth/me                  — { user } | { user: null }
//   POST /api/auth/logout              — destroy session, return { ok: true }
//   GET  /api/auth/:provider/start     — redirect to provider's consent URL
//   GET  /api/auth/:provider/callback  — handle the redirect back, set session
//
// All endpoints return 503 if sessions are disabled (no SESSION_SECRET) or
// if the named provider isn't registered. That lets the backend boot in
// OAuth-less environments (local dev without creds, bootstrap of a fresh
// env) without the frontend falling over.
import crypto from "node:crypto";
import { Request, Response, Router } from "express";
import { getPool } from "../db";
import { getProvider, enabledProviders } from "../auth/providers";
import { findUserById, upsertUserFromProfile, User } from "../auth/userRepo";

const SAFE_PATH_RE = /^\/[A-Za-z0-9/_-]{0,128}$/;

export const authRouter: Router = Router();

function currentUserSync(req: Request): { id: string } | null {
    const id = req.session?.userId;
    return id ? { id } : null;
}

authRouter.get("/me", async (req: Request, res: Response) => {
    const pool = getPool();
    const me = currentUserSync(req);
    if (!pool || !me) {
        res.json({ user: null, providers: enabledProviders() });
        return;
    }
    try {
        const user = await findUserById(pool, me.id);
        if (!user) {
            // Session points at a deleted user — kill the session and 401.
            req.session.destroy(() => {});
            res.json({ user: null, providers: enabledProviders() });
            return;
        }
        res.json({ user: toApi(user), providers: enabledProviders() });
    } catch (err) {
        console.error("[auth] /me failed:", err);
        res.status(500).json({ error: "failed to load session" });
    }
});

authRouter.post("/logout", (req: Request, res: Response) => {
    if (!req.session) {
        res.json({ ok: true });
        return;
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("[auth] session destroy failed:", err);
            res.status(500).json({ error: "failed to log out" });
            return;
        }
        res.clearCookie("spp.sid");
        res.json({ ok: true });
    });
});

authRouter.get("/:provider/start", (req: Request, res: Response) => {
    if (!req.session) {
        res.status(503).json({ error: "sessions not configured" });
        return;
    }
    const provider = getProvider(req.params.provider);
    if (!provider) {
        res.status(404).json({ error: `unknown provider: ${req.params.provider}` });
        return;
    }

    // Only accept `redirect` targets that look like local SPA paths. This
    // keeps us from being used as an open redirect.
    const redirectParam = typeof req.query.redirect === "string" ? req.query.redirect : "/";
    const postLogin = SAFE_PATH_RE.test(redirectParam) ? redirectParam : "/";

    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthState = state;
    req.session.postLoginRedirect = postLogin;

    const callbackUrl = buildCallbackUrl(req, provider.name);
    res.redirect(provider.authorizeUrl(state, callbackUrl));
});

authRouter.get("/:provider/callback", async (req: Request, res: Response) => {
    if (!req.session) {
        res.status(503).send("sessions not configured");
        return;
    }
    const provider = getProvider(req.params.provider);
    if (!provider) {
        res.status(404).send(`unknown provider: ${req.params.provider}`);
        return;
    }

    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) {
        // User denied consent or provider rejected the request. Send them
        // back home with an error hint.
        res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send("missing code or state");
        return;
    }
    if (state !== req.session.oauthState) {
        res.status(400).send("state mismatch");
        return;
    }

    const pool = getPool();
    if (!pool) {
        res.status(503).send("database not configured");
        return;
    }

    const postLogin = req.session.postLoginRedirect ?? "/";
    // One-shot values — clear even if the rest fails, so a retry starts fresh.
    delete req.session.oauthState;
    delete req.session.postLoginRedirect;

    try {
        const callbackUrl = buildCallbackUrl(req, provider.name);
        const profile = await provider.exchangeCodeForProfile(code, callbackUrl);
        const user = await upsertUserFromProfile(pool, provider.name, profile);

        req.session.userId = user.id;
        // Regenerate session id to prevent fixation (pre-auth id shouldn't
        // survive into the authenticated session). Must save before redirect.
        req.session.save((err) => {
            if (err) {
                console.error("[auth] session save failed:", err);
                res.status(500).send("login failed");
                return;
            }
            res.redirect(postLogin);
        });
    } catch (err) {
        console.error(`[auth] ${provider.name} callback failed:`, err);
        res.redirect("/?auth_error=callback_failed");
    }
});

function buildCallbackUrl(req: Request, providerName: string): string {
    // Respect the override when set (local dev uses OAUTH_CALLBACK_BASE_URL
    // so Google's registered redirect URI matches what we send).
    const base = process.env.OAUTH_CALLBACK_BASE_URL;
    if (base) return `${base.replace(/\/$/, "")}/api/auth/${providerName}/callback`;
    // In deployed envs the ALB terminates TLS and the X-Forwarded-Proto
    // header is honored via `app.set('trust proxy')`.
    return `${req.protocol}://${req.get("host")}/api/auth/${providerName}/callback`;
}

export function toApi(user: User): Record<string, unknown> {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
    };
}

/** Express middleware: reject unauthenticated requests with 401. */
export const requireAuth = (req: Request, res: Response, next: () => void) => {
    if (!req.session?.userId) {
        res.status(401).json({ error: "authentication required" });
        return;
    }
    next();
};
