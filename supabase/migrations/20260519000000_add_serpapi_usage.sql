-- Migration: SerpApi monthly usage tracking
-- Backs the per-key monthly quota + key rotation enforced by
-- src/lib/services/serpapi.ts (readUsage / incrementUsage / serpApiFetch).
--
-- Without this table + function the usage counter always reads 0, so
-- SERPAPI_MONTHLY_LIMIT is never reached and rotation-at-limit never fires.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) serpapi_usage — one counter row per (month, key_index)
--    month     : 'YYYY-MM' UTC, matches currentMonth() in serpapi.ts
--    key_index : 0-based index into the SERPAPI_KEYS list
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.serpapi_usage (
  month      text    NOT NULL,
  key_index  integer NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, key_index)
);

CREATE INDEX IF NOT EXISTS idx_serpapi_usage_month ON public.serpapi_usage(month);

-- Internal infrastructure table: only the service-role server client touches
-- it. RLS enabled with no policy => denied for anon/authenticated, while the
-- service role bypasses RLS (same posture as other server-only tables).
ALTER TABLE public.serpapi_usage ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) increment_serpapi_usage(p_month, p_key_index) -> new count
--    Atomically upserts and increments the counter, returning the new value.
--    Called by incrementUsage() via supabase.rpc(...).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_serpapi_usage(
  p_month     text,
  p_key_index integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.serpapi_usage (month, key_index, count, updated_at)
  VALUES (p_month, p_key_index, 1, now())
  ON CONFLICT (month, key_index)
  DO UPDATE SET count      = public.serpapi_usage.count + 1,
                updated_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;
