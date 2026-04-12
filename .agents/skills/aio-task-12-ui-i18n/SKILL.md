# Task 12 — UI Internationalization (EN / IT / SV) with `next-intl`

Translate the entire dashboard UI to Italian and Swedish with a single-click language switch. English is the default fallback. Target markets: **Sweden (sv), Italy (it), English (en fallback)**.

Data i18n (prompts, monitoring responses in brand language) is **already implemented** in Task 11 and operates independently. This task only covers the **UI chrome** — menus, buttons, labels, page titles, form placeholders, toasts, errors, empty states.

## CONTESTO

- Next.js 16 App Router, React 18, TypeScript strict
- Dashboard routes under `src/app/dashboard/**/*.tsx` (~30 pages)
- Auth via Supabase Auth (cookie + bearer). `user.user_metadata` is the canonical place for per-user preferences
- 371 tests passing, `tsc --noEmit` clean — must remain true at the end of this task
- The `<JourneyGuide>` component at `src/components/JourneyGuide.tsx` has long hardcoded IT/EN mix strings — these ARE part of this task

**Out of scope:**
- Prompt library translations (already done in Task 11)
- AI engine response language (follows `brand.language`, already done)
- Backend log messages (English only — telemetry/ops lingua franca)
- Test strings and code comments
- Migration SQL files, skill markdown files

## DECISIONI ARCHITETTURALI (NON negoziabili)

1. **Framework**: `next-intl@3.x` — de facto standard for Next.js App Router, Server Components compatible
2. **URL strategy**: **NO locale prefix** in URLs (no `/en/dashboard`, `/it/dashboard`). Use cookie-based locale. Keeps URLs stable, better SEO on single domain, matches Linear/Notion/Vercel pattern.
3. **Locale source priority**:
   ```
   user_metadata.ui_language  →  NEXT_LOCALE cookie  →  Accept-Language header  →  'en' default
   ```
4. **Message files**: JSON in `src/i18n/messages/{en,it,sv}.json`. Flat namespace-per-page structure: `{ "sidebar": { ... }, "dashboard": { ... }, "brands": { ... } }` — NOT deep nesting.
5. **Translation keys**: semantic English snake_case, e.g. `sidebar.monitor.live_monitoring`, NOT the full English phrase. Makes refactors easier.
6. **Language switcher**: lives in `Sidebar` footer (near Sign Out button). Dropdown with 🇬🇧/🇮🇹/🇸🇪 flags.
7. **Server-side**: use `getTranslations()` from `next-intl/server` in Server Components. Client-side: `useTranslations()` hook.

## COSA FARE

### 1. Install & configure `next-intl`

```bash
npm install next-intl
```

Create `src/i18n/config.ts`:

```typescript
export const locales = ['en', 'it', 'sv'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const localeLabels: Record<Locale, string> = {
  en: '🇬🇧 English',
  it: '🇮🇹 Italiano',
  sv: '🇸🇪 Svenska',
}
```

Create `src/i18n/request.ts` (next-intl convention):

```typescript
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { defaultLocale, locales, type Locale } from './config'

function pickFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale
  const primary = header.split(',')[0]?.split('-')[0]?.trim().toLowerCase()
  return (locales as readonly string[]).includes(primary ?? '')
    ? (primary as Locale)
    : defaultLocale
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // 1. Try authenticated user's preference
  let locale: Locale = defaultLocale
  try {
    const db = createServerClient()
    if (db) {
      const { data: { user } } = await db.auth.getUser()
      const userLocale = user?.user_metadata?.ui_language
      if (userLocale && (locales as readonly string[]).includes(userLocale)) {
        locale = userLocale
      }
    }
  } catch {
    // fall through
  }

  // 2. Fall back to cookie
  if (locale === defaultLocale) {
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
    if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
      locale = cookieLocale as Locale
    }
  }

  // 3. Fall back to browser Accept-Language
  if (locale === defaultLocale) {
    locale = pickFromAcceptLanguage(headerStore.get('accept-language'))
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
```

Update `next.config.ts` (or `.mjs`/`.js`):

```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
  // existing config
}

export default withNextIntl(nextConfig)
```

Wrap the root layout provider in `src/app/layout.tsx`:

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* existing providers */}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

### 2. Create message files

