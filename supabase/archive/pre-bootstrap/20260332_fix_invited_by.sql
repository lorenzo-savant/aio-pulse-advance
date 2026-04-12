-- Drop foreign key first
ALTER TABLE brand_invitations DROP CONSTRAINT IF EXISTS brand_invitations_invited_by_fkey;

-- Fix invited_by column to accept TEXT (for dev users)
ALTER TABLE brand_invitations ALTER COLUMN invited_by TYPE TEXT;

-- Also fix token to be TEXT not UUID
ALTER TABLE brand_invitations ALTER COLUMN token TYPE TEXT;

SELECT '✅ Fixed!' as status;
