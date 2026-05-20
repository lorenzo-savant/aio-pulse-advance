import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { classifyKeywordsForBrand } from './keyword-clustering'

interface KeywordData {
  keyword: string
  mention_count: number
  correlation_score: number
  engines: string[]
  first_seen: string | null
  last_seen: string | null
}

interface MonitoringResult {
  id: string
  brand_id: string
  engine: string
  response_text: string | null
  brand_mentioned: boolean | null
  created_at: string | null
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'used',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'when',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'then',
  'if',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'once',
  'etc',
  'eg',
  'ie',
  'vs',
  'via',
  'per',
  'say',
  'says',
  'said',
  'going',
  'make',
  'get',
  'got',
  'use',
  'using',
  'based',
  'including',
  'according',
  'available',
  'see',
  'know',
  'want',
  'think',
  'take',
  'come',
  'made',
  'find',
  'give',
  'tell',
  'try',
  'call',
  'look',
  'seem',
  'help',
  'show',
  'hear',
  'play',
  'run',
  'move',
  'live',
  'believe',
  'bring',
  // ── Swedish stopwords ──────────────────────────────────────────────────
  // Originally too narrow — top-30 monitoring keywords for acasting.se were
  // dominated by Swedish function words ("vara", "din", "finns", "hur",
  // "bra", "många"...) that should never have been tracked as topics. The
  // current list covers articles, pronouns, common verbs (essere/avere
  // forms), demonstratives, possessives, prepositions, conjunctions, and
  // the high-frequency adverbs/quantifiers that survive plain tokenization.
  'och',
  'att',
  'det',
  'som',
  'är',
  'på',
  'för',
  'med',
  'en',
  'ett',
  'den',
  'de',
  'har',
  'inte',
  'av',
  'om',
  'eller',
  'var',
  'vara',
  'vi',
  'ni',
  'du',
  'din',
  'dina',
  'ditt',
  'jag',
  'hon',
  'han',
  'mig',
  'dig',
  'sig',
  'sin',
  'sina',
  'sitt',
  'deras',
  'men',
  'till',
  'från',
  'kan',
  'kunde',
  'ska',
  'skulle',
  'vill',
  'finns',
  'här',
  'där',
  'när',
  'hur',
  'då',
  'så',
  'också',
  'även',
  'mer',
  'mest',
  'mycket',
  'lite',
  'många',
  'flera',
  'olika',
  'några',
  'alla',
  'bara',
  'bra',
  'ofta',
  'upp',
  'man',
  'dessa',
  'dessa',
  'vilket',
  'vilken',
  'vilka',
  'viktigt',
  'exempel',
  'ännu',
  'redan',
  'enligt',
  'samma',
  'andra',
  'annan',
  'annat',
  'varje',
  'både',
  'inom',
  'utan',
  'över',
  'under',
  'genom',
  'mellan',
  'hos',
  'ger',
  'fick',
  'varit',
  'blivit',
  'blir',
  'bli',
  'väl',
  'ganska',
  'dock',
  'således',
  'eftersom',
  'därför',
  'medan',
  'innan',
  'efter',
  'före',
  'mot',
  'via',
  'ej',
  'nu',
  'sedan',
  'sen',
  // ── Italian stopwords ──────────────────────────────────────────────────
  'il',
  'lo',
  'la',
  'le',
  'gli',
  'uno',
  'una',
  'del',
  'della',
  'dello',
  'degli',
  'delle',
  'dei',
  'al',
  'allo',
  'alla',
  'alle',
  'agli',
  'ai',
  'nel',
  'nello',
  'nella',
  'nelle',
  'negli',
  'nei',
  'dal',
  'dallo',
  'dalla',
  'dalle',
  'dagli',
  'dai',
  'sul',
  'sullo',
  'sulla',
  'sulle',
  'sugli',
  'sui',
  'che',
  'chi',
  'cui',
  'non',
  'ma',
  'però',
  'anche',
  'ancora',
  'già',
  'solo',
  'sempre',
  'mai',
  'più',
  'meno',
  'molto',
  'poco',
  'tanto',
  'tutto',
  'tutti',
  'tutta',
  'tutte',
  'essere',
  'avere',
  'fare',
  'dire',
  'sono',
  'sei',
  'era',
  'sarà',
  'ho',
  'hai',
  'abbiamo',
  'hanno',
  'loro',
  'voi',
  'noi',
  'lui',
  'lei',
  'essi',
  'esse',
  'io',
  'tu',
  'suo',
  'sua',
  'suoi',
  'sue',
  'nostro',
  'vostro',
  'mio',
  'mia',
  'miei',
  'tuo',
  'tua',
  'con',
  'per',
  'tra',
  'fra',
  'su',
  'giù',
  'quanto',
  'quando',
  'dove',
  'come',
  'perché',
  'cosa',
  'così',
  'quale',
  'quali',
  'senza',
  'dentro',
  'fuori',
  'sotto',
  'sopra',
  'verso',
  'presso',
  'dopo',
  'prima',
])

