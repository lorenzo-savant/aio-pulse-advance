-- Migration: brand_facts — operator-declared "ground truth" facts for
-- claim verification.
--
-- Pairs with AA (cross-engine claim divergence) to close the industry research
-- "find and fix what AI gets wrong about your brand" workflow:
--   1. Operator declares the brand's source-of-truth facts (founded
--      year, HQ city, founder, team size, pricing, funding).
--   2. fact-verifier service scans monitoring_results for AI claims
--      that contradict the declared value and flags them.
--
-- The fact_type enum mirrors ClaimType in src/lib/utils/claim-divergence.ts
-- so the two surfaces line up.

CREATE TABLE IF NOT EXISTS public.brand_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  fact_type text NOT NULL CHECK (fact_type IN (
    'founding_year',
    'headquarters',
    'founder',
    'team_size',
    'pricing',
    'funding'
  )),
  -- The canonical value as the operator wants it cited (e.g. "2018",
  -- "Stockholm", "Jane Doe", "250", "$49", "50M").
  value text NOT NULL,
  -- Free-form notes (source URL, last verified date, etc.).
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Each brand should declare at most one canonical value per fact_type.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_facts_brand_type
  ON public.brand_facts(brand_id, fact_type);

CREATE INDEX IF NOT EXISTS idx_brand_facts_user
  ON public.brand_facts(user_id, updated_at DESC);

ALTER TABLE public.brand_facts ENABLE ROW LEVEL SECURITY;

-- Postgres CREATE POLICY has no IF NOT EXISTS — drop-then-create makes the
-- migration idempotent on re-runs.
DROP POLICY IF EXISTS "users_own_brand_facts" ON public.brand_facts;
CREATE POLICY "users_own_brand_facts" ON public.brand_facts
  FOR ALL USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = (SELECT auth.uid())::text)
  );
