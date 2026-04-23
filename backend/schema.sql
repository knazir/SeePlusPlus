-- Applied at backend boot. Idempotent — IF NOT EXISTS everywhere.
-- When a second schema change lands, add it here (CREATE INDEX IF NOT EXISTS,
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS). If we ever need data backfills
-- or DROPs, graduate to a real migration tool.
CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_created_at_idx ON workspaces (created_at DESC);
