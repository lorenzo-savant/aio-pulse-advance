import { describe, it, expect } from 'vitest'
import { scoreCitationQuality, CITATION_QUALITY_WEIGHTS } from '../services/citation-quality-scorer'

const TIGHT_LEAD =
  'Acasting is a Swedish casting platform. Key takeaway: it matches productions with talent across Stockholm, Göteborg, and Malmö.'

const STRONG_HTML = `<!DOCTYPE html>
<html><head>
<meta name="author" content="Anna Lindberg, PhD">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","jobTitle":"Editor"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Acasting"}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage"}
</script>
</head>
<body>
<article>
<p class="summary">Acasting is a Swedish casting platform. Key takeaway: it matches productions with talent. TL;DR — fast, vetted, GDPR-compliant.</p>
<p>By Anna Lindberg, PhD — Editor at Acasting Magazine.</p>
<h2>How does Acasting work?</h2>
<p>Productions post castings; talent applies via the platform. <a href="https://en.wikipedia.org/wiki/Casting_(performing_arts)">Wikipedia</a> <a href="https://www.iso.org/standard/example">ISO</a></p>
<h2>What does it cost?</h2>
<ul><li>Free tier for individual talent</li><li>Production plans from 990 SEK</li></ul>
<h2>Who is it for?</h2>
<ol><li>Casting directors</li><li>Production houses</li><li>Independent talent</li></ol>
<h3>Pricing comparison</h3>
<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Free</td><td>0</td></tr></table>
<h2>Where is the data hosted?</h2>
<p>EU-only, GDPR compliant [1]. Source: see Wikipedia on GDPR.</p>
</article>
</body></html>`

const STRONG_TEXT = [
  'Acasting is a Swedish casting platform. Key takeaway: it matches productions with talent.',
  '',
  'By Anna Lindberg, PhD — editor.',
  '',
  '## How does Acasting work?',
  '',
  'Productions post castings; talent applies.',
  '',
  '## What does it cost?',
  '',
  '- Free tier',
  '- Plans from 990 SEK',
  '- Volume pricing',
  '',
  '## Who is it for?',
  '',
  '1. Casting directors',
  '2. Production houses',
  '3. Independent talent',
  '',
  '## Where is the data hosted?',
  '',
  'EU-only [1]. Source: GDPR docs.',
].join('\n')

describe('scoreCitationQuality — basic shape', () => {
  it('returns the five pillars + overall + band + topRecommendations', () => {
    const r = scoreCitationQuality({ text: TIGHT_LEAD })
    expect(r).toHaveProperty('overall')
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('pillars.clarity.score')
    expect(r).toHaveProperty('pillars.eeat.score')
    expect(r).toHaveProperty('pillars.qa.score')
    expect(r).toHaveProperty('pillars.structure.score')
    expect(r).toHaveProperty('pillars.structuredData.score')
    expect(r.topRecommendations).toHaveLength(3)
  })

  it('all pillar scores are 0–100', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    for (const key of Object.keys(r.pillars) as Array<keyof typeof r.pillars>) {
      expect(r.pillars[key].score).toBeGreaterThanOrEqual(0)
      expect(r.pillars[key].score).toBeLessThanOrEqual(100)
    }
    expect(r.overall).toBeGreaterThanOrEqual(0)
    expect(r.overall).toBeLessThanOrEqual(100)
  })

  it('pillar weights sum to exactly 100', () => {
    const total = Object.values(CITATION_QUALITY_WEIGHTS).reduce((s, n) => s + n, 0)
    expect(total).toBe(100)
  })
})

