import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/aio-pulse/i)
  })

  test('homepage has main content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('register page loads', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})

test.describe('Dashboard', () => {
  test('dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('API Health', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})
