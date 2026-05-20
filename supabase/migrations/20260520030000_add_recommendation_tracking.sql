-- Migration: recommendation_tracking
-- Distinct from public.recommendation_history (which DOES exist and is for
-- raw inserts). recommendation_tracking is the dedup / lifecycle / status
-- table — first/last seen dates, occurrence count, implementation status,
-- consistency scoring. Used by 5 routes in src/app/api/archive/* and
-- src/app/api/reports/pdf — without the table, all archive recommendations
-- views return empty and PDF reports omit the recommendations section.
--
-- Shape mirrors src/types/database.ts (already declared in generated types).

CREATE TABLE IF NOT EXISTS public.recommendation_tracking (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  archive_id                      uuid,
  category                        text,
  priority                        text,
  recommendation_text             text NOT NULL,
  source                          text,
  first_seen_date                 timestamptz,
  last_seen_date                  timestamptz,
  occurrence_count                integer NOT NULL DEFAULT 1,
  consistency_score               double precision,
  implementation_status           text NOT NULL DEFAULT 'pending',
  implementation_completion_date  timestamptz,
  notes                           text,
  status                          text NOT NULL DEFAULT 'active',
  user_last_updated_id            text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_brand          ON public.recommendation_tracking(brand_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_brand_status   ON public.recommendation_tracking(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_brand_priority ON public.recommendation_tracking(brand_id, priority);
CREATE INDEX IF NOT EXISTS idx_recommendation_tracking_brand_category ON public.recommendation_tracking(brand_id, category);

-- Same RLS posture as the other internal tables added this session.
ALTER TABLE public.recommendation_tracking ENABLE ROW LEVEL SECURITY;

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_recommendation_tracking_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommendation_tracking_updated_at ON public.recommendation_tracking;
CREATE TRIGGER trg_recommendation_tracking_updated_at
BEFORE UPDATE ON public.recommendation_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_recommendation_tracking_updated_at();
