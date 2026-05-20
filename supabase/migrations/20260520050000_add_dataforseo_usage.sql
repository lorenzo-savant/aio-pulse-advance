-- Migration: DataForSEO API monthly usage tracking
-- Mirrors brave_api_usage / serpapi_usage patterns. Backs the per-call
-- monthly counter + spending cap awareness for the DataForSEO narrow
-- scope (Google AI Overview, Knowledge Graph, PAA, keyword volume).
--
-- Why we need it:
--   DFS bills pay-as-you-go (~$0.001-0.003/query). The strategy v2 sets a
--   $20/mo spending cap on the DFS dashboard, but we ALSO want server-side
--   counting so we can:
--     - Display "DFS calls this month: X / cap Y" in the operator dashboard
--     - Refuse new calls gracefully if the cap is approached (cache hit?)
--     - Audit scope creep — if a single endpoint suddenly burns 70% of the
--       monthly quota, that's a signal something is misrouted away from
--       Brave (the free primary).
--
-- DFS doesn't have a per-key model like SerpApi/Brave; it's a single
-- login+password pair. We keep the same (month, key_index) shape for
-- consistency with brave_api_usage and serpapi_usage — key_index will
-- always be 0.

CREATE TABLE IF NOT EXISTS public.dataforseo_usage (
  month      text    NOT NULL,
  key_index  integer NOT NULL DEFAULT 0,
  count      integer NOT NULL DEFAULT 0,
  /** Estimated cost in cents — DFS bills pay-as-you-go so unlike Brave/SerpApi
      we want a money signal too, not just a count. */
  cost_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, key_index)
);

CREATE INDEX IF NOT EXISTS idx_dataforseo_usage_month ON public.dataforseo_usage(month);

ALTER TABLE public.dataforseo_usage ENABLE ROW LEVEL SECURITY;

-- Atomic upsert + increment of count and cost. Pass p_cost_cents = 0 if
-- the caller only wants to count (e.g. pre-paid endpoints).
CREATE OR REPLACE FUNCTION public.increment_dataforseo_usage(
  p_month      text,
  p_key_index  integer,
  p_cost_cents integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.dataforseo_usage (month, key_index, count, cost_cents, updated_at)
  VALUES (p_month, p_key_index, 1, COALESCE(p_cost_cents, 0), now())
  ON CONFLICT (month, key_index)
  DO UPDATE SET count      = public.dataforseo_usage.count + 1,
                cost_cents = public.dataforseo_usage.cost_cents + COALESCE(p_cost_cents, 0),
                updated_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;
