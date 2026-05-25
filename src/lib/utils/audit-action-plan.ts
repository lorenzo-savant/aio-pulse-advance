// PATH: src/lib/utils/audit-action-plan.ts
//
// Pure prioritiser that turns a Content Audit result into an ordered
// action plan: "Today / This week / This month / Backlog".
//
// Closes the gap from the Semrush "AI search optimization next steps":
//   "Today (30 minutes): Find 2-3 statistics for an article and add them.
//    This week: Rewrite 3-5 key headings as questions. Add one specific
//    statistic, result, or case study to your author bio. Run your top
//    topic through an AI tool to see sub-questions… etc."
//
// The audit already produces ~12 deterministic checks per page across
// 7 categories. Lots of signal, but no opinion about what to do FIRST.
// This util fixes that: each failed/warning check is scored by
// (impact × ease) and dropped into the right time bucket.
//
// Pure, no network. Same posture as the rest of the cheap-win utils.

import type { AuditResult, AuditCheck } from '@/lib/services/technical-seo-audit'

export type ActionBucket = 'today' | 'thisWeek' | 'thisMonth' | 'backlog'

export interface AuditAction {
  id: string
  /** The audit check id this action originates from. */
  checkId: string
  /** Audit category — used for "group by area" in the UI. */
  category: string
  /** Short imperative action (e.g. "Add JSON-LD Article schema"). */
  title: string
  /** One-line rationale — surface why this is worth doing. */
  why: string
  /** 0-100, higher = bigger expected uplift to AI visibility. */
  impact: number
  /** 0-100, higher = easier (less time / coordination needed). */
  ease: number
  /** impact × ease / 100 — single sortable score. */
  priorityScore: number
  bucket: ActionBucket
}

interface CheckPriorityMeta {
  /** The action sentence shown to the user. */
  title: string
  /** Why this matters. */
  why: string
  impact: number
  ease: number
}

// ─── Per-check action metadata ─────────────────────────────────────────────
// Map known audit check ids to their action sentence + impact/ease scores.
// Unknown check ids fall back to a generic action with mid-low impact.

