// PATH: src/lib/services/obsidian-export.ts
import { createServerClient } from '@/lib/supabase'
import type { HallucinationFlag } from '@/types'

export interface ExportedNote {
  filename: string
  path: string
  content: string
}

export interface ObsidianExportRequest {
  brandId: string
  brandName: string
  dateFrom: string
  dateTo: string
  types: Array<'snapshot' | 'hallucination' | 'prompt-test'>
}

interface SnapshotInput {
  brandName: string
  date: string
  healthScore: number
  citationCount: number
  citationRate: number
  mentionCount: number
  mentionRate: number
  sentimentScore: number
  hallucinationRate: number
  visibilityScore: number
  hallucinationCount: number
  shareOfVoice: number
  positionAvg: number | null
  promptsTested: number
  platformsTested: string[]
  engineBreakdown: Record<string, { citations: number; rate: number }>
}

interface HallucinationInput {
  brandName: string
  platform: string
  date: string
  seq: number
  severity: 'low' | 'medium' | 'high'
  category: string
  claimMade: string
  reality: string
  promptUsed: string
  corrected: boolean
}

interface PromptTestInput {
  brandName: string
  date: string
  seq: number
  promptId: string
  promptCategory: string
  promptText: string
  platform: string
  brandMentioned: boolean
  position: number | null
  sentiment: string
  accuracy: number
  sourceCited: boolean
  sourceUrl: string | null
  competitorsMentioned: string[]
  hallucinationDetected: boolean
  hallucinationFlags: HallucinationFlag[]
}

function escapeYaml(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (
    str.includes(':') ||
    str.includes('#') ||
    str.includes('\n') ||
    str.includes('"') ||
    str.includes("'") ||
    str.startsWith(' ') ||
    str.endsWith(' ')
  ) {
    return `"${str.replace(/"/g, '\\"')}"`
  }
  return str
}

