-- Migration: keyword_tracking
-- The keyword-tracking pipeline (src/lib/services/keyword-tracker.ts) and the
-- recommendations + keywords API routes all read/write public.keyword_tracking,
-- and src/types/database.ts already declares its shape — but no migration
-- ever created the table. This was a latent bug pre-dating the glossary work
-- (which is when it became more visible).
--
-- Schema mirrors src/types/database.ts plus the upsert in keyword-tracker.ts
-- (which ON CONFLICTs on (brand_id, keyword), so that pair must be unique).

CREATE TABLE IF NOT EXISTS public.keyword_tracking (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id              text,
  keyword              text NOT NULL,
  category             text,
  language             text,
  market               text,
  engines              text[] NOT NULL DEFAULT '{}',
  mention_count        integer NOT NULL DEFAULT 0,
  correlation_score    double precision NOT NULL DEFAULT 0,
  avg_position         double precision,
  cluster              text,
  cluster_generated_at timestamptz,
  is_active            boolean NOT NULL DEFAULT true,
  first_seen           timestamptz,
  last_seen            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keyword_tracking_brand          ON public.keyword_tracking(brand_id);
CREATE INDEX IF NOT EXISTS idx_keyword_tracking_brand_mention  ON public.keyword_tracking(brand_id, mention_count DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_tracking_brand_corr     ON public.keyword_tracking(brand_id, correlation_score DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_tracking_brand_cluster  ON public.keyword_tracking(brand_id, cluster);

-- Same posture as serpapi_usage: server-only table, RLS on with no policy →
-- denied for anon/authenticated, service role bypasses RLS.
ALTER TABLE public.keyword_tracking ENABLE ROW LEVEL SECURITY;

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_keyword_tracking_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keyword_tracking_updated_at ON public.keyword_tracking;
CREATE TRIGGER trg_keyword_tracking_updated_at
BEFORE UPDATE ON public.keyword_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_keyword_tracking_updated_at();
