#!/usr/bin/env node
/**
 * Demo Data Seeder — populate a new Supabase project with realistic Italian-market data
 *
 * USAGE:
 *   node scripts/seed-demo-data.mjs
 *
 * Prerequisites:
 *   - .env.local configured with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY
 *   - BOOTSTRAP.sql already run on the target Supabase
 *
 * What it does (idempotent — safe to re-run):
 *   1. Creates 1 brand "Caffè Milano" with language=it
 *   2. Seeds 5 Italian prompts for that brand
 *   3. Inserts 3 realistic monitoring_result rows across ChatGPT/Gemini/Claude
 *   4. Computes + inserts a brand_health_score with AVI ~68
 *
 * After running, the dashboard has populated Insights, sentiment, citations sections.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Load .env.local ────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const [key, ...rest] = l.split('=')
      const value = rest.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      return [key.trim(), value]
    }),
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const USER_ID = env.DEV_USER_ID || 'dev-user-local-001'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(`🎯 Target: ${SUPABASE_URL}`)
console.log(`👤 User:   ${USER_ID}`)
console.log('')

// ─── 1. Brand ────────────────────────────────────────────────────────────────
const BRAND = {
  user_id: USER_ID,
  name: 'Caffè Milano',
  slug: 'caffe-milano',
  description: 'Torrefazione artigianale milanese specializzata in miscele arabica single-origin.',
  domain: 'caffemilano.it',
  aliases: ['Caffè Milano', 'CM Coffee'],
  domains: ['caffemilano.it', 'caffemilano.com'],
  competitors: ['Lavazza', 'Illy', 'Kimbo'],
  industry: 'Restaurant & Food',
  language: 'it',
  color: '#8B4513',
  is_active: true,
}

console.log('1. Upserting brand...')
const { data: existing } = await supabase
  .from('brands')
  .select('id')
  .eq('user_id', USER_ID)
  .eq('slug', BRAND.slug)
  .maybeSingle()

let brandId
if (existing) {
  brandId = existing.id
  console.log(`   ℹ️  Brand exists (id=${brandId})`)
} else {
  const { data, error } = await supabase.from('brands').insert(BRAND).select('id').single()
  if (error) {
    console.error('   ❌ Brand insert failed:', error.message)
    process.exit(1)
  }
  brandId = data.id
  console.log(`   ✅ Brand created (id=${brandId})`)
}

// ─── 2. Prompts ──────────────────────────────────────────────────────────────
const PROMPTS = [
  { text: "Cos'è Caffè Milano?", category: 'discovery' },
  { text: 'Qual è la miglior torrefazione artigianale a Milano?', category: 'discovery' },
  { text: 'Confronta Caffè Milano con Lavazza', category: 'comparison' },
  { text: 'Miglior caffè arabica italiano del 2026', category: 'recommendation' },
  { text: 'Caffè Milano è affidabile? Recensioni', category: 'reputation' },
]

console.log('2. Seeding 5 Italian prompts...')
const { data: existingPrompts } = await supabase
  .from('prompts')
  .select('id, text')
  .eq('brand_id', brandId)

const existingTexts = new Set((existingPrompts || []).map((p) => p.text.toLowerCase()))

const toInsert = PROMPTS.filter((p) => !existingTexts.has(p.text.toLowerCase())).map((p) => ({
  brand_id: brandId,
  user_id: USER_ID,
  text: p.text,
  language: 'it',
  market: 'Italy',
  category: p.category,
  engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
  is_active: true,
  run_frequency: 'daily',
}))

if (toInsert.length > 0) {
  const { error } = await supabase.from('prompts').insert(toInsert)
  if (error) {
    console.error('   ❌ Prompts insert failed:', error.message)
    process.exit(1)
  }
  console.log(`   ✅ Inserted ${toInsert.length} prompts (${existingPrompts?.length ?? 0} already existed)`)
} else {
  console.log(`   ℹ️  All ${PROMPTS.length} prompts already exist`)
}

const { data: allPrompts } = await supabase
  .from('prompts')
  .select('id, text')
  .eq('brand_id', brandId)
  .order('created_at', { ascending: true })

// ─── 3. Monitoring results (3 realistic fixtures) ────────────────────────────
const RESPONSE_CHATGPT = `Caffè Milano è una torrefazione artigianale milanese nota per le miscele arabica single-origin. Fondata con l'obiettivo di offrire caffè di alta qualità, si è fatta strada tra competitor storici come Lavazza e Illy. I loro blend sono particolarmente apprezzati in ambienti specialty coffee. Recensioni generalmente positive sui loro chicchi etiopi e colombiani.`

const RESPONSE_GEMINI = `**Caffè Milano** è un brand italiano di caffè specialty con sede a Milano. Specializzati in torrefazione artigianale di chicchi arabica. Comparabile a Lavazza per copertura ma più premium nel posizionamento. Disponibili via caffemilano.it e in boutique selezionate.`

const RESPONSE_CLAUDE = `Caffè Milano rappresenta un'interessante proposta nel mercato italiano del caffè specialty. Il loro approccio single-origin li distingue da player mainstream come Lavazza, Illy e Kimbo. La qualità percepita è elevata, con feedback positivi su sostenibilità e trasparenza sulla filiera.`

const MONITORING_RESULTS = [
  {
    engine: 'chatgpt',
    response_text: RESPONSE_CHATGPT,
    brand_mentioned: true,
    mention_position: 1,
    mention_count: 2,
    mention_type: 'direct',
    visibility_score: 82,
    sentiment: 'positive',
    sentiment_score: 0.65,
    cited_urls: ['https://caffemilano.it'],
    competitor_mentions: [
      { name: 'Lavazza', position: 2, count: 1 },
      { name: 'Illy', position: 3, count: 1 },
    ],
    has_hallucination: false,
    hallucination_flags: [],
    primary_provider: 'openai:gpt-4o-mini',
    cost_credits: 0.8,
    execution_time_ms: 3200,
  },
  {
    engine: 'gemini',
    response_text: RESPONSE_GEMINI,
    brand_mentioned: true,
    mention_position: 1,
    mention_count: 1,
    mention_type: 'direct',
    visibility_score: 75,
    sentiment: 'positive',
    sentiment_score: 0.55,
    cited_urls: ['https://caffemilano.it'],
    competitor_mentions: [{ name: 'Lavazza', position: 2, count: 1 }],
    has_hallucination: false,
    hallucination_flags: [],
    primary_provider: 'gemini:flash-2.0',
    cost_credits: 0.3,
    execution_time_ms: 2100,
  },
  {
    engine: 'claude',
    response_text: RESPONSE_CLAUDE,
    brand_mentioned: true,
    mention_position: 1,
    mention_count: 1,
    mention_type: 'direct',
    visibility_score: 70,
    sentiment: 'positive',
    sentiment_score: 0.5,
    cited_urls: [],
    competitor_mentions: [
      { name: 'Lavazza', position: 2, count: 1 },
      { name: 'Illy', position: 3, count: 1 },
      { name: 'Kimbo', position: 4, count: 1 },
    ],
    has_hallucination: false,
    hallucination_flags: [],
    primary_provider: 'anthropic:claude-sonnet',
    cost_credits: 1.2,
    execution_time_ms: 4500,
  },
]

console.log('3. Inserting 3 monitoring_result fixtures...')
const firstPrompt = allPrompts?.[0]
if (!firstPrompt) {
  console.error('   ❌ No prompt to attach results to')
  process.exit(1)
}

// Check if fixtures already exist for this prompt
const { count: existingCount } = await supabase
  .from('monitoring_results')
  .select('*', { count: 'exact', head: true })
  .eq('prompt_id', firstPrompt.id)

if ((existingCount ?? 0) >= 3) {
  console.log(`   ℹ️  ${existingCount} monitoring results already exist for first prompt`)
} else {
  const rows = MONITORING_RESULTS.map((r) => ({
    prompt_id: firstPrompt.id,
    brand_id: brandId,
    user_id: USER_ID,
    prompt_text: firstPrompt.text,
    ...r,
  }))
  const { error } = await supabase.from('monitoring_results').insert(rows)
  if (error) {
    console.error('   ❌ Monitoring results insert failed:', error.message)
    process.exit(1)
  }
  console.log('   ✅ Inserted 3 monitoring results (ChatGPT, Gemini, Claude)')
}

// ─── 4. Brand health score with AVI ──────────────────────────────────────────
console.log('4. Computing AVI and inserting brand_health_score...')
const today = new Date().toISOString().split('T')[0]

// Compute AVI from fixtures (mirror the formula in src/lib/services/monitoring.ts)
const total = MONITORING_RESULTS.length
const mentioned = MONITORING_RESULTS.filter((r) => r.brand_mentioned).length
const cited = MONITORING_RESULTS.filter((r) => r.cited_urls.length > 0).length
const hallucinated = MONITORING_RESULTS.filter((r) => r.has_hallucination).length
const avgSentiment = MONITORING_RESULTS.reduce((a, r) => a + r.sentiment_score, 0) / total
const avgPosition = MONITORING_RESULTS.reduce((a, r) => a + r.mention_position, 0) / total

const citationRate = (cited / total) * 100
const mentionFrequency = (mentioned / total) * 100
const recommendationRate = (mentioned / total) * 100
const hallucinationIndex = (hallucinated / total) * 100
const sentimentNorm = ((avgSentiment + 1) / 2) * 100
const positionNorm = Math.max(0, Math.min(100, ((5 - avgPosition) / 4) * 100))
const antiHal = Math.max(0, 100 - hallucinationIndex)

const avi =
  citationRate * 0.2 +
  mentionFrequency * 0.2 +
  sentimentNorm * 0.15 +
  recommendationRate * 0.2 +
  positionNorm * 0.15 +
  antiHal * 0.1

const healthRow = {
  brand_id: brandId,
  user_id: USER_ID,
  date: today,
  visibility_score: Math.round(
    MONITORING_RESULTS.reduce((a, r) => a + r.visibility_score, 0) / total,
  ),
  sentiment_score: avgSentiment,
  hallucination_rate: hallucinationIndex / 100,
  mention_count: mentioned,
  citation_count: cited,
  avi_score: Math.round(avi * 10) / 10,
  citation_rate: citationRate,
  mention_rate: mentionFrequency,
  recommendation_rate: recommendationRate,
  position_avg: avgPosition,
  health_score: Math.round(avi * 10) / 10,
  engine_breakdown: {
    chatgpt: { avi: 85, mention_rate: 100 },
    gemini: { avi: 72, mention_rate: 100 },
    claude: { avi: 68, mention_rate: 100 },
  },
}

// Upsert (unique on brand_id + date)
const { error: healthErr } = await supabase
  .from('brand_health_scores')
  .upsert(healthRow, { onConflict: 'brand_id,date' })

if (healthErr) {
  console.error('   ❌ Health score upsert failed:', healthErr.message)
  process.exit(1)
}

console.log(`   ✅ AVI = ${healthRow.avi_score} / 100`)
console.log('')
console.log('━'.repeat(60))
console.log('✨ Demo data ready!')
console.log('━'.repeat(60))
console.log(`Brand:      ${BRAND.name} (language=it)`)
console.log(`Prompts:    ${allPrompts?.length ?? 0}`)
console.log(`Run fake:   3 monitoring_result rows (ChatGPT, Gemini, Claude)`)
console.log(`AVI today:  ${healthRow.avi_score}`)
console.log('')
console.log(`📊 Open: ${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/brands/${brandId}`)
console.log('')
