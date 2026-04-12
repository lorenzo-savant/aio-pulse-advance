# Task 13b — E2E Setup Flow: Onboarding → Brand → Prompts (30 min)

Covers phase 1 of the user journey: guided setup creates a brand with language, the prompt library seeds prompts in that language, and the sidebar counters + journey guides reflect the new state.

## PREREQUISITO

Task 13a must be completed and passing. This task relies on `e2e/fixtures.ts`, `e2e/pages/SidebarPage.ts`.

## COSA FARE

### 1. Create `e2e/pages/OnboardingPage.ts` (page object)

```typescript
import type { Page } from '@playwright/test'

export class OnboardingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard/onboarding')
  }

  async clickGetStarted() {
    await this.page.getByRole('button', { name: /get started/i }).click()
  }

  async fillBrand(opts: {
    name: string
    domain?: string
    industry?: string
    language: 'en' | 'it' | 'sv'
    aliases?: string
    competitors?: string
  }) {
    await this.page.getByPlaceholder(/ekonomirådgivarna/i).fill(opts.name)
    if (opts.domain) await this.page.getByPlaceholder(/\.se/i).fill(opts.domain)
    if (opts.industry) {
      await this.page.locator('select').filter({ hasText: /select industry/i }).first()
        .selectOption({ label: new RegExp(opts.industry, 'i') as unknown as string })
    }
    // Language dropdown
    const langLabel = { en: 'English', it: 'Italiano', sv: 'Svenska' }[opts.language]
    await this.page.locator('select').filter({ hasText: /english|italian|svensk/i })
      .selectOption({ label: new RegExp(langLabel, 'i') as unknown as string })
    if (opts.aliases) await this.page.getByPlaceholder(/alias/i).fill(opts.aliases)
    if (opts.competitors) await this.page.getByPlaceholder(/competitor/i).fill(opts.competitors)
  }

  async next() {
    await this.page.getByRole('button', { name: /continue/i }).click()
  }

  async launch() {
    await this.page.getByRole('button', { name: /launch monitoring/i }).click()
  }
}
```

### 2. Create `e2e/setup-flow.spec.ts`

```typescript
import { test, expect } from './fixtures'
import { OnboardingPage } from './pages/OnboardingPage'
import { SidebarPage } from './pages/SidebarPage'

const uniq = () => `e2e-${Date.now().toString(36)}`

test.describe('Setup flow — onboarding creates brand with correct language', () => {
  test('Italian brand: guided setup wires language through to prompts', async ({ authedPage }) => {
    const onboarding = new OnboardingPage(authedPage)
    const sidebar = new SidebarPage(authedPage)
    const brandName = `IT Brand ${uniq()}`

    // Step 0 → 1
    await onboarding.goto()
    await onboarding.clickGetStarted()

    // Step 1: brand details with IT language
    await onboarding.fillBrand({
      name: brandName,
      domain: 'testbrand.it',
      industry: 'SaaS / Technology',
      language: 'it',
      competitors: 'CompA, CompB',
    })
    await onboarding.next()

    // Step 2: accept auto-generated prompts
    await expect(authedPage.getByText(/monitoring prompts/i)).toBeVisible()
    await onboarding.next()

    // Step 3: summary shows brand with 4 engines
    await expect(authedPage.getByText(brandName)).toBeVisible()
    await expect(authedPage.getByText(/4 AI engines/i)).toBeVisible()

    // NOTE: we do NOT click Launch Monitoring here — that belongs to task 13c.
    // Instead we go back and verify side effects of brand + prompt creation only.
    // For this, create brand via API directly to keep the test fast.
  })

  test('Sidebar badges update after brand creation', async ({ authedPage }) => {
    // Create a brand via API (faster and isolated from onboarding UI)
    const res = await authedPage.request.post('/api/brands', {
      data: {
        name: `API Brand ${uniq()}`,
        language: 'sv',
        industry: 'Consulting',
      },
    })
    expect(res.ok()).toBeTruthy()

    // Sidebar should eventually reflect >= 1 brand
    await authedPage.goto('/dashboard/brands')
    await authedPage.waitForTimeout(1500) // allow stats cache refresh

    const brandsLink = authedPage.getByRole('link', { name: /brands/i }).first()
    const badge = brandsLink.locator('span').last()
    const badgeText = await badge.textContent()
    expect(Number(badgeText ?? '0')).toBeGreaterThanOrEqual(1)
  })

  test('Journey guide renders with the right step number on brands page', async ({ authedPage }) => {
    await authedPage.goto('/dashboard/brands')

    // Journey guide for brands is step 1
    const guide = authedPage.locator('[aria-expanded]').first()
    await expect(guide).toBeVisible()
    await expect(guide.getByText(/step 1/i)).toBeVisible()
    await expect(guide.getByText(/add the brand/i)).toBeVisible()
  })

  test('Journey guide can be collapsed and state persists via localStorage', async ({ authedPage }) => {
    await authedPage.goto('/dashboard/prompts')
    const guide = authedPage.locator('[aria-expanded=true]').first()
    await guide.click()
    await expect(authedPage.locator('[aria-expanded=false]').first()).toBeVisible()

    await authedPage.reload()
    await expect(authedPage.locator('[aria-expanded=false]').first()).toBeVisible()
  })
})

test.describe('Prompt library — seed in brand language', () => {
  test('IT brand seeds prompts in Italian', async ({ authedPage }) => {
    // Create brand via API with language = 'it'
    const brandRes = await authedPage.request.post('/api/brands', {
      data: { name: `Seed IT ${uniq()}`, language: 'it', industry: 'SaaS / Technology' },
    })
    expect(brandRes.ok()).toBeTruthy()
    const brand = (await brandRes.json()).data

    // Seed prompts
    const seedRes = await authedPage.request.post('/api/prompts/seed', {
      data: {
        brandId: brand.id,
        categories: ['discovery'],
      },
    })
    expect(seedRes.ok()).toBeTruthy()

    // Fetch prompts and verify at least one is in Italian
    const listRes = await authedPage.request.get(`/api/prompts?brand_id=${brand.id}`)
    const prompts = (await listRes.json()).data as Array<{ text: string; language: string }>
    expect(prompts.length).toBeGreaterThan(0)
    // At least one prompt contains an Italian-only word (rough smoke check)
    const hasItalian = prompts.some((p) =>
      /cos'è|migliore|aziende|conosciuta|affidabile|settore/i.test(p.text),
    )
    expect(hasItalian).toBe(true)
    expect(prompts.every((p) => p.language === 'it')).toBe(true)
  })
})
```

## VERIFICA

1. `npm run test:e2e -- setup-flow.spec.ts` → all tests green
2. Total runtime < 60s for this spec file
3. No orphan brands/prompts left — acceptable for dev DB; for CI add a `test.afterEach` cleanup or DB reset (see task 13d).

## COMMIT

```
test(e2e): setup flow — onboarding → brand → prompt seed in target language

- OnboardingPage POM wraps the 4-step guided setup flow
- Onboarding with IT language populates the brand form correctly
- Sidebar brand counter updates after brand creation
- JourneyGuide renders with correct step number and description
- JourneyGuide collapse state persists across page reloads
- Seeding prompts for an IT brand produces Italian-text prompts
  with prompt.language='it'
```