const PURE_NUMBER = /^\d+$/

// Lightweight Swedish (and partially Italian) stemmer. Collapses
// singular/plural and a few common verb conjugations so the keyword table
// doesn't show "plattform" (84) and "plattformar" (63) as two separate
// rows for the same concept — they're the same word, just inflected.
//
// Deliberately NOT a full Snowball stemmer: those over-aggressively
// strip suffixes and produce nonsense roots that don't read like real
// words in the UI. The rules here are conservative — they only trigger
// on suffixes that are unambiguous plural markers in the casting /
// monitoring vocabulary we actually see.
//
// Order matters: longer suffixes must be tried first to avoid
// "plattformar" being stripped to "plattorm" by the 2-char "ar" rule.
const SWEDISH_PLURAL_SUFFIXES: Array<{ suffix: string; min: number }> = [
  { suffix: 'erna', min: 6 }, // determinate plural: rollerna → roll
  { suffix: 'orna', min: 6 }, // determinate plural: kvinnorna → kvinna
  { suffix: 'arna', min: 6 }, // determinate plural: pojkarna → pojke
  { suffix: 'ioner', min: 7 }, // produktioner → produktion (keep -ion)
  { suffix: 'ningar', min: 8 }, // bokningar → bokning
  { suffix: 'ringar', min: 8 }, // sökringar (rare) → sökring
  { suffix: 'ister', min: 6 }, // statister → statist
  { suffix: 'are', min: 6 }, // skådespelare → skådespel (lossy — leave)
  { suffix: 'ormar', min: 7 }, // plattformar → plattform
  { suffix: 'ater', min: 6 }, // teater (already singular) — skip with min
]
const ITALIAN_PLURAL_SUFFIXES: Array<{ suffix: string; min: number; replace?: string }> = [
  { suffix: 'azioni', min: 7, replace: 'azione' }, // recensioni di azioni → azione
  { suffix: 'zioni', min: 6, replace: 'zione' }, // recensioni → recensione
  { suffix: 'sioni', min: 6, replace: 'sione' }, // decisioni → decisione
  { suffix: 'ssioni', min: 7, replace: 'ssione' }, // discussioni → discussione
  { suffix: 'oni', min: 5, replace: 'one' }, // (catch-all fallback for above)
  // Generic -i → -o and -e → -a are too gender-lossy to apply blindly.
  // We only apply them on tokens >= 6 chars to reduce damage, AND only
  // when the result is still a plausible word stem (length stays >= 4).
  { suffix: 'i', min: 6, replace: 'o' }, // attori → attoro (lossy but useful for casting nouns)
  { suffix: 'e', min: 6, replace: 'a' }, // attrici → attrica (less useful, often wrong)
]

