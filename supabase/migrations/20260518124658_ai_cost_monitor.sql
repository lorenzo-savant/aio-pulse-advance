-- AI Cost Monitor: Comprehensive cost tracking and budget management
-- Created: 2026-05-18

-- ai_cost_logs table
CREATE TABLE IF NOT EXISTS ai_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  brand_id UUID,
  provider TEXT NOT NULL,
  model TEXT,
  agent_type TEXT,
  conversation_id UUID,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_credits DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  endpoint TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  budget_alert BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for ai_cost_logs
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_user_id ON ai_cost_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_brand_id ON ai_cost_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_provider ON ai_cost_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_agent_type ON ai_cost_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created_at ON ai_cost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_user_id_created_at ON ai_cost_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_brand_id_created_at ON ai_cost_logs(brand_id, created_at DESC);

-- ai_budgets table
CREATE TABLE IF NOT EXISTS ai_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  brand_id UUID,
  monthly_limit_usd DOUBLE PRECISION NOT NULL DEFAULT 100,
  daily_limit_usd DOUBLE PRECISION,
  alert_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  provider_limits JSONB NOT NULL DEFAULT '{}',
  current_month_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_day_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_alert_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_budgets_user_brand UNIQUE (user_id, brand_id)
);

-- Indexes for ai_budgets
CREATE INDEX IF NOT EXISTS idx_ai_budgets_user_id ON ai_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_brand_id ON ai_budgets(brand_id);

-- RLS policies
ALTER TABLE ai_cost_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;

-- ai_cost_logs policies
CREATE POLICY "Users can view their own cost logs"
  ON ai_cost_logs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own cost logs"
  ON ai_cost_logs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- ai_budgets policies
CREATE POLICY "Users can view their own budgets"
  ON ai_budgets FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON ai_budgets FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own budgets"
  ON ai_budgets FOR UPDATE
  USING (auth.uid()::text = user_id);
