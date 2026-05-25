// PATH: src/lib/utils/citation-worthiness.ts
//
// Classifier that scores how "AI-citation-worthy" one of YOUR OWN pages
// looks, by matching it against the five archetypes Semrush identifies
// in the "AI Citations" piece:
//
//   1. original_research   — surveys, studies, data, "% of users" etc.
//   2. case_study          — concrete customer/usage stories with results
//   3. thought_leadership  — opinion, perspective, "the future of X"
//   4. news                — announcements, releases, dated events
//   5. brand_content       — home, about, product/pricing, services
//
// Plus a 'generic' fallback for pages that don't clearly fit any.
//
// Rationale: AI systems preferentially cite pages that fill gaps their
// pre-trained data can't (per Semrush). This scorer surfaces which of
// your pages already match a cite-worthy archetype + how confident the
// signal is, so the operator knows where to invest editorial effort.
//
// Pure — no network, no LLM, no dependency. Pairs naturally with
// technical-seo-audit.ts (which already pulls title/html for a URL).

export type CitationArchetype =
  | 'original_research'
  | 'case_study'
  | 'thought_leadership'
  | 'news'
  | 'brand_content'
  | 'generic'

export interface CitationWorthiness {
  /** Winning archetype (highest-scoring), or 'generic' when all signals are weak. */
  archetype: CitationArchetype
  /** 0-100 confidence that an AI system would treat this page as cite-worthy. */
  score: number
  /** Human-readable signals that drove the classification. */
  signals: string[]
  /** Raw per-archetype scores (debug / UI sort). */
  archetypeScores: Record<CitationArchetype, number>
}

interface Input {
  url: string
  title?: string
  /** Raw HTML of the page. Optional — URL + title alone yield a low-confidence verdict. */
  html?: string
}

// ---------- Per-archetype heuristic rules ----------

interface Rule {
  /** Slug fragments that appear in the URL path. */
  urlPaths: string[]
  /** Phrases that appear in the <title> (case-insensitive). */
  titlePhrases: string[]
  /** Regex tests run against stripped body text (case-insensitive). */
  bodyTests: RegExp[]
}

const RULES: Record<Exclude<CitationArchetype, 'generic'>, Rule> = {
  original_research: {
    urlPaths: [
      '/research/',
      '/researches/',
      '/study/',
      '/studies/',
      '/report/',
      '/reports/',
      '/survey/',
      '/surveys/',
      '/data/',
      '/whitepaper/',
      '/whitepapers/',
      '/findings/',
      '/insights/',
    ],
    titlePhrases: [
      'study',
      'research',
      'survey',
      'report',
      'findings',
      'analysis of',
      'state of',
      'benchmark',
      'whitepaper',
      'data shows',
      'we analyzed',
      'we surveyed',
    ],
    bodyTests: [
      /\b\d{1,3}(?:[.,]\d+)?\s?%/, // a percentage
      /\b(n\s?=\s?\d+|sample size|respondents|surveyed \d+|we analyzed \d+)\b/i,
      /\bmethodology\b/i,
      /\b(study|research|survey)\b.*\b(conducted|performed|carried out)\b/i,
    ],
  },
  case_study: {
    urlPaths: [
      '/case-study/',
      '/case-studies/',
      '/customers/',
      '/customer-stories/',
      '/success-stories/',
      '/stories/',
      '/use-case/',
      '/use-cases/',
    ],
    titlePhrases: [
      'case study',
      'success story',
      'how we',
      'how they',
      'how i',
      'lessons from',
      'lessons learned',
      'grew by',
      'saved',
      'reduced',
      'increased',
      'scaled',
    ],
    bodyTests: [
      /\b(increased|grew|reduced|saved|scaled|cut|boosted)\b[^.]{0,40}\b(\d{1,4}\s?%|\$\s?\d|\d+\s?(?:x|times))/i,
      /\b(?:challenge|solution|results?)\b[\s\S]{0,200}\b(?:challenge|solution|results?)\b/i,
      /\b(customer|client) (story|success)\b/i,
    ],
  },
  thought_leadership: {
    urlPaths: [
      '/opinion/',
      '/opinions/',
      '/perspective/',
      '/perspectives/',
      '/viewpoint/',
      '/viewpoints/',
      '/essays/',
      '/editorial/',
    ],
    titlePhrases: [
      'the future of',
      'why ',
      'why we',
      'why i',
      "we don't",
      'rethinking',
      'reconsidering',
      'is dead',
      'is broken',
      'opinion',
      'perspective',
      'my take',
      'manifesto',
      'predictions',
      'lessons',
    ],
    bodyTests: [
      /\b(i believe|in my view|in my opinion|i argue|i think|my take)\b/i,
      /\b(we believe|our view|we argue)\b/i,
      /\b(predict|prediction|forecast).{0,40}\b20\d{2}\b/i,
    ],
  },
  news: {
    urlPaths: [
      '/news/',
      '/press/',
      '/press-release/',
      '/press-releases/',
      '/newsroom/',
      '/announcements/',
      '/blog/news/',
    ],
    titlePhrases: [
      'announces',
      'announced',
      'launches',
      'launched',
      'introduces',
      'introduced',
      'unveils',
      'raises ',
      'wins ',
      'named ',
      'acquires',
      'partners with',
    ],
    bodyTests: [
      /\b(today (?:we )?(?:announced|launched|introduced|unveiled))\b/i,
      /\b(?:press release|for immediate release)\b/i,
      /\b(?:on|in)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
    ],
  },
  brand_content: {
    urlPaths: [
      '/about',
      '/about-us',
      '/company',
      '/team',
      '/products',
      '/product',
      '/solutions',
      '/services',
      '/pricing',
      '/plans',
      '/features',
      '/why-',
    ],
    titlePhrases: ['about us', 'about ', 'pricing', 'features', 'why ', 'our team', 'our mission'],
    bodyTests: [/\b(our (?:product|platform|service|mission|team|story))\b/i],
  },
}

