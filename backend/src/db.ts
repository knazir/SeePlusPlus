// Thin Postgres layer. Single pool, applies schema.sql on init, exposes a
// query helper. Two credential paths:
//   - Local: DATABASE_URL env var (set by docker-compose).
//   - Deployed: workspacesDbSecretArn is set by the Copilot addon; at boot
//     we fetch the JSON secret (username/password/host/port/dbname) and
//     assemble the URL. Task role has secretsmanager:GetSecretValue via the
//     addon's ManagedPolicy.
//
// If neither is present the pool is null and the persistence routes degrade
// gracefully (503). That keeps the backend bootable in any local setup that
// doesn't care about workspaces.
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

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

async function fetchUrlFromSecret(arn: string): Promise<string> {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const resp = await client.send(new GetSecretValueCommand({ SecretId: arn }));
    if (!resp.SecretString) {
        throw new Error(`secret ${arn} has no SecretString`);
    }
    const s = JSON.parse(resp.SecretString) as DbSecret;
    const password = encodeURIComponent(s.password);
    return `postgres://${s.username}:${password}@${s.host}:${s.port}/${s.dbname}`;
}

async function resolveDatabaseUrl(): Promise<string | null> {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const arn = process.env.workspacesDbSecretArn;
    if (arn) return fetchUrlFromSecret(arn);
    return null;
}

export async function initDb(): Promise<void> {
    const url = await resolveDatabaseUrl();
    if (!url) {
        console.warn("[db] no DATABASE_URL or workspacesDbSecretArn — workspace persistence disabled");
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
    await pool.query(sql);
    console.log("[db] connected and schema applied");
}

export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
