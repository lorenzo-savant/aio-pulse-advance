-- Migration: AEO Snippet Generator
-- Stores PAA-driven Q&A snippets generated for a brand, plus per-run metadata.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) aeo_runs — one row per generation run (keyword × brand × timestamp)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.aeo_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  keyword text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  model text,
  questions_count integer NOT NULL DEFAULT 0,
  gap_count integer NOT NULL DEFAULT 0,
  cost_credits numeric(12,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeo_runs_brand ON public.aeo_runs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeo_runs_user ON public.aeo_runs(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) aeo_snippets — Q&A pairs generated from PAA, optionally schema+gap tagged
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.aeo_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.aeo_runs(id) ON DELETE SET NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  answer_model text,
  language text NOT NULL DEFAULT 'en',
  paa_snippet text,
  paa_source_url text,
  schema_jsonld jsonb,
  gap_status text CHECK (gap_status IN ('covered','gap','unknown')) DEFAULT 'unknown',
  covered_url text,
  position integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, keyword, question)
);

CREATE INDEX IF NOT EXISTS idx_aeo_snippets_brand ON public.aeo_snippets(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeo_snippets_run ON public.aeo_snippets(run_id);
CREATE INDEX IF NOT EXISTS idx_aeo_snippets_gap ON public.aeo_snippets(brand_id, gap_status);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — user owns the underlying brand
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.aeo_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeo_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_aeo_runs" ON public.aeo_runs
  FOR ALL USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = (SELECT auth.uid())::text)
  );

CREATE POLICY "users_own_aeo_snippets" ON public.aeo_snippets
  FOR ALL USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = (SELECT auth.uid())::text)
  );
