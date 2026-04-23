// Workspace persistence routes.
//
//   POST   /api/workspaces            — create (anonymous or owned)
//   GET    /api/workspaces/mine       — list signed-in user's workspaces
//   GET    /api/workspaces/:slug      — fetch one (public; read-only sharing)
//   PUT    /api/workspaces/:slug      — update code (+ name); owner only
//   PATCH  /api/workspaces/:slug      — update name only; owner only
//   DELETE /api/workspaces/:slug      — delete; owner only
//
// Ownership rules:
//   - owner_id = NULL rows are immutable (can't be PUT/PATCH/DELETE'd).
//   - owner_id != NULL rows require session.userId = owner_id.
//   - Anonymous workspaces never become claimable — that would let a later
//     visitor hijack the permalink.
//
// Size cap: 64KB of source. Rate limit: 20 creates per IP per 10 minutes.
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { customAlphabet } from "nanoid";

import { dbEnabled, getPool } from "../db";
import { requireAuth } from "./auth";

const MAX_CODE_BYTES = 64 * 1024;
const MAX_NAME_LENGTH = 80;

// Ambiguous characters stripped (0/O, 1/l/I). 10-char slug over 54 symbols
// gives > 10^17 combinations — collision risk is negligible at our scale.
const SLUG_ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const newSlug = customAlphabet(SLUG_ALPHABET, 10);

const writeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

const SLUG_RE = /^[A-Za-z0-9]{4,32}$/;

export const workspacesRouter: Router = Router();

workspacesRouter.use((_req, res, next) => {
    if (!dbEnabled()) {
        res.status(503).json({ error: "workspace persistence not configured" });
        return;
    }
    next();
});

/** Optional name from a write body. Returns the trimmed string, null if
 *  explicitly null/empty/absent, or an Error if the field is malformed. */
function parseNameInput(raw: unknown): string | null | Error {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== "string") return new Error("name must be a string");
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_NAME_LENGTH) {
        return new Error(`name exceeds ${MAX_NAME_LENGTH} character limit`);
    }
    return trimmed;
}

workspacesRouter.post("/", writeLimiter, async (req: Request, res: Response) => {
    const code = typeof req.body?.code === "string" ? req.body.code : null;
    if (code === null) {
        res.status(400).json({ error: "code (string) is required" });
        return;
    }
    if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
        res.status(413).json({ error: `code exceeds ${MAX_CODE_BYTES} byte limit` });
        return;
    }
    const name = parseNameInput(req.body?.name);
    if (name instanceof Error) {
        res.status(400).json({ error: name.message });
        return;
    }

    const pool = getPool()!;
    const ownerId: string | null = req.session?.userId ?? null;

    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = newSlug();
        try {
            await pool.query(
                "INSERT INTO workspaces (slug, code, owner_id, name) VALUES ($1, $2, $3, $4)",
                [slug, code, ownerId, name],
            );
            res.status(201).json({ slug });
            return;
        } catch (err: unknown) {
            const errCode = (err as { code?: string })?.code;
            if (errCode === "23505") continue; // unique violation — retry
            console.error("[workspaces] insert failed:", err);
            res.status(500).json({ error: "failed to save workspace" });
            return;
        }
    }
    res.status(500).json({ error: "could not allocate slug" });
});

workspacesRouter.get("/mine", requireAuth, async (req: Request, res: Response) => {
    const pool = getPool()!;
    const userId = req.session!.userId!;
    try {
        const result = await pool.query<{
            slug: string;
            code: string;
            name: string | null;
            created_at: Date;
            updated_at: Date;
        }>(
            `SELECT slug, code, name, created_at, updated_at
             FROM workspaces
             WHERE owner_id = $1
             ORDER BY updated_at DESC
             LIMIT 100`,
            [userId],
        );
        res.json({
            workspaces: result.rows.map((r) => ({
                slug: r.slug,
                name: r.name,
                preview: r.code.slice(0, 160),
                createdAt: r.created_at.toISOString(),
                updatedAt: r.updated_at.toISOString(),
            })),
        });
    } catch (err) {
        console.error("[workspaces] /mine failed:", err);
        res.status(500).json({ error: "failed to load workspaces" });
    }
});

