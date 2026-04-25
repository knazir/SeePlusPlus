// Thin Postgres layer. Single pool, applies schema.sql on init, exposes a
// query helper. Two credential paths:
//   - Local: DATABASE_URL env var (set by docker-compose).
//   - Deployed: WORKSPACES_DB_SECRET env var, which Copilot's `secrets:` block
//     resolves from the workspacesDbSecret CFN export and injects as the
//     full credentials JSON (username/password/host/port/dbname).
//
// If neither is present the pool is null and the persistence routes degrade
// gracefully (503). That keeps the backend bootable in any local setup that
// doesn't care about workspaces.
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool | null {
    return pool;
}

export function dbEnabled(): boolean {
    return pool !== null;
}

interface DbSecret {
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
}

function urlFromSecretJson(json: string): string {
    const s = JSON.parse(json) as DbSecret;
    const password = encodeURIComponent(s.password);
    return `postgres://${s.username}:${password}@${s.host}:${s.port}/${s.dbname}`;
}

function resolveDatabaseUrl(): string | null {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const json = process.env.WORKSPACES_DB_SECRET;
    if (json) return urlFromSecretJson(json);
    return null;
}

export async function initDb(): Promise<void> {
    const url = resolveDatabaseUrl();
    if (!url) {
        console.warn("[db] no DATABASE_URL or WORKSPACES_DB_SECRET — workspace persistence disabled");
        return;
    }

    // RDS in AWS terminates TLS with a certificate that the default Node
    // bundle doesn't trust without adding the AWS CA. Enabling SSL with
    // rejectUnauthorized=false is acceptable here: the traffic stays inside
    // the VPC, we're just not verifying the chain. Tighten later if desired.
    const needsSsl = /rds\.amazonaws\.com/.test(url);
    pool = new Pool({
        connectionString: url,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 5,
    });

    pool.on("error", (err) => {
        console.error("[db] pool error:", err);
    });

    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    // Apply schema in a single transaction so a partial failure (one
    // ALTER TABLE rejected, an out-of-disk error mid-statement) leaves the
    // database in a consistent state rather than half-applied. IF NOT EXISTS
    // covers most reapply scenarios; the transaction handles the rest until
    // a real migration tool lands.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
    console.log("[db] connected and schema applied");
}

export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
