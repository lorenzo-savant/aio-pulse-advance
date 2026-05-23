export type PromptCategory =
  | 'discovery'
  | 'comparison'
  | 'recommendation'
  | 'problem'
  | 'reputation'
  | 'local'
  | 'negative'
  | 'expert'

export type PromptLang = 'en' | 'it' | 'sv'

export interface PromptTemplate {
  id: string
  category: PromptCategory
  description: string
  texts: Record<PromptLang, string>
  /**
   * Optional industry tags. When set, the template is offered only when the
   * brand's industry preset matches one of these slugs. When omitted, the
   * template is industry-agnostic (default behaviour). Keeps the existing
   * generic templates 100% backward-compatible while letting us layer in
   * industry-specific seeds (see getTemplatesByIndustry below).
   */
  industries?: string[]
}

export interface HydrationParams {
  brand?: string
  category?: string
  competitor?: string
  competitor2?: string
  location?: string
  use_case?: string
}

export const PROMPT_CATEGORIES: Record<PromptCategory, { label: string; description: string }> = {
  discovery: { label: 'Discovery', description: 'General awareness and brand discovery queries' },
  comparison: { label: 'Comparison', description: 'Brand vs competitor comparison queries' },
  recommendation: {
    label: 'Recommendation',
    description: 'Seeking product/service recommendations',
  },
  problem: {
    label: 'Problem Solving',
    description: 'Problem-solving and solution-seeking queries',
  },
  reputation: { label: 'Reputation', description: 'Brand reputation and trust queries' },
  local: { label: 'Local', description: 'Location-based queries' },
  negative: { label: 'Negative', description: 'Critical and problem-focused queries' },
  expert: { label: 'Expert', description: 'Expert-level and industry authority queries' },
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Discovery (D01-D10)
  {
    id: 'D01',
    category: 'discovery',
    description: 'Basic brand identity query',
    texts: {
      en: 'What is {brand}?',
      it: "Cos'è {brand}?",
      sv: 'Vad är {brand}?',
    },
  },
  {
    id: 'D02',
    category: 'discovery',
    description: 'Brand overview request',
    texts: {
      en: 'Tell me about {brand} and what they do',
      it: 'Parlami di {brand} e di cosa si occupa',
      sv: 'Berätta om {brand} och vad de gör',
    },
  },
  {
    id: 'D03',
    category: 'discovery',
    description: 'Top companies in category',
    texts: {
      en: 'What are the best {category} companies?',
      it: 'Quali sono le migliori aziende di {category}?',
      sv: 'Vilka är de bästa {category}-företagen?',
    },
  },
  {
    id: 'D04',
    category: 'discovery',
    description: 'Top providers in location',
    texts: {
      en: 'List the top 10 {category} providers in {location}',
      it: 'Elenca i migliori 10 fornitori di {category} a {location}',
      sv: 'Lista de 10 bästa {category}-leverantörerna i {location}',
    },
  },
  {
    id: 'D05',
    category: 'discovery',
    description: 'Market leader identification',
    texts: {
      en: 'Who is the market leader in {category}?',
      it: 'Chi è il leader di mercato nel settore {category}?',
      sv: 'Vem är marknadsledaren inom {category}?',
    },
  },
  {
    id: 'D06',
    category: 'discovery',
    description: 'Notable companies in sector',
    texts: {
      en: 'What companies should I know about in {category}?',
      it: 'Quali aziende dovrei conoscere nel settore {category}?',
      sv: 'Vilka företag bör jag känna till inom {category}?',
    },
  },
  {
    id: 'D07',
    category: 'discovery',
    description: 'Brand specialization query',
    texts: {
      en: 'What is {brand} known for?',
      it: 'Per cosa è conosciuta {brand}?',
      sv: 'Vad är {brand} känt för?',
    },
  },
  {
    id: 'D08',
    category: 'discovery',
    description: 'General quality assessment',
    texts: {
      en: 'Is {brand} a good company?',
      it: "{brand} è un'azienda affidabile?",
      sv: 'Är {brand} ett bra företag?',
    },
  },
  {
    id: 'D09',
    category: 'discovery',
    description: 'Brand expertise query',
    texts: {
      en: 'What does {brand} specialize in?',
      it: 'In cosa si specializza {brand}?',
      sv: 'Vad specialiserar sig {brand} på?',
    },
  },
  {
    id: 'D10',
    category: 'discovery',
    description: 'Industry overview request',
    texts: {
      en: 'Give me an overview of the {category} industry and key players',
      it: 'Fammi una panoramica del settore {category} e dei principali attori',
      sv: 'Ge mig en överblick av {category}-branschen och viktiga aktörer',
    },
  },

  // Comparison (C01-C10)
  {
    id: 'C01',
    category: 'comparison',
    description: 'Direct brand comparison',
    texts: {
      en: 'Compare {brand} vs {competitor}',
      it: 'Confronta {brand} con {competitor}',
      sv: 'Jämför {brand} med {competitor}',
    },
  },
  {
    id: 'C02',
    category: 'comparison',
    description: 'Use-case comparison',
    texts: {
      en: '{brand} or {competitor}, which is better for {use_case}?',
      it: '{brand} o {competitor}, quale è migliore per {use_case}?',
      sv: '{brand} eller {competitor}, vilket är bättre för {use_case}?',
    },
  },
  {
    id: 'C03',
    category: 'comparison',
    description: 'Brand pros and cons',
    texts: {
      en: 'What are the pros and cons of {brand}?',
      it: 'Quali sono i pro e i contro di {brand}?',
      sv: 'Vilka är för- och nackdelarna med {brand}?',
    },
  },
  {
    id: 'C04',
    category: 'comparison',
    description: 'Alternative comparison',
    texts: {
      en: 'How does {brand} compare to alternatives?',
      it: 'Come si confronta {brand} con le alternative?',
      sv: 'Hur står sig {brand} mot alternativen?',
    },
  },
  {
    id: 'C05',
    category: 'comparison',
    description: 'Value comparison',
    texts: {
      en: 'Is {brand} worth it compared to {competitor}?',
      it: '{brand} vale la pena rispetto a {competitor}?',
      sv: 'Är {brand} värt det jämfört med {competitor}?',
    },
  },
  {
    id: 'C06',
    category: 'comparison',
    description: 'Brand differentiation',
    texts: {
      en: 'What is the difference between {brand} and {competitor}?',
      it: 'Qual è la differenza tra {brand} e {competitor}?',
      sv: 'Vad är skillnaden mellan {brand} och {competitor}?',
    },
  },
  {
    id: 'C07',
    category: 'comparison',
    description: 'Multi-brand comparison',
    texts: {
      en: '{brand} vs {competitor} vs {competitor2} — which should I choose?',
      it: '{brand} vs {competitor} vs {competitor2} — quale dovrei scegliere?',
      sv: '{brand} mot {competitor} mot {competitor2} — vilket ska jag välja?',
    },
  },
  {
    id: 'C08',
    category: 'comparison',
    description: 'Brand rating request',
    texts: {
      en: 'Rate {brand} on a scale of 1-10 for {category}',
      it: 'Valuta {brand} su una scala da 1 a 10 per {category}',
      sv: 'Betygsätt {brand} på en skala 1-10 för {category}',
    },
  },
  {
    id: 'C09',
    category: 'comparison',
    description: 'Competitive advantage query',
    texts: {
      en: 'What are the advantages of {brand} over {competitor}?',
      it: 'Quali sono i vantaggi di {brand} rispetto a {competitor}?',
      sv: 'Vilka fördelar har {brand} framför {competitor}?',
    },
  },
  {
    id: 'C10',
    category: 'comparison',
    description: 'Value for money comparison',
    texts: {
      en: 'Which {category} tool has the best value for money?',
      it: 'Quale strumento {category} ha il miglior rapporto qualità-prezzo?',
      sv: 'Vilket {category}-verktyg ger bäst valuta för pengarna?',
    },
  },

  // Recommendation (R01-R10)
  {
    id: 'R01',
    category: 'recommendation',
    description: 'Small business recommendation',
    texts: {
      en: 'Recommend a {category} for a small business',
      it: 'Consiglia un {category} per una piccola azienda',
      sv: 'Rekommendera en {category} för ett litet företag',
    },
  },
  {
    id: 'R02',
    category: 'recommendation',
    description: 'Best category for use case',
    texts: {
      en: 'What is the best {category} for {use_case}?',
      it: 'Qual è il miglior {category} per {use_case}?',
      sv: 'Vad är det bästa {category} för {use_case}?',
    },
  },
  {
    id: 'R03',
    category: 'recommendation',
    description: 'Reliability-focused recommendation',
    texts: {
      en: 'I need a {category} that is reliable. What should I use?',
      it: 'Ho bisogno di un {category} affidabile. Cosa dovrei usare?',
      sv: 'Jag behöver en {category} som är pålitlig. Vad ska jag använda?',
    },
  },
  {
    id: 'R04',
    category: 'recommendation',
    description: 'Expert recommendation request',
    texts: {
      en: 'What {category} do experts recommend?',
      it: 'Quale {category} consigliano gli esperti?',
      sv: 'Vilken {category} rekommenderar experterna?',
    },
  },
  {
    id: 'R05',
    category: 'recommendation',
    description: 'Local small business recommendation',
    texts: {
      en: 'Best {category} for small businesses in {location}',
      it: 'Migliori {category} per piccole aziende a {location}',
      sv: 'Bästa {category} för små företag i {location}',
    },
  },
  {
    id: 'R06',
    category: 'recommendation',
    description: 'Future-proof recommendation',
    texts: {
      en: 'What {category} should I choose in 2026?',
      it: 'Quale {category} dovrei scegliere nel 2026?',
      sv: 'Vilken {category} ska jag välja 2026?',
    },
  },
  {
    id: 'R07',
    category: 'recommendation',
    description: 'Growth-oriented recommendation',
    texts: {
      en: 'If I want to grow my business, what {category} should I use?',
      it: 'Se voglio far crescere la mia azienda, quale {category} dovrei usare?',
      sv: 'Om jag vill växa mitt företag, vilken {category} ska jag använda?',
    },
  },
  {
    id: 'R08',
    category: 'recommendation',
    description: 'Current top recommendation',
    texts: {
      en: 'What is the most recommended {category} right now?',
      it: 'Qual è il {category} più consigliato in questo momento?',
      sv: 'Vilken {category} är mest rekommenderad just nu?',
    },
  },
  {
    id: 'R09',
    category: 'recommendation',
    description: 'Multi-choice recommendation',
    texts: {
      en: 'Help me choose between {brand}, {competitor}, and {competitor2}',
      it: 'Aiutami a scegliere tra {brand}, {competitor} e {competitor2}',
      sv: 'Hjälp mig välja mellan {brand}, {competitor} och {competitor2}',
    },
  },
  {
    id: 'R10',
    category: 'recommendation',
    description: 'Beginner recommendation',
    texts: {
      en: 'What would you recommend for someone new to {category}?',
      it: 'Cosa consiglieresti a chi è nuovo nel settore {category}?',
      sv: 'Vad skulle du rekommendera för någon ny inom {category}?',
    },
  },

  // Problem (P01-P10)
  {
    id: 'P01',
    category: 'problem',
    description: 'Help-seeking query',
    texts: {
      en: 'I need help with {category}, what should I use?',
      it: 'Ho bisogno di aiuto con {category}, cosa dovrei usare?',
      sv: 'Jag behöver hjälp med {category}, vad ska jag använda?',
    },
  },
  {
    id: 'P02',
    category: 'problem',
    description: 'Strategy improvement query',
    texts: {
      en: 'How do I improve my {category} strategy?',
      it: 'Come posso migliorare la mia strategia di {category}?',
      sv: 'Hur förbättrar jag min {category}-strategi?',
    },
  },
  {
    id: 'P03',
    category: 'problem',
    description: 'Growing company challenge',
    texts: {
      en: 'What is the best way to handle {category} for a growing company?',
      it: "Qual è il modo migliore per gestire {category} per un'azienda in crescita?",
      sv: 'Vad är det bästa sättet att hantera {category} för ett växande företag?',
    },
  },
  {
    id: 'P04',
    category: 'problem',
    description: 'Struggling with category',
    texts: {
      en: 'I am struggling with {category}. Any solutions?',
      it: 'Sto avendo problemi con {category}. Qualche soluzione?',
      sv: 'Jag har problem med {category}. Några lösningar?',
    },
  },
  {
    id: 'P05',
    category: 'problem',
    description: 'Brand assistance query',
    texts: {
      en: 'How can {brand} help with {category}?',
      it: 'Come può {brand} aiutare con {category}?',
      sv: 'Hur kan {brand} hjälpa till med {category}?',
    },
  },
  {
    id: 'P06',
    category: 'problem',
    description: 'Tool discovery query',
    texts: {
      en: 'What tools exist for {category}?',
      it: 'Quali strumenti esistono per {category}?',
      sv: 'Vilka verktyg finns för {category}?',
    },
  },
  {
    id: 'P07',
    category: 'problem',
    description: 'Getting started query',
    texts: {
      en: 'I need help with {category}. Where should I start?',
      it: 'Ho bisogno di aiuto con {category}. Da dove dovrei iniziare?',
      sv: 'Jag behöver hjälp med {category}. Var ska jag börja?',
    },
  },
  {
    id: 'P08',
    category: 'problem',
    description: 'Quick improvement query',
    texts: {
      en: 'What is the fastest way to improve {category}?',
      it: 'Qual è il modo più veloce per migliorare {category}?',
      sv: 'Vad är det snabbaste sättet att förbättra {category}?',
    },
  },
  {
    id: 'P09',
    category: 'problem',
    description: 'Current best practices',
    texts: {
      en: 'Best practices for {category} in 2026',
      it: 'Migliori pratiche per {category} nel 2026',
      sv: 'Bästa praxis för {category} 2026',
    },
  },
  {
    id: 'P10',
    category: 'problem',
    description: 'Common approach query',
    texts: {
      en: 'How do companies typically handle {category}?',
      it: 'Come gestiscono tipicamente {category} le aziende?',
      sv: 'Hur hanterar företag typiskt {category}?',
    },
  },

  // Reputation (T01-T10)
  {
    id: 'T01',
    category: 'reputation',
    description: 'Public perception query',
    texts: {
      en: 'What do people think about {brand}?',
      it: 'Cosa pensano le persone di {brand}?',
      sv: 'Vad tycker folk om {brand}?',
    },
  },
  {
    id: 'T02',
    category: 'reputation',
    description: 'Trust assessment query',
    texts: {
      en: 'Is {brand} trustworthy?',
      it: '{brand} è affidabile?',
      sv: 'Är {brand} pålitlig?',
    },
  },
  {
    id: 'T03',
    category: 'reputation',
    description: 'Legitimacy verification',
    texts: {
      en: '{brand} reviews — is it legit?',
      it: 'Recensioni di {brand} — è affidabile?',
      sv: '{brand} recensioner — är det legitimt?',
    },
  },
  {
    id: 'T04',
    category: 'reputation',
    description: 'Controversy check',
    texts: {
      en: 'Has {brand} had any controversies?',
      it: '{brand} ha avuto polemiche o scandali?',
      sv: 'Har {brand} haft några kontroverser?',
    },
  },
  {
    id: 'T05',
    category: 'reputation',
    description: 'Common complaints query',
    texts: {
      en: 'What are common complaints about {brand}?',
      it: 'Quali sono i reclami più comuni su {brand}?',
      sv: 'Vilka är vanliga klagomål på {brand}?',
    },
  },
  {
    id: 'T06',
    category: 'reputation',
    description: 'Negative sentiment query',
    texts: {
      en: 'Why do some people dislike {brand}?',
      it: 'Perché ad alcune persone non piace {brand}?',
      sv: 'Varför ogillar vissa {brand}?',
    },
  },
  {
    id: 'T07',
    category: 'reputation',
    description: 'Small business suitability',
    texts: {
      en: 'Is {brand} good for small businesses?',
      it: '{brand} è adatta alle piccole aziende?',
      sv: 'Är {brand} bra för små företag?',
    },
  },
  {
    id: 'T08',
    category: 'reputation',
    description: 'Industry reputation',
    texts: {
      en: "What is {brand}'s reputation in the industry?",
      it: 'Qual è la reputazione di {brand} nel settore?',
      sv: 'Vilket rykte har {brand} i branschen?',
    },
  },
  {
    id: 'T09',
    category: 'reputation',
    description: 'Business trust query',
    texts: {
      en: 'Should I trust {brand} with my business?',
      it: 'Dovrei fidarmi di {brand} per la mia attività?',
      sv: 'Ska jag lita på {brand} med mitt företag?',
    },
  },
  {
    id: 'T10',
    category: 'reputation',
    description: 'Risk assessment query',
    texts: {
      en: 'What are the risks of using {brand}?',
      it: "Quali sono i rischi nell'usare {brand}?",
      sv: 'Vilka är riskerna med att använda {brand}?',
    },
  },

  // Local (L01-L10)
  {
    id: 'L01',
    category: 'local',
    description: 'Best in location',
    texts: {
      en: 'Best {category} in {location}',
      it: 'Migliore {category} a {location}',
      sv: 'Bästa {category} i {location}',
    },
  },
  {
    id: 'L02',
    category: 'local',
    description: 'Local providers',
    texts: {
      en: '{category} providers near {location}',
      it: 'Fornitori di {category} vicino a {location}',
      sv: '{category}-leverantörer i närheten av {location}',
    },
  },
  {
    id: 'L03',
    category: 'local',
    description: 'Top-rated local',
    texts: {
      en: 'Top rated {category} in {location}',
      it: '{category} più votati a {location}',
      sv: 'Högst rankad {category} i {location}',
    },
  },
  {
    id: 'L04',
    category: 'local',
    description: 'Service location query',
    texts: {
      en: 'Where can I find {category} services in {location}?',
      it: 'Dove posso trovare servizi di {category} a {location}?',
      sv: 'Var kan jag hitta {category}-tjänster i {location}?',
    },
  },
  {
    id: 'L05',
    category: 'local',
    description: 'Local recommendations',
    texts: {
      en: 'Local {category} recommendations in {location}',
      it: 'Raccomandazioni locali di {category} a {location}',
      sv: 'Lokala {category}-rekommendationer i {location}',
    },
  },
  {
    id: 'L06',
    category: 'local',
    description: 'Sweden-specific recommendation',
    texts: {
      en: 'Best {category} in Sweden for {use_case}',
      it: 'Migliori {category} in Svezia per {use_case}',
      sv: 'Bästa {category} i Sverige för {use_case}',
    },
  },
  {
    id: 'L07',
    category: 'local',
    description: 'Brand locations query',
    texts: {
      en: '{brand} locations in {location}',
      it: 'Punti vendita di {brand} a {location}',
      sv: '{brand}-platser i {location}',
    },
  },
  {
    id: 'L08',
    category: 'local',
    description: 'Availability check',
    texts: {
      en: 'Is {brand} available in {location}?',
      it: '{brand} è disponibile a {location}?',
      sv: 'Finns {brand} i {location}?',
    },
  },
  {
    id: 'L09',
    category: 'local',
    description: 'Local alternatives',
    texts: {
      en: 'Alternatives to {brand} in {location}',
      it: 'Alternative a {brand} a {location}',
      sv: 'Alternativ till {brand} i {location}',
    },
  },
  {
    id: 'L10',
    category: 'local',
    description: 'Local provider identification',
    texts: {
      en: 'Who provides {category} in {location}?',
      it: 'Chi offre {category} a {location}?',
      sv: 'Vem erbjuder {category} i {location}?',
    },
  },

  // Negative (N01-N05)
  {
    id: 'N01',
    category: 'negative',
    description: 'Major problems query',
    texts: {
      en: 'What are the biggest problems with {brand}?',
      it: 'Quali sono i maggiori problemi di {brand}?',
      sv: 'Vilka är de största problemen med {brand}?',
    },
  },
  {
    id: 'N02',
    category: 'negative',
    description: 'Anti-recommendation query',
    texts: {
      en: 'Why should I NOT use {brand}?',
      it: 'Perché NON dovrei usare {brand}?',
      sv: 'Varför ska jag INTE använda {brand}?',
    },
  },
  {
    id: 'N03',
    category: 'negative',
    description: 'Customer failure query',
    texts: {
      en: 'Has {brand} ever failed a customer?',
      it: '{brand} ha mai deluso un cliente?',
      sv: 'Har {brand} någonsin misslyckats med en kund?',
    },
  },
  {
    id: 'N04',
    category: 'negative',
    description: 'Scam verification query',
    texts: {
      en: '{brand} scam — is it real?',
      it: '{brand} è una truffa — è vero?',
      sv: '{brand} bluff — är det sant?',
    },
  },
  {
    id: 'N05',
    category: 'negative',
    description: 'Brand criticism query',
    texts: {
      en: 'What does {brand} do wrong?',
      it: 'Cosa fa di sbagliato {brand}?',
      sv: 'Vad gör {brand} fel?',
    },
  },

  // Expert (E01-E05)
  {
    id: 'E01',
    category: 'expert',
    description: 'Industry expert query',
    texts: {
      en: 'Who is the leading expert in {category}?',
      it: 'Chi è il principale esperto di {category}?',
      sv: 'Vem är ledande expert inom {category}?',
    },
  },
  {
    id: 'E02',
    category: 'expert',
    description: 'Innovation leaders query',
    texts: {
      en: 'What companies are innovating in {category}?',
      it: 'Quali aziende stanno innovando nel settore {category}?',
      sv: 'Vilka företag innoverar inom {category}?',
    },
  },
  {
    id: 'E03',
    category: 'expert',
    description: 'Future vision query',
    texts: {
      en: 'What does {brand} think about the future of {category}?',
      it: 'Cosa pensa {brand} del futuro di {category}?',
      sv: 'Vad tycker {brand} om framtiden för {category}?',
    },
  },
  {
    id: 'E04',
    category: 'expert',
    description: 'Technology leadership query',
    texts: {
      en: 'Which {category} company has the best technology?',
      it: 'Quale azienda {category} ha la migliore tecnologia?',
      sv: 'Vilket {category}-företag har bäst teknik?',
    },
  },
  {
    id: 'E05',
    category: 'expert',
    description: 'Awards and recognition query',
    texts: {
      en: 'What awards has {brand} won?',
      it: 'Quali premi ha vinto {brand}?',
      sv: 'Vilka priser har {brand} vunnit?',
    },
  },

  // ─── Industry-specific templates (IND-*) ───────────────────────────────────
  // Layered ON TOP of the generic templates above. Only offered when the
  // brand's industry preset matches the `industries` slug. Keeps the seed
  // pool richer per industry without polluting industry-agnostic flows.

  // Marketing & Advertising
  {
    id: 'IND-MA-01',
    category: 'recommendation',
    description: 'Best agencies in a location (marketing)',
    industries: ['marketing-advertising'],
    texts: {
      en: 'What are the best {category} agencies in {location}?',
      it: 'Quali sono le migliori agenzie di {category} a {location}?',
      sv: 'Vilka är de bästa {category}-byråerna i {location}?',
    },
  },
  {
    id: 'IND-MA-02',
    category: 'problem',
    description: 'How to choose an agency for a use case',
    industries: ['marketing-advertising'],
    texts: {
      en: 'How do I choose a {category} agency for {use_case}?',
      it: "Come scelgo un'agenzia di {category} per {use_case}?",
      sv: 'Hur väljer jag en {category}-byrå för {use_case}?',
    },
  },
  {
    id: 'IND-MA-03',
    category: 'expert',
    description: 'Typical ROI / KPI expectations for the service',
    industries: ['marketing-advertising'],
    texts: {
      en: 'What ROI should I expect from a {category} agency?',
      it: "Quale ROI posso aspettarmi da un'agenzia di {category}?",
      sv: 'Vilken ROI ska jag förvänta mig från en {category}-byrå?',
    },
  },

  // Casting & Talent
  {
    id: 'IND-CT-01',
    category: 'discovery',
    description: 'Where to find talent for a use case in a location',
    industries: ['casting-talent'],
    texts: {
      en: 'Where can I find {use_case} talent in {location}?',
      it: 'Dove posso trovare talenti per {use_case} a {location}?',
      sv: 'Var hittar jag {use_case}-talanger i {location}?',
    },
  },
  {
    id: 'IND-CT-02',
    category: 'comparison',
    description: 'Best casting platforms for a category',
    industries: ['casting-talent'],
    texts: {
      en: 'Best casting platforms for {category} projects',
      it: 'Migliori piattaforme di casting per progetti di {category}',
      sv: 'Bästa casting-plattformarna för {category}-projekt',
    },
  },

  // SaaS / B2B
  {
    id: 'IND-SAAS-01',
    category: 'expert',
    description: 'Pricing structure of a B2B SaaS',
    industries: ['saas'],
    texts: {
      en: "What is {brand}'s pricing structure and how does it scale?",
      it: 'Qual è la struttura di prezzo di {brand} e come scala?',
      sv: 'Vilken prisstruktur har {brand} och hur skalar den?',
    },
  },
  {
    id: 'IND-SAAS-02',
    category: 'expert',
    description: 'Compliance and security posture',
    industries: ['saas'],
    texts: {
      en: 'Is {brand} GDPR / SOC2 compliant and what certifications does it have?',
      it: 'È {brand} conforme a GDPR / SOC2 e quali certificazioni ha?',
      sv: 'Är {brand} GDPR/SOC2-kompatibelt och vilka certifieringar har det?',
    },
  },
  {
    id: 'IND-SAAS-03',
    category: 'comparison',
    description: 'Enterprise vs SMB alternatives',
    industries: ['saas'],
    texts: {
      en: 'How does {brand} compare to enterprise alternatives like {competitor}?',
      it: 'Come si confronta {brand} con alternative enterprise come {competitor}?',
      sv: 'Hur jämför sig {brand} med enterprise-alternativ som {competitor}?',
    },
  },

  // E-commerce / D2C
  {
    id: 'IND-EC-01',
    category: 'recommendation',
    description: 'Best brands in a category for a use case',
    industries: ['ecommerce'],
    texts: {
      en: 'Best {category} brands for {use_case}',
      it: 'Migliori marchi di {category} per {use_case}',
      sv: 'Bästa {category}-varumärken för {use_case}',
    },
  },
  {
    id: 'IND-EC-02',
    category: 'local',
    description: 'Where to buy in a location',
    industries: ['ecommerce'],
    texts: {
      en: 'Where can I buy {brand} products in {location}?',
      it: 'Dove posso acquistare i prodotti {brand} a {location}?',
      sv: 'Var kan jag köpa {brand}-produkter i {location}?',
    },
  },

  // Hospitality / Travel
  {
    id: 'IND-HOSP-01',
    category: 'local',
    description: 'Top venues in a location for a use case',
    industries: ['hospitality'],
    texts: {
      en: 'Top {category} in {location} for {use_case}',
      it: 'Migliori {category} a {location} per {use_case}',
      sv: 'Bästa {category} i {location} för {use_case}',
    },
  },
  {
    id: 'IND-HOSP-02',
    category: 'reputation',
    description: 'Reviews and reputation summary',
    industries: ['hospitality'],
    texts: {
      en: 'What do recent reviews say about {brand}?',
      it: 'Cosa dicono le recensioni recenti su {brand}?',
      sv: 'Vad säger de senaste recensionerna om {brand}?',
    },
  },

  // Professional services (consulting / legal / finance)
  {
    id: 'IND-PS-01',
    category: 'comparison',
    description: 'Best consultancies in a location',
    industries: ['professional-services'],
    texts: {
      en: 'Best {category} consultancies in {location}',
      it: 'Migliori società di consulenza in {category} a {location}',
      sv: 'Bästa {category}-konsultbyråerna i {location}',
    },
  },
  {
    id: 'IND-PS-02',
    category: 'expert',
    description: 'Typical pricing for the service',
    industries: ['professional-services'],
    texts: {
      en: 'How much does {category} cost on average?',
      it: 'Quanto costa in media {category}?',
      sv: 'Vad kostar {category} i genomsnitt?',
    },
  },
  {
    id: 'IND-PS-03',
    category: 'reputation',
    description: 'Independent reviews of the firm',
    industries: ['professional-services'],
    texts: {
      en: 'What do independent reviews say about {brand} services?',
      it: 'Cosa dicono le recensioni indipendenti sui servizi di {brand}?',
      sv: 'Vad säger oberoende recensioner om {brand}s tjänster?',
    },
  },
]