// ---------- Scoring ----------

interface ScoreBreakdown {
  archetype: CitationArchetype
  score: number
  signals: string[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitleFromHtml(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return m ? m[1]!.replace(/\s+/g, ' ').trim() : ''
}

function isRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '' || pathname === '/index.html'
}

function scoreOne(
  archetype: Exclude<CitationArchetype, 'generic'>,
  rule: Rule,
  pathname: string,
  title: string,
  body: string,
): ScoreBreakdown {
  const signals: string[] = []
  let score = 0

  const pLower = pathname.toLowerCase()
  for (const seg of rule.urlPaths) {
    if (pLower.includes(seg)) {
      score += 35
      signals.push(`URL path contains "${seg}"`)
      break // one URL hit is enough — don't double-count
    }
  }

  const tLower = title.toLowerCase()
  let titleHits = 0
  for (const phrase of rule.titlePhrases) {
    if (tLower.includes(phrase)) {
      titleHits++
      signals.push(`Title contains "${phrase.trim()}"`)
      if (titleHits >= 2) break // cap to keep score realistic
    }
  }
  score += Math.min(titleHits, 2) * 15

  let bodyHits = 0
  for (const re of rule.bodyTests) {
    if (re.test(body)) {
      bodyHits++
      signals.push(`Body matches /${re.source}/`)
      if (bodyHits >= 2) break
    }
  }
  score += Math.min(bodyHits, 2) * 12

  return { archetype, score, signals }
}

/**
 * Score one of your own pages against the five Semrush "citation-worthy"
 * archetypes. Returns the winning archetype + a 0-100 confidence score.
 *
 * Notes:
 *   - With no body text, max score is ~65 (URL+title only). Bodies are
 *     what gives high-confidence verdicts.
 *   - Root / about / product paths gently bias toward 'brand_content'
 *     even without strong text signals, because that's how an AI engine
 *     will treat the URL too.
 *   - 'generic' is returned when no archetype clears a 25-point floor.
 */
export function scoreCitationWorthiness(input: Input): CitationWorthiness {
  const { url, html = '' } = input
  let pathname = ''
  try {
    pathname = new URL(url.includes('://') ? url : `https://${url}`).pathname
  } catch {
    pathname = ''
  }

  const title = (input.title ?? extractTitleFromHtml(html)).trim()
  const body = html ? stripHtml(html) : ''

  // Empty-input short-circuit: with no URL path AND no title AND no body
  // we have literally nothing to score; return generic at 0.
  if (!pathname && !title && !body) {
    return {
      archetype: 'generic',
      score: 0,
      signals: ['No URL path, title, or body text supplied'],
      archetypeScores: {
        original_research: 0,
        case_study: 0,
        thought_leadership: 0,
        news: 0,
        brand_content: 0,
        generic: 0,
      },
    }
  }

  const breakdowns: ScoreBreakdown[] = (
    Object.keys(RULES) as Array<Exclude<CitationArchetype, 'generic'>>
  ).map((a) => scoreOne(a, RULES[a], pathname, title, body))

  // Root-path bias: a bare homepage usually IS brand_content even when
  // the title doesn't say "about". Small bump, not a coup.
  if (isRootPath(pathname)) {
    const brand = breakdowns.find((b) => b.archetype === 'brand_content')!
    brand.score += 15
    brand.signals.push('URL is site root')
  }

  // Tie-break order: case_study > original_research > news >
  // thought_leadership > brand_content. Reflects how rare and valuable
  // each archetype is for AI citations.
  const tieOrder: CitationArchetype[] = [
    'case_study',
    'original_research',
    'news',
    'thought_leadership',
    'brand_content',
  ]
  breakdowns.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return tieOrder.indexOf(a.archetype) - tieOrder.indexOf(b.archetype)
  })

  const winner = breakdowns[0]!
  const archetypeScores: Record<CitationArchetype, number> = {
    original_research: 0,
    case_study: 0,
    thought_leadership: 0,
    news: 0,
    brand_content: 0,
    generic: 0,
  }
  for (const b of breakdowns) archetypeScores[b.archetype] = b.score

  // Confidence floor: below 25 → generic. Otherwise clip to 100.
  if (winner.score < 25) {
    return {
      archetype: 'generic',
      score: winner.score,
      signals:
        winner.signals.length > 0
          ? winner.signals
          : ['No strong archetype signals detected — content reads as generic'],
      archetypeScores,
    }
  }
  return {
    archetype: winner.archetype,
    score: Math.min(100, winner.score),
    signals: winner.signals,
    archetypeScores,
  }
}
