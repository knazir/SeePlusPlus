// Thin repo over the users / user_identities tables. No ORM — the queries
// are small and the table shape is stable.
import { Pool } from "pg";
import { ProviderProfile } from "./providers/provider";

export interface User {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
}

function mapUser(row: Record<string, unknown>): User {
    return {
        id: row.id as string,
        email: row.email as string,
        displayName: (row.display_name as string | null) ?? null,
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
    };
}

/** Comma/semicolon-separated list from env. Case-insensitive, whitespace-
 *  stripped. Empty string → []. */
function adminEmails(): string[] {
    const raw = process.env.ADMIN_EMAILS ?? "";
    return raw
        .split(/[,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/** Whether the given profile should be promoted to admin based on env
 *  config. `dev@localhost` is auto-promoted when DEV_AUTH_IS_ADMIN is set
 *  (defaults to on in development for developer ergonomics). */
function shouldBeAdmin(provider: string, profile: ProviderProfile): boolean {
    if (adminEmails().includes(profile.email.toLowerCase())) return true;
    if (
        provider === "dev" &&
        process.env.NODE_ENV === "development" &&
        (process.env.DEV_AUTH_IS_ADMIN ?? "true") === "true"
    ) {
        return true;
    }
    return false;
}

export async function findUserById(pool: Pool, id: string): Promise<User | null> {
    const res = await pool.query(
        "SELECT id, email, display_name, avatar_url, is_admin FROM users WHERE id = $1",
        [id],
    );
    return res.rowCount === 0 ? null : mapUser(res.rows[0]);
}

/**
 * Find-or-create a user for a given (provider, sub). If the identity already
 * exists, refresh the user's denormalized email/name/avatar — providers are
 * the source of truth for those. If new, create the user and link.
 * Transactional so a half-created row can't happen on a crash mid-upsert.
 */
export async function upsertUserFromProfile(
    pool: Pool,
    provider: string,
    profile: ProviderProfile,
): Promise<User> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const wantsAdmin = shouldBeAdmin(provider, profile);

        const existing = await client.query(
            `SELECT u.id, u.email, u.display_name, u.avatar_url, u.is_admin
             FROM user_identities i
             JOIN users u ON u.id = i.user_id
             WHERE i.provider = $1 AND i.provider_sub = $2`,
            [provider, profile.providerSub],
        );

        if (existing.rowCount && existing.rowCount > 0) {
            const user = mapUser(existing.rows[0]);
            // Refresh last-seen fields from the provider. is_admin is
            // env-driven: promote if ADMIN_EMAILS now includes this user,
            // leave alone otherwise (don't auto-demote — removing from
            // ADMIN_EMAILS is intentional but we want the operator to confirm
            // via SQL or a future admin UI, not have a deploy silently
            // revoke privileges).
            const nextIsAdmin = wantsAdmin ? true : user.isAdmin;
            await client.query(
                `UPDATE users
                 SET email = $2,
                     display_name = $3,
                     avatar_url = $4,
                     is_admin = $5,
                     updated_at = now()
                 WHERE id = $1`,
                [
                    user.id,
                    profile.email,
                    profile.displayName,
                    profile.avatarUrl ?? null,
                    nextIsAdmin,
                ],
            );
            await client.query("COMMIT");
            return {
                ...user,
                email: profile.email,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl ?? null,
                isAdmin: nextIsAdmin,
            };
        }

        const created = await client.query(
            `INSERT INTO users (email, display_name, avatar_url, is_admin)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, display_name, avatar_url, is_admin`,
            [
                profile.email,
                profile.displayName,
                profile.avatarUrl ?? null,
                wantsAdmin,
            ],
        );
        const user = mapUser(created.rows[0]);

        await client.query(
            `INSERT INTO user_identities (provider, provider_sub, user_id)
             VALUES ($1, $2, $3)`,
            [provider, profile.providerSub, user.id],
        );

        await client.query("COMMIT");
        return user;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
