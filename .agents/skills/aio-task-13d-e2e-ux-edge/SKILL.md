# Task 13d — E2E UX Edge Cases + Cleanup (30 min)

Covers non-happy-path coverage: error toasts, empty states, language switch, brand edit, re-seed flow, and test isolation via afterEach cleanup.

## PREREQUISITO

Tasks 13a, 13b, 13c completed and passing.

## COSA FARE

### 1. Create `e2e/utils/cleanup.ts`

```typescript
import type { APIRequestContext } from '@playwright/test'

/**
 * Delete all brands (and cascade) created by the test user.
 * Called in afterEach to keep the dev DB tidy between runs.
 */
export async function cleanupBrands(request: APIRequestContext, prefix = 'e2e-') {
  try {
    const listRes = await request.get('/api/brands')
    if (!listRes.ok()) return
    const { data } = (await listRes.json()) as { data: Array<{ id: string; name: string }> }
    if (!data) return
    for (const b of data) {
      if (b.name.toLowerCase().includes(prefix.toLowerCase())) {
        await request.delete(`/api/brands/${b.id}`).catch(() => {})
      }
    }
  } catch {
    // silent fail — next run will tolerate leftovers
  }
}
```

### 2. Create `e2e/ux-edge.spec.ts`

```typescript
import { test, expect } from './fixtures'
import { cleanupBrands } from './utils/cleanup'

const uniq = () => `e2e-${Date.now().toString(36)}`

test.afterEach(async ({ request }) => {
  await cleanupBrands(request, 'e2e-')
})

test.describe('Error surfacing — user sees specific messages, not "invalid"', () => {
  test('Brand creation with empty name shows a validation message', async ({ authedPage }) => {
    const res = await authedPage.request.post('/api/brands', {
      data: { name: '', language: 'en' },
    })
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/validation/i)
  })

  test('Monitoring without prompt_id returns a clear error', async ({ authedPage }) => {
    const res = await authedPage.request.post('/api/monitoring', { data: {} })
    expect(res.status()).toBe(422)
  })

  test('Monitoring of non-existent prompt returns 404, not 500', async ({ authedPage }) => {
    const res = await authedPage.request.post('/api/monitoring', {
      data: { prompt_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect([404, 403]).toContain(res.status())
  })
})

test.describe('Empty states render content without crashing', () => {
  test('Brands page with 0 brands shows the journey guide CTA', async ({ authedPage }) => {
    // Ensure zero brands first
    const list = (await (await authedPage.request.get('/api/brands')).json()).data as Array<{ id: string }>
    for (const b of list ?? []) await authedPage.request.delete(`/api/brands/${b.id}`).catch(() => {})

    await authedPage.goto('/dashboard/brands')
    // The JourneyGuide for step 1 should be prominent
    await expect(authedPage.getByText(/step 1/i)).toBeVisible()
    await expect(authedPage.getByRole('link', { name: /go to the guided setup/i })).toBeVisible()
  })

  test('Prompts page with 0 prompts is not broken', async ({ authedPage }) => {
    const pageErrors: string[] = []
    authedPage.on('pageerror', (e) => pageErrors.push(String(e)))
    await authedPage.goto('/dashboard/prompts')
    await authedPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    expect(pageErrors).toEqual([])
  })
})

test.describe('Brand edit — language change offers re-seed', () => {
  test('Changing language on a brand with prompts offers re-seed dialog', async ({ authedPage }) => {
    // Create brand with language=en and seed some prompts
    const brandRes = await authedPage.request.post('/api/brands', {
      data: { name: `Edit ${uniq()}`, language: 'en', industry: 'Consulting' },
    })
    const brand = (await brandRes.json()).data
    await authedPage.request.post('/api/prompts/seed', {
      data: { brandId: brand.id, categories: ['discovery'] },
    })

    // Go to edit page
    await authedPage.goto(`/dashboard/brands/${brand.id}/edit`)
    await expect(authedPage.getByRole('heading', { name: /edit brand/i })).toBeVisible()

    // Change language to IT
    const langSelect = authedPage.locator('select').filter({ hasText: /english|italian|svensk/i })
    await langSelect.selectOption('it')

    // Warning appears
    await expect(authedPage.getByText(/won.t re-translate/i)).toBeVisible()

    // Save
    await authedPage.getByRole('button', { name: /save/i }).click()

    // Re-seed offer appears
    await expect(authedPage.getByText(/re-seed prompts/i)).toBeVisible()
  })
})

test.describe('Sidebar — locked state for Insights without data', () => {
  test('Insights links show reduced opacity when no monitoring data exists', async ({ authedPage }) => {
    // Ensure no brands/data exist
    const list = (await (await authedPage.request.get('/api/brands')).json()).data as Array<{ id: string }>
    for (const b of list ?? []) await authedPage.request.delete(`/api/brands/${b.id}`).catch(() => {})

    await authedPage.goto('/dashboard')
    await authedPage.waitForTimeout(1500) // stats refresh

    const analyticsLink = authedPage.getByRole('link', { name: /^analytics$/i }).first()
    const opacity = await analyticsLink.evaluate((el) => getComputedStyle(el).opacity)
    expect(Number(opacity)).toBeLessThan(1)

    // Tooltip on hover
    const title = await analyticsLink.getAttribute('title')
    expect(title).toMatch(/requires data|earlier step/i)
  })
})

test.describe('Stats overview endpoint', () => {
  test('/api/stats/overview returns all counters', async ({ authedPage }) => {
    const res = await authedPage.request.get('/api/stats/overview')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.stats).toMatchObject({
      brands: expect.any(Number),
      prompts: expect.any(Number),
      monitoringRuns: expect.any(Number),
      unreadAlerts: expect.any(Number),
      hasData: expect.any(Boolean),
    })
  })
})
```

### 3. Update `package.json` scripts

```json
"test:e2e:full": "playwright test",
"test:e2e:critical": "playwright test e2e/auth.spec.ts e2e/smoke.spec.ts e2e/setup-flow.spec.ts e2e/monitoring.spec.ts e2e/ux-edge.spec.ts"
```

### 4. CI integration (optional stretch)

Create `.github/workflows/e2e.yml` (skip if repo has no GitHub Actions):

```yaml
name: E2E
on: [pull_request, push]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e:critical
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
          DEV_USER_ID: test-user-ci
          ENCRYPTION_KEY: ${{ secrets.TEST_ENCRYPTION_KEY }}
          CRON_SECRET_TOKEN: test-cron-secret
          WEBHOOK_SIGNING_SECRET: test-webhook-secret
          NEXT_PUBLIC_APP_URL: http://localhost:3000
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: playwright-report }
```

## VERIFICA

1. `npm run test:e2e -- ux-edge.spec.ts` → all tests green
2. `npm run test:e2e:critical` → **all 5 specs** (auth + smoke + setup-flow + monitoring + ux-edge) pass
3. Total runtime of `test:e2e:critical` < 4 minutes
4. After the run completes, dev Supabase has **zero** `e2e-*` brands left (cleanup works)

## COMMIT

```
test(e2e): edge cases, empty states, cleanup harness + critical suite

- utils/cleanup.ts removes e2e-* brands after each test
- ux-edge.spec.ts: validation error surfaces, empty brand/prompt
  pages don't crash, edit page offers re-seed when language changes,
  sidebar Insights locked opacity when no data, /api/stats/overview
  contract stable
- package.json: test:e2e:critical runs the 5 gating specs
- (optional) GitHub Actions workflow for PR gate

Closes the E2E coverage gap for the happy path + 1 edge case per
critical flow. Integration with CI keeps regressions out.
```
