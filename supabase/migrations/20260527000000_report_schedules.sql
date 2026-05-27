-- Migration: report_schedules — operator-defined recurring PDF report
-- delivery. Each schedule is owned by a user, scoped to a brand, with a
-- recipient list (email addresses) + a cadence (daily/weekly/monthly).
-- The /api/cron/report-delivery route picks up rows where next_run_at
-- is due, generates the PDF via the existing /api/reports/pdf service,
-- emails it via Resend (already wired in src/lib/services/email.ts).
--
-- Why not Supabase scheduled functions: the cron pattern follows the
-- existing /api/cron/{monitoring,weekly-review} convention so deploy
-- behaviour stays consistent — operators trigger via Vercel cron / GH
-- Actions / external scheduler hitting the route with CRON_SECRET.

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Cadence: 'daily' | 'weekly' | 'monthly'. Stored as text + CHECK
  -- rather than an enum so future cadences ('biweekly', etc) don't
  -- need a migration.
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  -- Recipient list. Email validation happens at the route layer (Zod);
  -- DB-level constraint stays loose to avoid migration churn.
  recipients text[] NOT NULL DEFAULT '{}',
  -- Optional human label so operators can manage multiple schedules
  -- per brand without confusion ("Monthly to client X", "Weekly to
  -- internal team").
  label text,
  -- Active flag — operators can pause schedules without deleting them
  -- to preserve history of past deliveries.
  is_active boolean NOT NULL DEFAULT true,
  -- next_run_at drives the cron selection. Initialised by the
  -- create-route to "now + 1 minute" so the first send fires on the
  -- next cron tick after creation; subsequent runs roll forward by
  -- the frequency interval after each successful send.
  next_run_at timestamptz NOT NULL DEFAULT (now() + interval '1 minute'),
  last_sent_at timestamptz,
  -- Diagnostic fields. last_error captures the last delivery error
  -- (Resend failure, PDF generation failure, etc) so the operator UI
  -- can show what went wrong without trawling logs.
  last_error text,
  send_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the cron sweep: "find due active schedules ordered by
-- next_run_at" is the hot path.
CREATE INDEX IF NOT EXISTS idx_report_schedules_due
  ON public.report_schedules(next_run_at)
  WHERE is_active = true;

-- Per-brand and per-user list queries (the operator UI).
CREATE INDEX IF NOT EXISTS idx_report_schedules_brand_id
  ON public.report_schedules(brand_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_user_id
  ON public.report_schedules(user_id);

-- Updated_at trigger — keep the column honest without app-layer reads.
CREATE OR REPLACE FUNCTION public.tg_report_schedules_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_schedules_updated_at ON public.report_schedules;
CREATE TRIGGER trg_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_report_schedules_set_updated_at();

-- Row Level Security: operators see only their own schedules.
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_schedules_select_own ON public.report_schedules;
CREATE POLICY report_schedules_select_own
  ON public.report_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS report_schedules_insert_own ON public.report_schedules;
CREATE POLICY report_schedules_insert_own
  ON public.report_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS report_schedules_update_own ON public.report_schedules;
CREATE POLICY report_schedules_update_own
  ON public.report_schedules
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS report_schedules_delete_own ON public.report_schedules;
CREATE POLICY report_schedules_delete_own
  ON public.report_schedules
  FOR DELETE
  USING (auth.uid() = user_id);
