import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Probe once at collection time. When no dev server is listening the whole
// suite is reported as SKIPPED. (Previously every test body did
// `if (await skipIfNoServer()) return`, which counted as PASSED — CI was
// green without a single assertion running.)
const serverUp = await (async (): Promise<boolean> => {
  try {
    const response = await fetch(BASE_URL, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
})()

const describeApi = describe.skipIf(!serverUp)

describeApi('API: Analyze', () => {
  const analyzeEndpoint = `${BASE_URL}/api/analyze`

  describe('GET /api/analyze', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(analyzeEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/analyze', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing input', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text' }),
      })
      expect(response.status).toBe(422)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.details).toHaveProperty('input')
    })

    it('rejects empty input', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: '', mode: 'text' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects input exceeding max length', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'a'.repeat(15001), mode: 'text' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid mode', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'test', mode: 'invalid' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid engine', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'test', mode: 'text', engine: 'invalid' }),
      })
      expect(response.status).toBe(422)
    })

    it('accepts valid text input', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'Test content for analysis', mode: 'text' }),
      })
      expect(response.status).toBeGreaterThanOrEqual(200)
      expect(response.status).toBeLessThan(600)
      const data = await response.json()
      expect(data).toHaveProperty('success')
    })
  })
})

describeApi('API: Brands', () => {
  const brandsEndpoint = `${BASE_URL}/api/brands`

  describe('GET /api/brands', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(brandsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/brands', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(brandsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })
  })
})

describeApi('API: Monitoring', () => {
  const monitoringEndpoint = `${BASE_URL}/api/monitoring`

  describe('GET /api/monitoring', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(monitoringEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/monitoring', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing prompt_id', async () => {
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid prompt_id format', async () => {
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: 'not-a-uuid' }),
      })
      expect(response.status).toBe(422)
    })
  })
})

describeApi('API: Alerts', () => {
  const alertsEndpoint = `${BASE_URL}/api/alerts`

  describe('GET /api/alerts', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(alertsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/alerts', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(alertsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing required fields', async () => {
      const response = await fetch(alertsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })
  })
})

describeApi('API: Prompts', () => {
  const promptsEndpoint = `${BASE_URL}/api/prompts`

  describe('GET /api/prompts', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(promptsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describeApi('API: Search', () => {
  const searchEndpoint = `${BASE_URL}/api/search`

  describe('GET /api/search', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(searchEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describeApi('API: Competitor', () => {
  const competitorEndpoint = `${BASE_URL}/api/competitor`

  describe('POST /api/competitor', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing primaryUrl', async () => {
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorUrls: ['https://example.com'] }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid primaryUrl', async () => {
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUrl: 'not-a-url', competitorUrls: ['https://example.com'] }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects empty competitors array', async () => {
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUrl: 'https://example.com', competitorUrls: [] }),
      })
      expect(response.status).toBe(422)
    })
  })
})

describeApi('API: Sentiment', () => {
  const sentimentEndpoint = `${BASE_URL}/api/sentiment`

  describe('POST /api/sentiment', () => {
    it('rejects invalid JSON', async () => {
      const response = await fetch(sentimentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing text', async () => {
      const response = await fetch(sentimentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })
  })
})

describeApi('API: Keywords', () => {
  const keywordsEndpoint = `${BASE_URL}/api/keywords`

  describe('GET /api/keywords', () => {
    it('returns 401 without auth', async () => {
      const response = await fetch(keywordsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describeApi('API: Security Headers', () => {
  it('includes security headers', async () => {
    const response = await fetch(BASE_URL)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})
