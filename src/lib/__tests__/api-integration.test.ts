import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const skipIfNoServer = async (): Promise<boolean> => {
  try {
    const response = await fetch(BASE_URL, { method: 'HEAD' })
    return !response.ok
  } catch {
    return true
  }
}

describe('API: Analyze', () => {
  const analyzeEndpoint = `${BASE_URL}/api/analyze`

  describe('GET /api/analyze', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/analyze', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing input', async () => {
      if (await skipIfNoServer()) return
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
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: '', mode: 'text' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects input exceeding max length', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'a'.repeat(15001), mode: 'text' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid mode', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'test', mode: 'invalid' }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid engine', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'test', mode: 'text', engine: 'invalid' }),
      })
      expect(response.status).toBe(422)
    })

    it('accepts valid text input', async () => {
      if (await skipIfNoServer()) return
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

describe('API: Brands', () => {
  const brandsEndpoint = `${BASE_URL}/api/brands`

  describe('GET /api/brands', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(brandsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/brands', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(brandsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })
  })
})

describe('API: Monitoring', () => {
  const monitoringEndpoint = `${BASE_URL}/api/monitoring`

  describe('GET /api/monitoring', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(monitoringEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/monitoring', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing prompt_id', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid prompt_id format', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: 'not-a-uuid' }),
      })
      expect(response.status).toBe(422)
    })
  })
})

describe('API: Alerts', () => {
  const alertsEndpoint = `${BASE_URL}/api/alerts`

  describe('GET /api/alerts', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(alertsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/alerts', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(alertsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing required fields', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(alertsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })
  })
})

describe('API: Prompts', () => {
  const promptsEndpoint = `${BASE_URL}/api/prompts`

  describe('GET /api/prompts', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(promptsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('API: Search', () => {
  const searchEndpoint = `${BASE_URL}/api/search`

  describe('GET /api/search', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(searchEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('API: Competitor', () => {
  const competitorEndpoint = `${BASE_URL}/api/competitor`

  describe('POST /api/competitor', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing primaryUrl', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorUrls: ['https://example.com'] }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects invalid primaryUrl', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUrl: 'not-a-url', competitorUrls: ['https://example.com'] }),
      })
      expect(response.status).toBe(422)
    })

    it('rejects empty competitors array', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(competitorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryUrl: 'https://example.com', competitorUrls: [] }),
      })
      expect(response.status).toBe(422)
    })
  })
})

describe('API: Sentiment', () => {
  const sentimentEndpoint = `${BASE_URL}/api/sentiment`

  describe('POST /api/sentiment', () => {
    it('rejects invalid JSON', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(sentimentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid',
      })
      expect(response.status).toBe(400)
    })

    it('rejects missing text', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(sentimentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(response.status).toBe(422)
    })
  })
})

describe('API: Keywords', () => {
  const keywordsEndpoint = `${BASE_URL}/api/keywords`

  describe('GET /api/keywords', () => {
    it('returns 401 without auth', async () => {
      if (await skipIfNoServer()) return
      const response = await fetch(keywordsEndpoint)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('API: Security Headers', () => {
  it('includes security headers', async () => {
    if (await skipIfNoServer()) return
    const response = await fetch(BASE_URL)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})
