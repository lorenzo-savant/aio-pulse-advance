// Targeted tests for the pure parts of brand-presence: the BrandPresence
// shape now includes UGC platforms (Reddit / YouTube / Quora) and an
// aggregate ugcScore. We can't test the network checks here without
// mocking Brave, but the score-shape is a pure structural concern: ensure
// the exported type matches the documented shape so consumers (Strategy
// Advisor + future UI panel) can rely on it.

import { describe, it, expect } from 'vitest'
import type { BrandPresence, PlatformPresence } from '@/lib/services/brand-presence'

describe('BrandPresence shape (post-UGC extension)', () => {
  it('exposes wikipedia + reddit + youtube + quora platform slots', () => {
    const sample: BrandPresence = {
      wikipedia: { found: true, url: 'https://en.wikipedia.org/wiki/Acme', title: 'Acme' },
      reddit: {
        found: true,
        url: 'https://reddit.com/r/saas/comments/x',
        title: 'Acme review',
        matchCount: 6,
      },
      youtube: {
        found: true,
        url: 'https://youtube.com/watch?v=x',
        title: 'Acme demo',
        matchCount: 3,
      },
      quora: { found: false, url: null, title: null, matchCount: 0 },
      ugcScore: 56,
    }
    expect(sample.wikipedia.found).toBe(true)
    expect(sample.reddit.matchCount).toBe(6)
    expect(sample.youtube.matchCount).toBe(3)
    expect(sample.quora.found).toBe(false)
    expect(sample.ugcScore).toBe(56)
  })

  it('ugcScore is optional (backward compatibility)', () => {
    const sample: BrandPresence = {
      wikipedia: { found: false, url: null, title: null },
      reddit: { found: false, url: null, title: null, matchCount: 0 },
      youtube: { found: false, url: null, title: null, matchCount: 0 },
      quora: { found: false, url: null, title: null, matchCount: 0 },
    }
    expect(sample.ugcScore).toBeUndefined()
  })

  it('PlatformPresence.matchCount is optional (Wikipedia has none)', () => {
    const wikipedia: PlatformPresence = {
      found: true,
      url: 'https://en.wikipedia.org/wiki/Acme',
      title: 'Acme',
    }
    expect(wikipedia.matchCount).toBeUndefined()
  })
})
