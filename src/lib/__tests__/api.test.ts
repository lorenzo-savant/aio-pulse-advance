import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Probe once at collection time. When no dev server is listening the suite
// is reported as SKIPPED instead of silently passing without assertions.
const serverUp = await (async (): Promise<boolean> => {
  try {
    const response = await fetch(BASE_URL, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
})()

const describeApi = describe.skipIf(!serverUp)

describeApi('API: Health', () => {
  it('GET /api/health returns healthy status', async () => {
    const response = await fetch(`${BASE_URL}/api/health`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('runtime')
    expect(data).toHaveProperty('services')
  })
})

describeApi('API: Providers', () => {
  it('GET /api/providers returns provider list', async () => {
    const response = await fetch(`${BASE_URL}/api/providers`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.providers)).toBe(true)
  })
})

describeApi('API: v1', () => {
  it('GET /api/v1 returns API info', async () => {
    const response = await fetch(`${BASE_URL}/api/v1`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('version')
  })
})
