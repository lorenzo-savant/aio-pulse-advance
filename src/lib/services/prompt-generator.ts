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
  return result
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

function getActiveCompetitors(preset: IndustryPreset, locale: Locale): string[] {
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
): ExpandedQuery[] {
  const result: ExpandedQuery[] = []
  const competitors = getActiveCompetitors(preset, locale)

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
): ExpandedQuery[] {
  const preset = INDUSTRY_PRESETS.find((p) => p.id === industryId)
  if (!preset) return []

  const queries: ExpandedQuery[] = []
  const year = getYear()
  const loc = location || preset.seedKeywords[locale][0] || ''
  const variables: Record<string, string> = {
    brand,
    location: loc,
    year,
  }

  for (const pattern of preset.intentPatterns) {
    queries.push(
      ...expandPattern(
        pattern.template,
        variables,
        preset,
        locale,
        pattern.bucket,
        pattern.priority,
      ),
    )
  }

  const localTemplates = preset.localizedTemplates?.[locale]
  if (localTemplates) {
    for (const lt of localTemplates) {
      queries.push(...expandPattern(lt, variables, preset, locale, 'B1', 'medium'))
    }
  }

  return queries
}

export function generatePrompts(
  brand: string,
  industryId: string,
  locale: Locale,
  location?: string,
): GeneratedPrompt[] {
  const preset = INDUSTRY_PRESETS.find((p) => p.id === industryId)
  if (!preset) return []

  const expandedQueries = expandKeywords(brand, industryId, locale, location)
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
