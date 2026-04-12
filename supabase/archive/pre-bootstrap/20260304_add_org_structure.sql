-- Organizations Structure Migration
-- Adds multi-org support to AIO Pulse

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  settings JSONB DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- Create user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'disabled')),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_user_orgs_user_id ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org_id ON user_organizations(organization_id);

-- Add org_id to brands table (for single-org brands, this will be set)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
-- Anyone in the org can view
CREATE POLICY "org_members_view" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND status = 'active')
  );

-- Only owners/admins can update
CREATE POLICY "org_admins_update" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- RLS Policies for user_organizations
-- Users can view their org memberships
CREATE POLICY "users_view_org_memberships" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

-- Users can create membership (handled via invite system)
CREATE POLICY "org_admins_invite" ON user_organizations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Only owners can delete memberships
CREATE POLICY "org_owners_manage_members" ON user_organizations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- Update brands RLS to use organization_id
DROP POLICY IF EXISTS "users_own_brands" ON brands;
CREATE POLICY "users_own_brands" ON brands
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Update subscriptions RLS
DROP POLICY IF EXISTS "users_own_subscription" ON subscriptions;
CREATE POLICY "users_own_subscription" ON subscriptions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Update user_api_keys RLS to use org (commented out - table may not exist)
-- DROP POLICY IF EXISTS "users_own_api_keys" ON user_api_keys;
-- CREATE POLICY "users_own_api_keys" ON user_api_keys
--   FOR ALL USING (
--     user_id::uuid IN (
--       SELECT user_id FROM user_organizations 
--       WHERE organization_id IN (
--         SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
--       ) AND status = 'active'
--     )
--   );

-- Create default organization for existing users
-- Run this separately if you want to migrate existing data
-- INSERT INTO organizations (id, name, slug, created_by)
-- SELECT gen_random_uuid(), 'My Organization', LOWER(user_id), user_id::uuid
-- FROM (SELECT DISTINCT user_id FROM brands) AS b
-- WHERE NOT EXISTS (SELECT 1 FROM user_organizations WHERE user_id = b.user_id::uuid);
