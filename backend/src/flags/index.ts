// Feature-flag cache + admin CRUD. Single source of truth is the
// `feature_flags` table; this module keeps an in-memory snapshot refreshed
// on boot and after admin mutations.
//
// Load-once policy (no polling). With a single backend task, an admin's
// PUT refreshes its own cache and every subsequent request sees the new
// value. If we ever run >1 task, revisit with a 30s poll.
//
// `isEnabled(name, default)` auto-creates the row on first call so adding
// a new flag in code is a single line; it shows up in /admin immediately
// for someone to flip.
//
// Failure mode: if the DB is down on boot, the cache is empty and every
// `isEnabled` call returns its passed default. Never throws.
import { Pool } from "pg";
import { getPool } from "../db";

export interface FlagRow {
    name: string;
    enabled: boolean;
    description: string | null;
    updatedAt: string;
    updatedBy: string | null;
}

let cache = new Map<string, FlagRow>();
/** Names we've seen a miss for, so we only auto-create + log once. */
const autoCreated = new Set<string>();

// node-postgres returns TIMESTAMPTZ as a string by default; some configs
// (custom type parsers) hand back a Date. Accept either.
function toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return new Date(value).toISOString();
    throw new Error(`unexpected timestamp value: ${String(value)}`);
}

function mapRow(row: Record<string, unknown>): FlagRow {
    return {
        name: row.name as string,
        enabled: Boolean(row.enabled),
        description: (row.description as string | null) ?? null,
        updatedAt: toIsoString(row.updated_at),
        updatedBy: (row.updated_by as string | null) ?? null,
    };
}

export async function loadFlags(): Promise<void> {
    const pool = getPool();
    if (!pool) return;
    try {
        const res = await pool.query<Record<string, unknown>>(
            "SELECT name, enabled, description, updated_at, updated_by FROM feature_flags",
        );
        const next = new Map<string, FlagRow>();
        for (const row of res.rows) {
            const mapped = mapRow(row);
            next.set(mapped.name, mapped);
        }
        cache = next;
        console.log(`[flags] loaded ${cache.size} flag(s)`);
    } catch (err) {
        console.error("[flags] load failed:", err);
    }
}

/** Synchronous read. Returns the cached value if we know the flag, else
 *  schedules an auto-create + insert in the background and returns the
 *  default. Hot-path safe — never blocks. */
export function isEnabled(name: string, defaultValue = false): boolean {
    const cached = cache.get(name);
    if (cached) return cached.enabled;
    if (!autoCreated.has(name)) {
        autoCreated.add(name);
        void autoCreate(name, defaultValue);
    }
    return defaultValue;
}

async function autoCreate(name: string, defaultValue: boolean): Promise<void> {
    const pool = getPool();
    if (!pool) return;
    try {
        // ON CONFLICT DO NOTHING in case a concurrent caller beat us to it.
        await pool.query(
            `INSERT INTO feature_flags (name, enabled)
             VALUES ($1, $2)
             ON CONFLICT (name) DO NOTHING`,
            [name, defaultValue],
        );
        // Re-load the row into the cache so the next caller gets it.
        const res = await pool.query<Record<string, unknown>>(
            "SELECT name, enabled, description, updated_at, updated_by FROM feature_flags WHERE name = $1",
            [name],
        );
        if (res.rowCount && res.rowCount > 0) {
            cache.set(name, mapRow(res.rows[0]));
            console.log(`[flags] auto-created "${name}" (default ${defaultValue})`);
        }
    } catch (err) {
        console.error(`[flags] auto-create of "${name}" failed:`, err);
    }
}

export function listFlags(): FlagRow[] {
    return [...cache.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Compact public view: { name: enabled } map. Client-consumed. */
export function publicFlagsMap(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const row of cache.values()) out[row.name] = row.enabled;
    return out;
}

export async function setFlag(
    pool: Pool,
    name: string,
    enabled: boolean,
    updatedBy: string,
    description?: string,
): Promise<FlagRow> {
    const res = await pool.query<Record<string, unknown>>(
        `INSERT INTO feature_flags (name, enabled, description, updated_at, updated_by)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (name) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             description = COALESCE(EXCLUDED.description, feature_flags.description),
             updated_at = now(),
             updated_by = EXCLUDED.updated_by
         RETURNING name, enabled, description, updated_at, updated_by`,
        [name, enabled, description ?? null, updatedBy],
    );
    const row = mapRow(res.rows[0]);
    cache.set(row.name, row);
    return row;
}

export async function deleteFlag(pool: Pool, name: string): Promise<void> {
    await pool.query("DELETE FROM feature_flags WHERE name = $1", [name]);
    cache.delete(name);
    autoCreated.delete(name);
}
