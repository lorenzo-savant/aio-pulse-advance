export interface IntentPattern {
  bucket: string
  template: string
  priority: 'high' | 'medium' | 'low'
}

export interface IndustryPreset {
  id: string
  name: { en: string; it: string; sv: string }
  description: { en: string; it: string; sv: string }
  competitors: string[]
  localCompetitors?: {
    sv?: string[]
    it?: string[]
    en?: string[]
  }
  localizedTemplates?: {
    sv?: string[]
    it?: string[]
    en?: string[]
  }
  categories: { en: string[]; it: string[]; sv: string[] }
  roles: { en: string[]; it: string[]; sv: string[] }
  intentPatterns: IntentPattern[]
  seedKeywords: { en: string[]; it: string[]; sv: string[] }
}

const BUCKET_LABELS = {
  en: {
    B1: 'Brand & Competitor',
    B2: 'Category Creation',
    B3: 'Problem / JTBD',
    B4: 'Buyer Intent (B2B)',
    B5: 'Compliance & Risk',
  },
  it: {
    B1: 'Brand e Competitor',
    B2: 'Creazione di Categoria',
    B3: 'Problema / JTBD',
    B4: 'Intento di Acquisto (B2B)',
    B5: 'Conformità e Rischi',
  },
  sv: {
    B1: 'Varumärke och Konkurrenter',
    B2: 'Kategoriskapande',
    B3: 'Problem / JTBD',
    B4: 'Köpintention (B2B)',
    B5: 'Regelefterlevnad och Risk',
  },
}

const LLM_TARGETS = ['chatgpt', 'claude', 'perplexity', 'gemini'] as const

export type Locale = 'en' | 'it' | 'sv'

/**
 * Strip protocol + trailing slash + path from a raw domain string so it
 * renders cleanly inside a prompt ("acasting.se" not "https://acasting.se/").
 * Exported so unit tests can pin the normalisation behavior.
 */
export function normaliseDomainForPrompt(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '')
}

/**
 * Decide whether a brand name needs a domain anchor in generated prompts
 * to avoid homonym confusion (e.g. "Acasting" → "Acasting (acasting.se)").
 *
 * Heuristic: single-word names ≤14 chars. Multi-word names are usually
 * self-disambiguating ("Savant Media AB" doesn't get confused with the
 * word "savant"); long single-word names are typically distinctive
 * enough on their own. The exact bounds err on the side of MORE
 * anchoring — extra context never hurts AI grounding.
 */
export function shouldAnchorBrandDomain(brand: string): boolean {
  const trimmed = brand.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > 14) return false
  if (/\s/.test(trimmed)) return false
  return true
}

/**
 * Build the brand label that gets substituted into `{brand}` placeholders.
 * When `shouldAnchorBrandDomain` agrees AND a domain is set, returns the
 * anchored form `"<Brand> (<domain>)"`. Otherwise the bare brand. The
 * anchored form forces AI engines to lock onto THIS entity at query
 * time instead of guessing between same-named alternatives.
 */
