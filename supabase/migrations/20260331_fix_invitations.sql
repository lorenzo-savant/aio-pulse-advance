-- Fix brand_invitations table
-- Add token column if missing
ALTER TABLE brand_invitations ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
ALTER TABLE brand_invitations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE brand_invitations ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE brand_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Ensure expires_at is not null
ALTER TABLE brand_invitations ALTER COLUMN expires_at SET NOT NULL;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated;

SELECT '✅ Brand invitations table fixed!' as status;
