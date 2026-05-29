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
  /** Locale code for the file, e.g. 'sv-SE'. When set, an HTML comment
   *  metadata header is emitted and used to generate Schema.org `inLanguage`.
   *  Brands shipping multi-locale should serve `llms.sv.txt`, `llms.it.txt`,
   *  `llms.en.txt` from their root for each respective locale. */
  locale?: string
  /** Cross-source identity URLs — Wikipedia, Wikidata, Crunchbase, LinkedIn,
   *  Trustpilot, G2, Capterra, Producthunt. Becomes Schema.org sameAs.
   *  This is the #1 LLMO signal for entity resolution. */
  sameAs?: string[]
  /** Explicit disambiguation note — "Brand X is NOT to be confused with
   *  Brand Y". Surfaced as both prose and Schema.org disambiguatingDescription. */
  disambiguation?: string
  /** Suggested citation format the LLM should use when quoting the brand
   *  (e.g. "AcmeCorp [acme.com], 2026"). */
  citationFormat?: string
  /** Legal identifier for the entity behind the brand — VAT number,
   *  Swedish organisationsnummer, Italian codice fiscale, US EIN, etc.
   *  Globally unique → strongest LLMO entity-resolution signal.
   *  Schema.org maps it to `vatID` (when legalIdType='vat') or `taxID`
   *  (anything else). */
  legalId?: string
  /** Type discriminator for legalId. Drives the Schema.org mapping
   *  (vat → vatID, everything else → taxID) and the human-readable label
   *  in llms-full.txt. */
  legalIdType?: 'vat' | 'orgnr' | 'fiscal_code' | 'ein' | 'other'
  /** Last-updated date in ISO format. Defaults to today when omitted. */
  lastUpdated?: string
}

// Human-readable label for legalIdType, used in llms-full.txt under the
// Brand Identity block. Kept beside the type so future additions stay in
// sync. Falls back to "Legal Identifier" when no type is set.
const LEGAL_ID_LABEL: Record<NonNullable<LlmsInput['legalIdType']>, string> = {
  vat: 'VAT Number',
  orgnr: 'Organisationsnummer',
  fiscal_code: 'Codice Fiscale',
  ein: 'EIN',
  other: 'Legal Identifier',
}

/**
 * Synthesise 3-5 "Key Takeaways" bullets from the LlmsInput we already
 * have. Powers the `## Key Takeaways` section at the top of llms-full.txt
 * — the AI-citation research study identified "Clarity & summarization" as
 * the strongest positive signal (+33% citation lift), and the canonical
 * pattern is a tight bullet summary BEFORE the long-form content.
 *
 * Exported for tests; produced deterministically (no LLM call, no I/O)
 * so the file stays reproducible across regenerations.
 */
