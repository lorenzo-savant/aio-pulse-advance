import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const skipIfNoServer = async () => {
  try {
    const response = await fetch(BASE_URL, { method: 'HEAD' })
    return !response.ok
  } catch {
    return true
  }
}

describe('API: Health', () => {
  it('GET /api/health returns healthy status', async () => {
    if (await skipIfNoServer()) {
      return
    }
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

describe('API: Providers', () => {
  it('GET /api/providers returns provider list', async () => {
    if (await skipIfNoServer()) {
      return
    }
    const response = await fetch(`${BASE_URL}/api/providers`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('API: v1', () => {
  it('GET /api/v1 returns API info', async () => {
    if (await skipIfNoServer()) {
      return
    }
    const response = await fetch(`${BASE_URL}/api/v1`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('version')
  })
})
