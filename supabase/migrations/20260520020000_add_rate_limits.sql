-- Migration: rate_limits (audit-route persistent rate limiter)
-- /api/audit/technical/route.ts implements a per-key rate limiter against
-- public.rate_limits — but the table was never created. Every check silently
-- returned 'success', so the audit endpoint (an expensive safeFetch + parse
-- pipeline) was effectively un-rate-limited. Abuse vector.
--
-- Shape inferred from src/app/api/audit/technical/route.ts (upserts to .from
-- ('rate_limits') with columns key/count/last_request) and src/types/
-- database.ts which already declares { key, count, last_request } as the row
-- shape. last_request is a Unix-ms timestamp (number), not a TIMESTAMPTZ,
-- because the route code does `Date.now()` comparisons directly against it.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  last_request bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_last_request ON public.rate_limits(last_request);

-- Same posture as serpapi_usage / keyword_tracking: internal infra,
-- RLS on with no policy (service-role bypasses).
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