workspacesRouter.get("/:slug", async (req: Request, res: Response) => {
    const slug = req.params.slug;
    if (!SLUG_RE.test(slug)) {
        res.status(400).json({ error: "invalid slug" });
        return;
    }
    const pool = getPool()!;
    try {
        const result = await pool.query<{
            code: string;
            name: string | null;
            owner_id: string | null;
            created_at: Date;
            updated_at: Date;
        }>(
            "SELECT code, name, owner_id, created_at, updated_at FROM workspaces WHERE slug = $1",
            [slug],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ error: "workspace not found" });
            return;
        }
        const row = result.rows[0];
        // ownerMe tells the frontend "you own this" without leaking the
        // actual owner UUID to anonymous viewers.
        const ownerMe =
            row.owner_id !== null && req.session?.userId === row.owner_id;
        res.json({
            slug,
            code: row.code,
            name: row.name,
            ownerMe,
            hasOwner: row.owner_id !== null,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
        });
    } catch (err) {
        console.error("[workspaces] select failed:", err);
        res.status(500).json({ error: "failed to load workspace" });
    }
});

/** Shared ownership guard: returns the user id on success, or sends a
 *  response and returns null on failure. */
async function requireOwnership(
    req: Request,
    res: Response,
): Promise<string | null> {
    const slug = req.params.slug;
    if (!SLUG_RE.test(slug)) {
        res.status(400).json({ error: "invalid slug" });
        return null;
    }
    const pool = getPool()!;
    const userId = req.session?.userId ?? null;
    if (!userId) {
        res.status(401).json({ error: "authentication required" });
        return null;
    }
    const result = await pool.query<{ owner_id: string | null }>(
        "SELECT owner_id FROM workspaces WHERE slug = $1",
        [slug],
    );
    if (result.rowCount === 0) {
        res.status(404).json({ error: "workspace not found" });
        return null;
    }
    const ownerId = result.rows[0].owner_id;
    if (ownerId !== userId) {
        res.status(403).json({ error: "you do not own this workspace" });
        return null;
    }
    return userId;
}

workspacesRouter.put("/:slug", async (req: Request, res: Response) => {
    if (!(await requireOwnership(req, res))) return;

    const code = typeof req.body?.code === "string" ? req.body.code : null;
    if (code === null) {
        res.status(400).json({ error: "code (string) is required" });
        return;
    }
    if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
        res.status(413).json({ error: `code exceeds ${MAX_CODE_BYTES} byte limit` });
        return;
    }
    const name = parseNameInput(req.body?.name);
    if (name instanceof Error) {
        res.status(400).json({ error: name.message });
        return;
    }

    const pool = getPool()!;
    try {
        // If `name` is absent from the body, keep the existing name. If the
        // client sends null/"", clear it. parseNameInput collapses both cases
        // to `null` — we use the `hasOwnProperty` trick to distinguish.
        const nameProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "name");
        if (nameProvided) {
            await pool.query(
                "UPDATE workspaces SET code = $1, name = $2, updated_at = now() WHERE slug = $3",
                [code, name, req.params.slug],
            );
        } else {
            await pool.query(
                "UPDATE workspaces SET code = $1, updated_at = now() WHERE slug = $2",
                [code, req.params.slug],
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error("[workspaces] update failed:", err);
        res.status(500).json({ error: "failed to update workspace" });
    }
});

workspacesRouter.patch("/:slug", async (req: Request, res: Response) => {
    if (!(await requireOwnership(req, res))) return;
    const name = parseNameInput(req.body?.name);
    if (name instanceof Error) {
        res.status(400).json({ error: name.message });
        return;
    }
    const pool = getPool()!;
    try {
        await pool.query(
            "UPDATE workspaces SET name = $1, updated_at = now() WHERE slug = $2",
            [name, req.params.slug],
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("[workspaces] patch failed:", err);
        res.status(500).json({ error: "failed to update workspace" });
    }
});

workspacesRouter.delete("/:slug", async (req: Request, res: Response) => {
    if (!(await requireOwnership(req, res))) return;
    const pool = getPool()!;
    try {
        await pool.query("DELETE FROM workspaces WHERE slug = $1", [req.params.slug]);
        res.json({ ok: true });
    } catch (err) {
        console.error("[workspaces] delete failed:", err);
        res.status(500).json({ error: "failed to delete workspace" });
    }
});