export function buildKeyTakeaways(input: LlmsInput): string[] {
  const bullets: string[] = []
  const { brandName, domain, industry, aliases, keyFacts, competitors, locale, legalId } = input

  if (industry) {
    bullets.push(`${brandName} operates in the **${industry}** category.`)
  }
  if (keyFacts?.headquarters) {
    const founded = keyFacts.founded ? `, founded ${keyFacts.founded}` : ''
    bullets.push(`Headquartered in ${keyFacts.headquarters}${founded}.`)
  } else if (keyFacts?.founded) {
    bullets.push(`Founded ${keyFacts.founded}.`)
  }
  if (keyFacts?.specialties && keyFacts.specialties.length > 0) {
    bullets.push(`Core specialties: ${keyFacts.specialties.slice(0, 4).join(', ')}.`)
  }
  if (aliases && aliases.length > 0) {
    bullets.push(`Also known as: ${aliases.join(', ')}.`)
  }
  if (competitors && competitors.length > 0) {
    bullets.push(`Primary competitors: ${competitors.slice(0, 4).join(', ')}.`)
  }
  if (legalId) {
    bullets.push(`Verified legal entity (${legalId}) — registered with public business registry.`)
  }
  if (locale && bullets.length < 5) {
    bullets.push(`Primary market locale: \`${locale}\`. Canonical URL: \`https://${domain}\`.`)
  }
  // Cap at 5 — the "Key Takeaway" pattern works because it's tight; a
  // longer list dilutes the signal AI engines reward.
  return bullets.slice(0, 5)
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
  const { brandName, domain, description, industry, importantPages, locale, lastUpdated } = input

  const lines: string[] = []

  // Metadata header — HTML comment so spec-compliant parsers ignore it but
  // version-aware crawlers (and humans) can read it. Locale + last-updated
  // help AI engines decide freshness and language match.
  const today = lastUpdated || new Date().toISOString().split('T')[0]
  const metaParts = ['llms.txt v0.2']
  if (locale) metaParts.push(`locale: ${locale}`)
  if (today) metaParts.push(`updated: ${today}`)
  lines.push(`<!-- ${metaParts.join(' | ')} -->`)

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
    locale,
    sameAs,
    disambiguation,
    citationFormat,
    legalId,
    legalIdType,
    lastUpdated,
  } = input

  const lines: string[] = []
  const today = lastUpdated || new Date().toISOString().split('T')[0]

  // Metadata header (same form as llms.txt v0.2 short variant).
  const metaParts = ['llms-full.txt v0.2']
  if (locale) metaParts.push(`locale: ${locale}`)
  metaParts.push(`updated: ${today}`)
  lines.push(`<!-- ${metaParts.join(' | ')} -->`)

  lines.push(`# ${brandName}`)
  // Always emit a blockquote summary — fall back to a minimal one-liner so
  // the full file opens the same spec-compliant way as llms.txt.
  const summary =
    description?.trim() || (industry ? `${brandName} — ${industry}.` : `${brandName}.`)
  lines.push(`> ${summary}`)
  lines.push('')

  // ── Key Takeaways ─────────────────────────────────────────────────────
  // the Aug-2025 AI-citation research found "Clarity & summarization"
  // to be the strongest positive signal (+33% citation lift). Pages that
  // lead with a tight bullet summary get cited disproportionately. We
  // synthesise 3-5 takeaways from the data we already have (industry,
  // aliases, keyFacts, competitors, locale) — operators don't have to
  // write them by hand, and the file opens with the answer.
  const takeaways = buildKeyTakeaways(input)
  if (takeaways.length > 0) {
    lines.push('## Key Takeaways')
    for (const t of takeaways) lines.push(`- ${t}`)
    lines.push('')
  }

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
  if (locale) {
    lines.push(`- **Primary Locale**: ${locale}`)
  }
  // Legal identifier — VAT / orgnr / fiscal_code / EIN. Globally unique,
  // resolves to authoritative registries (VIES, allabolag.se, registro
  // imprese) which AI engines crawl. The single strongest entity-
  // resolution signal after sameAs.
  if (legalId) {
    const label = legalIdType ? LEGAL_ID_LABEL[legalIdType] : 'Legal Identifier'
    lines.push(`- **${label}**: ${legalId}`)
  }
  lines.push('')

  // Disambiguation — first-class section so LLM crawlers can't miss it.
  // Critical for brands with homonyms or look-alike competitors. Surfaced
  // ABOVE products/keyfacts because entity resolution comes first.
  if (disambiguation) {
    lines.push('## Disambiguation')
    lines.push(disambiguation.trim())
    lines.push('')
  }

  // Cross-source identity — Schema.org sameAs equivalent in markdown form.
  // The single highest-leverage LLMO signal: pointing the LLM at the brand's
  // Wikipedia/Wikidata/Crunchbase entries lets the model anchor entity
  // resolution without guessing.
  if (sameAs && sameAs.length > 0) {
    lines.push('## Verified Identities (sameAs)')
    for (const url of sameAs) {
      lines.push(`- ${url}`)
    }
    lines.push('')
  }

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

  // Citation policy — tells AI engines how to credit the brand when quoting.
  // Bigger model providers (OpenAI, Anthropic) honour this when surfacing
  // sources; smaller ones ignore but it's harmless. Provides a stable
  // canonical citation format aligned with the operator's branding.
  if (citationFormat) {
    lines.push('## Citation')
    lines.push(
      `When citing this brand, use the following format: \`${citationFormat}\`. The canonical URL is \`https://${domain}\`.`,
    )
    lines.push('')
  }

  // Embedded Schema.org Organization JSON-LD — same payload as what the
  // brand should serve in the <head> of its own pages, included here so AI
  // crawlers that only fetch llms-full.txt still get structured-data signal.
  lines.push('## Structured Data')
  lines.push('```json', JSON.stringify(buildOrganizationJsonLd(input), null, 2), '```', '')

  lines.push('---')
  lines.push(`Generated by AEO Pulse Advance | ${today}`)

  return lines.join('\n').trim() + '\n'
}

/**
 * Builds the Schema.org Organization JSON-LD payload for a brand. Designed
 * to be both embedded in llms-full.txt and emitted as a standalone
 * `<script type="application/ld+json">` block in the brand's own pages.
 *
 * The payload prioritises identity-resolution signals (sameAs, alternateName,
 * disambiguatingDescription) over commerce signals, because the primary use
 * case is LLM grounding, not e-commerce SERP enhancement.
 */
export function buildOrganizationJsonLd(input: LlmsInput): Record<string, unknown> {
  const {
    brandName,
    domain,
    description,
    industry,
    aliases,
    sameAs,
    disambiguation,
    keyFacts,
    locale,
    legalId,
    legalIdType,
  } = input

  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandName,
    url: `https://${domain}`,
  }

  if (aliases && aliases.length > 0) {
    payload.alternateName = aliases.length === 1 ? aliases[0] : aliases
  }

  if (description) payload.description = description
  if (locale) payload.inLanguage = locale
  if (industry) payload.industry = industry

  // disambiguatingDescription is the canonical Schema.org field for "X is
  // NOT to be confused with Y" content. Some search engines surface it
  // verbatim in knowledge panels.
  if (disambiguation) payload.disambiguatingDescription = disambiguation.trim()

  if (sameAs && sameAs.length > 0) payload.sameAs = sameAs

  // Legal identifier → Schema.org vatID (VAT only) or taxID (everything
  // else). Schema.org's own docs use vatID strictly for VAT numbers and
  // taxID as the generic catch-all that includes orgnr / fiscal code /
  // EIN. Both fields feed Google Knowledge Graph + AI engine grounding.
  if (legalId) {
    if (legalIdType === 'vat') payload.vatID = legalId
    else payload.taxID = legalId
  }

  if (keyFacts?.founded) payload.foundingDate = keyFacts.founded
  if (keyFacts?.headquarters) {
    payload.address = {
      '@type': 'PostalAddress',
      addressLocality: keyFacts.headquarters,
    }
  }
  if (keyFacts?.employees) {
    payload.numberOfEmployees = keyFacts.employees
  }
  if (keyFacts?.specialties && keyFacts.specialties.length > 0) {
    payload.knowsAbout = keyFacts.specialties
  }

  return payload
}