export function hydratePrompt(
  template: PromptTemplate,
  language: PromptLang,
  params: HydrationParams,
): string {
  const raw = template.texts[language] ?? template.texts.en
  return raw
    .replace(/{brand}/g, params.brand || '')
    .replace(/{category}/g, params.category || '')
    .replace(/{competitor}/g, params.competitor || '')
    .replace(/{competitor2}/g, params.competitor2 || '')
    .replace(/{location}/g, params.location || '')
    .replace(/{use_case}/g, params.use_case || '')
}

export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter((t) => t.category === category)
}

export function getTemplatesByCategories(categories: PromptCategory[]): PromptTemplate[] {
  if (!categories.length) return PROMPT_TEMPLATES
  return PROMPT_TEMPLATES.filter((t) => categories.includes(t.category))
}

/**
 * Templates available for a given industry preset:
 * the union of (a) every industry-agnostic template (no `industries` field)
 * and (b) templates explicitly tagged with this industry. Call with `null`
 * or empty string to get only the agnostic ones.
 */
export function getTemplatesByIndustry(industry: string | null | undefined): PromptTemplate[] {
  const ind = (industry ?? '').trim().toLowerCase()
  if (!ind) return PROMPT_TEMPLATES.filter((t) => !t.industries || t.industries.length === 0)
  return PROMPT_TEMPLATES.filter(
    (t) => !t.industries || t.industries.length === 0 || t.industries.includes(ind),
  )
}