const ENGLISH_PLURAL_SUFFIXES: Array<{ suffix: string; min: number; replace?: string }> = [
  // English noun plurals — only the well-behaved suffixes. Skip irregulars
  // (children, geese, etc.) — they're rare in monitoring text and the
  // alternative is a full lemma dictionary, which is overkill here.
  { suffix: 'ies', min: 5, replace: 'y' }, // categories → category
  { suffix: 'sses', min: 6, replace: 'ss' }, // businesses → business
  { suffix: 'shes', min: 6, replace: 'sh' }, // brushes → brush
  { suffix: 'ches', min: 6, replace: 'ch' }, // benches → bench
  { suffix: 'xes', min: 5, replace: 'x' }, // boxes → box
  { suffix: 'oes', min: 5, replace: 'o' }, // heroes → hero
  // Generic -s strip last — very common but careful not to strip from words
  // ending in -ss (loss), -us (bus), -is (analysis). Min 5 chars + extra
  // guards in the function body.
  { suffix: 's', min: 5 },
]

function stemSwedish(word: string): string {
  // Try longer suffixes first.
  for (const { suffix, min } of SWEDISH_PLURAL_SUFFIXES) {
    if (word.length >= min && word.endsWith(suffix)) {
      // Special cases that need a re-attached vowel:
      if (suffix === 'ioner') return word.slice(0, -2) // produktioner → produktion (drop "er")
      if (suffix === 'are') return word // skådespelare — leave as-is (the agent noun IS the singular)
      if (suffix === 'erna' || suffix === 'orna' || suffix === 'arna') {
        return word.slice(0, -4) + (suffix === 'arna' ? 'e' : 'a')
      }
      return word.slice(0, -suffix.length)
    }
  }
  // Generic plural -ar / -er / -or only if word is reasonably long
  if (word.length >= 6) {
    if (word.endsWith('ar')) return word.slice(0, -2)
    if (word.endsWith('er')) return word.slice(0, -2)
    if (word.endsWith('or')) return word.slice(0, -2)
  }
  return word
}

function stemItalian(word: string): string {
  for (const { suffix, min, replace } of ITALIAN_PLURAL_SUFFIXES) {
    if (word.length >= min && word.endsWith(suffix)) {
      const stripped = word.slice(0, -suffix.length)
      if (stripped.length < 3) continue // safety: don't produce stubs
      return stripped + (replace ?? '')
    }
  }
  return word
}

// Words ending in -ss / -us / -is / -os / -as are typically singular,
// not -s plurals. Used by stemEnglish to skip wrong stripping.
const ENGLISH_S_GUARD = /(?:ss|us|is|os|as)$/

function stemEnglish(word: string): string {
  for (const { suffix, min, replace } of ENGLISH_PLURAL_SUFFIXES) {
    if (word.length < min || !word.endsWith(suffix)) continue
    // Generic -s guard: skip when the word already ends in a sibilant or
    // a Latin-suffixed singular form (analysis/news/bus).
    if (suffix === 's' && ENGLISH_S_GUARD.test(word)) continue
    const stripped = word.slice(0, -suffix.length)
    if (stripped.length < 3) continue
    return stripped + (replace ?? '')
  }
  return word
}

/**
 * Stem a single token. The optional `language` hint biases the order in
 * which language-specific rules are tried — important because the
 * suffix tables overlap (Swedish -er ≈ English -s for noun plurals).
 * When `language` is omitted we heuristically pick by character classes
 * (åäö → Swedish; ò à ò ì ù → Italian; otherwise English).
 */
