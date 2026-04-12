-- Add ALL missing columns to monitoring_results
-- Run this in Supabase SQL Editor

-- Core columns
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS mention_position INTEGER;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS cited_urls TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS hallucination_flags JSONB DEFAULT '[]';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS mention_type TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS prompt_text TEXT;

-- Execution tracking
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS cost_credits DOUBLE PRECISION;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS primary_provider TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS all_providers TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS failed_providers TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS response_comparison JSONB;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated;

-- Add missing columns to prompts table
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to brands table  
ALTER TABLE brands ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS alert_email TEXT;

-- Ensure RLS is enabled
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies
DROP POLICY IF EXISTS "monitoring_results_select" ON monitoring_results;
DROP POLICY IF EXISTS "monitoring_results_insert" ON monitoring_results;
CREATE POLICY "monitoring_results_select" ON monitoring_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monitoring_results_insert" ON monitoring_results FOR INSERT WITH CHECK (auth.uid() = user_id);

SELECT '✅ All columns added and permissions granted!' as status;
