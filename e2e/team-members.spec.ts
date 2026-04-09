import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Team Members Feature', () => {
  test('brand detail page renders the Team Members section', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/brands`)
    if (page.url().includes('/auth/login')) {
      test.skip()
      return
    }
    const firstBrandLink = page.locator('a[href*="/dashboard/brands/"]').first()
    if ((await firstBrandLink.count()) === 0) {
      test.skip()
      return
    }
    await firstBrandLink.click()
    await expect(page.locator('text=Team Members')).toBeVisible({ timeout: 10000 })
  })

  test('invite form shows email input, role selector, and Invite button', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/brands`)
    if (page.url().includes('/auth/login')) {
      test.skip()
      return
    }
    const firstBrandLink = page.locator('a[href*="/dashboard/brands/"]').first()
    if ((await firstBrandLink.count()) === 0) {
      test.skip()
      return
    }
    await firstBrandLink.click()
    await page.waitForSelector('text=Team Members', { timeout: 10000 })
    await expect(page.locator('input[type="email"][placeholder*="colleague"]')).toBeVisible()
    await expect(page.locator('select')).toBeVisible()
    await expect(page.locator('button:has-text("Invite")')).toBeVisible()
  })

  test('Invite button is disabled when the email field is empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/brands`)
    if (page.url().includes('/auth/login')) {
      test.skip()
      return
    }
    const firstBrandLink = page.locator('a[href*="/dashboard/brands/"]').first()
    if ((await firstBrandLink.count()) === 0) {
      test.skip()
      return
    }
    await firstBrandLink.click()
    await page.waitForSelector('text=Team Members', { timeout: 10000 })
    await expect(page.locator('button:has-text("Invite")')).toBeDisabled()
  })

  test('Invite button becomes enabled when a valid email is entered', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/brands`)
    if (page.url().includes('/auth/login')) {
      test.skip()
      return
    }
    const firstBrandLink = page.locator('a[href*="/dashboard/brands/"]').first()
    if ((await firstBrandLink.count()) === 0) {
      test.skip()
      return
    }
    await firstBrandLink.click()
    await page.waitForSelector('text=Team Members', { timeout: 10000 })
    await page.fill('input[type="email"][placeholder*="colleague"]', 'test@example.com')
    await expect(page.locator('button:has-text("Invite")')).toBeEnabled()
  })
})