export function anchorBrand(brand: string, domain?: string | null): string {
  const cleanDomain = normaliseDomainForPrompt(domain)
  if (!cleanDomain) return brand
  if (!shouldAnchorBrandDomain(brand)) return brand
  return `${brand} (${cleanDomain})`
}

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: 'casting-talent',
    name: { en: 'Casting & Talent', it: 'Casting e Talenti', sv: 'Casting och Talanger' },
    description: {
      en: 'Actors, extras, models, and talent platforms. Monitor brand visibility across casting industry queries.',
      it: 'Attori, comparse, modelle e piattaforme di talenti. Monitora la visibilità del brand nelle ricerche del settore casting.',
      sv: 'Skådespelare, statister, modeller och talangplattformar. Övervaka varumärkets synlighet inom castingbranschen.',
    },
    competitors: ['Stagepool', 'StarNow', 'Backstage', 'Spotlight', 'ActorAccess'],
    localCompetitors: {
      sv: ['Roller.nu', 'Filmtalang.se', 'Scenkonstportalen', 'Dramaten', 'Svenska Filminstitutet'],
      it: ['Cast.it', 'FilmAudition.it', 'Talent4Show'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} recension',
        '{brand} eller {competitor} vilket är bäst',
        'är {brand} seriöst',
        '{brand} kostnad pris',
        'hur fungerar {brand}',
        'vad kostar {brand}',
        '{brand} för {role}',
        'bästa {category} för {role} i {location}',
        'lediga {role} jobb {location}',
        '{brand} {competitor} jämförelse',
        '{brand} omdöme {location}',
        'söker {role} till {category} {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} funziona',
        '{brand} è affidabile',
        '{brand} costo abbonamento',
        '{brand} per {role}',
        'miglior {category} {location}',
        'alternative a {competitor} {location}',
      ],
    },
    categories: {
      en: ['casting platform', 'talent agency', 'digital portfolio', 'audition platform'],
      it: [
        'piattaforma di casting',
        'agenzia talenti',
        'portfolio digitale',
        'piattaforma audizioni',
      ],
      sv: ['castingplattform', 'talangförmedling', 'digital portfolio', 'auditionsplattform'],
    },
    roles: {
      en: ['actor', 'actress', 'extras', 'background actor', 'model', 'talent'],
      it: ['attore', 'attrice', 'comparsa', 'figurante', 'modello', 'talento'],
      sv: ['skådespelare', 'skådespelerska', 'statister', 'bakgrundsaktör', 'modell', 'talang'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to find {role} {location}', priority: 'medium' },
      {
        bucket: 'B3',
        template: 'what is the best way to get {role} jobs {location}',
        priority: 'medium',
      },
      { bucket: 'B4', template: '{brand} pricing plans', priority: 'high' },
      { bucket: 'B4', template: '{brand} for production companies', priority: 'high' },
      { bucket: 'B4', template: '{brand} features benefits', priority: 'high' },
      { bucket: 'B5', template: '{brand} gdpr data protection', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} safe legitimate', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['casting', 'talent platform', 'audition', 'acting jobs'],
      it: ['casting', 'piattaforma talenti', 'audizione', 'lavoro attore'],
      sv: ['casting', 'talangplattform', 'audition', 'skådespelarjobb'],
    },
  },
  {
    id: 'saas-b2b',
    name: { en: 'SaaS B2B', it: 'SaaS B2B', sv: 'SaaS B2B' },
    description: {
      en: 'B2B software platforms. Monitor brand visibility across SaaS industry queries targeting decision-makers.',
      it: 'Piattaforme software B2B. Monitora la visibilità del brand nelle ricerche del settore SaaS per decision-maker.',
      sv: 'B2B-programvaruplattformar. Övervaka varumärkets synlighet inom SaaS-branschen för beslutsfattare.',
    },
    competitors: ['Salesforce', 'HubSpot', 'Monday.com', 'Asana', 'Notion', 'Slack'],
    localCompetitors: {
      sv: ['Fortnox', 'Visma', 'Sitevision', '24SevenOffice', 'LexOffice'],
      it: ['Zucchetti', 'TeamSystem', 'FattureInCloud', 'WeFinance'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} recension',
        '{brand} eller {competitor} vilket är bäst',
        '{brand} pris {location}',
        '{brand} för {role}',
        '{brand} integration {competitor}',
        '{brand} omdöme {location}',
        'bästa {category} för {role}',
        '{brand} support svenska',
      ],
      it: [
        '{brand} {location} recensione',
        '{brand} o {competitor} quale scegliere',
        '{brand} prezzi {location}',
        '{brand} per {role}',
        'miglior {category} {location}',
        '{brand} assistenza italiana',
      ],
    },
    categories: {
      en: ['project management software', 'CRM platform', 'productivity tool', 'SaaS platform'],
      it: [
        'software project management',
        'piattaforma CRM',
        'strumento di produttività',
        'piattaforma SaaS',
      ],
      sv: ['projektledningsprogram', 'CRM-plattform', 'produktivitetsverktyg', 'SaaS-plattform'],
    },
    roles: {
      en: ['project manager', 'team lead', 'CTO', 'operations manager', 'founder'],
      it: ['project manager', 'team leader', 'CTO', 'responsabile operativo', 'fondatore'],
      sv: ['projektledare', 'teamledare', 'CTO', 'operationschef', 'grundare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {year}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: '{brand} alternative', priority: 'high' },
      { bucket: 'B2', template: 'best {category} for {role}', priority: 'high' },
      {
        bucket: 'B3',
        template: 'how to improve team productivity with {category}',
        priority: 'medium',
      },
      { bucket: 'B4', template: '{brand} pricing', priority: 'high' },
      { bucket: 'B4', template: '{brand} enterprise features', priority: 'high' },
      { bucket: 'B4', template: '{brand} for {role}', priority: 'high' },
      { bucket: 'B5', template: '{brand} security compliance', priority: 'medium' },
      { bucket: 'B5', template: '{brand} data privacy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['project management', 'CRM', 'productivity', 'team collaboration'],
      it: ['project management', 'CRM', 'produttività', 'collaborazione team'],
      sv: ['projektledning', 'CRM', 'produktivitet', 'teamsamarbete'],
    },
  },
  {
    id: 'ecommerce',
    name: { en: 'E-commerce', it: 'E-commerce', sv: 'E-handel' },
    description: {
      en: 'Online retail and marketplace brands. Monitor visibility across shopping and product discovery queries.',
      it: 'Brand di vendita al dettaglio online e marketplace. Monitora la visibilità nelle ricerche di shopping e scoperta prodotti.',
      sv: 'Onlinebutiker och marknadsplatser. Övervaka synlighet i shopping- och produktupptäcktsökningar.',
    },
    competitors: ['Amazon', 'eBay', 'Etsy', 'Shopify', 'Zalando', 'Wish'],
    localCompetitors: {
      sv: ['CDON', 'Adlibris', 'Apotea', 'Boozt', 'Lykos', 'Mathem'],
      it: ['Subito', 'Vinted', 'Privalia', 'Salidoo', 'Eprice'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        'handla på {brand} {location}',
        '{brand} frakt kostnad',
        'är {brand} pålitligt',
        '{brand} rabattkod',
        'köpa {category} på {brand}',
        '{brand} retur policy',
        '{brand} leveranstid {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} spedizione {location}',
        '{brand} è affidabile',
        '{brand} codice sconto',
        'comprare {category} su {brand}',
        '{brand} reso gratuito',
        '{brand} tempi consegna {location}',
      ],
    },
    categories: {
      en: ['online store', 'marketplace', 'shopping platform', 'ecommerce platform'],
      it: ['negozio online', 'marketplace', 'piattaforma di shopping', 'piattaforma ecommerce'],
      sv: ['nätbutik', 'marknadsplats', 'shoppingplattform', 'e-handelsplattform'],
    },
    roles: {
      en: ['online shopper', 'small business owner', 'retailer', 'merchant'],
      it: ['acquirente online', 'piccolo imprenditore', 'rivenditore', 'commerciante'],
      sv: ['onlineshoppare', 'småföretagare', 'återförsäljare', 'handlare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: 'shop on {brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'buy {product} online {location}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to return {brand}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} coupon discount code', priority: 'high' },
      { bucket: 'B4', template: '{brand} shipping times', priority: 'medium' },
      { bucket: 'B5', template: '{brand} refund policy', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} legit', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['online shopping', 'buy', 'discount', 'marketplace', 'delivery'],
      it: ['shopping online', 'comprare', 'sconto', 'marketplace', 'consegna'],
      sv: ['handla online', 'köp', 'rabatt', 'marknadsplats', 'leverans'],
    },
  },
  {
    // Re-commerce / price meta-search: brands whose product is FINDING the
    // lowest price across many sellers, not selling stock themselves. Distinct
    // from `ecommerce` on purpose — its templates ask "buy/shop on {brand}",
    // which measures the wrong intent for a comparison engine and reinforces
    // the "it's a shop" category the engines already wrongly assume.
    id: 'recommerce-comparison',
    name: {
      en: 'Re-Commerce & Price Comparison',
      it: 'Usato e Comparazione Prezzi',
      sv: 'Begagnat & Prisjämförelse',
    },
    description: {
      en: 'Second-hand marketplaces and price-comparison / meta-search brands that help buyers find the lowest price across sellers. Monitor visibility on "cheapest", "compare prices", and "where to buy used" queries.',
      it: 'Marketplace dell\'usato e comparatori di prezzo / meta-ricerca che aiutano a trovare il prezzo più basso tra più venditori. Monitora la visibilità su ricerche "più economico", "confronta prezzi" e "dove comprare usato".',
      sv: 'Begagnatmarknader och prisjämförelse- / meta-söktjänster som hjälper köpare att hitta lägsta pris hos flera säljare. Bevaka synlighet på "billigast", "jämför priser" och "var köper man begagnat".',
    },
    competitors: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'PriceRunner', 'Prisjakt'],
    localCompetitors: {
      sv: ['Blocket', 'Tradera', 'Sellpy', 'Prisjakt', 'PriceRunner', 'Plick'],
      it: ['Subito', 'Vinted', 'Wallapop', 'idealo', 'Trovaprezzi'],
    },
    localizedTemplates: {
      sv: [
        '{brand} omdöme',
        'är {brand} pålitligt',
        'är {brand} säkert att använda',
        '{brand} vs {competitor}',
        'jämför priser på begagnat {location}',
        'var köper jag {category} billigast {location}',
        'köpa begagnad {category} {location}',
        'bästa sajt för att jämföra priser på begagnat',
        'hitta billigaste {category} {location}',
        'hur fungerar {brand}',
      ],
      it: [
        '{brand} recensioni',
        '{brand} è affidabile',
        'è sicuro usare {brand}',
        '{brand} vs {competitor}',
        'confronta prezzi usato {location}',
        'dove comprare {category} al prezzo più basso {location}',
        'comprare {category} usato {location}',
        "miglior sito per confrontare prezzi dell'usato",
        'trovare {category} usato più economico {location}',
        'come funziona {brand}',
      ],
    },
    // PRODUCT categories a user actually searches to buy/compare — {category}
    // is hydrated from here, so these must be the goods (electronics, furniture,
    // …), NOT the business model. "var köper jag elektronik billigast", never
    // "var köper jag prisjämförelse billigast".
    categories: {
      en: ['electronics', 'furniture', 'clothing', 'home goods', 'phones'],
      it: ['elettronica', 'mobili', 'abbigliamento', 'arredamento', 'telefoni'],
      sv: ['elektronik', 'möbler', 'kläder', 'heminredning', 'telefoner'],
    },
    roles: {
      en: ['bargain hunter', 'second-hand buyer', 'budget shopper', 'reseller'],
      it: [
        'cacciatore di offerte',
        "acquirente dell'usato",
        'acquirente attento al budget',
        'rivenditore',
      ],
      sv: ['fyndjägare', 'begagnatköpare', 'budgetshoppare', 'återförsäljare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: 'is {brand} reliable', priority: 'medium' },
      { bucket: 'B2', template: 'compare prices for {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'cheapest {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'best site to buy used {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'where to find the cheapest {category}', priority: 'medium' },
      { bucket: 'B3', template: 'how does {brand} work', priority: 'medium' },
      { bucket: 'B4', template: 'buy second-hand {category} {location}', priority: 'high' },
      { bucket: 'B5', template: 'is {brand} safe to use', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} legit', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['price comparison', 'cheapest', 'second-hand', 'used', 'compare prices'],
      it: ['comparazione prezzi', 'più economico', 'usato', 'confronta prezzi', 'occasioni'],
      sv: ['prisjämförelse', 'billigast', 'begagnat', 'jämför priser', 'fynd'],
    },
  },
  {
    id: 'local-business',
    name: { en: 'Local Business', it: 'Attività Locali', sv: 'Lokalt Företag' },
    description: {
      en: 'Brick-and-mortar and local service businesses. Monitor visibility across local discovery and review queries.',
      it: 'Negozi fisici e servizi locali. Monitora la visibilità nelle ricerche di scoperta locale e recensioni.',
      sv: 'Fysiska butiker och lokala tjänsteföretag. Övervaka synlighet i lokala sökningar och recensioner.',
    },
    competitors: ['Google Maps', 'Yelp', 'TripAdvisor', 'Foursquare'],
    localCompetitors: {
      sv: ['Eniro', 'Hitta.se', 'Reco.se', 'Allabolag', 'Bokadirekt'],
      it: ['Trovacibo', 'QualeScegliere', 'IlPagineGialle', 'ProntoPro'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        '{brand} {location} öppettider',
        'bästa {category} i {location}',
        '{brand} {location} recensioner',
        '{brand} {location} pris',
        '{category} {location} rekommendationer',
        'är {brand} {location} öppet',
        '{brand} {location} betyg',
        'hitta {brand} {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} {location} orari',
        'miglior {category} {location}',
        '{brand} {location} prezzo',
        '{category} {location} consigliato',
      ],
    },
    categories: {
      en: ['local business', 'restaurant', 'service provider', 'shop'],
      it: ['attività locale', 'ristorante', 'fornitore di servizi', 'negozio'],
      sv: ['lokalt företag', 'restaurang', 'tjänsteleverantör', 'butik'],
    },
    roles: {
      en: ['local customer', 'tourist', 'resident', 'regular client'],
      it: ['cliente locale', 'turista', 'residente', 'cliente abituale'],
      sv: ['lokal kund', 'turist', 'boende', 'återkommande kund'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location} hours', priority: 'high' },
      { bucket: 'B2', template: 'best {category} near {location}', priority: 'high' },
      { bucket: 'B3', template: '{category} {location} recommendations', priority: 'medium' },
      { bucket: 'B4', template: '{brand} menu prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} booking reservation {location}', priority: 'medium' },
      { bucket: 'B5', template: '{brand} hygiene rating {location}', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} {location} open', priority: 'low' },
    ],
    seedKeywords: {
      en: ['near me', 'local', 'best', 'reviews', 'open now'],
      it: ['vicino a me', 'locale', 'migliori', 'recensioni', 'aperto ora'],
      sv: ['nära mig', 'lokal', 'bästa', 'recensioner', 'öppet nu'],
    },
  },
  {
    id: 'real-estate',
    name: { en: 'Real Estate', it: 'Immobiliare', sv: 'Fastigheter' },
    description: {
      en: 'Real estate agencies, brokers, and property platforms. Monitor visibility across property search and agent discovery queries.',
      it: 'Agenzie immobiliari, broker e piattaforme immobiliari. Monitora la visibilità nelle ricerche di proprietà e agenti.',
      sv: 'Fastighetsmäklare, mäklarfirmor och bostadsplattformar. Övervaka synlighet i bostadssökningar.',
    },
    competitors: [
      'Hemnet',
      'Booli',
      'Bostad Direkt',
      'Obos',
      'SkandiaMäklarna',
      'Svensk Fastighetsförmedling',
    ],
    localCompetitors: {
      sv: [
        'Hemnet',
        'Booli',
        'Bostad Direkt',
        'Svensk Fastighetsförmedling',
        'SkandiaMäklarna',
        'Notar',
        'Fastighetsbyrån',
        'Mäklarhuset',
      ],
      it: ['Immobiliare.it', 'Casa.it', 'Idealista', 'Tecnocasa', 'Gabetti'],
    },
    localizedTemplates: {
      sv: [
        'bästa mäklaren {location}',
        '{brand} {location} omdöme',
        '{brand} {location} recension',
        'sälja lägenhet {location} mäklare',
        '{brand} provision arvode',
        '{brand} {competitor} jämförelse',
        'värdering bostad {location} {brand}',
        '{brand} kundrecensioner {location}',
        'köpa bostad {location} tips',
        '{brand} eller {competitor} vilken mäklare är bäst',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale agenzia scegliere',
        'vendere casa {location} {brand}',
        '{brand} provvigione costi',
        'miglior agenzia immobiliare {location}',
        '{brand} valore casa {location}',
      ],
    },
    categories: {
      en: ['real estate agency', 'property platform', 'mortgage broker', 'home valuation'],
      it: ['agenzia immobiliare', 'piattaforma immobiliare', 'broker mutui', 'valutazione casa'],
      sv: ['fastighetsmäklare', 'bostadsplattform', 'mäklare', 'bostadsförmedling'],
    },
    roles: {
      en: ['home buyer', 'home seller', 'property investor', 'tenant'],
      it: ['acquirente', 'venditore', 'investitore immobiliare', 'affittuario'],
      sv: ['bostadsköpare', 'bostadssäljare', 'fastighetsinvesterare', 'hyresgäst'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: '{category} near {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to sell property {location}', priority: 'medium' },
      { bucket: 'B3', template: '{brand} selling process', priority: 'medium' },
      { bucket: 'B4', template: '{brand} commission fees {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} home valuation {location}', priority: 'high' },
      { bucket: 'B5', template: '{brand} license credentials', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} trustworthy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['real estate agent', 'home for sale', 'property', 'mortgage'],
      it: ['agenzia immobiliare', 'case in vendita', 'proprietà', 'mutuo'],
      sv: ['fastighetsmäklare', 'bostad till salu', 'lägenhet', 'mäklare'],
    },
  },
  {
    id: 'healthcare',
    name: { en: 'Healthcare', it: 'Sanità', sv: 'Hälsa & Sjukvård' },
    description: {
      en: 'Private healthcare providers, clinics, and wellness platforms. Monitor visibility across healthcare search queries.',
      it: 'Fornitori sanitari privati, cliniche e piattaforme di benessere. Monitora la visibilità nelle ricerche sanitarie.',
      sv: 'Privata vårdgivare, vårdcentraler och hälsoplattformar. Övervaka synlighet i vårdrelaterade sökningar.',
    },
    competitors: ['Kry', 'Doktor.se', 'Min Doktor', 'Praktikertjänst', 'Capio', 'Aleris'],
    localCompetitors: {
      sv: [
        'Kry',
        'Doktor.se',
        'Min Doktor',
        '1177',
        'Praktikertjänst',
        'Capio',
        'Aleris',
        'Medicover',
        'CityAkuten',
      ],
      it: ['MioDottore', 'Dottori.it', 'PagineMediche', 'Curamed', 'Humanitas'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        '{brand} {location} recension',
        'bästa vårdcentral {location}',
        '{brand} priser {location}',
        '{brand} {competitor} jämför',
        'är {brand} bra {location}',
        '{brand} väntetid {location}',
        'privat läkare {location} {brand}',
        'BVC {location} {brand}',
        '{brand} patientomdömen',
        'boka tid {brand} {location}',
        '{brand} för {role}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale clinica',
        'miglior medico {location}',
        '{brand} costi visite {location}',
        'prenotare visita {brand} {location}',
        '{brand} è convenzionato',
      ],
    },
    categories: {
      en: ['private clinic', 'doctor', 'healthcare platform', 'wellness center'],
      it: ['clinica privata', 'medico', 'piattaforma sanitaria', 'centro benessere'],
      sv: ['vårdcentral', 'läkare', 'vårdplattform', 'hälsocenter'],
    },
    roles: {
      en: ['patient', 'parent', 'senior care', 'specialist doctor'],
      it: ['paziente', 'genitore', 'assistenza anziani', 'medico specialista'],
      sv: ['patient', 'förälder', 'äldreomsorg', 'specialistläkare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {competitor} comparison', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to book appointment {brand}', priority: 'medium' },
      { bucket: 'B3', template: '{brand} services offered', priority: 'medium' },
      { bucket: 'B4', template: '{brand} prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} insurance accepted', priority: 'high' },
      { bucket: 'B5', template: '{brand} patient data security', priority: 'medium' },
      { bucket: 'B5', template: '{brand} medical license', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['doctor', 'clinic', 'healthcare', 'medical appointment'],
      it: ['medico', 'clinica', 'sanità', 'visita medica'],
      sv: ['läkare', 'vårdcentral', 'sjukvård', 'boka läkartid'],
    },
  },
  {
    id: 'education',
    name: { en: 'Education', it: 'Istruzione', sv: 'Utbildning' },
    description: {
      en: 'Schools, universities, adult education, and learning platforms. Monitor visibility across education search queries.',
      it: 'Scuole, università, istruzione per adulti e piattaforme di apprendimento. Monitora la visibilità nelle ricerche educative.',
      sv: 'Skolor, universitet, Komvux och lärplattformar. Övervaka synlighet i utbildningsrelaterade sökningar.',
    },
    competitors: ['Komvux', 'Yrkeshögskolan', 'Campus', 'Folkuniversitetet', 'Medlearn', 'Sensus'],
    localCompetitors: {
      sv: [
        'Komvux',
        'Yrkeshögskolan',
        'Folkuniversitetet',
        'Medlearn',
        'Sensus',
        'Hermods',
        'Academedia',
        'Antagning.se',
        'Studera.nu',
      ],
      it: ['UniMi', 'Politecnico', 'Coursera Italia', 'Maturità', 'EdX Italia'],
    },
    localizedTemplates: {
      sv: [
        'bästa {program} utbildning {location}',
        '{brand} {location} recension',
        '{brand} {competitor} jämför',
        '{brand} antagningspoäng {location}',
        '{brand} kostnad avgifter',
        'plugga till {role} {location}',
        '{brand} distansutbildning',
        '{brand} studievägledning {location}',
        'är {brand} bra utbildning',
        '{brand} omdöme student',
        '{brand} kurser {location}',
        'söka till {brand} {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale università',
        "{brand} test d'ingresso {location}",
        '{brand} tasse universitarie',
        'miglior corso {category} {location}',
        '{brand} laurea {role}',
      ],
    },
    categories: {
      en: ['university', 'college', 'online course', 'vocational training'],
      it: ['università', 'college', 'corso online', 'formazione professionale'],
      sv: ['universitet', 'högskola', 'distanskurs', 'yrkesutbildning'],
    },
    roles: {
      en: ['student', 'graduate', 'professional learner', 'career changer'],
      it: ['studente', 'laureato', 'professionista in formazione', 'cambiamento carriera'],
      sv: ['student', 'examen', 'yrkesväxlare', 'kompetensutveckling'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'top {category} programs {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to apply {brand}', priority: 'medium' },
      { bucket: 'B3', template: '{brand} admission requirements', priority: 'medium' },
      { bucket: 'B4', template: '{brand} tuition fees {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} scholarships', priority: 'medium' },
      { bucket: 'B5', template: '{brand} accreditation', priority: 'medium' },
      { bucket: 'B5', template: '{brand} degree recognition', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['education', 'university', 'course', 'study', 'degree'],
      it: ['istruzione', 'università', 'corso', 'studiare', 'laurea'],
      sv: ['utbildning', 'universitet', 'kurs', 'studera', 'examen'],
    },
  },
  {
    id: 'hospitality',
    name: { en: 'Hospitality & Tourism', it: 'Ospitalità e Turismo', sv: 'Besöksnäring & Turism' },
    description: {
      en: 'Hotels, restaurants, and tourism businesses. Monitor visibility across travel and dining search queries.',
      it: 'Hotel, ristoranti e attività turistiche. Monitora la visibilità nelle ricerche di viaggi e ristorazione.',
      sv: 'Hotell, restauranger och turistföretag. Övervaka synlighet i rese- och restaurangsökningar.',
    },
    competitors: ['Booking.com', 'Expedia', 'TripAdvisor', 'TheFork', 'OpenTable'],
    localCompetitors: {
      sv: [
        'Hotels.com',
        'Eatbu.com',
        'BokaBord.se',
        'VisitSweden',
        'Strawberry',
        'Elite Hotels',
        'Scandic',
      ],
      it: ['TheFork Italia', 'Booking Italia', 'Agriturismo.it', 'Turismo.it', 'Italia.it'],
    },
    localizedTemplates: {
      sv: [
        'bästa hotellet i {location}',
        '{brand} {location} recension',
        '{brand} {location} pris',
        'restaurang {location} {brand}',
        '{brand} {competitor} jämför',
        '{brand} {location} omdöme',
        'boka {brand} {location}',
        'billigaste {brand} {location}',
        '{brand} frukost ingår',
        '{brand} {location} betyg',
        'resa till {location} {brand}',
        '{brand} {location} meny priser',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale hotel',
        'miglior ristorante {location}',
        '{brand} {location} prezzo',
        'prenotare {brand} {location}',
        'offerta {brand} {location}',
      ],
    },
    categories: {
      en: ['hotel', 'restaurant', 'travel agency', 'tourism platform'],
      it: ['hotel', 'ristorante', 'agenzia di viaggi', 'piattaforma turistica'],
      sv: ['hotell', 'restaurang', 'resebyrå', 'turistplattform'],
    },
    roles: {
      en: ['traveler', 'tourist', 'foodie', 'business traveler'],
      it: ['viaggiatore', 'turista', 'appassionato di cucina', "viaggiatore d'affari"],
      sv: ['resenär', 'turist', 'matentusiast', 'affärsresenär'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} in {location}', priority: 'high' },
      { bucket: 'B2', template: 'top rated {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to cancel {brand} booking', priority: 'medium' },
      { bucket: 'B4', template: '{brand} {location} deals offers', priority: 'high' },
      { bucket: 'B4', template: '{brand} loyalty program', priority: 'medium' },
      { bucket: 'B5', template: '{brand} cancellation policy', priority: 'medium' },
      { bucket: 'B5', template: '{brand} health safety {location}', priority: 'low' },
    ],
    seedKeywords: {
      en: ['hotel', 'restaurant', 'travel', 'booking', 'vacation'],
      it: ['hotel', 'ristorante', 'viaggio', 'prenotazione', 'vacanza'],
      sv: ['hotell', 'restaurang', 'resa', 'bokning', 'semester'],
    },
  },
  {
    id: 'automotive',
    name: { en: 'Automotive', it: 'Automotive', sv: 'Fordon & Bil' },
    description: {
      en: 'Car dealers, repair shops, and automotive service brands. Monitor visibility across vehicle and service queries.',
      it: 'Concessionari auto, officine e brand di servizi automobilistici. Monitora la visibilità nelle ricerche di veicoli.',
      sv: 'Bilhandlare, bilverkstäder och fordonsservice. Övervaka synlighet i fordonsrelaterade sökningar.',
    },
    competitors: ['Blocket', 'Toyota', 'Volvo', 'Mekonomen', 'Bilia', 'Hedin Bil'],
    localCompetitors: {
      sv: [
        'Blocket',
        'Bilia',
        'Hedin Bil',
        'Mekonomen',
        'Autoexperten',
        'Riddermark Bil',
        'Kvdbil',
        'Carspect',
        'Besikta',
      ],
      it: ['AutoScout24', 'Subito Auto', 'Quattroruote', 'Pneumatici.it', 'Eurocar'],
    },
    localizedTemplates: {
      sv: [
        'köpa begagnad bil {location}',
        '{brand} {location} omdöme',
        '{brand} {location} recension',
        'bästa bilverkstaden {location}',
        '{brand} service pris {location}',
        '{brand} {competitor} jämför',
        'bilbesiktning {location} {brand}',
        '{brand} däckbyte pris',
        'leasa bil {brand} {location}',
        '{brand} kundomdömen {location}',
        '{brand} {location} öppettider',
        'verkstad {location} {brand}',
      ],
      it: [
        'comprare auto usata {location}',
        '{brand} {location} recensioni',
        '{brand} officina {location}',
        'miglior concessionario {location}',
        '{brand} tagliando prezzo {location}',
        '{brand} o {competitor} quale auto',
      ],
    },
    categories: {
      en: ['car dealer', 'auto repair', 'car rental', 'vehicle inspection'],
      it: ['concessionario auto', 'officina', 'noleggio auto', 'revisione veicoli'],
      sv: ['bilhandlare', 'bilverkstad', 'biluthyrning', 'bilbesiktning'],
    },
    roles: {
      en: ['car buyer', 'car owner', 'driver', 'fleet manager'],
      it: ['acquirente auto', 'proprietario auto', 'conducente', 'gestore flotta'],
      sv: ['bilköpare', 'bilägare', 'förare', 'flottchef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: '{brand} service cost {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to book {brand} appointment', priority: 'medium' },
      { bucket: 'B4', template: '{brand} prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} financing options', priority: 'medium' },
      { bucket: 'B5', template: '{brand} warranty coverage', priority: 'medium' },
      { bucket: 'B5', template: '{brand} customer complaints', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['car dealer', 'auto repair', 'used cars', 'car service'],
      it: ['concessionario', 'officina', 'auto usate', 'tagliando'],
      sv: ['bilhandlare', 'bilverkstad', 'begagnad bil', 'bilservice'],
    },
  },
  {
    id: 'construction',
    name: {
      en: 'Construction & Renovation',
      it: 'Costruzioni e Ristrutturazioni',
      sv: 'Bygg & Renovering',
    },
    description: {
      en: 'Construction companies, contractors, and renovation services. Monitor visibility across building and home improvement queries.',
      it: 'Imprese edili, appaltatori e servizi di ristrutturazione. Monitora la visibilità nelle ricerche di costruzione e miglioramento casa.',
      sv: 'Byggföretag, hantverkare och renoveringstjänster. Övervaka synlighet i bygg- och hemförbättringssökningar.',
    },
    competitors: ['JM', 'Skanska', 'NCC', 'Peab', 'Derome', 'Byggmax'],
    localCompetitors: {
      sv: [
        'JM',
        'Skanska',
        'NCC',
        'Peab',
        'Derome',
        'Byggmax',
        'Beijer',
        'XL-Bygg',
        'K-rauta',
        'Bygghemma',
        'Offerta.se',
      ],
      it: ['Edilportale', 'Habitat', 'GruppoMade', 'Bricoman', 'Leroy Merlin Italia'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        'byggfirma {location} {brand}',
        'renovera kök {location} offert',
        '{brand} pris {location}',
        'hantverkare {location} {brand}',
        '{brand} {competitor} jämför',
        '{brand} badrumsrenovering pris',
        'nybyggnation {location} {brand}',
        '{brand} kundrecensioner',
        'offerter {category} {location}',
        '{brand} fasadrenovering',
        'billigaste byggfirman {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        'impresa edile {location} {brand}',
        'ristrutturare casa {location} preventivo',
        '{brand} prezzi {location}',
        '{brand} o {competitor} quale impresa',
        'miglior {category} {location}',
      ],
    },
    categories: {
      en: ['construction company', 'contractor', 'renovation service', 'home improvement'],
      it: ['impresa edile', 'appaltatore', 'ristrutturazione', 'miglioramento casa'],
      sv: ['byggföretag', 'entreprenör', 'renovering', 'hemförbättring'],
    },
    roles: {
      en: ['homeowner', 'property developer', 'contractor', 'architect'],
      it: ['proprietario casa', 'sviluppatore immobiliare', 'appaltatore', 'architetto'],
      sv: ['husägare', 'fastighetsutvecklare', 'entreprenör', 'arkitekt'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: '{category} near {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to get renovation quote {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} renovation cost {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} project portfolio', priority: 'medium' },
      { bucket: 'B5', template: '{brand} insurance license', priority: 'medium' },
      { bucket: 'B5', template: '{brand} warranty workmanship', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['contractor', 'renovation', 'construction', 'home improvement', 'builder'],
      it: ['impresa edile', 'ristrutturazione', 'costruzione', 'miglioramento casa', 'appaltatore'],
      sv: ['byggfirma', 'renovering', 'bygg', 'hemförbättring', 'hantverkare'],
    },
  },
  {
    id: 'marketing-advertising',
    name: {
      en: 'Marketing & Advertising',
      it: 'Marketing e Pubblicità',
      sv: 'Marknadsföring & Reklam',
    },
    description: {
      en: 'Advertising, media, PR, and digital marketing agencies. Monitor visibility across agency-selection and campaign queries.',
      it: 'Agenzie pubblicitarie, media, PR e marketing digitale. Monitora la visibilità nelle ricerche di selezione agenzia e campagne.',
      sv: 'Reklam-, medie-, PR- och digitalmarknadsföringsbyråer. Övervaka synlighet i sökningar om byråval och kampanjer.',
    },
    competitors: ['Ogilvy', 'Publicis', 'WPP', 'Dentsu', 'Accenture Song', 'Havas'],
    localCompetitors: {
      sv: [
        'Forsman & Bodenfors',
        'Åkestam Holst',
        'NORD DDB',
        'Garbergs',
        'Prime Weber Shandwick',
        'Hjärta',
        'King',
      ],
      it: ['Armando Testa', 'Publicis Italia', 'Leo Burnett Italia', 'TBWA Italia', 'DUDE'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken byrå är bäst',
        'bästa {category} i {location}',
        '{brand} kundcase referenser',
        'anlita {category} {location}',
        '{brand} pris offert',
        '{brand} {competitor} jämförelse',
        'bästa reklambyrån {location}',
        '{brand} för {role}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale agenzia scegliere',
        'miglior {category} {location}',
        '{brand} portfolio clienti',
        '{brand} prezzi preventivo',
        '{brand} per {role}',
      ],
    },
    categories: {
      en: ['advertising agency', 'media agency', 'marketing agency', 'digital agency'],
      it: ['agenzia pubblicitaria', 'agenzia media', 'agenzia di marketing', 'agenzia digitale'],
      sv: ['reklambyrå', 'mediebyrå', 'marknadsföringsbyrå', 'digital byrå'],
    },
    roles: {
      en: ['marketing manager', 'brand manager', 'CMO', 'business owner'],
      it: ['responsabile marketing', 'brand manager', 'CMO', 'imprenditore'],
      sv: ['marknadschef', 'varumärkesansvarig', 'CMO', 'företagare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {year}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: '{brand} alternative agency', priority: 'high' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing fees', priority: 'high' },
      { bucket: 'B4', template: '{brand} for {role}', priority: 'high' },
      { bucket: 'B4', template: '{brand} case studies results', priority: 'high' },
      { bucket: 'B5', template: 'is {brand} a good agency', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['marketing agency', 'advertising', 'branding', 'campaign'],
      it: ['agenzia di marketing', 'pubblicità', 'branding', 'campagna'],
      sv: ['reklambyrå', 'marknadsföring', 'varumärke', 'kampanj'],
    },
  },
  {
    id: 'professional-services',
    name: {
      en: 'Professional Services',
      it: 'Servizi Professionali',
      sv: 'Konsult & Tjänster',
    },
    description: {
      en: 'Consultancies, law, accounting, recruitment, and B2B service firms. Monitor visibility across provider-selection queries.',
      it: 'Società di consulenza, studi legali, contabilità, recruiting e servizi B2B. Monitora la visibilità nelle ricerche di selezione fornitori.',
      sv: 'Konsultbolag, jurist-, redovisnings-, rekryterings- och B2B-tjänsteföretag. Övervaka synlighet i sökningar om leverantörsval.',
    },
    competitors: ['McKinsey', 'Deloitte', 'PwC', 'KPMG', 'EY', 'Accenture'],
    localCompetitors: {
      sv: ['Knowit', 'HiQ', 'Sweco', 'Cinode', 'Centigo', 'Implement', 'Academic Work'],
      it: ['Bip', 'Reply', 'P4I', 'Spencer Stuart Italia', 'Studio Legale BonelliErede'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken är bäst',
        'bästa {category} i {location}',
        '{brand} pris arvode',
        'anlita {category} {location}',
        '{brand} {competitor} jämförelse',
        '{brand} kundrecensioner',
        '{brand} för {role}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale scegliere',
        'miglior {category} {location}',
        '{brand} costi tariffe',
        '{brand} per {role}',
      ],
    },
    categories: {
      en: ['consultancy', 'law firm', 'accounting firm', 'recruitment agency'],
      it: [
        'società di consulenza',
        'studio legale',
        'studio commercialista',
        'agenzia di recruiting',
      ],
      sv: ['konsultbyrå', 'advokatbyrå', 'redovisningsbyrå', 'rekryteringsföretag'],
    },
    roles: {
      en: ['business owner', 'HR manager', 'CFO', 'startup founder'],
      it: ['imprenditore', 'responsabile HR', 'CFO', 'fondatore startup'],
      sv: ['företagare', 'HR-chef', 'CFO', 'startupgrundare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: '{brand} alternative', priority: 'high' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing fees', priority: 'high' },
      { bucket: 'B4', template: '{brand} for {role}', priority: 'high' },
      { bucket: 'B5', template: 'is {brand} reliable', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['consultancy', 'professional services', 'B2B services', 'advisory'],
      it: ['consulenza', 'servizi professionali', 'servizi B2B', 'advisory'],
      sv: ['konsult', 'professionella tjänster', 'B2B-tjänster', 'rådgivning'],
    },
  },
  {
    id: 'beauty-wellness',
    name: {
      en: 'Beauty & Wellness',
      it: 'Bellezza e Benessere',
      sv: 'Skönhet & Välmående',
    },
    description: {
      en: 'Salons, spas, cosmetics, and wellness brands. Monitor visibility across treatment and product discovery queries.',
      it: 'Saloni, spa, cosmetici e brand wellness. Monitora la visibilità nelle ricerche di trattamenti e prodotti.',
      sv: 'Salonger, spa, kosmetik och hälsovarumärken. Övervaka synlighet i sökningar om behandlingar och produkter.',
    },
    competitors: ['Sephora', "L'Oréal", 'The Body Shop', 'Rituals', 'Lyko'],
    localCompetitors: {
      sv: ['Lyko', 'Kicks', 'Eleven', 'Bangerhead', 'Skincity', 'Cocopanda'],
      it: ['Sephora Italia', 'Douglas', 'Pinalli', 'Tigotà', 'Beautystar'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        'bästa {category} i {location}',
        '{brand} {competitor} jämför',
        '{brand} priser behandling',
        'boka {category} {location}',
        '{brand} produkter recension',
        'är {brand} bra {location}',
        '{brand} {location} betyg',
      ],
      it: [
        '{brand} {location} recensioni',
        'miglior {category} {location}',
        '{brand} prezzi trattamenti',
        'prenotare {category} {location}',
        '{brand} prodotti recensione',
      ],
    },
    categories: {
      en: ['hair salon', 'beauty salon', 'spa', 'cosmetics brand'],
      it: ['parrucchiere', 'centro estetico', 'spa', 'brand di cosmetici'],
      sv: ['frisör', 'skönhetssalong', 'spa', 'kosmetikvarumärke'],
    },
    roles: {
      en: ['customer', 'bride', 'skincare enthusiast', 'regular client'],
      it: ['cliente', 'sposa', 'appassionato skincare', 'cliente abituale'],
      sv: ['kund', 'brud', 'hudvårdsentusiast', 'stamkund'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to book {brand} appointment', priority: 'medium' },
      { bucket: 'B4', template: '{brand} prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} products review', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} {location} good', priority: 'low' },
    ],
    seedKeywords: {
      en: ['salon', 'spa', 'beauty', 'skincare'],
      it: ['salone', 'spa', 'bellezza', 'skincare'],
      sv: ['salong', 'spa', 'skönhet', 'hudvård'],
    },
  },
  {
    id: 'finance-insurance',
    name: {
      en: 'Finance & Insurance',
      it: 'Finanza e Assicurazioni',
      sv: 'Finans & Försäkring',
    },
    description: {
      en: 'Banks, insurers, fintech, and financial advisors. Monitor visibility across product-comparison and provider-trust queries.',
      it: 'Banche, assicurazioni, fintech e consulenti finanziari. Monitora la visibilità nelle ricerche di confronto prodotti e fiducia.',
      sv: 'Banker, försäkringsbolag, fintech och finansrådgivare. Övervaka synlighet i sökningar om produktjämförelser och förtroende.',
    },
    competitors: ['Klarna', 'Revolut', 'PayPal', 'N26', 'Wise'],
    localCompetitors: {
      sv: [
        'Swedbank',
        'SEB',
        'Handelsbanken',
        'Nordea',
        'Avanza',
        'Nordnet',
        'Folksam',
        'Länsförsäkringar',
      ],
      it: ['Intesa Sanpaolo', 'UniCredit', 'Fineco', 'Generali', 'Poste Italiane'],
    },
    localizedTemplates: {
      sv: [
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken är bäst',
        'bästa {category} i {location}',
        '{brand} avgifter ränta',
        '{brand} {competitor} jämför',
        'är {brand} säkert',
        '{brand} kundrecensioner',
        'bästa {category} {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale scegliere',
        'miglior {category} {location}',
        '{brand} costi commissioni',
        'è sicuro {brand}',
      ],
    },
    categories: {
      en: ['bank', 'insurance company', 'fintech app', 'financial advisor'],
      it: ['banca', 'compagnia assicurativa', 'app fintech', 'consulente finanziario'],
      sv: ['bank', 'försäkringsbolag', 'fintech-app', 'finansrådgivare'],
    },
    roles: {
      en: ['saver', 'first-time investor', 'small business owner', 'homebuyer'],
      it: [
        'risparmiatore',
        'investitore alle prime armi',
        'piccolo imprenditore',
        'acquirente casa',
      ],
      sv: ['sparare', 'förstagångsinvesterare', 'småföretagare', 'bostadsköpare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} fees rates', priority: 'high' },
      { bucket: 'B4', template: '{brand} for {role}', priority: 'high' },
      { bucket: 'B5', template: 'is {brand} safe regulated', priority: 'high' },
    ],
    seedKeywords: {
      en: ['bank', 'insurance', 'fintech', 'savings'],
      it: ['banca', 'assicurazione', 'fintech', 'risparmio'],
      sv: ['bank', 'försäkring', 'fintech', 'sparande'],
    },
  },

  // ─── EXPANDED PRESETS (2026-05-26) ────────────────────────────────────────
  // 12 additional canonical industries so the brand wizard covers the real
  // economy beyond the original 14 verticals. Each carries name/description
  // in en/it/sv plus a minimal-but-complete prompt scaffold (6 intentPatterns
  // across the 5 buckets). Operators can expand competitors and templates
  // per case; the wizard will surface these immediately.

  {
    id: 'manufacturing-industrial',
    name: {
      en: 'Manufacturing & Industrial',
      it: 'Manifattura e Industria',
      sv: 'Tillverkning & Industri',
    },
    description: {
      en: 'OEMs, contract manufacturers, industrial suppliers, machinery makers. Monitor visibility across B2B sourcing and supplier-evaluation queries.',
      it: 'OEM, produttori conto terzi, fornitori industriali, costruttori di macchinari. Monitora la visibilità nelle ricerche di sourcing B2B e valutazione fornitori.',
      sv: 'OEM-tillverkare, kontraktstillverkare, industrileverantörer, maskintillverkare. Övervaka synlighet i B2B-sourcing och leverantörsutvärderingssökningar.',
    },
    competitors: ['Siemens', 'ABB', 'Bosch', 'Schneider Electric'],
    categories: {
      en: ['manufacturer', 'industrial supplier', 'OEM', 'machinery maker'],
      it: ['produttore', 'fornitore industriale', 'OEM', 'costruttore macchinari'],
      sv: ['tillverkare', 'industrileverantör', 'OEM', 'maskintillverkare'],
    },
    roles: {
      en: ['procurement manager', 'plant engineer', 'operations director'],
      it: ['responsabile acquisti', 'ingegnere impianti', 'direttore operativo'],
      sv: ['inköpschef', 'driftingenjör', 'verksamhetschef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews specifications', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} suppliers {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} lead time pricing', priority: 'high' },
      { bucket: 'B5', template: '{brand} ISO certification compliance', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['manufacturer', 'industrial', 'OEM', 'machinery'],
      it: ['produttore', 'industriale', 'OEM', 'macchinari'],
      sv: ['tillverkare', 'industriell', 'OEM', 'maskiner'],
    },
  },

  {
    id: 'energy-utilities',
    name: {
      en: 'Energy & Utilities',
      it: 'Energia e Utility',
      sv: 'Energi & Försörjning',
    },
    description: {
      en: 'Energy producers, grid operators, renewables, water and gas utilities. Monitor visibility across rate-comparison and provider-trust queries.',
      it: 'Produttori di energia, gestori di rete, rinnovabili, utility idriche e gas. Monitora la visibilità nelle ricerche di confronto tariffe e fiducia fornitori.',
      sv: 'Energiproducenter, nätoperatörer, förnybar energi, vatten- och gasleverantörer. Övervaka synlighet i pris- och leverantörssökningar.',
    },
    competitors: ['Vattenfall', 'E.ON', 'Enel', 'Engie'],
    categories: {
      en: ['energy provider', 'utility company', 'renewable energy', 'grid operator'],
      it: ['fornitore di energia', 'utility', 'energia rinnovabile', 'gestore di rete'],
      sv: ['energileverantör', 'försörjningsbolag', 'förnybar energi', 'nätoperatör'],
    },
    roles: {
      en: ['homeowner', 'small business', 'facility manager'],
      it: ['proprietario casa', 'piccola impresa', 'facility manager'],
      sv: ['villaägare', 'småföretag', 'fastighetschef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review rates {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} pricing', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to switch {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} contract terms', priority: 'high' },
      { bucket: 'B5', template: '{brand} renewable certification', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['energy', 'electricity', 'gas', 'renewable'],
      it: ['energia', 'elettricità', 'gas', 'rinnovabile'],
      sv: ['energi', 'elektricitet', 'gas', 'förnybar'],
    },
  },

  {
    id: 'food-beverage',
    name: {
      en: 'Food & Beverage',
      it: 'Alimentare e Bevande',
      sv: 'Livsmedel & Dryck',
    },
    description: {
      en: 'Restaurants, food producers, beverage brands, catering. Monitor visibility across diner-decision and product-discovery queries.',
      it: 'Ristoranti, produttori alimentari, brand di bevande, catering. Monitora la visibilità nelle ricerche di scelta ristorante e scoperta prodotti.',
      sv: 'Restauranger, livsmedelsproducenter, dryckesvarumärken, catering. Övervaka synlighet i sökningar om restaurangval och produktupptäckt.',
    },
    competitors: ['Nestlé', 'Coca-Cola', 'Unilever'],
    categories: {
      en: ['restaurant', 'food brand', 'beverage', 'catering'],
      it: ['ristorante', 'brand alimentare', 'bevanda', 'catering'],
      sv: ['restaurang', 'matvarumärke', 'dryck', 'catering'],
    },
    roles: {
      en: ['diner', 'home cook', 'event planner'],
      it: ['cliente', 'cuoco casalingo', 'organizzatore eventi'],
      sv: ['matgäst', 'hemmakock', 'eventplanerare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'where to find {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} menu prices', priority: 'high' },
      { bucket: 'B5', template: '{brand} allergens nutrition', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['restaurant', 'food', 'beverage', 'catering'],
      it: ['ristorante', 'cibo', 'bevanda', 'catering'],
      sv: ['restaurang', 'mat', 'dryck', 'catering'],
    },
  },

  {
    id: 'retail',
    name: {
      en: 'Retail (Brick-and-Mortar)',
      it: 'Retail Fisico',
      sv: 'Detaljhandel (Fysisk)',
    },
    description: {
      en: 'Physical stores, chain retailers, department stores. Distinct from e-commerce — focus on local-search and in-store experience.',
      it: 'Negozi fisici, catene retail, grandi magazzini. Diverso da e-commerce — focus su ricerca locale ed esperienza in-store.',
      sv: 'Fysiska butiker, kedjor, varuhus. Skiljer sig från e-handel — fokus på lokalsökning och butiksupplevelse.',
    },
    competitors: ['IKEA', 'H&M', 'Zara'],
    categories: {
      en: ['retail store', 'chain', 'department store', 'specialty shop'],
      it: ['negozio retail', 'catena', 'grande magazzino', 'negozio specializzato'],
      sv: ['butik', 'kedja', 'varuhus', 'specialbutik'],
    },
    roles: {
      en: ['shopper', 'family buyer', 'gift buyer'],
      it: ['acquirente', 'famiglia', 'acquirente regalo'],
      sv: ['kund', 'familjeköpare', 'gåvoköpare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} store {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'where to buy {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} opening hours {location}', priority: 'high' },
      { bucket: 'B5', template: '{brand} return policy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['retail', 'store', 'shop', 'shopping'],
      it: ['retail', 'negozio', 'shopping'],
      sv: ['detaljhandel', 'butik', 'shopping'],
    },
  },

  {
    id: 'logistics-transportation',
    name: {
      en: 'Logistics & Transportation',
      it: 'Logistica e Trasporti',
      sv: 'Logistik & Transport',
    },
    description: {
      en: 'Freight, shipping, last-mile delivery, fleet operators, 3PLs. Monitor visibility across carrier-selection and SLA queries.',
      it: 'Trasporti merci, spedizioni, last-mile, gestori flotte, 3PL. Monitora la visibilità nelle ricerche di selezione corriere e SLA.',
      sv: 'Gods, frakt, sista-milen-leverans, flottoperatörer, 3PL. Övervaka synlighet i transportörsval och SLA-sökningar.',
    },
    competitors: ['DHL', 'FedEx', 'UPS', 'PostNord'],
    categories: {
      en: ['freight forwarder', 'courier', 'logistics provider', '3PL'],
      it: ['spedizioniere', 'corriere', 'fornitore logistica', '3PL'],
      sv: ['speditör', 'kurir', 'logistikleverantör', '3PL'],
    },
    roles: {
      en: ['shipper', 'e-commerce merchant', 'supply chain manager'],
      it: ['spedizioniere', 'merchant e-commerce', 'responsabile supply chain'],
      sv: ['avsändare', 'e-handlare', 'supply chain-chef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review shipping', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} delivery times', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} rates pricing', priority: 'high' },
      { bucket: 'B5', template: '{brand} customs duties tracking', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['logistics', 'shipping', 'freight', 'courier'],
      it: ['logistica', 'spedizione', 'trasporto', 'corriere'],
      sv: ['logistik', 'frakt', 'transport', 'kurir'],
    },
  },

  {
    id: 'media-entertainment',
    name: {
      en: 'Media & Entertainment',
      it: 'Media e Intrattenimento',
      sv: 'Media & Underhållning',
    },
    description: {
      en: 'Streaming, broadcasters, publishers, game studios, podcasters. Monitor visibility across discovery and subscription queries.',
      it: 'Streaming, emittenti, editori, studi di gaming, podcaster. Monitora la visibilità nelle ricerche di scoperta e abbonamento.',
      sv: 'Streaming, sändare, förlag, spelstudior, podcaster. Övervaka synlighet i upptäckts- och prenumerationssökningar.',
    },
    competitors: ['Netflix', 'Spotify', 'Disney+', 'HBO Max'],
    categories: {
      en: ['streaming service', 'broadcaster', 'publisher', 'game studio', 'podcast'],
      it: ['servizio streaming', 'emittente', 'editore', 'studio di gaming', 'podcast'],
      sv: ['streamingtjänst', 'sändare', 'förlag', 'spelstudio', 'podcast'],
    },
    roles: {
      en: ['viewer', 'subscriber', 'gamer', 'reader'],
      it: ['spettatore', 'abbonato', 'gamer', 'lettore'],
      sv: ['tittare', 'prenumerant', 'gamer', 'läsare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review worth it', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'what to watch on {brand}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} subscription plans', priority: 'high' },
      { bucket: 'B5', template: '{brand} cancel free trial', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['streaming', 'media', 'entertainment', 'podcast'],
      it: ['streaming', 'media', 'intrattenimento', 'podcast'],
      sv: ['streaming', 'media', 'underhållning', 'podcast'],
    },
  },

  {
    id: 'telecommunications',
    name: {
      en: 'Telecommunications',
      it: 'Telecomunicazioni',
      sv: 'Telekommunikation',
    },
    description: {
      en: 'Mobile carriers, ISPs, fixed-line, satellite. Monitor visibility across plan-comparison and coverage queries.',
      it: 'Operatori mobili, ISP, telefonia fissa, satellitare. Monitora la visibilità nelle ricerche di confronto piani e copertura.',
      sv: 'Mobiloperatörer, ISP:er, fast telefoni, satellit. Övervaka synlighet i abonnemangsjämförelser och täckningssökningar.',
    },
    competitors: ['Telia', 'Tele2', 'Telenor', 'Vodafone', 'TIM'],
    categories: {
      en: ['mobile carrier', 'internet provider', 'fiber', 'satellite'],
      it: ['operatore mobile', 'fornitore internet', 'fibra', 'satellitare'],
      sv: ['mobiloperatör', 'internetleverantör', 'fiber', 'satellit'],
    },
    roles: {
      en: ['consumer', 'family', 'business customer'],
      it: ['consumatore', 'famiglia', 'cliente business'],
      sv: ['konsument', 'familj', 'företagskund'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} coverage {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} 5G', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to switch {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} plans prices', priority: 'high' },
      { bucket: 'B5', template: '{brand} contract early termination', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['mobile', 'internet', '5G', 'broadband'],
      it: ['mobile', 'internet', '5G', 'banda larga'],
      sv: ['mobil', 'internet', '5G', 'bredband'],
    },
  },

  {
    id: 'sports-fitness',
    name: {
      en: 'Sports & Fitness',
      it: 'Sport e Fitness',
      sv: 'Sport & Träning',
    },
    description: {
      en: 'Gyms, sports clubs, fitness apps, supplement brands, athletic gear. Monitor visibility across activity and product queries.',
      it: 'Palestre, club sportivi, app fitness, integratori, abbigliamento sportivo. Monitora la visibilità nelle ricerche di attività e prodotti.',
      sv: 'Gym, sportklubbar, träningsappar, kosttillskott, sportkläder. Övervaka synlighet i aktivitets- och produktsökningar.',
    },
    competitors: ['SATS', 'Nike', 'Adidas', 'Strava'],
    categories: {
      en: ['gym', 'sports club', 'fitness app', 'sports brand'],
      it: ['palestra', 'club sportivo', 'app fitness', 'brand sportivo'],
      sv: ['gym', 'sportklubb', 'träningsapp', 'sportvarumärke'],
    },
    roles: {
      en: ['athlete', 'beginner', 'parent'],
      it: ['atleta', 'principiante', 'genitore'],
      sv: ['idrottare', 'nybörjare', 'förälder'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} membership {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to start {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing trial', priority: 'high' },
      { bucket: 'B5', template: '{brand} cancel refund policy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['gym', 'fitness', 'sports', 'training'],
      it: ['palestra', 'fitness', 'sport', 'allenamento'],
      sv: ['gym', 'träning', 'sport', 'fitness'],
    },
  },

  {
    id: 'nonprofit-ngo',
    name: {
      en: 'Non-profit & NGO',
      it: 'Non Profit e ONG',
      sv: 'Ideella & NGO',
    },
    description: {
      en: 'Charities, foundations, advocacy groups, NGOs. Monitor visibility across donation-decision and trust queries.',
      it: 'Enti benefici, fondazioni, gruppi di advocacy, ONG. Monitora la visibilità nelle ricerche di scelta donazione e fiducia.',
      sv: 'Välgörenhet, stiftelser, opinionsbildare, NGO:er. Övervaka synlighet i donations- och förtroendesökningar.',
    },
    competitors: ['Red Cross', 'Save the Children', 'UNICEF'],
    categories: {
      en: ['charity', 'foundation', 'advocacy group', 'NGO'],
      it: ['ente benefico', 'fondazione', 'gruppo advocacy', 'ONG'],
      sv: ['välgörenhet', 'stiftelse', 'opinionsbildare', 'NGO'],
    },
    roles: {
      en: ['donor', 'volunteer', 'beneficiary'],
      it: ['donatore', 'volontario', 'beneficiario'],
      sv: ['donator', 'volontär', 'mottagare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews legitimacy', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} impact', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'how to donate to {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} tax-deductible donate', priority: 'high' },
      { bucket: 'B5', template: '{brand} transparency reports', priority: 'high' },
    ],
    seedKeywords: {
      en: ['charity', 'NGO', 'donate', 'non-profit'],
      it: ['ente benefico', 'ONG', 'donare', 'non profit'],
      sv: ['välgörenhet', 'NGO', 'donera', 'ideell'],
    },
  },

  {
    id: 'fashion-apparel',
    name: {
      en: 'Fashion & Apparel',
      it: 'Moda e Abbigliamento',
      sv: 'Mode & Kläder',
    },
    description: {
      en: 'Fashion brands, apparel makers, footwear, accessories. Monitor visibility across trend, sizing, and brand-comparison queries.',
      it: 'Brand di moda, abbigliamento, calzature, accessori. Monitora la visibilità nelle ricerche di trend, taglie e confronto brand.',
      sv: 'Modevarumärken, klädtillverkare, skor, accessoarer. Övervaka synlighet i trend-, storleks- och varumärkesjämförelser.',
    },
    competitors: ['H&M', 'Zara', 'Uniqlo', 'COS'],
    categories: {
      en: ['fashion brand', 'apparel', 'footwear', 'accessories'],
      it: ['brand moda', 'abbigliamento', 'calzature', 'accessori'],
      sv: ['modevarumärke', 'kläder', 'skor', 'accessoarer'],
    },
    roles: {
      en: ['shopper', 'fashion-conscious', 'sustainable buyer'],
      it: ['acquirente', 'fashion-conscious', 'acquirente sostenibile'],
      sv: ['kund', 'modemedveten', 'hållbar köpare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review quality', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} sustainable', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'where to buy {category} online', priority: 'medium' },
      { bucket: 'B4', template: '{brand} sizing fit', priority: 'high' },
      { bucket: 'B5', template: '{brand} ethics labor sourcing', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['fashion', 'apparel', 'clothing', 'footwear'],
      it: ['moda', 'abbigliamento', 'calzature'],
      sv: ['mode', 'kläder', 'skor'],
    },
  },

  {
    id: 'pharma-biotech',
    name: {
      en: 'Pharma & Biotech',
      it: 'Farmaceutico e Biotecnologie',
      sv: 'Läkemedel & Biotech',
    },
    description: {
      en: 'Pharmaceutical companies, biotech, medical-device manufacturers. Distinct from Healthcare (providers/clinics).',
      it: 'Aziende farmaceutiche, biotech, produttori di dispositivi medici. Distinto da Sanità (fornitori/cliniche).',
      sv: 'Läkemedelsföretag, bioteknik, tillverkare av medicintekniska produkter. Skiljer sig från Sjukvård (vårdgivare/kliniker).',
    },
    competitors: ['Pfizer', 'Novartis', 'AstraZeneca', 'Roche'],
    categories: {
      en: ['pharma company', 'biotech', 'medical device', 'CRO'],
      it: ['azienda farmaceutica', 'biotech', 'dispositivo medico', 'CRO'],
      sv: ['läkemedelsföretag', 'bioteknik', 'medicinteknik', 'CRO'],
    },
    roles: {
      en: ['patient', 'physician', 'investor'],
      it: ['paziente', 'medico', 'investitore'],
      sv: ['patient', 'läkare', 'investerare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} drug review', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor} efficacy', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how does {category} work', priority: 'medium' },
      { bucket: 'B4', template: '{brand} clinical trials enrollment', priority: 'medium' },
      { bucket: 'B5', template: '{brand} FDA approval safety', priority: 'high' },
    ],
    seedKeywords: {
      en: ['pharma', 'biotech', 'drug', 'medical device'],
      it: ['farmaco', 'biotech', 'dispositivo medico'],
      sv: ['läkemedel', 'bioteknik', 'medicinteknik'],
    },
  },

  {
    id: 'tech-hardware',
    name: {
      en: 'Technology & Hardware',
      it: 'Tecnologia e Hardware',
      sv: 'Teknik & Hårdvara',
    },
    description: {
      en: 'Consumer electronics, IoT devices, robotics, AI hardware. Distinct from SaaS — focus on physical product reviews and specs.',
      it: 'Elettronica consumer, dispositivi IoT, robotica, hardware AI. Distinto da SaaS — focus su recensioni prodotto e specifiche.',
      sv: 'Konsumentelektronik, IoT-enheter, robotik, AI-hårdvara. Skiljer sig från SaaS — fokus på produktrecensioner och specifikationer.',
    },
    competitors: ['Apple', 'Samsung', 'Sony', 'Dell'],
    categories: {
      en: ['consumer electronics', 'IoT device', 'wearable', 'robotics'],
      it: ['elettronica consumer', 'dispositivo IoT', 'wearable', 'robotica'],
      sv: ['konsumentelektronik', 'IoT-enhet', 'wearable', 'robotik'],
    },
    roles: {
      en: ['tech enthusiast', 'home user', 'creator'],
      it: ['appassionato tech', 'utente casa', 'creator'],
      sv: ['teknikentusiast', 'hemanvändare', 'kreatör'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review specs', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B3', template: 'is {brand} worth buying', priority: 'medium' },
      { bucket: 'B4', template: '{brand} price availability', priority: 'high' },
      { bucket: 'B5', template: '{brand} warranty repair support', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['electronics', 'IoT', 'hardware', 'gadget'],
      it: ['elettronica', 'IoT', 'hardware', 'gadget'],
      sv: ['elektronik', 'IoT', 'hårdvara', 'prylar'],
    },
  },
  // ─── VERTICAL EXPANSION (2026-08-20) ──────────────────────────────────────
  // Additional canonical industries so the onboarding industry dropdown covers
  // far more of the real economy. Same rich shape as the top presets
  // (localCompetitors + native sv/it localizedTemplates). NOTE: three requested
  // verticals — media-entertainment, sports-fitness, fashion-apparel — already
  // exist above and were intentionally NOT re-added to avoid duplicate ids.

  {
    id: 'legal-services',
    name: {
      en: 'Legal Services',
      it: 'Servizi Legali',
      sv: 'Juridik & Advokat',
    },
    description: {
      en: 'Law firms, solicitors, legal-tech, and online legal advice services. Monitor visibility across firm-selection and legal-help queries.',
      it: 'Studi legali, avvocati, legal-tech e servizi di consulenza legale online. Monitora la visibilità nelle ricerche di scelta studio e assistenza legale.',
      sv: 'Advokatbyråer, jurister, legal-tech och juridisk rådgivning online. Övervaka synlighet i sökningar om byråval och juridisk hjälp.',
    },
    competitors: ['Familjens Jurist', 'Lexly', 'Lawline', 'Avtal24', 'LexDo.it'],
    localCompetitors: {
      sv: ['Familjens Jurist', 'Lexly', 'Lawline', 'Avtal24', 'Fondia', 'Vasa Advokatbyrå'],
      it: ['LexDo.it', 'Studio Cataldi', 'Altalex', 'Avvocato360', 'UniLex'],
    },
    localizedTemplates: {
      sv: [
        'bästa advokatbyrån {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken advokat är bäst',
        '{brand} pris juridisk rådgivning',
        'behöver jag en {category} {location}',
        'juridisk hjälp {location} {brand}',
        '{brand} recensioner {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale studio legale',
        'miglior avvocato {location}',
        '{brand} costi consulenza legale',
        'ho bisogno di un {category} {location}',
        '{brand} è affidabile {location}',
      ],
    },
    categories: {
      en: [
        'law firm',
        'legal advice service',
        'family lawyer',
        'business lawyer',
        'online legal service',
      ],
      it: [
        'studio legale',
        'servizio di consulenza legale',
        'avvocato di famiglia',
        "avvocato d'impresa",
        'servizio legale online',
      ],
      sv: [
        'advokatbyrå',
        'juridisk rådgivning',
        'familjejurist',
        'affärsjurist',
        'juridisk onlinetjänst',
      ],
    },
    roles: {
      en: ['individual client', 'small business owner', 'startup founder', 'property buyer'],
      it: [
        'cliente privato',
        'piccolo imprenditore',
        'fondatore startup',
        'acquirente immobiliare',
      ],
      sv: ['privatperson', 'småföretagare', 'startupgrundare', 'bostadsköpare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to find a {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing fees', priority: 'high' },
      { bucket: 'B4', template: '{brand} free consultation', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} reliable {location}', priority: 'medium' },
      { bucket: 'B5', template: '{brand} accredited lawyer', priority: 'low' },
    ],
    seedKeywords: {
      en: ['lawyer', 'legal advice', 'law firm', 'attorney', 'legal help'],
      it: ['avvocato', 'consulenza legale', 'studio legale', 'assistenza legale'],
      sv: ['advokat', 'juridisk rådgivning', 'advokatbyrå', 'juridisk hjälp'],
    },
  },

  {
    id: 'telecom',
    name: {
      en: 'Telecom & Broadband',
      it: 'Telecomunicazioni',
      sv: 'Telekom & Bredband',
    },
    description: {
      en: 'Broadband, fiber, mobile carriers, and TV bundles. Monitor visibility across plan-comparison, coverage, and speed queries.',
      it: 'Banda larga, fibra, operatori mobili e pacchetti TV. Monitora la visibilità nelle ricerche di confronto offerte, copertura e velocità.',
      sv: 'Bredband, fiber, mobiloperatörer och TV-paket. Övervaka synlighet i sökningar om abonnemangsjämförelser, täckning och hastighet.',
    },
    competitors: ['Telia', 'Bredbandsbolaget', 'Bahnhof', 'Comhem', 'Fastweb', 'TIM'],
    localCompetitors: {
      sv: ['Telia', 'Tele2', 'Telenor', 'Bredbandsbolaget', 'Bahnhof', 'Comhem', 'Tre'],
      it: ['TIM', 'Vodafone', 'Fastweb', 'WindTre', 'Iliad'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} täckning',
        '{brand} eller {competitor} vilket bredband är bäst',
        '{brand} pris månadskostnad',
        '{brand} {location} omdöme',
        'byta {category} {location}',
        '{brand} hastighet fiber {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale offerta',
        'miglior {category} {location}',
        '{brand} copertura {location}',
        '{brand} costi mensili',
        'cambiare {category} {location}',
      ],
    },
    categories: {
      en: [
        'broadband provider',
        'mobile carrier',
        'fiber internet',
        'TV & broadband bundle',
        'ISP',
      ],
      it: [
        'operatore banda larga',
        'operatore mobile',
        'fibra internet',
        'pacchetto TV e internet',
        'provider internet',
      ],
      sv: [
        'bredbandsleverantör',
        'mobiloperatör',
        'fiberinternet',
        'TV- och bredbandspaket',
        'internetleverantör',
      ],
    },
    roles: {
      en: ['household', 'remote worker', 'small business', 'gamer'],
      it: ['famiglia', 'lavoratore da remoto', 'piccola impresa', 'gamer'],
      sv: ['hushåll', 'distansarbetare', 'småföretag', 'gamer'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} coverage {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to switch {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} plans prices', priority: 'high' },
      { bucket: 'B4', template: '{brand} speed {location}', priority: 'medium' },
      { bucket: 'B5', template: '{brand} contract early termination', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['broadband', 'fiber', 'mobile plan', 'internet provider', '5G'],
      it: ['banda larga', 'fibra', 'offerta mobile', 'operatore internet', '5G'],
      sv: ['bredband', 'fiber', 'mobilabonnemang', 'internetleverantör', '5G'],
    },
  },

  {
    id: 'pets-veterinary',
    name: {
      en: 'Pets & Veterinary',
      it: 'Animali e Veterinaria',
      sv: 'Djur & Veterinär',
    },
    description: {
      en: 'Pet stores, veterinary clinics, pet insurance, and pet-food brands. Monitor visibility across care, product, and clinic-choice queries.',
      it: 'Negozi per animali, cliniche veterinarie, assicurazioni e brand di alimenti per animali. Monitora la visibilità nelle ricerche di cura, prodotti e scelta clinica.',
      sv: 'Djuraffärer, veterinärkliniker, djurförsäkring och djurfodervarumärken. Övervaka synlighet i sökningar om vård, produkter och klinikval.',
    },
    competitors: ['Arken Zoo', 'Zooplus', 'Musti och Mirri', 'Agria', 'Arcaplanet'],
    localCompetitors: {
      sv: ['Arken Zoo', 'Zooplus', 'Musti och Mirri', 'Agria', 'Evidensia', 'AniCura'],
      it: ['Zooplus', 'Arcaplanet', 'Bauzaar', 'Robinson Pet Shop', 'Isnardi Pet'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken är bäst',
        '{brand} priser veterinär',
        'akut veterinär {location} {brand}',
        '{brand} hundmat recension',
        '{brand} djurförsäkring {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale scegliere',
        'miglior {category} {location}',
        '{brand} costi veterinario',
        'veterinario urgente {location} {brand}',
        '{brand} cibo per cani recensione',
      ],
    },
    categories: {
      en: ['pet store', 'veterinary clinic', 'pet insurance', 'pet food brand', 'animal hospital'],
      it: [
        'negozio per animali',
        'clinica veterinaria',
        'assicurazione animali',
        'brand di alimenti per animali',
        'ospedale veterinario',
      ],
      sv: ['djuraffär', 'veterinärklinik', 'djurförsäkring', 'djurfodervarumärke', 'djursjukhus'],
    },
    roles: {
      en: ['dog owner', 'cat owner', 'new pet parent', 'breeder'],
      it: ['proprietario di cane', 'proprietario di gatto', 'nuovo proprietario', 'allevatore'],
      sv: ['hundägare', 'kattägare', 'ny djurägare', 'uppfödare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      {
        bucket: 'B3',
        template: 'how to find an emergency {category} {location}',
        priority: 'medium',
      },
      { bucket: 'B4', template: '{brand} prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} pet insurance cost', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} trustworthy {location}', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['vet', 'pet food', 'pet insurance', 'veterinary clinic', 'dog'],
      it: ['veterinario', 'cibo per animali', 'assicurazione animali', 'clinica veterinaria'],
      sv: ['veterinär', 'djurfoder', 'djurförsäkring', 'veterinärklinik'],
    },
  },

  {
    id: 'home-garden',
    name: {
      en: 'Home & Garden',
      it: 'Casa e Giardino',
      sv: 'Hem & Trädgård',
    },
    description: {
      en: 'Furniture, garden centers, home-improvement and DIY retailers. Monitor visibility across product-discovery and store-choice queries.',
      it: 'Mobili, centri giardinaggio, ferramenta e negozi fai-da-te. Monitora la visibilità nelle ricerche di scoperta prodotti e scelta negozio.',
      sv: 'Möbler, trädgårdscenter, byggvaruhus och gör-det-själv-butiker. Övervaka synlighet i sökningar om produktupptäckt och butiksval.',
    },
    competitors: ['IKEA', 'Bauhaus', 'Plantagen', 'Jula', 'Leroy Merlin', 'Clas Ohlson'],
    localCompetitors: {
      sv: ['IKEA', 'Bauhaus', 'Plantagen', 'Jula', 'Clas Ohlson', 'Rusta', 'Hornbach'],
      it: ['Leroy Merlin', 'Bricoman', 'OBI', 'Mondo Convenienza', 'Bricocenter'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} var handla',
        '{brand} priser {location}',
        'köpa {category} online {brand}',
        '{brand} leverans montering',
        '{brand} trädgård rea {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} dove comprare',
        'miglior {category} {location}',
        '{brand} prezzi {location}',
        'comprare {category} online {brand}',
        '{brand} consegna montaggio',
      ],
    },
    categories: {
      en: [
        'furniture store',
        'garden center',
        'home improvement store',
        'interior decor shop',
        'DIY store',
      ],
      it: [
        'negozio di mobili',
        'centro giardinaggio',
        'negozio di bricolage',
        'negozio di arredamento',
        'negozio fai-da-te',
      ],
      sv: [
        'möbelbutik',
        'trädgårdscenter',
        'byggvaruhus',
        'inredningsbutik',
        'gör-det-själv-butik',
      ],
    },
    roles: {
      en: ['homeowner', 'renter', 'gardening enthusiast', 'DIY hobbyist'],
      it: [
        'proprietario di casa',
        'inquilino',
        'appassionato di giardinaggio',
        'appassionato fai-da-te',
      ],
      sv: ['villaägare', 'hyresgäst', 'trädgårdsentusiast', 'gör-det-själv-entusiast'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'where to buy {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} prices {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} delivery assembly', priority: 'medium' },
      { bucket: 'B5', template: '{brand} return policy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['furniture', 'garden', 'home decor', 'DIY', 'interior'],
      it: ['mobili', 'giardino', 'arredamento', 'bricolage', 'fai-da-te'],
      sv: ['möbler', 'trädgård', 'inredning', 'gör-det-själv', 'bygg'],
    },
  },

  {
    id: 'it-services-security',
    name: {
      en: 'IT Services & Cybersecurity',
      it: 'Servizi IT e Cybersecurity',
      sv: 'IT-tjänster & Cybersäkerhet',
    },
    description: {
      en: 'Managed IT, MSPs, cloud services, and cybersecurity providers. Monitor visibility across vendor-evaluation and B2B trust queries.',
      it: 'IT gestito, MSP, servizi cloud e fornitori di cybersecurity. Monitora la visibilità nelle ricerche di valutazione fornitori e fiducia B2B.',
      sv: 'Managed IT, MSP:er, molntjänster och cybersäkerhetsleverantörer. Övervaka synlighet i sökningar om leverantörsutvärdering och B2B-förtroende.',
    },
    competitors: ['Atea', 'TietoEVRY', 'CGI', 'Orange Cyberdefense', 'Truesec', 'Reply'],
    localCompetitors: {
      sv: ['Atea', 'TietoEVRY', 'CGI', 'Basefarm', 'Orange Cyberdefense', 'Truesec', 'Nixu'],
      it: ['Reply', 'Engineering', 'Leonardo', 'Fastweb Enterprise', 'Var Group'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken leverantör är bäst',
        '{brand} pris offert',
        'anlita {category} {location}',
        '{brand} kundcase referenser',
        '{brand} incidenthantering säkerhet',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale fornitore',
        'miglior {category} {location}',
        '{brand} prezzi preventivo',
        '{brand} case study clienti',
        '{brand} gestione incidenti sicurezza',
      ],
    },
    categories: {
      en: [
        'managed IT provider',
        'cybersecurity provider',
        'MSP',
        'cloud services provider',
        'penetration testing firm',
      ],
      it: [
        'fornitore IT gestito',
        'fornitore di cybersecurity',
        'MSP',
        'fornitore di servizi cloud',
        'società di penetration testing',
      ],
      sv: [
        'managed IT-leverantör',
        'cybersäkerhetsleverantör',
        'MSP',
        'molntjänstleverantör',
        'penetrationstestföretag',
      ],
    },
    roles: {
      en: ['IT manager', 'CISO', 'small business owner', 'compliance officer'],
      it: ['responsabile IT', 'CISO', 'piccolo imprenditore', 'responsabile compliance'],
      sv: ['IT-chef', 'CISO', 'småföretagare', 'compliance-ansvarig'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'medium' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing quote', priority: 'high' },
      { bucket: 'B4', template: '{brand} case studies results', priority: 'medium' },
      { bucket: 'B5', template: '{brand} ISO 27001 GDPR compliance', priority: 'high' },
      { bucket: 'B5', template: 'is {brand} trustworthy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['managed IT', 'cybersecurity', 'MSP', 'IT support', 'pentest'],
      it: ['IT gestito', 'cybersecurity', 'MSP', 'assistenza IT', 'penetration test'],
      sv: ['managed IT', 'cybersäkerhet', 'MSP', 'IT-support', 'penetrationstest'],
    },
  },

  {
    id: 'recruitment-hr',
    name: {
      en: 'Recruitment & HR',
      it: 'Recruiting e HR',
      sv: 'Rekrytering & Bemanning',
    },
    description: {
      en: 'Recruitment agencies, staffing firms, executive search, and HR consultancies. Monitor visibility across agency-selection and hiring queries.',
      it: 'Agenzie di recruiting, società di somministrazione, head hunting e consulenza HR. Monitora la visibilità nelle ricerche di selezione agenzia e assunzioni.',
      sv: 'Rekryteringsföretag, bemanningsföretag, executive search och HR-konsulter. Övervaka synlighet i sökningar om byråval och anställning.',
    },
    competitors: [
      'Academic Work',
      'Randstad',
      'Adecco',
      'Manpower',
      'Wise Group',
      'StudentConsulting',
    ],
    localCompetitors: {
      sv: [
        'Academic Work',
        'Manpower',
        'Randstad',
        'Adecco',
        'Wise Group',
        'StudentConsulting',
        'Bravura',
      ],
      it: ['Randstad', 'Adecco', 'Gi Group', 'Manpower', 'Umana'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken byrå är bäst',
        '{brand} pris rekrytering',
        'anlita {category} {location}',
        '{brand} recensioner kandidat',
        '{brand} hitta personal {location}',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale agenzia',
        'miglior {category} {location}',
        '{brand} costi recruiting',
        '{brand} trovare personale {location}',
        '{brand} opinioni candidati',
      ],
    },
    categories: {
      en: [
        'recruitment agency',
        'staffing agency',
        'executive search firm',
        'HR consultancy',
        'temp staffing agency',
      ],
      it: [
        'agenzia di recruiting',
        'agenzia di somministrazione',
        'società di head hunting',
        'consulenza HR',
        'agenzia di lavoro interinale',
      ],
      sv: [
        'rekryteringsföretag',
        'bemanningsföretag',
        'executive search-byrå',
        'HR-konsult',
        'bemanningsbyrå',
      ],
    },
    roles: {
      en: ['HR manager', 'hiring manager', 'job seeker', 'startup founder'],
      it: ['responsabile HR', 'hiring manager', 'candidato', 'fondatore startup'],
      sv: ['HR-chef', 'rekryterande chef', 'arbetssökande', 'startupgrundare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing fees', priority: 'high' },
      { bucket: 'B4', template: '{brand} candidate experience', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} reliable {location}', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['recruitment', 'staffing', 'hiring', 'headhunter', 'HR'],
      it: ['recruiting', 'somministrazione', 'assunzioni', 'head hunter', 'HR'],
      sv: ['rekrytering', 'bemanning', 'anställning', 'headhunter', 'HR'],
    },
  },

  {
    id: 'events-conferences',
    name: {
      en: 'Events & Conferences',
      it: 'Eventi e Congressi',
      sv: 'Event & Konferens',
    },
    description: {
      en: 'Event agencies, conference venues, ticketing platforms, and trade fairs. Monitor visibility across venue-choice and ticketing queries.',
      it: 'Agenzie di eventi, sedi congressuali, piattaforme di ticketing e fiere. Monitora la visibilità nelle ricerche di scelta sede e biglietteria.',
      sv: 'Eventbyråer, konferensanläggningar, biljettplattformar och mässor. Övervaka synlighet i sökningar om lokalval och biljetter.',
    },
    competitors: ['Eventbrite', 'Cvent', 'Stockholmsmässan', 'Fiera Milano', 'Billetto', 'DICE'],
    localCompetitors: {
      sv: [
        'Stockholmsmässan',
        'Kistamässan',
        'Svenska Mässan',
        'Eventbrite',
        'Billetto',
        'Trippus',
      ],
      it: ['Fiera Milano', 'IEG Rimini', 'Eventbrite', 'Mailticket', 'DICE'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken plattform är bäst',
        '{brand} pris biljetter',
        'boka {category} {location}',
        '{brand} konferenslokal {location}',
        '{brand} recensioner arrangör',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale piattaforma',
        'miglior {category} {location}',
        '{brand} prezzi biglietti',
        'prenotare {category} {location}',
        '{brand} sede congressi {location}',
      ],
    },
    categories: {
      en: [
        'event agency',
        'conference venue',
        'ticketing platform',
        'trade fair',
        'exhibition center',
      ],
      it: [
        'agenzia di eventi',
        'sede congressuale',
        'piattaforma di ticketing',
        'fiera',
        'centro espositivo',
      ],
      sv: ['eventbyrå', 'konferensanläggning', 'biljettplattform', 'mässa', 'utställningshall'],
    },
    roles: {
      en: ['event planner', 'marketing manager', 'exhibitor', 'conference organizer'],
      it: ['event planner', 'responsabile marketing', 'espositore', 'organizzatore congressi'],
      sv: ['eventplanerare', 'marknadschef', 'utställare', 'konferensarrangör'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'medium' },
      { bucket: 'B3', template: 'how to book a {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing tickets', priority: 'high' },
      { bucket: 'B4', template: '{brand} venue capacity {location}', priority: 'medium' },
      { bucket: 'B5', template: '{brand} refund cancellation policy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['event', 'conference', 'venue', 'ticketing', 'trade fair'],
      it: ['evento', 'congresso', 'sede', 'biglietteria', 'fiera'],
      sv: ['event', 'konferens', 'lokal', 'biljetter', 'mässa'],
    },
  },

  {
    id: 'nonprofit',
    name: {
      en: 'Non-profit & Associations',
      it: 'No-profit e Associazioni',
      sv: 'Ideell & Förening',
    },
    description: {
      en: 'Charities, foundations, membership associations, and volunteer organizations. Monitor visibility across donation and trust queries.',
      it: 'Enti benefici, fondazioni, associazioni di categoria e organizzazioni di volontariato. Monitora la visibilità nelle ricerche di donazione e fiducia.',
      sv: 'Välgörenhet, stiftelser, medlemsföreningar och volontärorganisationer. Övervaka synlighet i sökningar om donationer och förtroende.',
    },
    competitors: ['Röda Korset', 'Rädda Barnen', 'Bris', 'WWF', 'Croce Rossa Italiana', 'Caritas'],
    localCompetitors: {
      sv: [
        'Röda Korset',
        'Rädda Barnen',
        'Bris',
        'Cancerfonden',
        'Stadsmissionen',
        'Naturskyddsföreningen',
      ],
      it: ['Croce Rossa Italiana', 'Caritas', 'Emergency', 'AIRC', 'Telethon'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} att stödja {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken förening',
        'är {brand} seriöst',
        'skänka pengar till {brand}',
        'bli medlem {brand} {location}',
        '{brand} transparens redovisning',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale associazione',
        'miglior {category} {location}',
        '{brand} è affidabile',
        'donare a {brand}',
        '{brand} trasparenza bilancio',
      ],
    },
    categories: {
      en: [
        'charity',
        'foundation',
        'membership association',
        'volunteer organization',
        'advocacy group',
      ],
      it: [
        'ente benefico',
        'fondazione',
        'associazione di categoria',
        'organizzazione di volontariato',
        'gruppo di advocacy',
      ],
      sv: [
        'välgörenhet',
        'stiftelse',
        'medlemsförening',
        'volontärorganisation',
        'intresseorganisation',
      ],
    },
    roles: {
      en: ['donor', 'volunteer', 'member', 'board member'],
      it: ['donatore', 'volontario', 'socio', 'membro del consiglio'],
      sv: ['donator', 'volontär', 'medlem', 'styrelsemedlem'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews legitimacy', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'medium' },
      { bucket: 'B3', template: 'how to donate to a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} membership fees', priority: 'medium' },
      { bucket: 'B4', template: '{brand} tax-deductible donation', priority: 'high' },
      { bucket: 'B5', template: '{brand} transparency reports', priority: 'high' },
    ],
    seedKeywords: {
      en: ['charity', 'donate', 'non-profit', 'association', 'volunteer'],
      it: ['ente benefico', 'donare', 'no-profit', 'associazione', 'volontariato'],
      sv: ['välgörenhet', 'donera', 'ideell', 'förening', 'volontär'],
    },
  },

  {
    id: 'agriculture',
    name: {
      en: 'Agriculture & Farming',
      it: 'Agricoltura',
      sv: 'Jordbruk & Lantbruk',
    },
    description: {
      en: 'Farm suppliers, agricultural machinery, seed and fertilizer, and agri cooperatives. Monitor visibility across supplier and equipment queries.',
      it: 'Fornitori agricoli, macchinari, sementi e fertilizzanti e consorzi agrari. Monitora la visibilità nelle ricerche di fornitori e attrezzature.',
      sv: 'Lantbruksleverantörer, jordbruksmaskiner, utsäde och gödsel samt lantbrukskooperativ. Övervaka synlighet i sökningar om leverantörer och utrustning.',
    },
    competitors: ['Lantmännen', 'DeLaval', 'Väderstad', 'John Deere', 'Yara', 'New Holland'],
    localCompetitors: {
      sv: ['Lantmännen', 'DeLaval', 'Väderstad', 'Hushållningssällskapet', 'Yara', 'Swedish Agro'],
      it: [
        'Coldiretti',
        "Consorzi Agrari d'Italia",
        'New Holland',
        'CAI Agromec',
        'Confagricoltura',
      ],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken är bäst',
        '{brand} pris maskiner',
        'köpa {category} {location}',
        '{brand} reservdelar service',
        '{brand} recensioner lantbrukare',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale scegliere',
        'miglior {category} {location}',
        '{brand} prezzi macchinari',
        'comprare {category} {location}',
        '{brand} ricambi assistenza',
      ],
    },
    categories: {
      en: [
        'farm supplier',
        'agricultural machinery maker',
        'seed and fertilizer supplier',
        'dairy equipment maker',
        'agri cooperative',
      ],
      it: [
        'fornitore agricolo',
        'costruttore di macchine agricole',
        'fornitore di sementi e fertilizzanti',
        'costruttore di impianti per latte',
        'consorzio agrario',
      ],
      sv: [
        'lantbruksleverantör',
        'jordbruksmaskintillverkare',
        'utsädes- och gödselleverantör',
        'mjölkutrustningstillverkare',
        'lantbrukskooperativ',
      ],
    },
    roles: {
      en: ['farmer', 'agronomist', 'dairy producer', 'cooperative manager'],
      it: ['agricoltore', 'agronomo', 'produttore lattiero', 'responsabile consorzio'],
      sv: ['lantbrukare', 'agronom', 'mjölkproducent', 'kooperativchef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews specifications', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'medium' },
      { bucket: 'B3', template: 'how to choose a {category}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} prices financing', priority: 'high' },
      { bucket: 'B4', template: '{brand} spare parts service', priority: 'medium' },
      { bucket: 'B5', template: '{brand} EU subsidy compliance', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['farming', 'agriculture', 'farm equipment', 'fertilizer', 'crops'],
      it: ['agricoltura', 'coltivazione', 'macchine agricole', 'fertilizzante', 'raccolto'],
      sv: ['jordbruk', 'lantbruk', 'jordbruksmaskiner', 'gödsel', 'gröda'],
    },
  },

  {
    id: 'travel',
    name: {
      en: 'Travel & Booking',
      it: 'Viaggi e Prenotazioni',
      sv: 'Resor & Bokning',
    },
    description: {
      en: 'Travel agencies, online booking platforms, tour operators, and flight comparison sites. Monitor visibility across booking and deal queries.',
      it: 'Agenzie di viaggio, piattaforme di prenotazione online, tour operator e comparatori di voli. Monitora la visibilità nelle ricerche di prenotazione e offerte.',
      sv: 'Resebyråer, bokningsplattformar online, researrangörer och flygjämförelsesajter. Övervaka synlighet i sökningar om bokning och erbjudanden.',
    },
    competitors: ['Booking.com', 'Expedia', 'TUI', 'Ving', 'eDreams', 'Momondo'],
    localCompetitors: {
      sv: ['Ving', 'TUI', 'Apollo', 'Momondo', 'Booking.com', 'Resia'],
      it: ['Booking.com', 'eDreams', 'Alpitour', 'Volagratis', 'Lastminute.com'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} var boka billigast',
        '{brand} pris resa {location}',
        'boka {category} {location}',
        '{brand} avbokning återbetalning',
        '{brand} sista minuten erbjudande',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} dove prenotare',
        'miglior {category} {location}',
        '{brand} prezzi viaggio {location}',
        'prenotare {category} {location}',
        '{brand} cancellazione rimborso',
      ],
    },
    categories: {
      en: [
        'travel agency',
        'online booking platform',
        'tour operator',
        'flight comparison site',
        'hotel booking site',
      ],
      it: [
        'agenzia di viaggi',
        'piattaforma di prenotazione online',
        'tour operator',
        'comparatore di voli',
        'sito di prenotazione hotel',
      ],
      sv: [
        'resebyrå',
        'bokningsplattform online',
        'researrangör',
        'flygjämförelsesajt',
        'hotellbokningssajt',
      ],
    },
    roles: {
      en: ['leisure traveler', 'business traveler', 'family vacationer', 'backpacker'],
      it: ['viaggiatore per piacere', "viaggiatore d'affari", 'famiglia in vacanza', 'backpacker'],
      sv: ['fritidsresenär', 'affärsresenär', 'familjeresenär', 'backpacker'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor}', priority: 'medium' },
      { bucket: 'B3', template: 'how to book cheap {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} deals offers {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} price comparison', priority: 'medium' },
      { bucket: 'B5', template: '{brand} cancellation refund policy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['travel', 'booking', 'flights', 'holiday', 'tour'],
      it: ['viaggi', 'prenotazione', 'voli', 'vacanza', 'tour'],
      sv: ['resor', 'bokning', 'flyg', 'semester', 'resa'],
    },
  },

  {
    id: 'cleaning-facility',
    name: {
      en: 'Cleaning & Facility Services',
      it: 'Pulizie e Facility',
      sv: 'Städ & Facility',
    },
    description: {
      en: 'Cleaning companies, facility management, office and home cleaning, and industrial cleaning. Monitor visibility across provider-choice and B2B queries.',
      it: 'Imprese di pulizie, facility management, pulizie per uffici e case e pulizie industriali. Monitora la visibilità nelle ricerche di scelta fornitore e B2B.',
      sv: 'Städföretag, facility management, kontors- och hemstädning samt industristädning. Övervaka synlighet i sökningar om leverantörsval och B2B.',
    },
    competitors: ['ISS', 'Sodexo', 'Coor', 'Compass Group', 'Hemfrid', 'Rekeep'],
    localCompetitors: {
      sv: ['ISS', 'Coor', 'Sodexo', 'Hemfrid', 'Samhall', 'Freska'],
      it: ['Manutencoop', 'Markas', 'Dussmann', 'Rekeep', 'ServizItalia'],
    },
    localizedTemplates: {
      sv: [
        'bästa {category} {location}',
        '{brand} {location} omdöme',
        '{brand} eller {competitor} vilken är bäst',
        '{brand} pris städning',
        'anlita {category} {location}',
        '{brand} kontorsstädning offert {location}',
        '{brand} recensioner kund',
      ],
      it: [
        '{brand} {location} recensioni',
        '{brand} o {competitor} quale scegliere',
        'miglior {category} {location}',
        '{brand} prezzi pulizie',
        '{brand} pulizie uffici preventivo {location}',
        '{brand} opinioni clienti',
      ],
    },
    categories: {
      en: [
        'cleaning company',
        'facility management provider',
        'office cleaning service',
        'home cleaning service',
        'industrial cleaning firm',
      ],
      it: [
        'impresa di pulizie',
        'fornitore di facility management',
        'servizio di pulizie uffici',
        'servizio di pulizie domestiche',
        'impresa di pulizie industriali',
      ],
      sv: [
        'städföretag',
        'facility management-leverantör',
        'kontorsstädning',
        'hemstädning',
        'industristädningsföretag',
      ],
    },
    roles: {
      en: ['office manager', 'property manager', 'homeowner', 'facility director'],
      it: ['office manager', 'property manager', 'proprietario di casa', 'facility director'],
      sv: ['kontorschef', 'fastighetsförvaltare', 'villaägare', 'facility-chef'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} reviews {location}', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: '{brand} {location}', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'alternative to {competitor} {location}', priority: 'medium' },
      { bucket: 'B3', template: 'how to hire a {category} {location}', priority: 'medium' },
      { bucket: 'B4', template: '{brand} pricing quote {location}', priority: 'high' },
      { bucket: 'B4', template: '{brand} office cleaning contract', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} insured reliable', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['cleaning', 'facility management', 'office cleaning', 'housekeeping', 'janitorial'],
      it: [
        'pulizie',
        'facility management',
        'pulizie uffici',
        'pulizie domestiche',
        'sanificazione',
      ],
      sv: ['städning', 'facility management', 'kontorsstädning', 'hemstädning', 'lokalvård'],
    },
  },
  {
    // Generic fallback so no brand is ever blocked from generating a starter set
    // when none of the specific presets fit. Templates are brand-agnostic; the
    // {competitor} slots are filled from the brand's own competitors (always
    // present — the new-brand form requires at least one), not from this preset.
    id: 'other',
    name: { en: 'Other / General', it: 'Altro / Generico', sv: 'Övrigt / Allmänt' },
    description: {
      en: 'No specific industry — generic starter prompts built from the brand name and its competitors. Refine them after creation.',
      it: 'Nessun settore specifico — prompt iniziali generici costruiti dal nome del brand e dai suoi competitor. Affinali dopo la creazione.',
      sv: 'Ingen specifik bransch — generiska startprompter byggda på varumärkesnamnet och dess konkurrenter. Finjustera dem efter skapandet.',
    },
    competitors: [],
    localizedTemplates: {
      sv: [
        '{brand} omdöme',
        'är {brand} pålitligt',
        '{brand} vs {competitor}',
        'bästa {category} {location}',
        'vad är {brand}',
        '{brand} alternativ',
      ],
      it: [
        '{brand} recensioni',
        '{brand} è affidabile',
        '{brand} vs {competitor}',
        'migliore {category} {location}',
        "cos'è {brand}",
        'alternative a {brand}',
      ],
    },
    categories: {
      en: ['service', 'platform', 'product', 'solution', 'provider'],
      it: ['servizio', 'piattaforma', 'prodotto', 'soluzione', 'fornitore'],
      sv: ['tjänst', 'plattform', 'produkt', 'lösning', 'leverantör'],
    },
    roles: {
      en: ['customer', 'buyer', 'user', 'decision maker'],
      it: ['cliente', 'acquirente', 'utente', 'decisore'],
      sv: ['kund', 'köpare', 'användare', 'beslutsfattare'],
    },
    intentPatterns: [
      { bucket: 'B1', template: '{brand} review', priority: 'high' },
      { bucket: 'B1', template: '{brand} vs {competitor}', priority: 'high' },
      { bucket: 'B1', template: 'is {brand} reliable', priority: 'medium' },
      { bucket: 'B2', template: 'best {category} {location}', priority: 'high' },
      { bucket: 'B2', template: 'what is {brand}', priority: 'medium' },
      { bucket: 'B3', template: '{brand} alternatives', priority: 'medium' },
      { bucket: 'B3', template: 'how does {brand} work', priority: 'medium' },
      { bucket: 'B4', template: '{brand} price {location}', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} legit', priority: 'medium' },
      { bucket: 'B5', template: 'is {brand} trustworthy', priority: 'medium' },
    ],
    seedKeywords: {
      en: ['review', 'best', 'alternatives', 'compare', 'trusted'],
      it: ['recensioni', 'migliore', 'alternative', 'confronto', 'affidabile'],
      sv: ['omdöme', 'bäst', 'alternativ', 'jämför', 'pålitlig'],
    },
  },
]

export interface ExpandedQuery {
  query: string
  intentBucket: string
  intentLabel: string
  priority: 'high' | 'medium' | 'low'
}

export interface GeneratedPrompt {
  title: string
  intentBucket: string
  intentLabel: string
  targetLLMs: string[]
  language: Locale
  systemPrompt: string
  userQuery: string
  expectedOutput: string
  suggestedFrequency: 'daily' | 'weekly' | 'monthly'
  priority: 'high' | 'medium' | 'low'
}

function getLocaleLabels(bucket: string, locale: Locale): string {
  const labels = BUCKET_LABELS[locale]
  return labels[bucket as keyof typeof labels] || bucket
}

function replaceTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  // Collapse the whitespace an empty placeholder leaves behind (e.g. an absent
  // {location} at the end of a template) so we never emit "hitta billigaste
  // elektronik  " or double spaces mid-string.
  return result.replace(/\s+/g, ' ').trim()
}

function getYear() {
  return new Date().getFullYear().toString()
}

function buildSystemPrompt(industry: IndustryPreset, locale: Locale): string {
  const industryName = industry.name[locale]
  if (locale === 'it') {
    return `Sei un analista esperto nel settore "${industryName}". Rispondi alla domanda in modo completo e obiettivo, citando le fonti quando possibile. Valuta le piattaforme, i brand e i servizi menzionati in modo critico, evidenziando punti di forza e debolezza. Fornisci esempi concreti e dati dove pertinenti.`
  }
  if (locale === 'sv') {
    return `Du är en erfaren analytiker inom "${industryName}". Svara på frågan heltäckande och objektivt, citera källor där möjligt. Utvärdera plattformar, varumärken och tjänster kritiskt med styrkor och svagheter. Ge konkreta exempel och data där det är relevant.`
  }
  return `You are an expert analyst in the "${industryName}" industry. Answer the question comprehensively and objectively, citing sources where possible. Critically evaluate the platforms, brands, and services mentioned, highlighting strengths and weaknesses. Provide concrete examples and data where relevant.`
}

function buildExpectedOutput(locale: Locale): string {
  if (locale === 'it') {
    return 'Brand menzionati, sentiment (positivo/neutro/negativo), citazioni con URL, raccomandazioni, competitor menzionati, tono generale della risposta'
  }
  if (locale === 'sv') {
    return 'Nämnda varumärken, sentiment (positivt/neutralt/negativt), citat med URL:er, rekommendationer, nämnda konkurrenter, allmän ton i svaret'
  }
  return 'Brands mentioned, sentiment (positive/neutral/negative), citations with URLs, recommendations, competitors mentioned, overall tone of response'
}

function suggestFrequency(priority: 'high' | 'medium' | 'low'): 'daily' | 'weekly' | 'monthly' {
  if (priority === 'high') return 'weekly'
  if (priority === 'medium') return 'weekly'
  return 'monthly'
}

function getActiveCompetitors(
  preset: IndustryPreset,
  locale: Locale,
  override?: string[],
): string[] {
  // When the brand supplies its OWN competitors, use them — the preset's
  // competitor list is a generic placeholder (e.g. Salesforce/HubSpot for
  // saas-b2b) and produces misleading "<brand> vs <wrong competitor>" prompts.
  // Clean first: a stray comma can yield [""] which must NOT win over the
  // preset (it would drop comparison prompts entirely).
  const cleanedOverride = override
    ? [...new Set(override.map((c) => c.trim()).filter(Boolean))]
    : []
  if (cleanedOverride.length > 0) {
    return cleanedOverride
  }
  const base = [...preset.competitors]
  if (locale !== 'en' && preset.localCompetitors?.[locale]) {
    for (const c of preset.localCompetitors[locale]!) {
      if (!base.includes(c)) base.push(c)
    }
  }
  return base
}

function expandPattern(
  template: string,
  variables: Record<string, string>,
  preset: IndustryPreset,
  locale: Locale,
  bucket: string,
  priority: 'high' | 'medium' | 'low',
  competitorOverride?: string[],
): ExpandedQuery[] {
  const result: ExpandedQuery[] = []
  const competitors = getActiveCompetitors(preset, locale, competitorOverride)

  if (template.includes('{competitor}')) {
    for (const competitor of competitors.slice(0, 5)) {
      result.push({
        query: replaceTemplate(template, { ...variables, competitor }),
        intentBucket: bucket,
        intentLabel: getLocaleLabels(bucket, locale),
        priority,
      })
    }
  } else if (template.includes('{category}')) {
    const cats = preset.categories[locale]
    for (const cat of cats.slice(0, 3)) {
      result.push({
        query: replaceTemplate(template, { ...variables, category: cat }),
        intentBucket: bucket,
        intentLabel: getLocaleLabels(bucket, locale),
        priority,
      })
    }
  } else if (template.includes('{role}')) {
    const roles = preset.roles[locale]
    for (const role of roles.slice(0, 3)) {
      result.push({
        query: replaceTemplate(template, { ...variables, role }),
        intentBucket: bucket,
        intentLabel: getLocaleLabels(bucket, locale),
        priority,
      })
    }
  } else {
    result.push({
      query: replaceTemplate(template, variables),
      intentBucket: bucket,
      intentLabel: getLocaleLabels(bucket, locale),
      priority,
    })
  }

  return result
}

export function expandKeywords(
  brand: string,
  industryId: string,
  locale: Locale,
  location?: string,
  competitors?: string[],
  brandDomain?: string | null,
): ExpandedQuery[] {
  const preset = INDUSTRY_PRESETS.find((p) => p.id === industryId)
  if (!preset) return []

  const year = getYear()
  // No location provided → leave {location} EMPTY. Borrowing seedKeywords[0]
  // (the old fallback) injected a keyword as if it were a place, producing junk
  // like "hitta billigaste elektronik prisjämförelse". replaceTemplate trims the
  // gap the empty placeholder leaves.
  const loc = location || ''
  // Anchor the brand with its domain when the name is at risk of homonym
  // confusion ("Acasting" → "Acasting (acasting.se)"). Drops in
  // transparently because the {brand} placeholder is hydrated from this
  // map — every template benefits without per-template editing.
  const variables: Record<string, string> = {
    brand: anchorBrand(brand, brandDomain),
    location: loc,
    year,
  }

  const intentQueries: ExpandedQuery[] = []
  for (const pattern of preset.intentPatterns) {
    intentQueries.push(
      ...expandPattern(
        pattern.template,
        variables,
        preset,
        locale,
        pattern.bucket,
        pattern.priority,
        competitors,
      ),
    )
  }

  const localQueries: ExpandedQuery[] = []
  const localTemplates = preset.localizedTemplates?.[locale]
  if (localTemplates) {
    for (const lt of localTemplates) {
      localQueries.push(
        ...expandPattern(lt, variables, preset, locale, 'B1', 'medium', competitors),
      )
    }
  }

  // For non-English locales the localized templates are natively phrased (e.g.
  // "bästa reklambyrån Stockholm"), while intentPatterns are English scaffolding
  // ("best {category} {location}"). Lead with the native ones so a capped/top
  // slice favors prompts that actually read well in the brand's language.
  // English scaffolding (intentPatterns) reads wrong on a Swedish/Italian brand
  // ("compare prices for elektronik" tagged as SV). When the preset ships enough
  // native localized templates, drop the English ones entirely; only fall back
  // to them when there are too few native prompts to stand alone (so we never
  // return an empty set for a sparse preset).
  if (locale === 'en') return [...intentQueries, ...localQueries]
  return localQueries.length >= 4 ? localQueries : [...localQueries, ...intentQueries]
}

export function generatePrompts(
  brand: string,
  industryId: string,
  locale: Locale,
  location?: string,
  competitors?: string[],
  brandDomain?: string | null,
): GeneratedPrompt[] {
  const preset = INDUSTRY_PRESETS.find((p) => p.id === industryId)
  if (!preset) return []

  const expandedQueries = expandKeywords(
    brand,
    industryId,
    locale,
    location,
    competitors,
    brandDomain,
  )
  const systemPrompt = buildSystemPrompt(preset, locale)
  const expectedOutput = buildExpectedOutput(locale)

  return expandedQueries.map((eq) => ({
    title: eq.query,
    intentBucket: eq.intentBucket,
    intentLabel: eq.intentLabel,
    targetLLMs: [...LLM_TARGETS],
    language: locale,
    systemPrompt,
    userQuery: eq.query,
    expectedOutput,
    suggestedFrequency: suggestFrequency(eq.priority),
    priority: eq.priority,
  }))
}

export function getIndustryPreset(id: string): IndustryPreset | undefined {
  return INDUSTRY_PRESETS.find((p) => p.id === id)
}

export function getAllIndustryPresets(): IndustryPreset[] {
  return INDUSTRY_PRESETS
}