function stem(word: string, language?: 'en' | 'it' | 'sv' | string | null): string {
  // Explicit hint wins. The brand.language is the most reliable signal.
  if (language === 'sv') {
    const r = stemSwedish(word)
    return r !== word ? r : stemEnglish(word)
  }
  if (language === 'it') {
    const r = stemItalian(word)
    return r !== word ? r : stemEnglish(word)
  }
  if (language === 'en') {
    const r = stemEnglish(word)
    return r !== word ? r : word
  }
  // Heuristic fallback. Swedish letters are unambiguous; Italian-only
  // accents next; otherwise English. Each branch falls through to the
  // others when the language-specific rule doesn't fire — avoids
  // missing "platforms" just because the previous word had an å.
  if (/[åäö]/.test(word)) {
    const r = stemSwedish(word)
    return r !== word ? r : stemEnglish(word)
  }
  if (/[àèéìíòóùú]/.test(word)) {
    const r = stemItalian(word)
    return r !== word ? r : stemEnglish(word)
  }
  // ASCII-only: try Swedish first (handles "plattformar" etc.), then
  // English, then Italian as a last resort.
  const sw = stemSwedish(word)
  if (sw !== word) return sw
  const en = stemEnglish(word)
  if (en !== word) return en
  return stemItalian(word)
}

function tokenize(text: string, language?: string | null): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zåäöüßéèêëàâáãíîìôòóúùçñ\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 && word.length <= 30 && !PURE_NUMBER.test(word) && !STOP_WORDS.has(word),
    )
    .map((w) => stem(w, language))
    .filter((word) => !STOP_WORDS.has(word)) // re-filter: stem may produce a stopword
}

