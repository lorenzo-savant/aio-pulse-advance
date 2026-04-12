-- ============================================================================
-- Fix RLS Policy for brand_invitations
-- Removes public access that exposes email addresses
-- Run against: xivmecvzfbnojozgsgxv.supabase.co
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read invitations by token" ON brand_invitations;

-- Create a more restrictive policy:
-- - Brand owners can view/manage their brand's invitations
-- - Team members can view invitations for their brands
-- - Invitation acceptance is handled via token in the API route (not RLS)
CREATE POLICY "Brand owners and team can manage invitations"
  ON brand_invitations FOR ALL
  USING (
    brand_id IN (
      SELECT id FROM brands 
      WHERE user_id = auth.uid()::text
    )
    OR brand_id IN (
      SELECT brand_id FROM team_members 
      WHERE user_id = auth.uid()::text AND status = 'accepted'
    )
  );

-- Note: For invitation acceptance via token, the route handler 
-- (api/invitations/accept/route.ts) uses service role client 
-- which bypasses RLS, so public token lookup works correctly.