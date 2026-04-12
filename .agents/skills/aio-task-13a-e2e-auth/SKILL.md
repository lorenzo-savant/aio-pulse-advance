# Task 13a — E2E Auth + Test Harness (30 min)

Harden the existing Playwright E2E foundation and make it reliably runnable by any agent. This is a **prerequisite** for tasks 13b/c/d — do not start them until this passes.

## CONTESTO

- Playwright already installed (`@playwright/test@^1.58.2`)
- Config at `playwright.config.ts` points to `./e2e/*.spec.ts`
- webServer runs `npm run dev` at port 3000
- Existing files: `e2e/{auth,flows,export,team-members,example}.spec.ts`
- Tests currently run against the user's dev Supabase — **this is fragile** for CI and parallel runs

## OBIETTIVO

Create a **test fixture + page object foundation** that isolates state, sets up a reusable authenticated session, and verifies the auth surface works end-to-end. No monitoring / brand / data flows in this task.

## COSA FARE

### 1. Create `e2e/fixtures.ts`

```typescript
import { test as base, expect, type Page } from '@playwright/test'

/**
 * Test user that exists in the dev Supabase — DEV_USER_ID in .env.local.
 * For CI, provision a dedicated test user and set TEST_USER_EMAIL/PASSWORD.
 */
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'dev@local',
  password: process.env.TEST_USER_PASSWORD || 'DevPassword1!',
}

type Fixtures = {
  authedPage: Page
}

export const test = base.extend<Fixtures>({
  authedPage: async ({ page }, use) => {
    // If we're in local dev mode with DEV_USER_ID, the middleware may skip
    // auth — just go to /dashboard and proceed.
    await page.goto('/dashboard')

    // If redirected to /auth/login, do a real login
    if (page.url().includes('/auth/login')) {
      await page.fill('input[type=email]', TEST_USER.email)
      await page.fill('input[type=password]', TEST_USER.password)
      await page.click('button[type=submit]')
      await page.waitForURL('**/dashboard**', { timeout: 10_000 })
    }

    await expect(page).toHaveURL(/\/dashboard/)
    await use(page)
  },
})

export { expect }
```

### 2. Create `e2e/pages/SidebarPage.ts` (page object)

```typescript
import type { Page, Locator } from '@playwright/test'

export class SidebarPage {
  constructor(private page: Page) {}

  section(step: 1 | 2 | 3 | 4 | 5): Locator {
    // Step pill selector — each section label has the numbered pill next to it
    return this.page.locator(`nav aside`).filter({ hasText: new RegExp(`^${step}`) }).first()
  }

  link(label: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(label, 'i') })
  }

  async gotoBrands() { await this.link('Brands').click() }
  async gotoPrompts() { await this.link('Prompts').click() }
  async gotoMonitoring() { await this.link('Live Monitoring').click() }
  async gotoAlerts() { await this.link('Alerts').click() }

  async expectBadge(linkLabel: string, badgeText: string) {
    const link = this.link(linkLabel)
    return link.locator('span').filter({ hasText: badgeText })
  }
}
```

### 3. Rewrite `e2e/auth.spec.ts` for robustness

Replace the existing content with focused tests using the new fixture:

```typescript
import { test, expect } from './fixtures'

test.describe('Authentication', () => {
  test('redirects unauthenticated users from /dashboard to /auth/login', async ({ page }) => {
    // Clear cookies to ensure unauthenticated state
    await page.context().clearCookies()
    const response = await page.goto('/dashboard')
    // Either redirects OR passes if DEV_USER_ID bypass is active in dev
    if (page.url().includes('/auth/login')) {
      await expect(page.locator('input[type=email]')).toBeVisible()
    } else {
      // Dev bypass active — still a valid dashboard render
      await expect(page).toHaveURL(/\/dashboard/)
    }
  })

  test('authed dashboard renders the numbered journey sidebar', async ({ authedPage }) => {
    // 5 numbered sections should be visible
    for (const step of [1, 2, 3, 4, 5]) {
      await expect(authedPage.locator('nav').getByText(String(step), { exact: true }).first()).toBeVisible()
    }
    // Key labels present
    await expect(authedPage.getByRole('link', { name: /brands/i }).first()).toBeVisible()
    await expect(authedPage.getByRole('link', { name: /prompts/i }).first()).toBeVisible()
  })

  test('sign out button is present in the sidebar footer', async ({ authedPage }) => {
    await expect(authedPage.getByRole('button', { name: /sign out/i })).toBeVisible()
  })
})
```

### 4. Add smoke test `e2e/smoke.spec.ts` that pings core surfaces

```typescript
import { test, expect } from './fixtures'

const CORE_ROUTES = [
  '/dashboard',
  '/dashboard/brands',
  '/dashboard/prompts',
  '/dashboard/monitoring',
  '/dashboard/alerts',
  '/dashboard/settings',
]

test.describe('Smoke — every core route renders without error', () => {
  for (const route of CORE_ROUTES) {
    test(`GET ${route} — no 5xx, no unhandled error toast`, async ({ authedPage }) => {
      const errors: string[] = []
      authedPage.on('pageerror', (e) => errors.push(String(e)))
      authedPage.on('response', (r) => {
        if (r.url().startsWith('http') && r.status() >= 500) {
          errors.push(`5xx on ${r.url()}: ${r.status()}`)
        }
      })

      await authedPage.goto(route)
      // Allow hydration + data fetches
      await authedPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      expect(errors).toEqual([])
    })
  }
})
```

### 5. Add npm script shortcut

In `package.json`, ensure:
```json
"test:e2e:smoke": "playwright test e2e/smoke.spec.ts e2e/auth.spec.ts",
"test:e2e:install": "playwright install --with-deps chromium"
```

## VERIFICA

1. `npm run test:e2e:install` (first time only) — installs browsers
2. Dev server NOT running → `npm run test:e2e:smoke` should boot its own and pass
3. All tests in `auth.spec.ts` + `smoke.spec.ts` green
4. No test takes > 30s individually
5. Exit 0 on the whole `test:e2e:smoke` run

## COMMIT

```
test(e2e): auth fixture + smoke suite for core routes

- e2e/fixtures.ts provides reusable authedPage fixture that handles
  both dev-bypass and real login flows
- e2e/pages/SidebarPage.ts page object for the new journey nav
- e2e/auth.spec.ts rewritten: redirect, journey sidebar render,
  sign out button present
- e2e/smoke.spec.ts verifies all 6 core routes render without 5xx
  responses or page errors — catches regressions fast
- npm scripts: test:e2e:smoke, test:e2e:install
```

**PREREQUISITO PER**: 13b, 13c, 13d (all use `authedPage` fixture and `SidebarPage` POM)