const CHECK_META: Record<string, CheckPriorityMeta> = {
  // AI crawler access — high impact, easy to fix.
  'ai-crawler-gptbot': {
    title: 'Allow GPTBot in robots.txt',
    why: 'GPTBot is OpenAI’s ChatGPT crawler — blocking it removes you from one of the largest AI surfaces.',
    impact: 90,
    ease: 85,
  },
  'ai-crawler-claudebot': {
    title: 'Allow ClaudeBot in robots.txt',
    why: 'ClaudeBot is Anthropic’s crawler — blocking it means Claude can’t cite your pages.',
    impact: 75,
    ease: 85,
  },
  'ai-crawler-perplexitybot': {
    title: 'Allow PerplexityBot in robots.txt',
    why: 'Perplexity has its own crawler and pulls citations live — blocking it makes you invisible there.',
    impact: 75,
    ease: 85,
  },
  'ai-crawler-google-extended': {
    title: 'Allow Google-Extended in robots.txt',
    why: 'Google-Extended controls Gemini + AI Overview access to your content.',
    impact: 85,
    ease: 85,
  },
  'ai-crawler-anthropic-ai': {
    title: 'Allow anthropic-ai in robots.txt',
    why: 'Legacy Anthropic crawler token — keep it allowed for older Claude versions.',
    impact: 50,
    ease: 85,
  },
  'ai-crawler-ccbot': {
    title: 'Allow CCBot in robots.txt',
    why: 'CCBot feeds Common Crawl — the dataset most LLMs train on.',
    impact: 60,
    ease: 85,
  },

  // llms.txt
  'llms-txt-exists': {
    title: 'Publish an llms.txt file',
    why: 'A root-level llms.txt is the emerging standard for telling LLMs what your site is about.',
    impact: 60,
    ease: 75,
  },
  'llms-txt-content': {
    title: 'Expand llms.txt to ≥100 chars with headings',
    why: 'A thin llms.txt isn’t useful — LLMs need a short Markdown overview to actually leverage it.',
    impact: 40,
    ease: 80,
  },
  'llms-txt-structure': {
    title: 'Add Markdown headings to llms.txt',
    why: 'Headings make the file machine-parseable so LLMs can find the right section.',
    impact: 30,
    ease: 90,
  },

  // Schema
  'schema-organization': {
    title: 'Add Organization JSON-LD',
    why: 'Organization schema is the strongest entity signal a site can send LLMs.',
    impact: 70,
    ease: 70,
  },
  'schema-website': {
    title: 'Add WebSite JSON-LD',
    why: 'Establishes the site identity + sitelinks search box potential.',
    impact: 40,
    ease: 75,
  },
  'schema-breadcrumblist': {
    title: 'Add BreadcrumbList JSON-LD',
    why: 'Helps LLMs reconstruct your site hierarchy when citing pages.',
    impact: 35,
    ease: 75,
  },
  'schema-faqpage': {
    title: 'Add FAQPage schema to Q&A content',
    why: 'FAQPage entries map directly to AI Overview + featured snippet extraction.',
    impact: 65,
    ease: 60,
  },
  'schema-article': {
    title: 'Add Article JSON-LD to blog/news posts',
    why: 'Article schema with author + dateModified is one of the strongest recency signals for AI.',
    impact: 60,
    ease: 65,
  },

  // Meta + structure
  'meta-title': {
    title: 'Add or shorten <title> to ≤60 chars',
    why: 'Title is the first thing LLMs read; missing or truncated titles cost citations.',
    impact: 80,
    ease: 90,
  },
  'meta-description': {
    title: 'Add a 70–160 char meta description',
    why: 'AI engines often paraphrase the meta description into the citation snippet.',
    impact: 60,
    ease: 90,
  },
  'meta-canonical': {
    title: 'Add a canonical link tag',
    why: 'Canonicals prevent LLMs from citing duplicate versions of your content.',
    impact: 35,
    ease: 90,
  },

  // Security
  'sec-https': {
    title: 'Serve the page over HTTPS',
    why: 'HTTP-only pages are de-prioritised by every modern crawler — AI included.',
    impact: 75,
    ease: 30,
  },
  'sec-hsts': {
    title: 'Set Strict-Transport-Security header',
    why: 'Locks down HTTPS — minor signal but cheap to add.',
    impact: 15,
    ease: 60,
  },
  'sec-csp': {
    title: 'Set a Content-Security-Policy header',
    why: 'Improves trust signals; some AI evaluators weight security headers.',
    impact: 15,
    ease: 40,
  },
  'sec-xcto': {
    title: 'Set X-Content-Type-Options: nosniff',
    why: 'One-line header that improves the trust posture.',
    impact: 10,
    ease: 95,
  },

  // Content structure (the new AEO checks)
  'content-hreflang': {
    title: 'Add hreflang annotations for multi-locale pages',
    why: 'AI engines cite the locale-appropriate version when hreflang is present.',
    impact: 25,
    ease: 50,
  },
  'content-multi-h1': {
    title: 'Keep a single H1 per page',
    why: 'Multiple H1s confuse AI about the page topic and split extraction.',
    impact: 30,
    ease: 85,
  },
  'content-img-alt': {
    title: 'Add alt-text to images',
    why: 'Alt-text feeds the page’s entity signal and helps AI multimedia results.',
    impact: 25,
    ease: 75,
  },
  'content-meta-robots': {
    title: 'Remove noindex from indexable pages',
    why: 'A stray noindex makes you invisible to crawlers AND AI engines.',
    impact: 95,
    ease: 90,
  },
  'content-og': {
    title: 'Complete Open Graph tags (title + description + image)',
    why: 'OG tags are the social/AI preview source; incomplete sets degrade citation cards.',
    impact: 35,
    ease: 85,
  },
  'content-canonical-og': {
    title: 'Make canonical URL match og:url',
    why: 'Mismatch tells AI you’re unsure which version is canonical — cite-rate suffers.',
    impact: 30,
    ease: 80,
  },
  'content-mixed': {
    title: 'Remove HTTP resources from HTTPS pages',
    why: 'Mixed content breaks trust + breaks resources for downstream crawlers.',
    impact: 40,
    ease: 50,
  },
  'content-last-updated': {
    title: 'Add dateModified to JSON-LD + visible "Updated" date',
    why: '95% of ChatGPT citations come from content updated in the last 10 months; dated pages get 1.8× more citations.',
    impact: 80,
    ease: 60,
  },
  'content-answer-first': {
    title: 'Rewrite section openings to lead with the answer',
    why: 'AI engines extract the first sentence under a heading — preambles get skipped.',
    impact: 75,
    ease: 50,
  },
  'content-eeat-markup': {
    title: 'Add author byline + reviewer + original-data signals',
    why: 'E-E-A-T markup correlates with 40%+ uplift in AI source visibility (AirOps study).',
    impact: 70,
    ease: 55,
  },
  'content-zero-click-vulnerability': {
    title: 'Harden vulnerable pages with tables, charts, or original data',
    why: 'Pages flagged "vulnerable" can be replaced by a 40-word AI Overview — add depth + interactivity to keep the click.',
    impact: 55,
    ease: 35,
  },
}

