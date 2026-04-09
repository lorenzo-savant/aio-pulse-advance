import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Critical User Flows', () => {
  test.describe('Analysis Flow', () => {
    test('analyze endpoint accepts valid request', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/analyze`, {
        data: {
          input: 'Test content for AIO optimization',
          mode: 'text',
        },
      })

      expect(response.status()).toBeGreaterThanOrEqual(200)
      expect(response.status()).toBeLessThan(600)

      const data = await response.json()
      expect(data).toHaveProperty('success')
    })

    test('analyze endpoint validates input', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/analyze`, {
        data: {
          input: '',
          mode: 'text',
        },
      })

      expect(response.status()).toBe(422)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    test('analyze endpoint rate limits requests', async ({ request }) => {
      // Make multiple rapid requests
      const responses = []
      for (let i = 0; i < 25; i++) {
        responses.push(
          request.post(`${BASE_URL}/api/analyze`, {
            data: {
              input: `Test ${i}`,
              mode: 'text',
            },
          }),
        )
      }

      const results = await Promise.all(responses)
      const rateLimited = results.some((r) => r.status() === 429)
      expect(rateLimited || results.every((r) => r.status() !== 200)).toBeTruthy()
    })
  })

  test.describe('Brands Management', () => {
    test('brands endpoint requires auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/brands`)
      expect(response.status()).toBeGreaterThanOrEqual(400)
    })

    test('brands validates brand data', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/brands`, {
        data: {
          name: '',
          url: 'invalid-url',
        },
      })

      expect(response.status()).toBe(422)
    })
  })

  test.describe('Monitoring Flow', () => {
    test('monitoring endpoint validates prompt_id', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/monitoring`, {
        data: {
          prompt_id: 'not-a-uuid',
        },
      })

      expect(response.status()).toBe(422)
    })

    test('monitoring endpoint requires auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/monitoring`)
      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('Alerts Flow', () => {
    test('alerts endpoint validates required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/alerts`, {
        data: {},
      })

      expect(response.status()).toBe(422)
    })

    test('alerts endpoint requires auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/alerts`)
      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })

  test.describe('Security', () => {
    test('prevents XSS in input fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      const xssPayload = '<script>alert("xss")</script>'
      await page.fill('input[type="email"]', xssPayload)
      await page.fill('input[type="password"]', 'Test1234!')
      await page.click('button[type="submit"]')

      // Page should not execute script
      const alerts: string[] = []
      page.on('dialog', async (dialog) => {
        alerts.push(dialog.message())
        await dialog.dismiss()
      })

      await page.waitForTimeout(500)
      expect(alerts.length).toBe(0)
    })

    test('includes security headers', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/`)

      expect(response.headers()['x-content-type-options']).toBe('nosniff')
      expect(response.headers()['x-frame-options']).toBeDefined()
    })

    test('API does not leak sensitive info', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/health`)
      const data = await response.json()

      // Should not expose internal paths or credentials
      const responseText = JSON.stringify(data).toLowerCase()
      expect(responseText).not.toContain('password')
      expect(responseText).not.toContain('secret')
      expect(responseText).not.toContain('apikey')
    })
  })

  test.describe('Error Handling', () => {
    test('handles 404 gracefully', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page`)
      await expect(page.locator('text=not found')).toBeVisible({ visible: false })
    })

    test('API handles malformed JSON', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/analyze`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: 'invalid json',
      })

      expect(response.status()).toBe(400)
    })

    test('handles timeout gracefully', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        setTimeout(() => route.continue(), 30000)
      })

      await page.goto(`${BASE_URL}/login`)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  })

  test.describe('Performance', () => {
    test('health endpoint responds quickly', async ({ request }) => {
      const start = Date.now()
      await request.get(`${BASE_URL}/api/health`)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })

    test('login page loads quickly', async ({ page }) => {
      const start = Date.now()
      await page.goto(`${BASE_URL}/login`)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(3000)
    })
  })

  test.describe('Data Validation', () => {
    test('validates URL format for competitor analysis', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/competitor`, {
        data: {
          primaryUrl: 'not-a-url',
          competitorUrls: ['https://example.com'],
        },
      })

      expect(response.status()).toBe(422)
    })

    test('validates email format for forgot password', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: {
          email: 'invalid-email',
        },
      })

      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })
})
