-- Add Credit and CreditUsage tables
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  stripe_payment_id TEXT,
  description TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query_id UUID,
  credits_used INTEGER NOT NULL,
  provider TEXT,
  engine TEXT,
  brand_id UUID,
  description TEXT,
  cost_credits DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_expires_at ON credits(expires_at);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON credit_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_brand_id ON credit_usage(brand_id);