function countTokens(text: string, language?: string | null): Map<string, number> {
  const counts = new Map<string, number>()
  for (const w of tokenize(text, language)) {
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  return counts
}

// ─── Bigram detection ───────────────────────────────────────────────────────
//
// Two-word phrases like "sociala medier" (Swedish for "social media") often
// appear as separate top-frequency keywords with near-identical document
// support. The phrase carries more intent than either word alone. We detect
// them by finding pairs of consecutive tokens that co-occur frequently
// enough relative to either token's own count.
//
// Heuristic chosen over PMI / log-likelihood because it's transparent for
// the dashboard ("appeared together in ≥10 responses") and easy to debug.
const BIGRAM_MIN_COOCCURRENCES = 5
const BIGRAM_COHESION_THRESHOLD = 0.4 // pair must co-occur in ≥40% of the rarer token's docs

function extractBigrams(text: string): string[] {
  // Re-tokenize WITHOUT stemming for bigram detection — phrase pairs are
  // more recognizable in their natural inflection (e.g. "sociala medier"
  // not "social medier"). Stem the joined phrase after pairing.
  const words = text
    .toLowerCase()
    .replace(/[^a-zåäöüßéèêëàâáãíîìôòóúùçñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 30 && !PURE_NUMBER.test(w) && !STOP_WORDS.has(w))
  const pairs: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    pairs.push(`${words[i]} ${words[i + 1]}`)
  }
  return pairs
}

// ─── Industry vocabulary classifier (multi-industry, multi-language) ──────
//
// Per-industry sets of domain-specific terms. Aligned with the presets in
// src/lib/services/prompt-generator.ts so the keyword classifier and the
// prompt generator agree on the vocabulary of each vertical.
//
// Adding a new industry: create a new key (matched against brand.industry
// case-insensitively below) and dump the en/it/sv vocabulary into it.
// Stems land in the same set so users searching with either form work.
const INDUSTRY_VOCABULARIES: Record<string, Set<string>> = {
  casting: new Set([
    // English
    'casting',
    'audition',
    'actor',
    'actress',
    'extra',
    'background',
    'talent',
    'agent',
    'agency',
    'role',
    'rol',
    'director',
    'producer',
    'production',
    'film',
    'tv',
    'commercial',
    'photoshoot',
    'photographer',
    'model',
    'profile',
    'portfolio',
    'showreel',
    'booking',
    'screenplay',
    'script',
    // Swedish
    'skådespelare',
    'skådespel',
    'skådespelar',
    'statist',
    'roll',
    'rolle',
    'rollen',
    'regissör',
    'producent',
    'manus',
    'reklam',
    'reklamfilm',
    'fotograf',
    'fotografering',
    'modell',
    'modellbyrå',
    'talang',
    'agentur',
    'profil',
    'bokning',
    'castningsdirektör',
    // Italian
    'attore',
    'attrice',
    'comparsa',
    'figurante',
    'provini',
    'regista',
    'produttore',
    'sceneggiatura',
    'sceneggiatore',
    'fotografo',
    'modello',
    'modella',
    'agenzia',
  ]),
  saas: new Set([
    // English
    'subscription',
    'integration',
    'api',
    'feature',
    'pricing',
    'plan',
    'tier',
    'enterprise',
    'workspace',
    'dashboard',
    'analytics',
    'workflow',
    'automation',
    'webhook',
    'sso',
    'rbac',
    'tenant',
    'multi-tenant',
    'saas',
    'cloud',
    'self-hosted',
    'onboarding',
    'churn',
    'mrr',
    'arr',
    'seat',
    // Italian
    'abbonamento',
    'integrazione',
    'funzionalità',
    'prezzo',
    'piano',
    'pannello',
    'flusso',
    'automazione',
    // Swedish
    'prenumeration',
    'integration',
    'funktion',
    'pris',
    'plan',
    'panel',
    'analytik',
    'arbetsflöde',
    'automatisering',
  ]),
  ecommerce: new Set([
    // English
    'product',
    'cart',
    'checkout',
    'shipping',
    'inventory',
    'sku',
    'catalog',
    'collection',
    'category',
    'discount',
    'coupon',
    'shipping',
    'fulfillment',
    'warehouse',
    'storefront',
    'wishlist',
    'review',
    'rating',
    'return',
    'refund',
    'order',
    'shopify',
    'woocommerce',
    // Italian
    'prodotto',
    'carrello',
    'spedizione',
    'inventario',
    'catalogo',
    'categoria',
    'sconto',
    'coupon',
    'ordine',
    'recensione',
    'rimborso',
    // Swedish
    'produkt',
    'kundvagn',
    'frakt',
    'lager',
    'katalog',
    'kategori',
    'rabatt',
    'kupong',
    'beställning',
    'recension',
    'återbetalning',
  ]),
  local: new Set([
    // English (local services / brick-and-mortar)
    'booking',
    'appointment',
    'reservation',
    'opening',
    'hours',
    'walk-in',
    'consultation',
    'clinic',
    'salon',
    'studio',
    'shop',
    'store',
    'location',
    'address',
    'parking',
    'directions',
    // Italian
    'prenotazione',
    'appuntamento',
    'orari',
    'apertura',
    'consulenza',
    'studio',
    'negozio',
    'indirizzo',
    'parcheggio',
    // Swedish
    'bokning',
    'tidsbokning',
    'öppettider',
    'konsultation',
    'mottagning',
    'salong',
    'verkstad',
    'butik',
    'parkering',
  ]),
}

// Map brand.industry free-text → the vocabulary key. Multiple keywords
// per vertical so we handle the variations users actually type in
// brand setup ("casting platform", "Talent Acquisition", "casting &
// talent", etc.).
const INDUSTRY_KEYWORDS: Array<{
  vertical: keyof typeof INDUSTRY_VOCABULARIES
  patterns: RegExp[]
}> = [
  {
    vertical: 'casting',
    patterns: [
      /\bcasting\b/i,
      /\btalent\b/i,
      /\bactor\b/i,
      /\baudition\b/i,
      /\bfilm\b/i,
      /\bmedia\b/i,
    ],
  },
  {
    vertical: 'saas',
    patterns: [
      /\bsaas\b/i,
      /\bsoftware\b/i,
      /\b(b2b|enterprise|martech)\b/i,
      /\bcloud\b/i,
      /\bplatform\b/i,
      /\bapi\b/i,
    ],
  },
  {
    vertical: 'ecommerce',
    patterns: [
      /\be-?commerce\b/i,
      /\bretail\b/i,
      /\bshop\b/i,
      /\bstore\b/i,
      /\bshopify\b/i,
      /\bwoocommerce\b/i,
    ],
  },
  {
    vertical: 'local',
    patterns: [
      /\blocal\b/i,
      /\bsalon\b/i,
      /\bclinic\b/i,
      /\brestaurant\b/i,
      /\bservice\b/i,
      /\bappointment\b/i,
    ],
  },
]

function verticalFor(
  industry: string | null | undefined,
): keyof typeof INDUSTRY_VOCABULARIES | null {
  if (!industry) return null
  for (const entry of INDUSTRY_KEYWORDS) {
    if (entry.patterns.some((p) => p.test(industry))) return entry.vertical
  }
  return null
}

// ─── Geo detection ─────────────────────────────────────────────────────────
//
// Major Swedish + Italian + English-speaking cities. Geo signals answer
// "where does this brand operate?" so they go to Market Context.
const GEO_TOKENS = new Set<string>([
  // Swedish cities / regions
  'stockholm',
  'göteborg',
  'malmö',
  'uppsala',
  'västerås',
  'örebro',
  'linköping',
  'helsingborg',
  'jönköping',
  'norrköping',
  'lund',
  'umeå',
  'gävle',
  'borås',
  'sverige',
  'skåne',
  'småland',
  'norrland',
  // Italian cities
  'milano',
  'roma',
  'torino',
  'napoli',
  'firenze',
  'bologna',
  'venezia',
  'palermo',
  'genova',
  'verona',
  'italia',
  'lombardia',
  'lazio',
  'sicilia',
  'toscana',
  'piemonte',
  'veneto',
  'campania',
  // UK / Ireland
  'london',
  'manchester',
  'birmingham',
  'leeds',
  'liverpool',
  'bristol',
  'edinburgh',
  'glasgow',
  'cardiff',
  'dublin',
  'belfast',
  // USA major
  'new york',
  'nyc',
  'los angeles',
  'chicago',
  'houston',
  'phoenix',
  'philadelphia',
  'san antonio',
  'san diego',
  'dallas',
  'austin',
  'seattle',
  'boston',
  'miami',
  'atlanta',
  'denver',
  'portland',
  'detroit',
  // France
  'paris',
  'marseille',
  'lyon',
  'toulouse',
  'nice',
  'nantes',
  'bordeaux',
  'lille',
  'france',
  // Germany / Spain (top cities — common in Euro brand monitoring)
  'berlin',
  'hamburg',
  'münchen',
  'munich',
  'frankfurt',
  'köln',
  'cologne',
  'stuttgart',
  'düsseldorf',
  'deutschland',
  'germany',
  'madrid',
  'barcelona',
  'valencia',
  'sevilla',
  'zaragoza',
  'málaga',
  'españa',
  'spain',
])

/**
 * Suggest a cluster (product or market) for a stemmed token based on the
 * brand's industry. Falls back to language-agnostic geo detection.
 * Returns null for tokens that don't match anything — they get the
 * default classification later.
 */
export function suggestedClusterFor(
  stemmed: string,
  industry?: string | null,
): 'product' | 'market' | null {
  // 1. Geo always wins for the cluster (Market Context) regardless of
  //    industry — "stockholm" is a location signal in any vertical.
  if (GEO_TOKENS.has(stemmed)) return 'market'

  // 2. Industry vocabulary: pick the right set based on brand.industry.
  //    If no industry is configured, try the casting vocab first (most
  //    of our test data is casting) then fall through.
  const vertical = verticalFor(industry) ?? 'casting'
  if (INDUSTRY_VOCABULARIES[vertical]?.has(stemmed)) return 'product'

  // 3. Industry-blind fallback: if the token is in ANY industry vocab,
  //    classify as product. Handles brands with unusual industry strings.
  for (const vocab of Object.values(INDUSTRY_VOCABULARIES)) {
    if (vocab.has(stemmed)) return 'product'
  }
  return null
}

export async function trackKeywords(brandId: string): Promise<void> {
  const db = createServerClient()
  if (!db) {
    logger.warn('Database not configured', { service: 'keyword-tracker' })
    return
  }

  try {
    // Pull the brand's language hint so the stemmer can pick the right
    // suffix table per token. With this, "platforms" stems to "platform"
    // for English brands and "plattformar" stems to "plattform" for
    // Swedish brands — without it the heuristic fallback in stem() works
    // OK but trips on edge cases where both rule sets apply.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const brandRow = (
      await (db as any).from('brands').select('language, industry').eq('id', brandId).single()
    ).data as { language: string | null; industry: string | null } | null
    const language = brandRow?.language ?? null

    const { data: results, error: fetchError } = await db
      .from('monitoring_results')
      .select('id, brand_id, engine, response_text, brand_mentioned, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (fetchError || !results || results.length === 0) {
      return
    }

    const mentionResults = results.filter((r) => r.brand_mentioned)
    const noMentionResults = results.filter((r) => !r.brand_mentioned)
    const mentionCount = mentionResults.length
    const noMentionCount = noMentionResults.length

    // Per-response token counts (cached to avoid re-tokenising). Also
    // extract candidate bigrams that we'll promote to keywords if they
    // pass the cohesion threshold below.
    const tokenizedResults = results.map((r) => {
      const text = r.response_text || ''
      const tokens = countTokens(text, language)
      const bigrams = new Set<string>()
      for (const bg of extractBigrams(text)) bigrams.add(bg)
      return { result: r, tokens, bigrams }
    })

    // Pre-pass: count bigram document frequency. We keep a bigram as a
    // single token IF it co-occurred in enough documents AND its
    // appearance is concentrated (not just two common words that happen
    // to be adjacent sometimes).
    const bigramDocCount = new Map<string, number>()
    for (const tr of tokenizedResults) {
      for (const bg of tr.bigrams) bigramDocCount.set(bg, (bigramDocCount.get(bg) || 0) + 1)
    }
    const promotedBigrams = new Set<string>()
    for (const [bg, count] of bigramDocCount) {
      if (count < BIGRAM_MIN_COOCCURRENCES) continue
      const [a, b] = bg.split(' ')
      if (!a || !b) continue
      const aDocs = tokenizedResults.filter((tr) => tr.tokens.has(stem(a, language))).length
      const bDocs = tokenizedResults.filter((tr) => tr.tokens.has(stem(b, language))).length
      const rarer = Math.min(aDocs, bDocs) || 1
      if (count / rarer >= BIGRAM_COHESION_THRESHOLD) promotedBigrams.add(bg)
    }

    // Inject promoted bigrams into the per-response token maps so they
    // are counted alongside unigrams. The bigram string IS the keyword
    // (no further stemming — we want "sociala medier" to read naturally).
    for (const tr of tokenizedResults) {
      for (const bg of tr.bigrams) {
        if (!promotedBigrams.has(bg)) continue
        tr.tokens.set(bg, (tr.tokens.get(bg) || 0) + 1)
      }
    }

    // Global aggregates per keyword
    interface Stats {
      totalOccurrences: number
      docsInMention: number
      docsInNoMention: number
      engines: Set<string>
      dates: string[]
    }
    const stats = new Map<string, Stats>()

    for (const { result: r, tokens } of tokenizedResults) {
      const date = (r.created_at ?? '').split('T')[0] || ''
      for (const [word, count] of tokens) {
        let s = stats.get(word)
        if (!s) {
          s = {
            totalOccurrences: 0,
            docsInMention: 0,
            docsInNoMention: 0,
            engines: new Set<string>(),
            dates: [],
          }
          stats.set(word, s)
        }
        s.totalOccurrences += count
        if (r.brand_mentioned) s.docsInMention += 1
        else s.docsInNoMention += 1
        s.engines.add(r.engine)
        if (date) s.dates.push(date)
      }
    }

    // Keep keywords that appear in enough responses (signal filter).
    // Threshold scales with sample size:
    //   - <10 results: 1 doc (any signal counts, sample is too small to filter)
    //   - 10-49: 2 docs
    //   - 50+: 3 docs (filter the long tail of one-off mentions)
    const keywordData: Record<string, KeywordData> = {}
    const totalResultCount = results.length
    const minDocThreshold = totalResultCount < 10 ? 1 : totalResultCount < 50 ? 2 : 3
    const ranked = [...stats.entries()]
      .filter(([, s]) => s.docsInMention + s.docsInNoMention >= minDocThreshold)
      .sort((a, b) => b[1].totalOccurrences - a[1].totalOccurrences)
      .slice(0, 200)

    for (const [keyword, s] of ranked) {
      // Proper correlation: P(keyword | mentioned) - P(keyword | not mentioned)
      // Range: -1..1; positive = keyword correlates with brand mention
      const mentionRate = mentionCount > 0 ? s.docsInMention / mentionCount : 0
      const noMentionRate = noMentionCount > 0 ? s.docsInNoMention / noMentionCount : 0
      const correlation = mentionRate - noMentionRate

      const sortedDates = s.dates.sort()
      keywordData[keyword] = {
        keyword,
        mention_count: s.totalOccurrences,
        correlation_score: Math.round(correlation * 100) / 100,
        engines: [...s.engines],
        first_seen: sortedDates[0] || null,
        last_seen: sortedDates[sortedDates.length - 1] || null,
      }
    }

    // Remove stale keywords for this brand before inserting fresh set
    await db.from('keyword_tracking').delete().eq('brand_id', brandId)

    // Batch upsert — one round trip instead of N. The delete above already
    // cleared stale rows for this brand, so the onConflict is purely a
    // safety net for races between concurrent tracker runs.
    const rows = Object.entries(keywordData).map(([keyword, data]) => ({
      brand_id: brandId,
      keyword,
      mention_count: data.mention_count,
      correlation_score: data.correlation_score,
      engines: data.engines,
      first_seen: data.first_seen,
      last_seen: data.last_seen,
    }))

    if (rows.length > 0) {
      const { error: upsertError } = await db
        .from('keyword_tracking')
        .upsert(rows, { onConflict: 'brand_id,keyword' })

      if (upsertError) {
        logger.error('Keyword batch upsert error', {
          service: 'keyword-tracker',
          rowCount: rows.length,
          error: upsertError,
        })
      }
    }

    logger.info('Keywords tracked', {
      service: 'keyword-tracker',
      brandId,
      keywordCount: Object.keys(keywordData).length,
    })

    // Classify fresh keywords into clusters using brand context
    try {
      const clusterRes = await classifyKeywordsForBrand(brandId)
      logger.info('Keywords clustered', {
        service: 'keyword-tracker',
        brandId,
        classified: clusterRes.classified,
        errors: clusterRes.errors.length,
      })
    } catch (clusterErr) {
      logger.error('Keyword clustering failed', {
        service: 'keyword-tracker',
        brandId,
        error: String(clusterErr),
      })
    }
  } catch (error) {
    logger.error('Error tracking keywords', { service: 'keyword-tracker', error })
  }
}

export async function getKeywords(brandId: string, limit = 50) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .order('mention_count', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Keyword fetch error', { service: 'keyword-tracker', error })
    return []
  }

  return data || []
}

export async function getTopCorrelatedKeywords(brandId: string, limit = 20) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .gt('correlation_score', 0)
    .order('correlation_score', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Correlated keyword fetch error', { service: 'keyword-tracker', error })
    return []
  }

  return data || []
}