**`src/i18n/messages/en.json`**: master file. Extract every user-visible string from the app into keys. Use semantic namespaces per area:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "saving": "Saving...",
    "back": "Back",
    "continue": "Continue",
    "confirm": "Confirm",
    "yes": "Yes",
    "no": "No",
    "required": "Required"
  },
  "sidebar": {
    "sections": {
      "setup": { "label": "Setup", "description": "Configure what you monitor" },
      "monitor": { "label": "Monitor", "description": "Run AI visibility checks" },
      "insights": { "label": "Insights", "description": "Analyze monitoring results" },
      "optimize": { "label": "Optimize", "description": "Improve content for AI search" },
      "account": { "label": "Account", "description": "" }
    },
    "items": {
      "start_here": "Start Here",
      "brands": "Brands",
      "prompts": "Prompts",
      "live_monitoring": "Live Monitoring",
      "workflows": "Workflows",
      "alerts": "Alerts",
      "dashboard": "Dashboard",
      "analytics": "Analytics",
      "sentiment": "Sentiment",
      "citations": "Citations",
      "keywords": "Keywords",
      "snapshots": "Snapshots",
      "reports": "Reports",
      "competitor": "Competitor",
      "scan_history": "Scan History",
      "content_optimizer": "Content Optimizer",
      "content_audit": "Content Audit",
      "recommendations": "Recommendations",
      "engine_info": "Engine Info",
      "billing": "Billing",
      "credits": "Credits",
      "settings": "Settings",
      "documentation": "Documentation"
    },
    "badges": {
      "begin": "Begin",
      "setup_first": "Setup first",
      "run_first_check": "Run first check",
      "locked_tooltip": "Requires data from an earlier step"
    },
    "language_switcher": {
      "label": "Interface language",
      "applied": "Language updated"
    },
    "sign_out": "Sign Out"
  },
  "journey_guide": {
    "step_prefix": "Step",
    "guide_label": "Guide",
    "what_to_do": "What to do",
    "what_youll_get": "What you'll get"
  },
  "onboarding": { /* all strings from src/app/dashboard/onboarding/page.tsx */ },
  "brands": { /* all strings from src/app/dashboard/brands/**/*.tsx */ },
  "prompts": { /* all strings from src/app/dashboard/prompts/**/*.tsx */ },
  "monitoring": { /* ... */ },
  "alerts": { /* ... */ },
  "settings": { /* ... */ },
  "billing": { /* ... */ },
  "credits": { /* ... */ },
  "analytics": { /* ... */ },
  "sentiment": { /* ... */ },
  "citations": { /* ... */ },
  "keywords": { /* ... */ },
  "snapshots": { /* ... */ },
  "reports": { /* ... */ },
  "competitor": { /* ... */ },
  "history": { /* ... */ },
  "optimizer": { /* ... */ },
  "audit": { /* ... */ },
  "recommendations": { /* ... */ },
  "workflows": { /* ... */ },
  "docs": { /* ... */ },
  "errors": {
    "generic": "Something went wrong",
    "auth_failed": "Authentication failed",
    "not_found": "Not found",
    "validation_failed": "Validation failed",
    "rate_limited": "Too many requests — slow down",
    "insufficient_credits": "Not enough credits — top up in Billing",
    "missing_ai_key": "This AI engine is not configured — add the API key in Settings"
  },
  "empty_states": {
    "no_brands": {
      "title": "No brands yet",
      "description": "Add your first brand to start monitoring AI visibility.",
      "cta": "Add brand"
    },
    "no_prompts": {
      "title": "No prompts configured",
      "description": "Add queries to monitor across AI engines.",
      "cta": "Browse library"
    },
    "no_monitoring_data": {
      "title": "No monitoring data yet",
      "description": "Run your first check from the Prompts page.",
      "cta": "Go to Prompts"
    },
    "no_alerts": {
      "title": "No alerts triggered",
      "description": "Good news — nothing needs your attention right now."
    }
  }
}
```

**Process to extract strings:**

1. Open every `.tsx` file under `src/app/dashboard/` and `src/components/` (excluding tests)
2. Find every hardcoded user-visible string (JSX text, `toast.success/error()`, `placeholder`, `title`, `aria-label`, button text, error messages in UI)
3. Add to `en.json` under the appropriate namespace
4. Replace with `{t('namespace.key')}` — see section 3

Estimate: 800-1200 strings across ~30 page files + ~40 component files.

**`it.json` and `sv.json`:** same structure as `en.json`, translated. Process:

1. After `en.json` is complete, copy to `it.json` and `sv.json`
2. Use Claude/GPT-4 to draft translations preserving JSON structure
3. **Review rules for IT**: natural Italian, avoid English loanwords where clean Italian exists. "Brand" stays (industry term). "Dashboard" stays. "Monitor" → "Monitoraggio". "Insights" → "Analisi".
4. **Review rules for SV**: natural Swedish, Swedish business register. "Monitor" → "Övervakning". "Insights" → "Insikter". "Dashboard" stays.
5. Maintain placeholder format `{variable}` identical across languages.

### 3. Wrap strings with `useTranslations` / `getTranslations`

**Client Component example** (`'use client'` at top):

```tsx
'use client'
import { useTranslations } from 'next-intl'

