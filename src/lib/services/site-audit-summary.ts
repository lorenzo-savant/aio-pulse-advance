// PATH: src/lib/services/site-audit-summary.ts
//
// Single source of truth for "what's the most recent cached site audit for
// this brand?" Used both by /api/geo-score (inline indicator on the gauge
// card) and by the Strategy Advisor's context builder (so the strategist
// reasons over static readiness + live visibility together).
//
// No new audit engine — this is a thin read over the existing
// seo_audit_results rows produced by /api/audit/technical.

import { createServerClient } from '@/lib/supabase'
import { gradeFor, type GeoGrade } from '@/lib/services/geo-score'
import { logger } from '@/lib/logger'

export interface SiteAuditSummary {
  /** 0–100, the audit's overall score. */
  score: number
  /** Same letter bands as the GEO Score (A/B/C/D/F) for UI consistency. */
  grade: GeoGrade
  /** Audited URL — used to deep-link back into /dashboard/audit. */
  url: string
  cachedAt: string
  expiresAt: string
  /** Up to 3 short labels for failing checks, ordered as the engine reports them. */
  topIssues: string[]
}

interface AuditRow {
  overall_score: number | null
  results: unknown
  url: string
  cached_at: string
  expires_at: string
}

/**
 * Latest non-expired site audit for the given brand. Returns null when no
 * brand-scoped audit row exists — callers should treat that as "no audit yet"
 * (not an error) and surface a "Run site audit" prompt.
 */
export async function loadLatestSiteAuditSummary(
  brandId: string,
): Promise<SiteAuditSummary | null> {
  const db = createServerClient()
  if (!db) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any
    const { data } = (await dbAny
      .from('seo_audit_results')
      .select('overall_score, results, url, cached_at, expires_at')
      .eq('brand_id', brandId)
      .gt('expires_at', new Date().toISOString())
      .order('cached_at', { ascending: false })
      .limit(1)) as { data: AuditRow[] | null }

    const row = data?.[0]
    if (!row) return null

    return {
      score: Math.round(row.overall_score ?? 0),
      grade: gradeFor(row.overall_score ?? 0),
      url: row.url,
      cachedAt: row.cached_at,
      expiresAt: row.expires_at,
      topIssues: extractTopIssues(row.results, 3),
    }
  } catch (e) {
    logger.warn('site-audit-summary: query failed', {
      err: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** Walk the AuditResult structure for failing checks and return short labels. */
export function extractTopIssues(results: unknown, max: number): string[] {
  const out: string[] = []
  if (!results || typeof results !== 'object') return out
  const cats = (results as { categories?: unknown }).categories
  if (!cats || typeof cats !== 'object') return out

  for (const cat of Object.values(cats as Record<string, unknown>)) {
    if (out.length >= max) break
    if (!cat || typeof cat !== 'object') continue
    const checks = (cat as { checks?: unknown }).checks
    if (!Array.isArray(checks)) continue
    for (const check of checks) {
      if (out.length >= max) break
      const c = check as { status?: string; name?: string }
      if (c?.status === 'fail' && typeof c.name === 'string' && c.name.length > 0) {
        out.push(c.name)
      }
    }
  }
  return out
}
