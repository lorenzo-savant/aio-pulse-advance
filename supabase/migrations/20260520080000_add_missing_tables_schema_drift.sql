-- Migration: Create the 9 tables that exist in Prisma schema (and/or are
-- referenced by application code) but were never provisioned in Supabase.
--
-- Background:
--   When we regenerated src/types/database.ts from the live DB in the
--   schema-drift round, tsc surfaced 79 errors across routes that query
--   these tables via `as any` casts. Reverting the regen kept compilation
--   green but left the runtime broken: routes calling keyword_research,
--   ai_conversations, scraper_configs, etc. error out with "relation does
--   not exist" the moment they're hit.
--
-- Scope of this migration (Prisma-defined → DDL transcribed from
-- prisma/schema.prisma; checked field-by-field):
--   1. keyword_rankings  — serp-tracker.ts active consumer
--   2. gsc_performance   — gsc-sync.ts, /api/gsc
--   3. keyword_research  — keyword-refresh.ts, /api/keywords
--   4. scraper_configs   — brightdata-sync.ts
--   5. report_templates  — Prisma-defined, no live consumer yet
--   6. report_deliveries — Prisma-defined, no live consumer yet
--   7. ai_conversations  — agent-memory.ts active consumer
--   8. ai_messages       — agent-memory.ts active consumer
--   9. security_logs     — /api/errors + /api/security/csp-report
--      (no Prisma model — schema inferred from the two insert call sites)
--
-- Out of scope (deferred to a dedicated PR — `archive_*` feature family):
--   research_archives, archive_audit_log, brand_snapshots,
--   sentiment_history, query_export_jobs. These belong to an in-progress
--   research-archive UI under /api/archive/* and don't have Prisma
--   definitions yet; guessing their schema would risk locking us into the
--   wrong shape.
--
-- RLS: enabled on every table with deny-by-default (no policies created
-- here). All access goes through the service-role server client, which
-- bypasses RLS. End-user routes already enforce ownership via brand /
-- workspace checks in the application layer. If we add direct browser →
-- Supabase access later, policies go in a follow-up migration.
--
-- Triggers: updated_at populated automatically via the public.update_updated_at()
-- function created earlier (migration 20260520070000). Tables without an
-- updated_at column don't need a trigger.

-- ─── 1. keyword_rankings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.keyword_rankings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  keyword             text NOT NULL,
  url                 text,
  position            integer NOT NULL DEFAULT 0,
  search_volume       integer NOT NULL DEFAULT 0,
  intent              text,
  ai_overview_present boolean NOT NULL DEFAULT false,
  ai_overview_cited   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_brand     ON public.keyword_rankings(brand_id);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword   ON public.keyword_rankings(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_created   ON public.keyword_rankings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_position  ON public.keyword_rankings(position);
-- Prisma's @@unique([brandId, keyword, createdAt(sort: Desc)]) — the sort
-- modifier is Prisma-only; the SQL unique index ignores it.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_keyword_rankings_brand_kw_created
  ON public.keyword_rankings(brand_id, keyword, created_at);
ALTER TABLE public.keyword_rankings ENABLE ROW LEVEL SECURITY;

-- ─── 2. gsc_performance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gsc_performance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  date        date NOT NULL,
  query       text,
  page        text,
  country     text NOT NULL DEFAULT 'all',
  device      text NOT NULL DEFAULT 'all',
  clicks      integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr         double precision NOT NULL DEFAULT 0,
  position    double precision NOT NULL DEFAULT 0
);
-- The Prisma unique constraint includes nullable columns (query, page) —
-- Postgres treats NULL ≠ NULL by default, so we use COALESCE in the index
-- to make NULLs distinguishable as a single "empty" value.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gsc_perf_grain
  ON public.gsc_performance(
    brand_id,
    date,
    COALESCE(query, ''),
    COALESCE(page, ''),
    country,
    device
  );
CREATE INDEX IF NOT EXISTS idx_gsc_perf_brand_date ON public.gsc_performance(brand_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_perf_brand_query ON public.gsc_performance(brand_id, query);
CREATE INDEX IF NOT EXISTS idx_gsc_perf_brand_pos   ON public.gsc_performance(brand_id, position);
ALTER TABLE public.gsc_performance ENABLE ROW LEVEL SECURITY;

-- ─── 3. keyword_research ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.keyword_research (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  keyword             text NOT NULL,
  search_volume       integer NOT NULL DEFAULT 0,
  competition         double precision NOT NULL DEFAULT 0,
  cpc                 double precision NOT NULL DEFAULT 0,
  trend               jsonb NOT NULL DEFAULT '[]'::jsonb,
  intent              text,
  keyword_difficulty  integer,
  ai_overview_present boolean NOT NULL DEFAULT false,
  top_10_domains      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keyword_research_brand     ON public.keyword_research(brand_id);
CREATE INDEX IF NOT EXISTS idx_keyword_research_volume    ON public.keyword_research(search_volume DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_research_intent    ON public.keyword_research(intent);
ALTER TABLE public.keyword_research ENABLE ROW LEVEL SECURITY;

-- ─── 4. scraper_configs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraper_configs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  engine               text NOT NULL,
  prompt_text          text NOT NULL,
  language             text NOT NULL DEFAULT 'en',
  market               text NOT NULL DEFAULT 'global',
  country              text NOT NULL DEFAULT 'us',
  is_active            boolean NOT NULL DEFAULT true,
  run_frequency        text NOT NULL DEFAULT 'daily',
  last_run_at          timestamptz,
  last_run_status      text,
  last_run_duration_ms integer,
  cost_credits         double precision NOT NULL DEFAULT 0,
  success_rate         double precision NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
-- Prisma uses @@unique([brandId, engine, promptText(191)]) — the (191) is
-- a MySQL prefix-length hint for indexable VARCHAR(191) keys. On Postgres
-- we hash the prompt_text to keep the index tiny and bounded regardless
-- of prompt length.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_scraper_configs_brand_engine_prompt
  ON public.scraper_configs(brand_id, engine, md5(prompt_text));
CREATE INDEX IF NOT EXISTS idx_scraper_configs_brand   ON public.scraper_configs(brand_id);
CREATE INDEX IF NOT EXISTS idx_scraper_configs_engine  ON public.scraper_configs(engine);
CREATE INDEX IF NOT EXISTS idx_scraper_configs_active  ON public.scraper_configs(is_active);
ALTER TABLE public.scraper_configs ENABLE ROW LEVEL SECURITY;

-- ─── 5. report_templates ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL,  -- weekly, monthly, 30day, 60day, 90day, custom
  language         text NOT NULL DEFAULT 'en',
  sections         jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_charts   boolean NOT NULL DEFAULT true,
  include_tables   boolean NOT NULL DEFAULT true,
  include_raw_data boolean NOT NULL DEFAULT false,
  logo_url         text,
  primary_color    text NOT NULL DEFAULT '#6366f1',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_templates_brand ON public.report_templates(brand_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type  ON public.report_templates(type);
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- ─── 6. report_deliveries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  template_id      uuid REFERENCES public.report_templates(id) ON DELETE SET NULL,
  type             text NOT NULL,  -- weekly, monthly, 30day, 60day, 90day
  language         text NOT NULL DEFAULT 'en',
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  generated_by     text NOT NULL,
  format           text NOT NULL DEFAULT 'pdf',
  file_url         text,
  sent_to          text,
  sent_at          timestamptz,
  status           text NOT NULL DEFAULT 'generated',
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_delta      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_brand  ON public.report_deliveries(brand_id);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_type   ON public.report_deliveries(type);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_period ON public.report_deliveries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_status ON public.report_deliveries(status);
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;

-- ─── 7. ai_conversations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  brand_id   uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  agent_type text NOT NULL DEFAULT 'brand_monitor',
  title      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user       ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_brand      ON public.ai_conversations(brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent_type ON public.ai_conversations(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated    ON public.ai_conversations(updated_at);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- ─── 8. ai_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,
  content         text NOT NULL,
  provider_used   text,
  latency_ms      integer,
  tokens_used     integer,
  cost_estimate   double precision,
  context_data    jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_role         ON public.ai_messages(role);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created      ON public.ai_messages(created_at);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- ─── 9. security_logs (no Prisma model — inferred from /api/errors + CSP) ────
CREATE TABLE IF NOT EXISTS public.security_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,           -- 'client_error' | 'csp_violation' | future event kinds
  user_id    uuid,                    -- nullable; many events are pre-auth or unauth
  brand_id   uuid,                    -- nullable for the same reason
  ip_address text,                    -- v4 / v6 string from getClientIp()
  user_agent text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity   text NOT NULL,           -- 'low' | 'medium' | 'high' | 'critical' | 'warning'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity   ON public.security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_user       ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created    ON public.security_logs(created_at DESC);
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- ─── updated_at triggers for the 5 new tables that have updated_at ───────────
-- update_updated_at() was created in migration 20260520070000; we reuse it.

DROP TRIGGER IF EXISTS keyword_research_updated_at ON public.keyword_research;
CREATE TRIGGER keyword_research_updated_at BEFORE UPDATE ON public.keyword_research
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS scraper_configs_updated_at ON public.scraper_configs;
CREATE TRIGGER scraper_configs_updated_at BEFORE UPDATE ON public.scraper_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS report_templates_updated_at ON public.report_templates;
CREATE TRIGGER report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
