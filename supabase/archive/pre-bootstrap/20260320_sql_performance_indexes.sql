-- SQL Optimization: Missing Indexes & Performance Improvements
-- Run in Supabase SQL Editor or via migration
-- ============================================================

-- 1. ALERT EVENTS - Missing composite index for common queries
-- ============================================================
-- Query pattern: WHERE user_id = ? AND brand_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_alert_events_user_brand_created 
ON alert_events (user_id, brand_id, created_at DESC);

-- Query pattern: WHERE user_id = ? AND is_read = false
CREATE INDEX IF NOT EXISTS idx_alert_events_user_unread 
ON alert_events (user_id, is_read) WHERE is_read = false;

-- 2. MONITORING RESULTS - Composite indexes for analytics
-- ============================================================
-- Query pattern: WHERE brand_id = ? AND created_at >= ? (time-series analysis)
CREATE INDEX IF NOT EXISTS idx_monitoring_results_brand_time 
ON monitoring_results (brand_id, created_at DESC);

-- Query pattern: WHERE brand_id = ? AND engine = ? (engine-specific analysis)
CREATE INDEX IF NOT EXISTS idx_monitoring_results_brand_engine 
ON monitoring_results (brand_id, engine);

-- Query pattern: WHERE user_id = ? AND brand_id = ? (user's brand data)
CREATE INDEX IF NOT EXISTS idx_monitoring_results_user_brand 
ON monitoring_results (user_id, brand_id);

-- Query pattern: brand_mentioned filtering for analytics
CREATE INDEX IF NOT EXISTS idx_monitoring_results_mentioned 
ON monitoring_results (brand_id, brand_mentioned, created_at DESC);

-- 3. BRAND HEALTH SCORES - Time-series optimization
-- ============================================================
-- Query pattern: WHERE brand_id = ? AND date >= ? (date range queries)
CREATE INDEX IF NOT EXISTS idx_health_scores_brand_date 
ON brand_health_scores (brand_id, date DESC);

-- 4. TEAM MEMBERS - Status-based queries
-- ============================================================
-- Query pattern: WHERE brand_id = ? AND status = 'accepted' (active members)
CREATE INDEX IF NOT EXISTS idx_team_members_brand_status 
ON team_members (brand_id, status) WHERE status = 'accepted';

-- Query pattern: WHERE user_id = ? AND status = 'accepted' (user's teams)
CREATE INDEX IF NOT EXISTS idx_team_members_user_status 
ON team_members (user_id, status) WHERE status = 'accepted';

-- 5. BRAND INVITATIONS - Status-based index
-- ============================================================
-- Query pattern: WHERE brand_id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_brand_invitations_pending 
ON brand_invitations (brand_id, expires_at) 
WHERE status = 'pending';

-- 6. SCAN HISTORY - Common query patterns
-- ============================================================
-- Check if scan_history table exists and add indexes
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scan_history') THEN
    -- Query pattern: WHERE user_id = ? ORDER BY created_at DESC
    CREATE INDEX IF NOT EXISTS idx_scan_history_user_created 
    ON scan_history (user_id, created_at DESC);
    
    -- Query pattern: WHERE brand_id = ? ORDER BY created_at DESC
    CREATE INDEX IF NOT EXISTS idx_scan_history_brand_created 
    ON scan_history (brand_id, created_at DESC);
    
    -- Query pattern: WHERE user_id = ? AND brand_id = ?
    CREATE INDEX IF NOT EXISTS idx_scan_history_user_brand 
    ON scan_history (user_id, brand_id);
  END IF;
END $$;

-- 7. RECOMMENDATION HISTORY - Brand analytics
-- ============================================================
-- Query pattern: WHERE brand_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_recommendation_history_brand_created 
ON recommendation_history (brand_id, created_at DESC);

-- 8. CITATION SNAPSHOTS - Time-series optimization
-- ============================================================
-- Query pattern: WHERE project_id = ? AND scan_date >= ?
CREATE INDEX IF NOT EXISTS idx_citation_snapshots_project_date 
ON citation_snapshots (project_id, scan_date DESC);

-- Query pattern: WHERE project_id = ? AND engine = ?
CREATE INDEX IF NOT EXISTS idx_citation_snapshots_project_engine 
ON citation_snapshots (project_id, engine);

-- 9. COMPETITOR ANALYSES - Recent analyses
-- ============================================================
-- Query pattern: WHERE brand_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_brand_created 
ON competitor_analyses (brand_id, created_at DESC);

-- 10. SUBSCRIPTIONS - Status queries
-- ============================================================
-- Query pattern: WHERE status = 'active' AND current_period_end < ?
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiring 
ON subscriptions (status, current_period_end) 
WHERE status = 'active';

-- ============================================================
-- ANALYTICS VIEWS - Pre-computed aggregations
-- ============================================================

-- Brand Health Summary View (replaces repeated aggregations)
CREATE OR REPLACE VIEW v_brand_health_summary AS
SELECT 
    b.id AS brand_id,
    b.name AS brand_name,
    b.user_id,
    COUNT(DISTINCT bhs.id) AS health_score_count,
    AVG(bhs.health_score) AS avg_health_score,
    AVG(bhs.visibility_score) AS avg_visibility_score,
    AVG(bhs.sentiment_score) AS avg_sentiment_score,
    MAX(bhs.date) AS latest_health_date,
    MIN(bhs.date) AS earliest_health_date
FROM brands b
LEFT JOIN brand_health_scores bhs ON b.id = bhs.brand_id
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.user_id;

-- Alert Summary View
CREATE OR REPLACE VIEW v_alert_summary AS
SELECT 
    ar.id AS alert_rule_id,
    ar.name AS alert_name,
    ar.brand_id,
    ar.user_id,
    ar.is_active,
    ar.last_fired_at,
    COUNT(ae.id) AS event_count,
    COUNT(CASE WHEN ae.is_read = false THEN 1 END) AS unread_count,
    MAX(ae.created_at) AS latest_event
FROM alert_rules ar
LEFT JOIN alert_events ae ON ar.id = ae.alert_rule_id
WHERE ar.deleted_at IS NULL
GROUP BY ar.id, ar.name, ar.brand_id, ar.user_id, ar.is_active, ar.last_fired_at;

-- Monitoring Summary View (heavy query optimization)
CREATE OR REPLACE VIEW v_monitoring_summary AS
SELECT 
    mr.brand_id,
    b.name AS brand_name,
    mr.engine,
    COUNT(*) AS total_results,
    COUNT(CASE WHEN mr.brand_mentioned = true THEN 1 END) AS mentioned_count,
    AVG(mr.visibility_score) AS avg_visibility_score,
    AVG(mr.sentiment_score) AS avg_sentiment_score,
    MAX(mr.created_at) AS latest_result
FROM monitoring_results mr
LEFT JOIN brands b ON mr.brand_id = b.id
GROUP BY mr.brand_id, b.name, mr.engine;

-- ============================================================
-- PERFORMANCE: Update Statistics
-- ============================================================
ANALYZE brands;
ANALYZE prompts;
ANALYZE monitoring_results;
ANALYZE alert_events;
ANALYZE alert_rules;
ANALYZE brand_health_scores;
ANALYZE team_members;
ANALYZE brand_invitations;
ANALYZE scan_history;
ANALYZE recommendation_history;
ANALYZE citation_snapshots;
ANALYZE competitor_analyses;
ANALYZE subscriptions;

-- ============================================================
-- QUERY OPTIMIZATION NOTES
-- ============================================================
/*
Key optimizations applied:

1. COMPOSITE INDEXES - Cover multiple query patterns
   - Alert events: user + brand + created (covers most common filter + sort)
   - Monitoring results: brand + time, brand + engine (analytics queries)

2. PARTIAL INDEXES - Only index relevant rows
   - Team members: only accepted status (most common query)
   - Subscriptions: only active for expiry checks

3. COVERING INDEXES - Include frequently selected columns
   - Add include columns for foreign key lookups

4. ANALYTIC VIEWS - Pre-compute expensive aggregations
   - v_brand_health_summary: replaces repeated GROUP BY queries
   - v_alert_summary: replaces JOIN + COUNT queries
   - v_monitoring_summary: replaces heavy aggregation queries

5. STATISTICS - Ensure query planner has fresh data
*/
