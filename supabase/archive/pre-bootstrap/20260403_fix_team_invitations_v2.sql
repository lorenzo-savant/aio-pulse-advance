-- ─── FIX: brand_invitations status column + RLS ───────────────────────────────

-- Assicura che la colonna status esista con default corretto
ALTER TABLE brand_invitations 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
  CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired'));

-- Assicura che accepted_at esista
ALTER TABLE brand_invitations 
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Aggiorna inviti scaduti a status 'expired'
UPDATE brand_invitations 
SET status = 'expired' 
WHERE expires_at < NOW() AND status = 'pending';

-- Indice per query pendenti (performance)
CREATE INDEX IF NOT EXISTS idx_brand_invitations_status_brand 
ON brand_invitations(brand_id, status) WHERE status = 'pending';

-- RLS: service_role gestisce tutto lato server (già bypassato)
-- Aggiunge RLS per il client anon (accept page senza login non ne ha bisogno 
-- perché usa service_role lato server)
DROP POLICY IF EXISTS "brand_invitations_owner_manage" ON brand_invitations;
CREATE POLICY "brand_invitations_owner_manage" ON brand_invitations
  FOR ALL TO authenticated
  USING (
    invited_by = auth.uid()
    OR brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

SELECT '✅ Team invitations fixed!' as status;
