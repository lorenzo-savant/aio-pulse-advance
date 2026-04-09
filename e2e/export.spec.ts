import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Export Feature', () => {
  test('brand detail page shows CSV and PDF export buttons', async ({ page }) => {
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
    await expect(page.locator('button:has-text("CSV")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button:has-text("PDF")')).toBeVisible()
  })
})
