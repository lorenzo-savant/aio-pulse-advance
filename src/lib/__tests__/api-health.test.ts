import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const skipIfNoServer = async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { method: 'HEAD' })
    return !response.ok
  } catch {
    return true
  }
}

describe('API Health Endpoint', () => {
  it('GET /api/health returns 200 with the correct structure', async () => {
    if (await skipIfNoServer()) {
      return
    }

    const response = await fetch(`${BASE_URL}/api/health`)

    expect(response.status).toBe(200)

    const data = await response.json()

    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('runtime')
    expect(data).toHaveProperty('services')
    expect(data).toHaveProperty('responseTime')
  })

  it('response includes timestamp, version, runtime, and services fields', async () => {
    if (await skipIfNoServer()) {
      return
    }

    const response = await fetch(`${BASE_URL}/api/health`)
    const data = await response.json()

    expect(typeof data.timestamp).toBe('string')
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(typeof data.version).toBe('string')

    expect(data.runtime).toBe('edge')

    expect(typeof data.services).toBe('object')
    expect(data.services).toHaveProperty('database')
    expect(data.services).toHaveProperty('ai_providers')
  })
})
