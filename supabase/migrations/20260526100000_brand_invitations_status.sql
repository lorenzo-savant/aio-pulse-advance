-- Migration: add `status` + `accepted_at` to brand_invitations.
--
-- The /api/invitations/accept route implements an atomic pending→accepted
-- claim that requires these two columns. They were referenced in code but
-- never added to the schema, so every invitation acceptance silently
-- failed at the eq('status', 'pending') filter (no row matched, claim
-- "succeeded" with zero rows, user was never added to the team).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS handles partial prior runs (e.g.
-- if status was added manually via dashboard).

ALTER TABLE public.brand_invitations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired'));

ALTER TABLE public.brand_invitations
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Index supports the .eq('status', 'pending') filter in the atomic claim.
CREATE INDEX IF NOT EXISTS idx_brand_invitations_status
  ON public.brand_invitations(brand_id, status)
  WHERE status = 'pending';
