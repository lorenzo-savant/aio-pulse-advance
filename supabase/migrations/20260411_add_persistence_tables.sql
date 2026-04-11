-- ============================================================================
-- Add persistence tables: SEO audit cache, llms.txt versions, weekly reviews,
-- webhook delivery logs
-- ============================================================================

-- ─── SEO Audit Results (cached) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_audit_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  url            TEXT NOT NULL,
  overall_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
  results        JSONB NOT NULL DEFAULT '{}',
  cached_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_audit_results_user ON seo_audit_results(user_id);
CREATE INDEX idx_seo_audit_results_brand ON seo_audit_results(brand_id);
CREATE INDEX idx_seo_audit_results_url ON seo_audit_results(url);
CREATE INDEX idx_seo_audit_results_expires ON seo_audit_results(expires_at);

-- RLS
ALTER TABLE seo_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit results"
  ON seo_audit_results FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert own audit results"
  ON seo_audit_results FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- ─── llms.txt Versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS llms_txt_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  llms_txt       TEXT NOT NULL,
  llms_full_txt  TEXT NOT NULL,
  input_data     JSONB NOT NULL DEFAULT '{}',
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llms_txt_versions_brand ON llms_txt_versions(brand_id);
CREATE INDEX idx_llms_txt_versions_user ON llms_txt_versions(user_id);
CREATE INDEX idx_llms_txt_versions_created ON llms_txt_versions(created_at DESC);

-- RLS
ALTER TABLE llms_txt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own llms versions"
  ON llms_txt_versions FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert own llms versions"
  ON llms_txt_versions FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- ─── Weekly Reviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  week_number  INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  week_start   DATE NOT NULL,
  week_end     DATE NOT NULL,
  metrics      JSONB NOT NULL DEFAULT '{}',
  markdown     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, year, week_number)
);

CREATE INDEX idx_weekly_reviews_brand ON weekly_reviews(brand_id);
CREATE INDEX idx_weekly_reviews_user ON weekly_reviews(user_id);
CREATE INDEX idx_weekly_reviews_created ON weekly_reviews(created_at DESC);

-- RLS
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly reviews"
  ON weekly_reviews FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert own weekly reviews"
  ON weekly_reviews FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- ─── Webhook Delivery Logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_event_id   TEXT NOT NULL,
  alert_rule_id    TEXT NOT NULL,
  url              TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  http_status      INTEGER,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_attempt_at  TIMESTAMPTZ,
  next_retry_at    TIMESTAMPTZ,
  response_body    TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_event ON webhook_delivery_logs(alert_event_id);
CREATE INDEX idx_webhook_logs_rule ON webhook_delivery_logs(alert_rule_id);
CREATE INDEX idx_webhook_logs_status ON webhook_delivery_logs(status);
CREATE INDEX idx_webhook_logs_retry ON webhook_delivery_logs(next_retry_at);

-- RLS
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Webhook logs readable by the user who owns the alert rule
CREATE POLICY "Users can view own webhook logs"
  ON webhook_delivery_logs FOR SELECT
  USING (
    alert_rule_id IN (
      SELECT id::text FROM alert_rules WHERE user_id = (select auth.uid())::text
    )
  );