export default function BrandsPage() {
  const t = useTranslations('brands')
  const tc = useTranslations('common')

  return (
    <div>
      <h1>{t('page_title')}</h1>
      <Button>{tc('save')}</Button>
      <p>{t('subtitle')}</p>
    </div>
  )
}
```

**Server Component example** (no `'use client'`):

```tsx
import { getTranslations } from 'next-intl/server'

export default async function SomeServerPage() {
  const t = await getTranslations('namespace')
  return <h1>{t('title')}</h1>
}
```

**For toast messages** — use the translations inside event handlers:

```tsx
const t = useTranslations('brands')
// ...
toast.success(t('toast.brand_created'))
toast.error(t('toast.save_failed'))
```

**For placeholder / aria-label**:

```tsx
<input
  placeholder={t('form.name_placeholder')}
  aria-label={t('form.name_label')}
/>
```

**For interpolation**:

```json
{ "welcome": "Welcome, {name}!" }
```
```tsx
t('welcome', { name: userName })
```

**For pluralization** (next-intl supports ICU):

```json
{ "brands_count": "{count, plural, =0 {No brands} one {# brand} other {# brands}}" }
```

Apply this systematically to every file. Order of attack:
1. `src/components/layout/Sidebar.tsx` (highest visibility)
2. `src/components/JourneyGuide.tsx`
3. `src/app/dashboard/page.tsx` (main dashboard)
4. `src/app/dashboard/onboarding/page.tsx` (guided setup)
5. `src/app/dashboard/brands/**/*.tsx`
6. `src/app/dashboard/prompts/**/*.tsx`
7. `src/app/dashboard/monitoring/**/*.tsx`
8. `src/app/dashboard/alerts/**/*.tsx`
9. `src/app/dashboard/settings/**/*.tsx`
10. All remaining `src/app/dashboard/**/*.tsx`
11. All `src/components/**/*.tsx` that have user-visible strings

### 4. Language switcher component

Create `src/components/LanguageSwitcher.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Globe } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale
  const router = useRouter()
  const t = useTranslations('sidebar.language_switcher')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const change = async (next: Locale) => {
    if (next === currentLocale) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      // 1. Persist to user profile if authenticated
      const supabase = createSupabaseBrowserClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.auth.updateUser({
            data: { ui_language: next },
          })
        }
      }
      // 2. Set cookie for unauthenticated fallback & immediate effect
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      toast.success(t('applied'))
      // 3. Hard refresh to reload server-side messages
      router.refresh()
    } catch {
      toast.error('Failed to change language')
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{localeLabels[currentLocale]}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border bg-card shadow-lg">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => change(l)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary',
                l === currentLocale && 'bg-secondary font-bold',
              )}
            >
              <span className="flex-1 text-left">{localeLabels[l]}</span>
              {l === currentLocale && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

Insert `<LanguageSwitcher />` in the Sidebar footer, immediately above the Sign Out button, for both desktop and mobile sidebar variants.

### 5. Middleware integration

Update `src/middleware.ts` to ensure the `NEXT_LOCALE` cookie is forwarded to server components. `next-intl` does NOT require middleware when using the non-routing (cookie-only) approach, so no changes needed unless you want to redirect on `Accept-Language`. Keep current auth middleware as-is.

### 6. Backfill: pages that use `toast`, alerts, confirm dialogs

Search all files with `grep -rn "toast\." src/app src/components` and wrap each string. Confirm dialogs (`useConfirmDialog`) also have title/description strings — wrap those.

The `src/components/ui/ConfirmDialog.tsx` generic UI strings ("Confirm", "Cancel") can use `common.confirm` / `common.cancel`.

### 7. API error responses stay in English

API routes return `message: "Validation failed"` etc. in English — these are **developer strings**, not UI strings. Client-side, map known error messages to translated versions in the error toast handler. Example:

```tsx
const MESSAGE_KEY_MAP: Record<string, string> = {
  'Validation failed': 'errors.validation_failed',
  'Rate limit exceeded': 'errors.rate_limited',
  'Not enough credits': 'errors.insufficient_credits',
}

function translateError(message: string, t: (key: string) => string): string {
  const key = MESSAGE_KEY_MAP[message]
  return key ? t(key) : message
}
```

This keeps the API boundary English (standard for B2B SaaS) while the user sees translated messages.

### 8. Tests

Update any test that asserts on hardcoded UI strings to either:
- Import the EN messages JSON and compare against it, OR
- Use `data-testid` attributes for assertions and stop asserting on visible text

Add a new test file `src/lib/__tests__/i18n-messages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import en from '../../i18n/messages/en.json'
import it from '../../i18n/messages/it.json'
import sv from '../../i18n/messages/sv.json'

function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null ? flatten(v, key) : [key]
  })
}

describe('i18n messages', () => {
  it('it.json and sv.json have the same keys as en.json', () => {
    const enKeys = flatten(en).sort()
    const itKeys = flatten(it).sort()
    const svKeys = flatten(sv).sort()
    expect(itKeys).toEqual(enKeys)
    expect(svKeys).toEqual(enKeys)
  })

  it('every locale value is a non-empty string', () => {
    for (const locale of [en, it, sv]) {
      const check = (obj: unknown, path = ''): void => {
        if (typeof obj !== 'object' || obj === null) return
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const p = path ? `${path}.${k}` : k
          if (typeof v === 'object' && v !== null) {
            check(v, p)
          } else {
            expect(v, `Key ${p}`).toBeTypeOf('string')
            expect((v as string).length, `Key ${p}`).toBeGreaterThan(0)
          }
        }
      }
      check(locale)
    }
  })

  it('placeholders like {name} appear identically in all locales', () => {
    const enFlat = flattenWithValue(en)
    const itFlat = flattenWithValue(it)
    const svFlat = flattenWithValue(sv)
    for (const [key, enVal] of Object.entries(enFlat)) {
      const placeholders = (enVal.match(/\{[^}]+\}/g) || []).sort()
      for (const [loc, flat] of [['it', itFlat], ['sv', svFlat]] as const) {
        const ph = ((flat[key] ?? '').match(/\{[^}]+\}/g) || []).sort()
        expect(ph, `Key ${key} in ${loc}`).toEqual(placeholders)
      }
    }
  })
})

function flattenWithValue(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj !== 'object' || obj === null) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) Object.assign(out, flattenWithValue(v, key))
    else if (typeof v === 'string') out[key] = v
  }
  return out
}
```

### 9. Settings page integration

In `src/app/dashboard/settings/page.tsx`, add a new section **"Interface Language"** between Profile and Notifications, showing the same `LanguageSwitcher` inline as an explicit setting. This reinforces the feature beyond the footer pill.

## VERIFICA

1. `npx tsc --noEmit` → EXIT=0, zero errors
2. `npx vitest run` → all tests pass (existing 371 + new i18n tests)
3. Manual smoke test:
   - Load dashboard in EN (default) → all labels English
   - Click language switcher → pick Italiano → page refreshes → all labels Italian
   - Refresh browser → language persists (cookie + user profile)
   - Pick Svenska → same flow, Swedish labels
   - Open a server-rendered page (e.g. dashboard home) → SSR HTML source contains IT/SV strings (not EN)
4. JSON key parity: `it.json` and `sv.json` have **identical key structure** to `en.json` (test enforces this)
5. No hardcoded English strings remain in user-visible JSX — grep `'|"[A-Z][a-zA-Z ]+ [a-zA-Z]+'` across `src/app/dashboard` and `src/components` (excluding test files) should return near-zero user-visible matches
6. Logger messages, API error strings, test strings **may** remain in English — that's expected and correct

## COMMIT MESSAGE

```
feat(i18n-ui): full UI localization EN / IT / SV with one-click switch

Add next-intl with cookie-based locale (no URL prefix) sourced from
user_metadata.ui_language → NEXT_LOCALE cookie → Accept-Language →
default 'en'. Language switcher in sidebar footer and Settings page.

- src/i18n/{config.ts,request.ts,messages/{en,it,sv}.json}
- All ~30 dashboard pages and ~40 components wrapped with
  useTranslations / getTranslations
- Language persists via supabase.auth.updateUser({ data }) plus cookie
- 800+ strings translated across 3 locales with placeholder fidelity
- i18n-messages.test.ts enforces key parity + placeholder preservation

Data i18n (prompts, monitoring responses in brand language) was
delivered in Task 11 and remains independent of this UI layer.
```

## NOTE IMPLEMENTATIVE

- **Don't translate backend strings**. API routes, logger, server errors stay English. Only client-side UI strings.
- **Don't translate URLs, route names, query params**. The cookie-based approach keeps URL structure identical across locales.
- **Don't translate code identifiers**. Variable names, function names, CSS classes stay English.
- **Placeholder discipline**: if `en.json` has `"Welcome, {name}!"`, then `it.json` must have `{name}` somewhere too — test enforces it.
- **Dates & numbers**: next-intl ships formatters. Use `useFormatter()` for dates (`DD/MM/YYYY` in IT vs `YYYY-MM-DD` in SV) when touching date displays. Out of scope for this task unless trivial.
- **Accessibility**: the `<html lang="...">` attribute MUST reflect the active locale — already handled by setting `lang={locale}` in root layout.
- **Token cost**: translating ~1000 strings × 2 locales via Claude ~$5-8 total. Cheap.
- **Review pass**: after AI translation, ONE human review pass per language is recommended for idiomatic quality. Lorenzo can review IT, SV needs a Swedish reviewer or a second AI pass with "be more natural" instruction.
