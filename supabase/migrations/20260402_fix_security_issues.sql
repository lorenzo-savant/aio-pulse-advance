-- Security fixes: Enable RLS and create policies

-- Enable RLS
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

-- Credits policies
DROP POLICY IF EXISTS "credits_select" ON public.credits;
DROP POLICY IF EXISTS "credits_insert" ON public.credits;
DROP POLICY IF EXISTS "credits_update" ON public.credits;

CREATE POLICY "credits_select" ON public.credits FOR SELECT TO authenticated USING (true);
CREATE POLICY "credits_insert" ON public.credits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "credits_update" ON public.credits FOR UPDATE TO authenticated USING (true);

-- Credit_usage policies
DROP POLICY IF EXISTS "credit_usage_select" ON public.credit_usage;
DROP POLICY IF EXISTS "credit_usage_insert" ON public.credit_usage;

CREATE POLICY "credit_usage_select" ON public.credit_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "credit_usage_insert" ON public.credit_usage FOR INSERT TO authenticated WITH CHECK (true);

-- Fix v_alert_summary SECURITY DEFINER (drop if not needed, or recreate without SECURITY DEFINER)
DROP VIEW IF EXISTS public.v_alert_summary;

SELECT '✅ Security fixes applied' as result;
