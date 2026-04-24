// Admin endpoints. All require a signed-in user with users.is_admin = true.
// 404 (not 401/403) on auth failure so anonymous probes can't discover the
// surface.
import { Router, Request, Response } from "express";
import { getPool } from "../db";
import { deleteFlag, listFlags, loadFlags, setFlag } from "../flags";
import { requireAdmin } from "./auth";

const FLAG_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

export const adminRouter: Router = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/flags", (_req: Request, res: Response) => {
    res.json({ flags: listFlags() });
});

adminRouter.put("/flags/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!FLAG_NAME_RE.test(name)) {
        res.status(400).json({ error: "flag name must be kebab-case" });
        return;
    }
    const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : null;
    if (enabled === null) {
        res.status(400).json({ error: "enabled (boolean) is required" });
        return;
    }
    const description =
        typeof req.body?.description === "string"
            ? req.body.description.trim().slice(0, 500)
            : undefined;

    const pool = getPool()!;
    const userId = req.session!.userId!;
    try {
        const row = await setFlag(pool, name, enabled, userId, description);
        res.json({ flag: row });
    } catch (err) {
        console.error("[admin] PUT /flags failed:", err);
        res.status(500).json({ error: "failed to save flag" });
    }
});

adminRouter.delete("/flags/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    if (!FLAG_NAME_RE.test(name)) {
        res.status(400).json({ error: "flag name must be kebab-case" });
        return;
    }
    const pool = getPool()!;
    try {
        await deleteFlag(pool, name);
        res.json({ ok: true });
    } catch (err) {
        console.error("[admin] DELETE /flags failed:", err);
        res.status(500).json({ error: "failed to delete flag" });
    }
});

adminRouter.post("/flags/reload", async (_req: Request, res: Response) => {
    await loadFlags();
    res.json({ ok: true, count: listFlags().length });
});
