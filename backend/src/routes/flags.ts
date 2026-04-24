// Public flag endpoint. Returns the whole { name: enabled } map — no auth,
// no secrets leaked. See docs-via-chat for why there's no public/internal
// split: the flag *value* is boring; the gated features behind it are what
// requireAdmin protects.
import { Router, Request, Response } from "express";
import { dbEnabled } from "../db";
import { publicFlagsMap } from "../flags";

export const flagsRouter: Router = Router();

flagsRouter.get("/", (_req: Request, res: Response) => {
    if (!dbEnabled()) {
        // No DB → no flags. Return an empty map rather than 503 so the
        // frontend can fall back to defaults and keep rendering.
        res.json({});
        return;
    }
    res.json(publicFlagsMap());
});