// Generic fallback for unknown check ids.
const DEFAULT_META: CheckPriorityMeta = {
  title: 'Fix this audit finding',
  why: 'Surfaced by the technical SEO + AEO audit — review the message field for the specific fix.',
  impact: 30,
  ease: 50,
}

// ─── Bucket assignment ────────────────────────────────────────────────────
// Today: ease ≥75 (≤30 min fixes)
// This week: ease ≥50 OR impact ≥70 (high-value with some effort)
// This month: everything else
// Backlog: only when failed/warning isn't actionable (e.g. "info" status).

function bucketFor(action: { impact: number; ease: number }): ActionBucket {
  if (action.ease >= 75) return 'today'
  if (action.ease >= 50 || action.impact >= 70) return 'thisWeek'
  return 'thisMonth'
}

function statusSeverityWeight(status: AuditCheck['status']): number {
  // Failures count harder than warnings; info doesn't surface as an action.
  if (status === 'fail') return 1.0
  if (status === 'warning') return 0.7
  return 0 // 'pass' / 'info' — no action needed
}

function flattenChecks(audit: AuditResult): Array<{ category: string; check: AuditCheck }> {
  const out: Array<{ category: string; check: AuditCheck }> = []
  const cats = audit.categories as unknown as Record<string, { checks: AuditCheck[] } | undefined>
  for (const [categoryName, category] of Object.entries(cats)) {
    if (!category?.checks) continue
    for (const check of category.checks) out.push({ category: categoryName, check })
  }
  return out
}

/**
 * Turn a full AuditResult into a prioritised action plan.
 *
 * The plan splits failed / warning checks into 3 time buckets (today /
 * thisWeek / thisMonth) using an impact × ease score that's been
 * curated per check id. Unknown check ids fall back to the generic
 * mid-low priority bucket. Pass + info checks are ignored.
 */
export function prioritizeAuditActions(audit: AuditResult): {
  today: AuditAction[]
  thisWeek: AuditAction[]
  thisMonth: AuditAction[]
  totalActions: number
} {
  const all: AuditAction[] = []
  const checks = flattenChecks(audit)

  for (const { category, check } of checks) {
    const severity = statusSeverityWeight(check.status)
    if (severity === 0) continue
    const meta = CHECK_META[check.id] ?? DEFAULT_META
    const impact = Math.round(meta.impact * severity)
    const ease = meta.ease
    const priorityScore = Math.round((impact * ease) / 100)
    all.push({
      id: `${check.id}-${category}`,
      checkId: check.id,
      category,
      title: meta.title,
      why: meta.why,
      impact,
      ease,
      priorityScore,
      bucket: bucketFor({ impact, ease }),
    })
  }

  all.sort((a, b) => b.priorityScore - a.priorityScore || a.checkId.localeCompare(b.checkId))

  const today = all.filter((a) => a.bucket === 'today')
  const thisWeek = all.filter((a) => a.bucket === 'thisWeek')
  const thisMonth = all.filter((a) => a.bucket === 'thisMonth')

  return {
    today,
    thisWeek,
    thisMonth,
    totalActions: all.length,
  }
}
