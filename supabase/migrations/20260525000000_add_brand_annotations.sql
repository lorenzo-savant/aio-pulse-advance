-- Migration: brand_annotations — operator-recorded events on a brand timeline.
--
-- Closes the gap from the Semrush "AI search visibility reporting" piece:
--   "Annotated campaigns, launches, and content updates turn your AI
--    visibility data from a line chart into a narrative. When your
--    citation share jumps two weeks after a content campaign, the
--    annotation makes the causation arguable."
--
-- Each annotation captures a single point-in-time event (content publish,
-- product launch, earned-media spike, competitor move, campaign activation,
-- platform/algo update) so the operator can overlay them on visibility
-- charts and explain peaks and dips to stakeholders.

CREATE TABLE IF NOT EXISTS public.brand_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  -- The event date the annotation refers to (not the row creation date).
  event_date date NOT NULL,
  -- Constrained event taxonomy — keeps UI filters tidy and prevents typos.
  type text NOT NULL CHECK (type IN (
    'content_publish',
    'product_launch',
    'earned_media',
    'competitor_move',
    'campaign',
    'algorithm_update',
    'other'
  )),
  label text NOT NULL,
  -- Optional URL the annotation references (the published article, PR mention,
  -- competitor's comparison page, etc.).
  url text,
  -- Optional free-form notes.
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_annotations_brand_date
  ON public.brand_annotations(brand_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_brand_annotations_user
  ON public.brand_annotations(user_id, created_at DESC);

-- RLS: only the user that owns the brand can read/write the annotation.
ALTER TABLE public.brand_annotations ENABLE ROW LEVEL SECURITY;

-- Postgres CREATE POLICY has no IF NOT EXISTS — drop-then-create makes the
-- migration idempotent on re-runs (DB already partially applied via prior
-- runs / manual SQL).
DROP POLICY IF EXISTS "users_own_brand_annotations" ON public.brand_annotations;
CREATE POLICY "users_own_brand_annotations" ON public.brand_annotations
  FOR ALL USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = (SELECT auth.uid())::text)
  );
