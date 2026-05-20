-- Migration: Brave Search API monthly usage tracking
-- Mirrors the serpapi_usage pattern (20260519000000) — backs the per-key
-- monthly quota + spending cap enforced by src/lib/services/brave-search.ts.
--
-- Why we need it:
--   Brave Search free tier = 2000 queries/month recurring. The Base paid tier
--   bills at $3/1000 with a dashboard spending cap. Without server-side
--   counting we can't (a) display "queries left" to the user, (b) refuse
--   gracefully when the cap is approached, or (c) implement the cache/dedup
--   layer that depends on a "is this a fresh-quota request" signal.
--
--   Per the consolidated API-strategy decision (May 2026): Brave is the
--   primary SERP provider, NOT SerpApi. SerpApi removal is a follow-up
--   commit; the existing serpapi_usage table stays for now but will be
--   dropped once src/lib/services/serpapi.ts is gone.

CREATE TABLE IF NOT EXISTS public.brave_api_usage (
  month      text    NOT NULL,             -- 'YYYY-MM' UTC, matches currentMonth() helper
  key_index  integer NOT NULL,             -- 0-based index into BRAVE_API_KEYS list (single key normal, multi-key for spending isolation)
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, key_index)
);

CREATE INDEX IF NOT EXISTS idx_brave_api_usage_month ON public.brave_api_usage(month);

-- Internal infra table: only the service-role server client touches it.
-- RLS enabled with no policy => denied for anon/authenticated; service-role
-- bypasses. Same posture as serpapi_usage / rate_limits / webhook_delivery_logs.
ALTER TABLE public.brave_api_usage ENABLE ROW LEVEL SECURITY;

-- Atomic upsert + increment, returns the new count. Mirrors
-- public.increment_serpapi_usage for the same pattern.
CREATE OR REPLACE FUNCTION public.increment_brave_api_usage(
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
  INSERT INTO public.brave_api_usage (month, key_index, count, updated_at)
  VALUES (p_month, p_key_index, 1, now())
  ON CONFLICT (month, key_index)
  DO UPDATE SET count      = public.brave_api_usage.count + 1,
                updated_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;
