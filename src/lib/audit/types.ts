export interface AuditCheck {
  id: string
  category: 'seo' | 'aeo' | 'eeat' | 'technical' | 'freshness'
  name: string
  description: string
  score: number
  status: 'pass' | 'warn' | 'fail'
  details?: string
  fix?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  impact: number
}

export interface SiteAuditResult {
  url: string
  auditedAt: string
  overallScore: number
  seoScore: number
  aeoScore: number
  eeatScore: number
  technicalScore: number
  freshnessScore: number
  geoCitationScore: number
  checks: AuditCheck[]
  summary: string
}

export interface FixBriefItem {
  id: string
  checkId: string
  category: string
  title: string
  description: string
  fix: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  impact: number
  estimatedEffort: '5min' | '15min' | '30min' | '1h' | '2h' | '4h' | '1d' | '10min'
}

export interface FixBrief {
  siteUrl: string
  generatedAt: string
  overallScore: number
  totalIssues: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  items: FixBriefItem[]
}

export interface GeoCitationMetrics {
  score: number
  factors: {
    semanticAuthority: number
    sourceAttribution: number
    contentFreshness: number
    structuredData: number
    entitySalience: number
    trustSignals: number
  }
  recommendations: string[]
}

export interface LlmstxtConfig {
  siteUrl: string
  includePaths?: string[]
  excludePaths?: string[]
  maxUrls?: number
}

export interface FreshnessResult {
  url: string
  hasDatePublished: boolean
  hasDateModified: boolean
  daysSinceModified?: number
  freshnessScore: number
  recommendation?: string
}
