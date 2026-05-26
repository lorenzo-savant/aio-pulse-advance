-- Migration: add homonym-confusion flag to monitoring_results.
--
-- Problem: AI engines can hallucinate a "brand mention" when they actually
-- meant a homonym (Acasting ↔ Acast / "casting"; Savant ↔ "savant" as
-- common adjective; etc). Those false positives inflate Visibility, Share
-- of Voice, and Sentiment metrics. We let an LLM classifier audit each
-- `brand_mentioned = true` row and flag the confused ones, then filter
-- them out at the read path.
--
--   confusion_flag        boolean  → true when the mention is NOT actually
--                                    about this brand (homonym confusion).
--                                    Defaults to false so existing rows
--                                    keep counting until audited.
--   confusion_reason      text     → one-sentence rationale from the
--                                    classifier (e.g. "talks about Acast
--                                    the podcast hosting, not Acasting").
--   confusion_audited_at  timestamp→ when the audit was last run for this
--                                    row. NULL means never audited.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

ALTER TABLE public.monitoring_results
  ADD COLUMN IF NOT EXISTS confusion_flag boolean NOT NULL DEFAULT false;

ALTER TABLE public.monitoring_results
  ADD COLUMN IF NOT EXISTS confusion_reason text;

ALTER TABLE public.monitoring_results
  ADD COLUMN IF NOT EXISTS confusion_audited_at timestamptz;

-- Partial index: only rows that ARE flagged matter for the audit panel
-- ("show me my false-positive mentions"). Tiny on disk, fast on read.
CREATE INDEX IF NOT EXISTS idx_monitoring_results_brand_confusion
  ON public.monitoring_results(brand_id)
  WHERE confusion_flag = true;

-- Pending-audit index: lets the audit job find "brand_mentioned=true,
-- not yet audited" rows cheaply.
CREATE INDEX IF NOT EXISTS idx_monitoring_results_audit_pending
  ON public.monitoring_results(brand_id, created_at DESC)
  WHERE brand_mentioned = true AND confusion_audited_at IS NULL;