describe('clarity pillar', () => {
  it('rewards a tight definitional lead with a TL;DR marker', () => {
    const r = scoreCitationQuality({ text: TIGHT_LEAD })
    expect(r.pillars.clarity.score).toBeGreaterThanOrEqual(70)
  })

  it('penalises a long unfocused lead', () => {
    const longLead = Array.from({ length: 200 }, () => 'lorem ipsum dolor sit amet').join(' ')
    const r = scoreCitationQuality({ text: longLead })
    expect(r.pillars.clarity.score).toBeLessThan(40)
  })

  it('detects Italian and Swedish summary markers', () => {
    const it = scoreCitationQuality({
      text: 'Acasting è una piattaforma di casting svedese. In breve: collega produzioni e talenti.',
    })
    expect(it.pillars.clarity.score).toBeGreaterThan(50)
    const sv = scoreCitationQuality({
      text: 'Acasting är en svensk castingplattform. Sammanfattning: matchar produktioner med talanger.',
    })
    expect(sv.pillars.clarity.score).toBeGreaterThan(50)
  })
})

describe('eeat pillar', () => {
  it('rewards named byline + credentials + outbound authoritative links', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    expect(r.pillars.eeat.score).toBeGreaterThanOrEqual(70)
  })

  it('scores poorly without any authorship signals', () => {
    const r = scoreCitationQuality({
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    })
    expect(r.pillars.eeat.score).toBeLessThan(30)
  })
})

describe('qa pillar', () => {
  it('rewards FAQPage schema + question headings', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    expect(r.pillars.qa.score).toBeGreaterThanOrEqual(70)
  })

  it('scores low when no Q&A patterns are present', () => {
    const r = scoreCitationQuality({
      text: 'A flat article with one continuous paragraph and no questions.',
    })
    expect(r.pillars.qa.score).toBeLessThan(30)
  })
})

describe('structure pillar', () => {
  it('rewards ≥3 H2 sections + lists + a table', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    expect(r.pillars.structure.score).toBeGreaterThanOrEqual(70)
  })

  it('detects markdown headings in text-only mode', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT })
    // Without HTML there's no table bonus, but H2/H3 + lists still count.
    expect(r.pillars.structure.score).toBeGreaterThanOrEqual(30)
  })

  it('scores poorly on a flat text wall', () => {
    const wall = 'A long unstructured paragraph with no headings and no lists. '.repeat(40)
    const r = scoreCitationQuality({ text: wall })
    expect(r.pillars.structure.score).toBeLessThan(40)
  })
})

describe('structuredData pillar', () => {
  it('rewards Article + Organization + FAQPage JSON-LD coverage', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    expect(r.pillars.structuredData.score).toBeGreaterThanOrEqual(60)
  })

  it('returns 0 + actionable hint when no HTML provided', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT })
    expect(r.pillars.structuredData.score).toBe(0)
    expect(r.pillars.structuredData.recommendation).toMatch(/URL mode/i)
  })

  it('returns 0 + hint when HTML has no JSON-LD', () => {
    const r = scoreCitationQuality({
      text: STRONG_TEXT,
      html: '<html><body>No schema here</body></html>',
    })
    expect(r.pillars.structuredData.score).toBe(0)
    expect(r.pillars.structuredData.recommendation).toMatch(/Schema\.org/i)
  })
})

describe('overall band', () => {
  it('produces a "strong" report for the rich HTML+text fixture', () => {
    const r = scoreCitationQuality({ text: STRONG_TEXT, html: STRONG_HTML })
    expect(r.overall).toBeGreaterThanOrEqual(60)
    expect(['medium', 'strong']).toContain(r.band)
  })

  it('produces a "weak" report for empty-ish input', () => {
    const r = scoreCitationQuality({ text: 'A short blurb.' })
    expect(r.overall).toBeLessThan(50)
    expect(r.band).toBe('weak')
  })
})

describe('topRecommendations', () => {
  it('surfaces highest-leverage low-scoring pillars first', () => {
    // Weak EEAT + strong everything else → EEAT recommendation should be in top 3.
    const noEeat =
      '# Acasting is great\n\n## How does it work?\n- step\n- step\n\n## Who is it for?\n- talent\n- studios'
    const r = scoreCitationQuality({ text: noEeat })
    // EEAT is the weakest by far in this input, must appear in top 3.
    expect(r.topRecommendations.some((rec) => /author|credentials|byline|EEAT/i.test(rec))).toBe(
      true,
    )
  })
})
