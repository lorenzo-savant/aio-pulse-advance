import { describe, it, expect } from 'vitest'
import { deriveNoteMetrics } from '../services/obsidian-export'

/**
 * Every exported Obsidian note reported "Mention Rate 100%".
 *
 * The derivation was:
 *   totalPrompts = citation_count + (mention_count - citation_count)
 *   mentionRate  = mention_count / totalPrompts
 *
 * The first line simplifies to `mention_count`, so the second is
 * `mention_count / mention_count` — algebraically pinned at 1. A brand
 * mentioned in 3 answers out of 40 exported as perfectly visible, in the YAML
 * frontmatter and in the client-facing Metrics Overview table, and the same
 * broken expression ran again for the snapshot note.
 *
 * `brand_health_scores` already stores `mention_rate` and `citation_rate`,
 * computed over the real denominator. The fix is to stop recomputing.
 *
 * `citationRate` had its own defect: `citation_count / mention_count` is
 * citations over mentions, not over responses, and can exceed 100%.
 */

describe('obsidian note metrics', () => {
  it('does not report a fixed 100% mention rate', () => {
    // 3 mentions across 40 responses. The old algebra returned 100.
    const m = deriveNoteMetrics({ mention_count: 3, citation_count: 1, mention_rate: 7.5 }, 40)

    expect(m.mentionRate).toBe(7.5)
  })

  it('prefers the stored rates over recomputing from counts', () => {
    const m = deriveNoteMetrics(
      { mention_count: 12, citation_count: 9, mention_rate: 30, citation_rate: 22.5 },
      40,
    )

    expect(m.mentionRate).toBe(30)
    expect(m.citationRate).toBe(22.5)
  })

  it('falls back to the real denominator when a rate was never stored', () => {
    // Older rows predate the stored columns. Recompute over RESPONSES, which is
    // the denominator the rate is defined on — never over mention_count.
    const m = deriveNoteMetrics({ mention_count: 10, citation_count: 5 }, 40)

    expect(m.mentionRate).toBe(25)
    expect(m.citationRate).toBe(12.5)
  })

  it('never reports a citation rate above 100%', () => {
    // citation_count > mention_count is possible: citations are counted over all
    // responses, mentions over a subset. The old ratio went past 100%.
    const m = deriveNoteMetrics({ mention_count: 2, citation_count: 30 }, 40)

    expect(m.citationRate).toBeLessThanOrEqual(100)
  })

  it('reports responses tested, not the mention count', () => {
    const m = deriveNoteMetrics({ mention_count: 3, citation_count: 1 }, 40)

    expect(m.promptsTested).toBe(40)
  })

  it('returns nulls rather than zeros when there is no health row', () => {
    // No data is not a measurement of zero.
    const m = deriveNoteMetrics(null, 40)

    expect(m.mentionRate).toBeNull()
    expect(m.citationRate).toBeNull()
  })
})
