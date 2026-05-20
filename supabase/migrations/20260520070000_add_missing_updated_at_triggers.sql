-- Migration: Add updated_at triggers for models with @updatedAt that were
-- missing a Postgres trigger.
--
-- Problem: Prisma's `@updatedAt` only fires when the row is written through
-- the Prisma client. This codebase reads/writes through the Supabase JS
-- client too, which bypasses Prisma entirely — so `updated_at` stayed frozen
-- at whatever value `@default(now())` set on insert.
--
-- Fix: install `BEFORE UPDATE` triggers on the affected tables so the
-- timestamp is set by the database itself, no matter which client touches
-- the row. Each block is guarded with a `to_regclass` existence check so
-- the migration is safe even if a given table hasn't been provisioned in
-- this environment yet (Prisma models can outpace Supabase migrations).
--
-- Tables already covered by existing migrations / BOOTSTRAP.sql:
--   brands, prompts, subscriptions, team_members, keyword_tracking,
--   recommendation_tracking
--
-- Tables covered by THIS migration (when they exist):
--   organizations, workspaces, keyword_research, scraper_configs,
--   report_templates, ai_conversations, ai_budgets

-- Generic helper. Already created in BOOTSTRAP.sql; ensured here for restored
-- environments and ordering-independent re-application.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  trigger_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations',
    'workspaces',
    'keyword_research',
    'scraper_configs',
    'report_templates',
    'ai_conversations',
    'ai_budgets'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      trigger_name := tbl || '_updated_at';
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, tbl);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
        trigger_name,
        tbl
      );
    END IF;
  END LOOP;
END $$;
