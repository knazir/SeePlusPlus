-- Applied at backend boot. Idempotent — IF NOT EXISTS everywhere.
-- When a second schema change lands that can't be expressed with IF NOT
-- EXISTS (e.g. a DROP, a rename, a data backfill), graduate to a real
-- migration tool. Until then, this file is the whole schema.

-- gen_random_uuid() is in core from PG 13+, but pgcrypto provides it on
-- older builds and is harmless on newer ones. Cheap belt-and-braces.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_created_at_idx ON workspaces (created_at DESC);

-- Users: identity-provider-agnostic record. Email/displayName/avatar are
-- the last values seen from any provider; overwritten on subsequent logins.
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT         NOT NULL,
    display_name  TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Links one or more OAuth identities to a single user. Adding a second
-- provider for an existing user (e.g. "link GitHub to my Google account")
-- inserts a new row here; no users-table changes.
CREATE TABLE IF NOT EXISTS user_identities (
    provider      TEXT         NOT NULL,
    provider_sub  TEXT         NOT NULL,
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities (user_id);

-- Sessions: connect-pg-simple's schema. sid is the cookie id, sess is the
-- session JSON blob, expire is when the session becomes invalid.
CREATE TABLE IF NOT EXISTS sessions (
    sid     VARCHAR      PRIMARY KEY,
    sess    JSONB        NOT NULL,
    expire  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire);

-- Attribute workspaces to the user that created them (if any). Nullable
-- so anonymous share links — the v1 default — keep working. Future
-- PUT/DELETE logic checks owner_id against the session user.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workspaces_owner_id_idx ON workspaces (owner_id);

-- Optional display name. When null the UI falls back to the slug. Not
-- unique — two scratch workspaces called "Untitled" is fine; users don't
-- think in namespaces.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS name TEXT;

-- Role bit on users. Promoted from ADMIN_EMAILS env var at sign-in /
-- upsert — never via the UI (that would be a circular-trust nightmare).
-- Single column today; revisit if we ever need >1 role.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Feature flags. Auto-created on first isEnabled() call with default=false
-- so adding a flag in code is a single line. Admins flip them via /admin.
CREATE TABLE IF NOT EXISTS feature_flags (
    name         TEXT         PRIMARY KEY,
    enabled      BOOLEAN      NOT NULL DEFAULT false,
    description  TEXT,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   UUID         REFERENCES users(id) ON DELETE SET NULL
);
