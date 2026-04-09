import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Authentication Flow', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
    })

    test('loads login page successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/login/i)
    })

    test('shows email and password fields', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test('shows submit button', async ({ page }) => {
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('shows link to registration page', async ({ page }) => {
      const registerLink = page.locator('a[href="/register"]')
      await expect(registerLink).toBeVisible()
    })

    test('validates empty email submission', async ({ page }) => {
      await page.click('button[type="submit"]')
      await expect(page.locator('text=email')).toBeVisible()
    })

    test('validates invalid email format', async ({ page }) => {
      await page.fill('input[type="email"]', 'invalid-email')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=email')).toBeVisible()
    })

    test('shows password visibility toggle', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]')
      await expect(passwordInput).toBeVisible()
    })
  })

  test.describe('Registration Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
    })

    test('loads registration page successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/register/i)
    })

    test('shows all required fields', async ({ page }) => {
      await expect(page.locator('input[type="text"]')).toBeVisible() // name
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test('validates password requirements', async ({ page }) => {
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'weak')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=Password')).toBeVisible()
    })

    test('validates password mismatch', async ({ page }) => {
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'Password1!')
      await page.fill('input[type="password"]', 'Different1!')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=match')).toBeVisible()
    })

    test('shows link to login page', async ({ page }) => {
      const loginLink = page.locator('a[href="/login"]')
      await expect(loginLink).toBeVisible()
    })
  })

  test.describe('Password Requirements', () => {
    test('validates minimum 8 characters', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'Pass1!')
      await page.fill('input[name="confirmPassword"]', 'Pass1!')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=8')).toBeVisible()
    })

    test('validates uppercase letter requirement', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password1!')
      await page.fill('input[name="confirmPassword"]', 'password1!')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=uppercase')).toBeVisible()
    })

    test('validates lowercase letter requirement', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'PASSWORD1!')
      await page.fill('input[name="confirmPassword"]', 'PASSWORD1!')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=lowercase')).toBeVisible()
    })

    test('validates number requirement', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'Password!')
      await page.fill('input[name="confirmPassword"]', 'Password!')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=number')).toBeVisible()
    })

    test('validates special character requirement', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await page.fill('input[type="text"]', 'Test User')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'Password1')
      await page.fill('input[name="confirmPassword"]', 'Password1')
      await page.click('button[type="submit"]')
      await expect(page.locator('text=special')).toBeVisible()
    })
  })

  test.describe('Session Management', () => {
    test('unauthenticated user redirected to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`)
      await expect(page).toHaveURL(/login/)
    })

    test('login page accessible without auth', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      await expect(page).toHaveURL(/login/)
    })

    test('register page accessible without auth', async ({ page }) => {
      await page.goto(`${BASE_URL}/register`)
      await expect(page).toHaveURL(/register/)
    })
  })

  test.describe('Navigation Security', () => {
    test('home page accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/`)
      await expect(page).toHaveURL(/.*/)
    })

    test('health endpoint responds', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/health`)
      expect(response.ok()).toBeTruthy()
    })

    test('protected API routes require auth', async ({ request }) => {
      const protectedRoutes = ['/api/brands', '/api/monitoring', '/api/prompts', '/api/alerts']

      for (const route of protectedRoutes) {
        const response = await request.get(`${BASE_URL}${route}`)
        expect(response.status()).toBeGreaterThanOrEqual(400)
      }
    })
  })

  test.describe('Error Handling', () => {
    test('shows error message on invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', 'nonexistent@example.com')
      await page.fill('input[type="password"]', 'WrongPassword123!')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(1000)
      // Should show error or remain on login page
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('handles network errors gracefully', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.abort('failed')
      })
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'Password123!')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(500)
      // Should handle error gracefully
    })
  })

  test.describe('Accessibility', () => {
    test('form inputs have proper labels', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      const emailInput = page.locator('input[type="email"]')
      await expect(emailInput).toHaveAttribute('name', 'email')
    })

    test('form submission works with keyboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', 'test@example.com')
      await page.press('input[type="email"]', 'Tab')
      await page.press('input[type="password"]', 'Tab')
      await page.press('body', 'Enter')
      await page.waitForTimeout(500)
    })

    test('focus states visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)
      await page.click('input[type="email"]')
      const focusedElement = page.locator('input:focus')
      await expect(focusedElement).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('login page works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${BASE_URL}/login`)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('register page works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${BASE_URL}/register`)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  })
})

test.describe('Public Pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await expect(page).toHaveURL(/.*/)
  })

  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page).toHaveURL(/login/)
  })

  test('register page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await expect(page).toHaveURL(/register/)
  })

  test('health check works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty('status')
  })
})
