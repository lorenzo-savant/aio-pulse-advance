-- Fase 1 — T07 (workspace hierarchy) + T08 (audit log) + T09 (scoped API keys).
-- IDEMPOTENT: safe to run multiple times. Every CREATE / ALTER is guarded.
--
-- Strategy:
--   1. Create new tables (organizations, organization_members, workspaces,
--      workspace_members, audit_logs).
--   2. Add NULLABLE workspace_id / organization_id columns to brands (and
--      api_keys for org-level ownership).
--   3. Extend api_keys with key_prefix, key_hash, scopes, revoked_at, etc.
--   4. Backfill: every distinct brands.user_id becomes 1 org + 1 default ws,
--      with the user as owner of both. Existing brands are linked.
--   5. Backfill api_keys: grant ALL_SCOPES to legacy keys (preserves access)
--      and link to the user's default org.
--   6. RLS for audit_logs (append-only).
--
-- NOT NULL enforcement on brands.workspace_id / brands.organization_id is
-- DEFERRED to PR 7.7 — only after all app code reads/writes through the new
-- scoping. This migration is fully reversible (drop the new tables + columns).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  owner_id             UUID NOT NULL,
  stripe_customer_id   TEXT,
  stripe_sub_id        TEXT,
  plan                 TEXT NOT NULL DEFAULT 'free',
  status               TEXT NOT NULL DEFAULT 'active',
  current_period_end   TIMESTAMPTZ,
  logo_url             TEXT,
  primary_color        TEXT NOT NULL DEFAULT '#6366f1',
  default_workspace_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS organizations_owner_id_idx ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_deleted_at_idx ON organizations(deleted_at);

CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member',
  invited_by      UUID,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS organization_members_organization_id_idx ON organization_members(organization_id);

CREATE TABLE IF NOT EXISTS workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(organization_id, slug)
);
CREATE INDEX IF NOT EXISTS workspaces_organization_id_idx ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS workspaces_deleted_at_idx ON workspaces(deleted_at);

CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  role         TEXT NOT NULL DEFAULT 'viewer',
  invited_by   UUID,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx ON workspace_members(workspace_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id      UUID,
  actor_id          UUID NOT NULL,
  actor_type        TEXT NOT NULL DEFAULT 'user',
  actor_api_key_id  UUID,
  action            TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  resource_id       TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_ws_created_idx ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add nullable FKs to existing tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE brands ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS organization_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_workspace_id_fkey'
  ) THEN
    ALTER TABLE brands
      ADD CONSTRAINT brands_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_organization_id_fkey'
  ) THEN
    ALTER TABLE brands
      ADD CONSTRAINT brands_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS brands_workspace_id_idx ON brands(workspace_id);
CREATE INDEX IF NOT EXISTS brands_organization_id_idx ON brands(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. api_keys: extend for T09 (scoped + org-level + hashed)
-- ─────────────────────────────────────────────────────────────────────────────

-- Create base table if it never existed (api_keys is brand-new in Prisma but
-- there is no production data — safe to create-or-skip).
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  key             TEXT,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_by UUID;

ALTER TABLE api_keys ALTER COLUMN key DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_organization_id_fkey'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_hash_key'
  ) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS api_keys_organization_id_idx ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_revoked_at_idx ON api_keys(revoked_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill: 1 org + 1 default workspace per existing brands.user_id
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Create org per distinct user_id that has brands.
INSERT INTO organizations (id, name, slug, owner_id, plan, status)
SELECT
  gen_random_uuid(),
  COALESCE(
    (SELECT au.raw_user_meta_data->>'full_name'
       FROM auth.users au WHERE au.id = b.user_id LIMIT 1),
    (SELECT au.email FROM auth.users au WHERE au.id = b.user_id LIMIT 1),
    'Org-' || substr(b.user_id::text, 1, 8)
  ),
  'org-' || substr(b.user_id::text, 1, 8),
  b.user_id,
  COALESCE((SELECT plan FROM subscriptions WHERE user_id = b.user_id LIMIT 1), 'free'),
  COALESCE((SELECT status FROM subscriptions WHERE user_id = b.user_id LIMIT 1), 'active')
FROM (SELECT DISTINCT user_id FROM brands WHERE deleted_at IS NULL) b
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.owner_id = b.user_id)
ON CONFLICT (slug) DO NOTHING;

-- 4b. owner -> organization_members.
INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, o.owner_id, 'owner'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.organization_id = o.id AND om.user_id = o.owner_id
);

-- 4c. Default workspace per org.
INSERT INTO workspaces (organization_id, name, slug)
SELECT o.id, 'Default', 'default'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.organization_id = o.id AND w.slug = 'default'
);

-- 4d. owner -> workspace_members.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, o.owner_id, 'owner'
FROM workspaces w
JOIN organizations o ON o.id = w.organization_id
WHERE w.slug = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = w.id AND wm.user_id = o.owner_id
  );

-- 4e. Set default_workspace_id on org.
UPDATE organizations o
SET default_workspace_id = w.id
FROM workspaces w
WHERE w.organization_id = o.id
  AND w.slug = 'default'
  AND o.default_workspace_id IS NULL;

-- 4f. Backfill workspace_id + organization_id on brands.
UPDATE brands b
SET
  workspace_id = COALESCE(b.workspace_id, (
    SELECT w.id FROM workspaces w
    JOIN organizations o ON o.id = w.organization_id
    WHERE o.owner_id = b.user_id AND w.slug = 'default'
    LIMIT 1
  )),
  organization_id = COALESCE(b.organization_id, (
    SELECT o.id FROM organizations o
    WHERE o.owner_id = b.user_id
    LIMIT 1
  ))
WHERE b.workspace_id IS NULL OR b.organization_id IS NULL;

-- 4g. Sanity check — surfaced as NOTICE, not exception, since columns remain
-- nullable in PR 7.1. PR 7.7 will RAISE EXCEPTION and add NOT NULL.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM brands
  WHERE (workspace_id IS NULL OR organization_id IS NULL)
    AND deleted_at IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'PR 7.1: % active brands still lack workspace/org. Resolve before PR 7.7.', orphan_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill api_keys to org-level + grant all scopes (preserve access)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE api_keys ak
SET organization_id = (
  SELECT o.id FROM organizations o WHERE o.owner_id = ak.user_id LIMIT 1
)
WHERE ak.organization_id IS NULL;

-- Grant ALL scopes to legacy keys so existing integrations keep working.
-- New keys created via UI will pick scopes explicitly.
UPDATE api_keys
SET scopes = ARRAY[
  'read:brands', 'write:brands',
  'read:prompts', 'write:prompts',
  'read:analytics', 'write:webhooks',
  'read:audit', 'manage:api_keys',
  'manage:billing', 'manage:members'
]
WHERE scopes = '{}' OR scopes IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS: audit_logs is APPEND-ONLY for clients.
--    service_role bypasses RLS by design — server-side inserts use it.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs FOR UPDATE USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs FOR DELETE USING (false);

DROP POLICY IF EXISTS "audit_logs_select_org_admin" ON audit_logs;
CREATE POLICY "audit_logs_select_org_admin" ON audit_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "audit_logs_no_client_insert" ON audit_logs;
CREATE POLICY "audit_logs_no_client_insert" ON audit_logs FOR INSERT WITH CHECK (false);

-- Future RLS for organizations / workspaces / members will land in PR 7.3.
-- This migration deliberately stops here so PR 7.1 stays additive-only.

COMMIT;