export function generateSnapshotNote(input: SnapshotInput): ExportedNote {
  const date = input.date.replace(/-/g, '')
  const filename = `Snapshot-${input.date}.md`
  const path = `01-Clients/${input.brandName}/Snapshots/`

  const tags = [
    'snapshot',
    input.brandName.toLowerCase().replace(/\s+/g, '-'),
    `avi-${Math.round(input.healthScore)}`,
  ]

  const yaml = [
    '---',
    `type: snapshot`,
    `client: ${escapeYaml(input.brandName)}`,
    `status: active`,
    `created: ${input.date}`,
    `updated: ${input.date}`,
    `tags: [${tags.map((t) => escapeYaml(t)).join(', ')}]`,
    `avi_score: ${input.healthScore}`,
    `citation_rate: ${input.citationRate}`,
    `mention_rate: ${input.mentionRate}`,
    `recommendation_rate: ${input.shareOfVoice}`,
    `sentiment_avg: ${input.sentimentScore}`,
    `hallucination_count: ${input.hallucinationCount}`,
    `share_of_voice: ${input.shareOfVoice}`,
    `position_avg: ${input.positionAvg ?? ''}`,
    `prompts_tested: ${input.promptsTested}`,
    `platforms_tested: [${input.platformsTested.map((p) => escapeYaml(p)).join(', ')}]`,
    '---',
  ].join('\n')

  const metricsTable = [
    '## Metrics Overview',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| AVI Score | ${input.healthScore} |`,
    `| Citation Rate | ${input.citationRate}% |`,
    `| Mention Rate | ${input.mentionRate}% |`,
    `| Share of Voice | ${input.shareOfVoice}% |`,
    `| Sentiment Avg | ${input.sentimentScore} |`,
    `| Hallucination Count | ${input.hallucinationCount} |`,
    `| Visibility Score | ${input.visibilityScore} |`,
    `| Avg Position | ${input.positionAvg ?? 'N/A'} |`,
    `| Prompts Tested | ${input.promptsTested} |`,
    '',
  ].join('\n')

  const engineBreakdown = [
    '## Engine Breakdown',
    '',
    '| Engine | Citations | Rate |',
    '|--------|----------|------|',
    ...Object.entries(input.engineBreakdown).map(
      ([engine, data]) => `| ${engine} | ${data.citations} | ${data.rate}% |`,
    ),
    '',
  ].join('\n')

  const content = `${yaml}\n${metricsTable}${engineBreakdown}`
  return { filename, path, content }
}

export function generateHallucinationNote(input: HallucinationInput): ExportedNote {
  const filename = `HAL-${input.date}-${String(input.seq).padStart(3, '0')}.md`
  const path = `01-Clients/${input.brandName}/Hallucinations/`

  const priority = input.severity === 'high' ? 'P1' : input.severity === 'low' ? 'P2' : 'P2'

  const yaml = [
    '---',
    `type: hallucination`,
    `client: ${escapeYaml(input.brandName)}`,
    `platform: ${escapeYaml(input.platform)}`,
    `hal_id: ${filename.replace('.md', '')}`,
    `severity: ${input.severity}`,
    `category: ${escapeYaml(input.category)}`,
    `claim_made: ${escapeYaml(input.claimMade)}`,
    `reality: ${escapeYaml(input.reality)}`,
    `prompt_used: ${escapeYaml(input.promptUsed)}`,
    `corrected: ${input.corrected}`,
    `priority: ${priority}`,
    '---',
  ].join('\n')

  const body = [
    '## Claim',
    input.claimMade,
    '',
    '## Reality',
    input.reality,
    '',
    '## Prompt Used',
    input.promptUsed,
    '',
    '## Correction Plan Checklist',
    `- [ ] Verify claim with primary sources`,
    `- [ ] Update brand knowledge base if needed`,
    `- [ ] Flag similar patterns in future monitoring`,
    `- [ ] Document correction response`,
    '',
    '## Recurrence Log',
    '',
    '| Date | Platform | Severity | Status |',
    '|------|----------|----------|--------|',
    `| ${input.date} | ${input.platform} | ${input.severity} | ${input.corrected ? 'Corrected' : 'Open'} |`,
    '',
  ].join('\n')

  return { filename, path, content: `${yaml}\n${body}` }
}

export function generatePromptTestNote(input: PromptTestInput): ExportedNote {
  const filename = `PT-${input.date}-${String(input.seq).padStart(3, '0')}.md`
  const path = `01-Clients/${input.brandName}/Prompt-Tests/`

  const competitorsStr =
    input.competitorsMentioned.length > 0
      ? `[${input.competitorsMentioned.map((c) => escapeYaml(c)).join(', ')}]`
      : '[]'

  const yaml = [
    '---',
    `type: prompt-test`,
    `client: ${escapeYaml(input.brandName)}`,
    `prompt_id: ${escapeYaml(input.promptId)}`,
    `prompt_category: ${escapeYaml(input.promptCategory)}`,
    `prompt_text: ${escapeYaml(input.promptText)}`,
    `platform: ${escapeYaml(input.platform)}`,
    `brand_mentioned: ${input.brandMentioned}`,
    `position: ${input.position ?? ''}`,
    `sentiment: ${escapeYaml(input.sentiment)}`,
    `accuracy: ${input.accuracy}`,
    `source_cited: ${input.sourceCited}`,
    `source_url: ${escapeYaml(input.sourceUrl ?? '')}`,
    `competitors_mentioned: ${competitorsStr}`,
    `hallucination_detected: ${input.hallucinationDetected}`,
    '---',
  ].join('\n')

  const responseExcerpt =
    input.promptText.length > 200 ? input.promptText.slice(0, 200) + '...' : input.promptText

  const hallucinationSection =
    input.hallucinationDetected && input.hallucinationFlags.length > 0
      ? [
          '',
          '## Hallucination Check',
          '',
          '⚠️ **Hallucinations detected**',
          '',
          ...input.hallucinationFlags.map(
            (flag) => `- **[${flag.severity.toUpperCase()}]** ${flag.text} (${flag.type})`,
          ),
          '',
        ].join('\n')
      : ['', '## Hallucination Check', '', '✅ No hallucinations detected', ''].join('\n')

  const body = [
    '## Prompt',
    `\`\`\`\n${input.promptText}\n\`\`\``,
    '',
    '## Response Excerpt',
    responseExcerpt,
    '',
    '## Analysis',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Platform | ${input.platform} |`,
    `| Brand Mentioned | ${input.brandMentioned ? 'Yes' : 'No'} |`,
    `| Position | ${input.position ?? 'N/A'} |`,
    `| Sentiment | ${input.sentiment} |`,
    `| Source Cited | ${input.sourceCited ? 'Yes' : 'No'} |`,
    ...(input.sourceUrl ? [`| Source URL | ${input.sourceUrl} |`] : []),
    '',
    hallucinationSection,
  ].join('\n')

  return { filename, path, content: `${yaml}\n${body}` }
}

export async function generateObsidianExport(
  userId: string,
  request: ObsidianExportRequest,
): Promise<ExportedNote[]> {
  const db = createServerClient()
  if (!db) return []

  const notes: ExportedNote[] = []
  const { brandId, brandName, dateFrom, dateTo, types } = request

  const fromDateISO = `${dateFrom}T00:00:00.000Z`
  const toDateISO = `${dateTo}T23:59:59.999Z`

  if (types.includes('snapshot')) {
    const { data: healthScores } = await db
      .from('brand_health_scores')
      .select('*')
      .eq('brand_id', brandId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })

    if (healthScores && healthScores.length > 0) {
      const latest = healthScores[0]
      const engineBreakdown: Record<string, { citations: number; rate: number }> = {}
      const breakdown = latest.engine_breakdown as Record<
        string,
        { citations?: number; rate?: number }
      > | null
      if (breakdown) {
        for (const [engine, data] of Object.entries(breakdown)) {
          engineBreakdown[engine] = {
            citations: data.citations ?? 0,
            rate: data.rate ?? 0,
          }
        }
      }

      const totalPrompts = latest.citation_count + (latest.mention_count - latest.citation_count)
      const mentionRate = totalPrompts > 0 ? (latest.mention_count / totalPrompts) * 100 : 0
      const citationRate =
        latest.mention_count > 0 ? (latest.citation_count / latest.mention_count) * 100 : 0

      notes.push(
        generateSnapshotNote({
          brandName,
          date: latest.date,
          healthScore: latest.health_score,
          citationCount: latest.citation_count,
          citationRate: Math.round(citationRate * 100) / 100,
          mentionCount: latest.mention_count,
          mentionRate: Math.round(mentionRate * 100) / 100,
          sentimentScore: latest.sentiment_score,
          hallucinationRate: latest.hallucination_rate,
          visibilityScore: latest.visibility_score,
          hallucinationCount: 0,
          shareOfVoice: citationRate,
          positionAvg: null,
          promptsTested: totalPrompts,
          platformsTested: Object.keys(engineBreakdown),
          engineBreakdown,
        }),
      )
    }
  }

  if (types.includes('hallucination') || types.includes('prompt-test')) {
    const { data: monitoringResults } = await db
      .from('monitoring_results')
      .select('*, prompt:prompts(id, text, category)')
      .eq('brand_id', brandId)
      .gte('created_at', fromDateISO)
      .lte('created_at', toDateISO)
      .order('created_at', { ascending: false })

    if (monitoringResults) {
      let hallucinationSeq = 1
      let promptTestSeq = 1

      for (const result of monitoringResults) {
        const date = new Date(result.created_at).toISOString().split('T')[0] ?? dateTo

        if (types.includes('hallucination') && result.has_hallucination) {
          const flags = (result.hallucination_flags as HallucinationFlag[]) || []
          for (const flag of flags) {
            notes.push(
              generateHallucinationNote({
                brandName,
                platform: result.engine,
                date,
                seq: hallucinationSeq++,
                severity: flag.severity,
                category: flag.type,
                claimMade: flag.text,
                reality: 'Verification needed',
                promptUsed: result.prompt_text || result.query_text || '',
                corrected: false,
              }),
            )
          }
        }

        if (types.includes('prompt-test') && promptTestSeq <= 100) {
          const citedUrls = (result.cited_urls as string[]) || []
          const competitors = result.competitor_mentions as Array<{ name: string }> | null
          const competitorNames = competitors?.map((c) => c.name) || []
          const hallucinationFlags = (result.hallucination_flags as HallucinationFlag[]) || []

          notes.push(
            generatePromptTestNote({
              brandName,
              date,
              seq: promptTestSeq++,
              promptId: result.prompt_id || 'unknown',
              promptCategory: (result.prompt as { category?: string })?.category || 'general',
              promptText: result.prompt_text || '',
              platform: result.engine,
              brandMentioned: result.brand_mentioned ?? false,
              position: result.mention_position,
              sentiment: result.sentiment || 'neutral',
              accuracy: 0,
              sourceCited: citedUrls.length > 0,
              sourceUrl: citedUrls[0] || null,
              competitorsMentioned: competitorNames,
              hallucinationDetected: result.has_hallucination ?? false,
              hallucinationFlags,
            }),
          )
        }
      }
    }
  }

  return notes
}
