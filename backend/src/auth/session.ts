// Session middleware. Sessions live in Postgres via connect-pg-simple so
// they survive backend restarts and are portable across tasks if we ever
// scale past one. Cookie is signed with SESSION_SECRET; absence of that
// secret disables sessions entirely (auth routes 503 — same pattern as
// the workspaces router when DATABASE_URL is missing).
import { RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";

// Augment the session payload so TypeScript knows about our fields.
declare module "express-session" {
    interface SessionData {
        userId?: string;
        /** Random token stashed before an OAuth redirect, validated on callback. */
        oauthState?: string;
        /** Where to send the user after a successful login (e.g. /workspaces). */
        postLoginRedirect?: string;
    }
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Returns the session middleware if SESSION_SECRET is set, else null. */
export function buildSessionMiddleware(pool: Pool): RequestHandler | null {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        console.warn("[auth] SESSION_SECRET not set — sessions disabled");
        return null;
    }

    const PgStore = connectPgSimple(session);
    const store = new PgStore({
        pool,
        tableName: "sessions",
        // Schema is applied at boot by src/db.ts; no need to have the store
        // create it (and fail on permissions in locked-down DBs).
        createTableIfMissing: false,
    });

    // In production, force secure cookies — relying on `secure: "auto"` here
    // is fragile against any deploy that mishandles X-Forwarded-Proto (e.g.,
    // an ALB health-checking on HTTP, a reverse proxy forgetting the header).
    // The cost of an explicit boolean is zero; the cost of a session cookie
    // ever leaving on plaintext is high. trust proxy is set on the Express
    // app in index.ts.
    const isProd = process.env.NODE_ENV === "production";
    return session({
        name: "spp.sid",
        secret,
        store,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: isProd,
            maxAge: ONE_WEEK_MS,
        },
    });
}
