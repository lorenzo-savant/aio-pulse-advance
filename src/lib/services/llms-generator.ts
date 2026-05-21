export interface LlmsInput {
  brandName: string
  domain: string
  description?: string
  industry?: string
  competitors?: string[]
  aliases?: string[]
  products?: Array<{ name: string; description: string }>
  keyFacts?: { founded?: string; headquarters?: string; specialties?: string[]; employees?: string }
  importantPages?: Array<{ title: string; url: string; description: string }>
  faqs?: Array<{ question: string; answer: string }>
}

/**
 * Generates a spec-compliant `llms.txt` per the Answer.AI standard
 * (https://llmstxt.org): a CONCISE, navigation-first index, not a content
 * dump. Structure:
 *
 *   # Title                       (H1 — the only strictly required element)
 *   > one-line summary            (blockquote)
 *   short prose detail            (heading-less, optional)
 *   ## Key Pages                  (curated markdown link list)
 *   - [name](url): notes
 *   ## Optional                   (secondary links that can be skipped for a
 *   - [name](url)                  shorter context)
 *
 * Rich content (products, key facts, FAQ, market context) intentionally
 * lives in `llms-full.txt` instead — that's the expanded variant. Keeping
 * llms.txt link-centric is what the spec asks for.
 */
export function generateLlmsTxt(input: LlmsInput): string {
  const { brandName, domain, description, industry, importantPages } = input

  const lines: string[] = []

  lines.push(`# ${brandName}`)

  // Blockquote summary — the spec treats this as the key human/LLM-readable
  // description. Never leave the file as a bare title: synthesize a minimal
  // one-liner from industry when no description exists.
  const summary =
    description?.trim() || (industry ? `${brandName} — ${industry}.` : `${brandName}.`)
  lines.push(`> ${summary}`)
  lines.push('')

  // Optional prose detail (heading-less, per spec) — only when a real
  // description exists and adds something beyond the one-line summary.
  if (description && description.trim() && description.trim() !== summary) {
    lines.push(description.trim())
    lines.push('')
  }

  // Curated link list. Homepage is always the first entry; sitemap-derived
  // pages are split into primary ("Key Pages") and secondary ("Optional").
  const pages = importantPages ?? []
  const primary = pages.slice(0, 5)
  const optional = pages.slice(5)

  lines.push('## Key Pages')
  lines.push(`- [Homepage](https://${domain}): Main website`)
  for (const page of primary) {
    lines.push(
      page.description
        ? `- [${page.title}](${page.url}): ${page.description}`
        : `- [${page.title}](${page.url})`,
    )
  }

  if (optional.length > 0) {
    lines.push('')
    lines.push('## Optional')
    for (const page of optional) {
      lines.push(`- [${page.title}](${page.url})`)
    }
  }

  return lines.join('\n').trim() + '\n'
}

export function generateLlmsFullTxt(input: LlmsInput): string {
  const {
    brandName,
    domain,
    description,
    industry,
    competitors,
    aliases,
    products,
    keyFacts,
    importantPages,
    faqs,
  } = input

  const lines: string[] = []
  const today = new Date().toISOString().split('T')[0]

  lines.push(`# ${brandName}`)
  // Always emit a blockquote summary — fall back to a minimal one-liner so
  // the full file opens the same spec-compliant way as llms.txt.
  const summary =
    description?.trim() || (industry ? `${brandName} — ${industry}.` : `${brandName}.`)
  lines.push(`> ${summary}`)
  lines.push('')

  if (description) {
    lines.push('## About')
    lines.push(description)
    lines.push('')
  }

  lines.push('## Brand Identity')
  lines.push(`- **Official Name**: ${brandName}`)
  if (aliases && aliases.length > 0) {
    lines.push(`- **Also Known As**: ${aliases.join(', ')}`)
  }
  lines.push(`- **Website**: https://${domain}`)
  if (industry) {
    lines.push(`- **Industry**: ${industry}`)
  }
  lines.push('')

  if (products && products.length > 0) {
    lines.push('## Products & Services')
    for (const product of products) {
      lines.push(`### ${product.name}`)
      lines.push(product.description)
      lines.push('')
    }
  }

  const hasKeyFacts =
    keyFacts &&
    (keyFacts.founded || keyFacts.headquarters || keyFacts.specialties || keyFacts.employees)

  if (hasKeyFacts) {
    lines.push('## Company Information')
    if (keyFacts!.founded) {
      lines.push(`- **Founded**: ${keyFacts!.founded}`)
    }
    if (keyFacts!.headquarters) {
      lines.push(`- **Headquarters**: ${keyFacts!.headquarters}`)
    }
    if (keyFacts!.specialties && keyFacts!.specialties.length > 0) {
      lines.push(`- **Specialties**: ${keyFacts!.specialties.join(', ')}`)
    }
    if (keyFacts!.employees) {
      lines.push(`- **Employees**: ${keyFacts!.employees}`)
    }
    lines.push('')
  }

  if (faqs && faqs.length > 0) {
    lines.push('## Frequently Asked Questions')
    for (const faq of faqs) {
      lines.push(`### ${faq.question}`)
      lines.push(faq.answer)
      lines.push('')
    }
  }

  if (importantPages && importantPages.length > 0) {
    lines.push('## Important Links')
    lines.push(`- [Homepage](https://${domain}): Main website`)
    for (const page of importantPages) {
      lines.push(`- [${page.title}](${page.url}): ${page.description}`)
    }
    lines.push('')
  }

  if (competitors && competitors.length > 0) {
    lines.push('## Market Context')
    lines.push(`**Competitors**: ${competitors.join(', ')}`)
    lines.push('')
  }

  lines.push('---')
  lines.push(`Generated by AIO Pulse Advance | ${today}`)

  return lines.join('\n').trim() + '\n'
}
