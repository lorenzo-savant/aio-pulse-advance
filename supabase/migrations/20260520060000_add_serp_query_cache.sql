-- Migration: SERP query response cache (TTL-based)
--
-- Why we need it (memory/project_api_strategy.md):
--   Brave free tier = 2k queries/mo, DataForSEO billed per-call. The single
--   biggest waste in v1 was re-fetching the same query within minutes from
--   different code paths (e.g. AEO snippet gap-check + daily-tracker hitting
--   the same Brave 'best plumber stockholm' organic SERP back-to-back).
--   This table caches normalized request → JSON response with a TTL so all
--   downstream consumers share the same hit.
--
--   Hit rate target: ≥40% on Brave organic, ≥60% on DFS keyword volume.
--   Spending impact target: cut Brave usage to <1k/mo and DFS to <$10/mo
--   without losing data freshness.
--
-- Shape decisions:
--   - provider: 'brave' | 'dataforseo' (string, no enum — easy to extend)
--   - endpoint: 'web/search' | 'paa' | 'ai-overview' | 'kg' | 'keyword-volume' | ...
--   - query_hash: SHA-256 of normalized {endpoint, params}; we keep the
--     hash (not raw params) as the primary lookup key so the table doesn't
--     bloat with verbose JSON in the index.
--   - params: full request params (jsonb) — kept for audit/debugging
--   - response: full provider response (jsonb)
--   - expires_at: when the row stops being a valid hit; readers MUST check
--     it (we don't have a scheduled job to purge — a cleanup function is
--     provided but reaping is the operator's responsibility)
--
-- Purge cadence: cleanup_expired_serp_cache() is safe to call from any cron
-- (we recommend daily via the existing /api/cron/* surface).

CREATE TABLE IF NOT EXISTS public.serp_query_cache (
  provider    text        NOT NULL,
  endpoint    text        NOT NULL,
  query_hash  text        NOT NULL,
  params      jsonb       NOT NULL,
  response    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  hit_count   integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, endpoint, query_hash)
);

-- Lookup index. The PK already covers (provider, endpoint, query_hash), but
-- the readers also filter `expires_at > now()` so an index on expires_at
-- accelerates the cleanup scan.
CREATE INDEX IF NOT EXISTS idx_serp_query_cache_expires
  ON public.serp_query_cache(expires_at);

ALTER TABLE public.serp_query_cache ENABLE ROW LEVEL SECURITY;

-- Bump hit_count atomically on a cache HIT so we can audit which queries
-- are most reused (operator dashboard signal: "the gap-detect for keyword X
-- was reused 47 times this month — caching saved $0.94").
CREATE OR REPLACE FUNCTION public.serp_cache_register_hit(
  p_provider    text,
  p_endpoint    text,
  p_query_hash  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.serp_query_cache
     SET hit_count = hit_count + 1
   WHERE provider   = p_provider
     AND endpoint   = p_endpoint
     AND query_hash = p_query_hash;
END;
$$;

-- Purge expired rows. Returns number of rows removed for cron-job logging.
CREATE OR REPLACE FUNCTION public.cleanup_expired_serp_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.serp_query_cache
   WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
