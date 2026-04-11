export type PromptCategory =
  | 'discovery'
  | 'comparison'
  | 'recommendation'
  | 'problem'
  | 'reputation'
  | 'local'
  | 'negative'
  | 'expert'

export interface PromptTemplate {
  id: string
  category: PromptCategory
  text: string
  description: string
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
    text: 'What is {brand}?',
    description: 'Basic brand identity query',
  },
  {
    id: 'D02',
    category: 'discovery',
    text: 'Tell me about {brand} and what they do',
    description: 'Brand overview request',
  },
  {
    id: 'D03',
    category: 'discovery',
    text: 'What are the best {category} companies?',
    description: 'Top companies in category',
  },
  {
    id: 'D04',
    category: 'discovery',
    text: 'List the top 10 {category} providers in {location}',
    description: 'Top providers in location',
  },
  {
    id: 'D05',
    category: 'discovery',
    text: 'Who is the market leader in {category}?',
    description: 'Market leader identification',
  },
  {
    id: 'D06',
    category: 'discovery',
    text: 'What companies should I know about in {category}?',
    description: 'Notable companies in sector',
  },
  {
    id: 'D07',
    category: 'discovery',
    text: 'What is {brand} known for?',
    description: 'Brand specialization query',
  },
  {
    id: 'D08',
    category: 'discovery',
    text: 'Is {brand} a good company?',
    description: 'General quality assessment',
  },
  {
    id: 'D09',
    category: 'discovery',
    text: 'What does {brand} specialize in?',
    description: 'Brand expertise query',
  },
  {
    id: 'D10',
    category: 'discovery',
    text: 'Give me an overview of the {category} industry and key players',
    description: 'Industry overview request',
  },

  // Comparison (C01-C10)
  {
    id: 'C01',
    category: 'comparison',
    text: 'Compare {brand} vs {competitor}',
    description: 'Direct brand comparison',
  },
  {
    id: 'C02',
    category: 'comparison',
    text: '{brand} or {competitor}, which is better for {use_case}?',
    description: 'Use-case comparison',
  },
  {
    id: 'C03',
    category: 'comparison',
    text: 'What are the pros and cons of {brand}?',
    description: 'Brand pros and cons',
  },
  {
    id: 'C04',
    category: 'comparison',
    text: 'How does {brand} compare to alternatives?',
    description: 'Alternative comparison',
  },
  {
    id: 'C05',
    category: 'comparison',
    text: 'Is {brand} worth it compared to {competitor}?',
    description: 'Value comparison',
  },
  {
    id: 'C06',
    category: 'comparison',
    text: 'What is the difference between {brand} and {competitor}?',
    description: 'Brand differentiation',
  },
  {
    id: 'C07',
    category: 'comparison',
    text: '{brand} vs {competitor} vs {competitor2} — which should I choose?',
    description: 'Multi-brand comparison',
  },
  {
    id: 'C08',
    category: 'comparison',
    text: 'Rate {brand} on a scale of 1-10 for {category}',
    description: 'Brand rating request',
  },
  {
    id: 'C09',
    category: 'comparison',
    text: 'What are the advantages of {brand} over {competitor}?',
    description: 'Competitive advantage query',
  },
  {
    id: 'C10',
    category: 'comparison',
    text: 'Which {category} tool has the best value for money?',
    description: 'Value for money comparison',
  },

  // Recommendation (R01-R10)
  {
    id: 'R01',
    category: 'recommendation',
    text: 'Recommend a {category} for a small business',
    description: 'Small business recommendation',
  },
  {
    id: 'R02',
    category: 'recommendation',
    text: 'What is the best {category} for {use_case}?',
    description: 'Best category for use case',
  },
  {
    id: 'R03',
    category: 'recommendation',
    text: 'I need a {category} that is reliable. What should I use?',
    description: 'Reliability-focused recommendation',
  },
  {
    id: 'R04',
    category: 'recommendation',
    text: 'What {category} do experts recommend?',
    description: 'Expert recommendation request',
  },
  {
    id: 'R05',
    category: 'recommendation',
    text: 'Best {category} for small businesses in {location}',
    description: 'Local small business recommendation',
  },
  {
    id: 'R06',
    category: 'recommendation',
    text: 'What {category} should I choose in 2026?',
    description: 'Future-proof recommendation',
  },
  {
    id: 'R07',
    category: 'recommendation',
    text: 'If I want to grow my business, what {category} should I use?',
    description: 'Growth-oriented recommendation',
  },
  {
    id: 'R08',
    category: 'recommendation',
    text: 'What is the most recommended {category} right now?',
    description: 'Current top recommendation',
  },
  {
    id: 'R09',
    category: 'recommendation',
    text: 'Help me choose between {brand}, {competitor}, and {competitor2}',
    description: 'Multi-choice recommendation',
  },
  {
    id: 'R10',
    category: 'recommendation',
    text: 'What would you recommend for someone new to {category}?',
    description: 'Beginner recommendation',
  },

  // Problem (P01-P10)
  {
    id: 'P01',
    category: 'problem',
    text: 'I need help with {category}, what should I use?',
    description: 'Help-seeking query',
  },
  {
    id: 'P02',
    category: 'problem',
    text: 'How do I improve my {category} strategy?',
    description: 'Strategy improvement query',
  },
  {
    id: 'P03',
    category: 'problem',
    text: 'What is the best way to handle {category} for a growing company?',
    description: 'Growing company challenge',
  },
  {
    id: 'P04',
    category: 'problem',
    text: 'I am struggling with {category}. Any solutions?',
    description: 'Struggling with category',
  },
  {
    id: 'P05',
    category: 'problem',
    text: 'How can {brand} help with {category}?',
    description: 'Brand assistance query',
  },
  {
    id: 'P06',
    category: 'problem',
    text: 'What tools exist for {category}?',
    description: 'Tool discovery query',
  },
  {
    id: 'P07',
    category: 'problem',
    text: 'I need help with {category}. Where should I start?',
    description: 'Getting started query',
  },
  {
    id: 'P08',
    category: 'problem',
    text: 'What is the fastest way to improve {category}?',
    description: 'Quick improvement query',
  },
  {
    id: 'P09',
    category: 'problem',
    text: 'Best practices for {category} in 2026',
    description: 'Current best practices',
  },
  {
    id: 'P10',
    category: 'problem',
    text: 'How do companies typically handle {category}?',
    description: 'Common approach query',
  },

  // Reputation (T01-T10)
  {
    id: 'T01',
    category: 'reputation',
    text: 'What do people think about {brand}?',
    description: 'Public perception query',
  },
  {
    id: 'T02',
    category: 'reputation',
    text: 'Is {brand} trustworthy?',
    description: 'Trust assessment query',
  },
  {
    id: 'T03',
    category: 'reputation',
    text: '{brand} reviews — is it legit?',
    description: 'Legitimacy verification',
  },
  {
    id: 'T04',
    category: 'reputation',
    text: 'Has {brand} had any controversies?',
    description: 'Controversy check',
  },
  {
    id: 'T05',
    category: 'reputation',
    text: 'What are common complaints about {brand}?',
    description: 'Common complaints query',
  },
  {
    id: 'T06',
    category: 'reputation',
    text: 'Why do some people dislike {brand}?',
    description: 'Negative sentiment query',
  },
  {
    id: 'T07',
    category: 'reputation',
    text: 'Is {brand} good for small businesses?',
    description: 'Small business suitability',
  },
  {
    id: 'T08',
    category: 'reputation',
    text: "What is {brand}'s reputation in the industry?",
    description: 'Industry reputation',
  },
  {
    id: 'T09',
    category: 'reputation',
    text: 'Should I trust {brand} with my business?',
    description: 'Business trust query',
  },
  {
    id: 'T10',
    category: 'reputation',
    text: 'What are the risks of using {brand}?',
    description: 'Risk assessment query',
  },

  // Local (L01-L10)
  {
    id: 'L01',
    category: 'local',
    text: 'Best {category} in {location}',
    description: 'Best in location',
  },
  {
    id: 'L02',
    category: 'local',
    text: '{category} providers near {location}',
    description: 'Local providers',
  },
  {
    id: 'L03',
    category: 'local',
    text: 'Top rated {category} in {location}',
    description: 'Top-rated local',
  },
  {
    id: 'L04',
    category: 'local',
    text: 'Where can I find {category} services in {location}?',
    description: 'Service location query',
  },
  {
    id: 'L05',
    category: 'local',
    text: 'Local {category} recommendations in {location}',
    description: 'Local recommendations',
  },
  {
    id: 'L06',
    category: 'local',
    text: 'Best {category} in Sweden for {use_case}',
    description: 'Sweden-specific recommendation',
  },
  {
    id: 'L07',
    category: 'local',
    text: '{brand} locations in {location}',
    description: 'Brand locations query',
  },
  {
    id: 'L08',
    category: 'local',
    text: 'Is {brand} available in {location}?',
    description: 'Availability check',
  },
  {
    id: 'L09',
    category: 'local',
    text: 'Alternatives to {brand} in {location}',
    description: 'Local alternatives',
  },
  {
    id: 'L10',
    category: 'local',
    text: 'Who provides {category} in {location}?',
    description: 'Local provider identification',
  },

  // Negative (N01-N05)
  {
    id: 'N01',
    category: 'negative',
    text: 'What are the biggest problems with {brand}?',
    description: 'Major problems query',
  },
  {
    id: 'N02',
    category: 'negative',
    text: 'Why should I NOT use {brand}?',
    description: 'Anti-recommendation query',
  },
  {
    id: 'N03',
    category: 'negative',
    text: 'Has {brand} ever failed a customer?',
    description: 'Customer failure query',
  },
  {
    id: 'N04',
    category: 'negative',
    text: '{brand} scam — is it real?',
    description: 'Scam verification query',
  },
  {
    id: 'N05',
    category: 'negative',
    text: 'What does {brand} do wrong?',
    description: 'Brand criticism query',
  },

  // Expert (E01-E05)
  {
    id: 'E01',
    category: 'expert',
    text: 'Who is the leading expert in {category}?',
    description: 'Industry expert query',
  },
  {
    id: 'E02',
    category: 'expert',
    text: 'What companies are innovating in {category}?',
    description: 'Innovation leaders query',
  },
  {
    id: 'E03',
    category: 'expert',
    text: 'What does {brand} think about the future of {category}?',
    description: 'Future vision query',
  },
  {
    id: 'E04',
    category: 'expert',
    text: 'Which {category} company has the best technology?',
    description: 'Technology leadership query',
  },
  {
    id: 'E05',
    category: 'expert',
    text: 'What awards has {brand} won?',
    description: 'Awards and recognition query',
  },
]

export function hydratePrompt(template: string, params: HydrationParams): string {
  return template
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
