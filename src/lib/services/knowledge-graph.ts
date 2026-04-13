export type EntityType =
  | 'Organization'
  | 'Person'
  | 'Product'
  | 'LocalBusiness'
  | 'HowTo'
  | 'Recipe'

export interface Entity {
  type: EntityType
  name: string
  url?: string
  description?: string
  properties?: Record<string, unknown>
}

export interface EeatSignals {
  author: {
    present: boolean
    name?: string
    url?: string
  }
  sameAs: {
    present: boolean
    links: string[]
  }
  credentials: {
    present: boolean
    values: string[]
  }
  externalCitations: {
    present: boolean
    count: number
    links: string[]
  }
  aboutPage: {
    present: boolean
    url?: string
  }
  contactPage: {
    present: boolean
    url?: string
  }
}

export interface KnowledgeGraphResult {
  entities: Entity[]
  eeatSignals: EeatSignals
  eeatScore: number
}

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  Organization: 'Organization',
  Person: 'Person',
  Product: 'Product',
  LocalBusiness: 'LocalBusiness',
  HowTo: 'HowTo',
  Recipe: 'Recipe',
}

const AUTHOR_TYPES = [
  'Article',
  'NewsArticle',
  'BlogPosting',
  'TechArticle',
  'HowTo',
  'Recipe',
  'Author',
]

export function extractEntities(jsonLd: object[]): Entity[] {
  const entities: Entity[] = []

  for (const item of jsonLd) {
    if (!item || typeof item !== 'object') continue

    const schema = item as Record<string, unknown>
    const type = schema['@type']

    if (!type) continue

    const types = Array.isArray(type) ? type : [type]

    for (const t of types) {
      const normalizedType = String(t)
      const entityType = ENTITY_TYPE_MAP[normalizedType]

      if (entityType) {
        const entity: Entity = {
          type: entityType,
          name: String(schema.name || ''),
        }

        if (schema.url) {
          entity.url = String(schema.url)
        }
        if (schema.description) {
          entity.description = String(schema.description)
        }

        const propsToExtract: string[] = []
        if (entityType === 'Person') {
          propsToExtract.push('jobTitle', 'alumniOf', 'worksFor')
        } else if (entityType === 'Organization') {
          propsToExtract.push('founder', 'address', 'contactPoint')
        } else if (entityType === 'Product') {
          propsToExtract.push('brand', 'aggregateRating', 'offers')
        }

        if (propsToExtract.length > 0) {
          entity.properties = {}
          for (const prop of propsToExtract) {
            if (schema[prop] !== undefined) {
              entity.properties[prop] = schema[prop]
            }
          }
          if (Object.keys(entity.properties).length === 0) {
            delete entity.properties
          }
        }

        entities.push(entity)
        break
      }
    }
  }

  return entities
}

export function extractEeatSignals(html: string, jsonLd: object[]): EeatSignals {
  const htmlLower = html.toLowerCase()

  const aboutPageRegex = /<a[^>]+href=["']([^"']*about[^"']*)["'][^>]*>/gi
  const contactPageRegex = /<a[^>]+href=["']([^"']*contact[^"']*)["'][^>]*>/gi
  const authorLinkRegex =
    /<a[^>]+class=["'][^"']*author[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi
  const citationRegex =
    /<a[^>]+href=["'](https?:\/\/(?!.*(?:youtube|facebook|twitter|instagram|linkedin)[^\s]*$).+)["'][^>]*>/gi

  const aboutMatches = htmlLower.match(aboutPageRegex) || []
  const contactMatches = htmlLower.match(contactPageRegex) || []
  const authorLinks: string[] = []
  let authorMatch
  const authorRegex = new RegExp(authorLinkRegex.source, 'gi')
  while ((authorMatch = authorRegex.exec(html)) !== null) {
    if (authorMatch[1]) {
      authorLinks.push(authorMatch[1])
    }
  }

  const citationLinks: string[] = []
  let citationMatch
  while ((citationMatch = citationRegex.exec(html)) !== null) {
    if (citationMatch[1]) {
      citationLinks.push(citationMatch[1])
    }
  }

  let authorInfo: EeatSignals['author'] = { present: false }

  for (const item of jsonLd) {
    if (!item || typeof item !== 'object') continue

    const schema = item as Record<string, unknown>
    const type = schema['@type']

    if (!type) continue

    const types = Array.isArray(type) ? type : [type]

    for (const t of types) {
      if (AUTHOR_TYPES.includes(String(t))) {
        if (schema.author) {
          const author = schema.author
          if (typeof author === 'string') {
            authorInfo = { present: true, name: author }
          } else if (typeof author === 'object' && author !== null) {
            const authorObj = author as Record<string, unknown>
            authorInfo = {
              present: true,
              name: authorObj.name ? String(authorObj.name) : undefined,
              url: authorObj.url ? String(authorObj.url) : undefined,
            }
          }
        }
        break
      }
    }
  }

  let sameAsLinks: string[] = []
  for (const item of jsonLd) {
    if (!item || typeof item !== 'object') continue

    const schema = item as Record<string, unknown>
    if (schema.sameAs) {
      const sameAs = schema.sameAs
      if (Array.isArray(sameAs)) {
        sameAsLinks = sameAs.map((s) => String(s))
      } else if (typeof sameAs === 'string') {
        sameAsLinks = [sameAs]
      }
    }
  }

  let credentials: string[] = []
  for (const item of jsonLd) {
    if (!item || typeof item !== 'object') continue

    const schema = item as Record<string, unknown>
    if (schema.awards) {
      const awards = schema.awards
      if (Array.isArray(awards)) {
        credentials = awards.map((a) => String(a))
      } else {
        credentials = [String(awards)]
      }
    }
    if (schema.certifications) {
      const certs = schema.certifications
      if (Array.isArray(certs)) {
        credentials = [...credentials, ...certs.map((c) => String(c))]
      } else {
        credentials = [...credentials, String(certs)]
      }
    }
    if (schema.credentials) {
      const creds = schema.credentials
      if (Array.isArray(creds)) {
        credentials = [...credentials, ...creds.map((c) => String(c))]
      } else {
        credentials = [...credentials, String(creds)]
      }
    }
  }

  const hasAbout = aboutMatches.length > 0
  const hasContact = contactMatches.length > 0

  return {
    author: authorInfo,
    sameAs: {
      present: sameAsLinks.length > 0,
      links: sameAsLinks,
    },
    credentials: {
      present: credentials.length > 0,
      values: [...new Set(credentials)],
    },
    externalCitations: {
      present: citationLinks.length > 0,
      count: citationLinks.length,
      links: [...new Set(citationLinks)].slice(0, 20),
    },
    aboutPage: {
      present: hasAbout,
      url: hasAbout ? '/about' : undefined,
    },
    contactPage: {
      present: hasContact,
      url: hasContact ? '/contact' : undefined,
    },
  }
}

export function calculateEeatScore(signals: EeatSignals): number {
  let score = 0

  if (signals.author.present) score += 15
  if (signals.sameAs.present) score += 15
  if (signals.credentials.present) score += 20
  if (signals.externalCitations.present) score += 20
  if (signals.aboutPage.present) score += 15
  if (signals.contactPage.present) score += 15

  return score
}

export function analyzeKnowledgeGraph(html: string, jsonLd: object[]): KnowledgeGraphResult {
  const entities = extractEntities(jsonLd)
  const eeatSignals = extractEeatSignals(html, jsonLd)
  const eeatScore = calculateEeatScore(eeatSignals)

  return {
    entities,
    eeatSignals,
    eeatScore,
  }
}
