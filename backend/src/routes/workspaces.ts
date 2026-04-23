// Workspace persistence routes.
//
// Model: fork-to-save. POST creates an immutable snapshot keyed by a short
// URL-safe slug; GET fetches it. No PUT/DELETE until accounts land — mutable
// slugs without auth would be an open write endpoint.
//
// Size cap: 64KB of source. Rate limit: 20 creates per IP per 10 minutes,
// which is generous for humans and hostile to script kiddies.
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { customAlphabet } from "nanoid";

import { dbEnabled, getPool } from "../db";

const MAX_CODE_BYTES = 64 * 1024;

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

export const workspacesRouter: Router = Router();

workspacesRouter.use((_req, res, next) => {
    if (!dbEnabled()) {
        res.status(503).json({ error: "workspace persistence not configured" });
        return;
    }
    next();
});

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

    const pool = getPool()!;
    // Collision retry: nanoid is astronomically unlikely to collide, but a
    // bounded retry loop is cheap insurance.
    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = newSlug();
        try {
            await pool.query(
                "INSERT INTO workspaces (slug, code) VALUES ($1, $2)",
                [slug, code],
            );
            res.status(201).json({ slug });
            return;
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "23505") continue; // unique violation — retry
            console.error("[workspaces] insert failed:", err);
            res.status(500).json({ error: "failed to save workspace" });
            return;
        }
    }
    res.status(500).json({ error: "could not allocate slug" });
});

workspacesRouter.get("/:slug", async (req: Request, res: Response) => {
    const slug = req.params.slug;
    if (!/^[A-Za-z0-9]{4,32}$/.test(slug)) {
        res.status(400).json({ error: "invalid slug" });
        return;
    }
    const pool = getPool()!;
    try {
        const result = await pool.query<{ code: string; created_at: Date }>(
            "SELECT code, created_at FROM workspaces WHERE slug = $1",
            [slug],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ error: "workspace not found" });
            return;
        }
        const row = result.rows[0];
        res.json({ slug, code: row.code, createdAt: row.created_at.toISOString() });
    } catch (err) {
        console.error("[workspaces] select failed:", err);
        res.status(500).json({ error: "failed to load workspace" });
    }
});
