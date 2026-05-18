# Fas 3 — Seat billing + Onboarding + API docs (T15-T18)

> 2-3 veckor, 10-15k EUR. **Kommersiell polish.** Parallelliserbar med Fas 2 efter Fas 1.

---

## 🎯 Fasens mål

Förvandla AIO Pulse från "tekniskt verktyg" till **säljbar self-serve-produkt**: tydlig pricing, onboarding på 10 minuter, API docs som en dev förstår direkt. + flexibilitet i billing för founder-led sales custom mid-market.

## ⚠️ Förutsättning

[Fas 1](02-fase-1-workspace-audit.md) slutförd: seat billing kräver Organization tier, onboarding-wizarden guidar nya användare genom skapandet av Org/Workspace.

## 📋 Task overview

| Task | Titel | Effort | Deps |
|---|---|---|---|
| T15 | Seat-based billing via Stripe | 4-5 dagar | T07 |
| T16 | Manual invoicing per custom plan | 2-3 dagar | T15 |
| T17 | Onboarding wizard self-serve | 4-5 dagar | T07 |
| T18 | API docs complete + SDK starter | 3-4 dagar | T09 |

**Totalt**: ~2-3 veckor med 1 dev på heltid.

---

## T15 — Seat-based billing via Stripe

**Effort**: 4-5 dagar
**Dependencies**: T07 (Organization tier)
**Owner**: TBD

### Paradigmskifte

**För närvarande**: 1 user → 1 subscription. Credit-based + monthly plan.

**Target**: 1 organization → 1 subscription med **N seat** (= N aktiva workspace member). Stripe hanterar seat count dynamiskt.

### Föreslagen pricing model (att validera med founder)

| Plan | Seat included | Extra seat | Krediter inkluderade /månad | Features |
|---|---|---|---|---|
| **Free** | 1 | n/a | 500 (50 query) | 1 workspace, 1 brand |
| **Starter** | 1 | €15/seat | 5.000 (500 query) | 3 workspace, 5 brand/workspace, basic alerts |
| **Pro** | 3 | €25/seat | 25.000 (2.500 query) | 10 workspace, unlimited brand, advanced alerts, API |
| **Agency** | 10 | €35/seat | 100.000 (10k query) | Unlimited workspace, white-label, priority support |
| **Custom** | Negotiated | Negotiated | Custom | Custom SLA, dedicated CSM, custom integrations |

→ **Att validera med founder**. Pricing är ett strategiskt beslut, inte ett dev-beslut.

### Stripe configuration

I Stripe dashboard:
- Skapa 4 Products: Starter / Pro / Agency / Custom (Custom = no price, hidden)
- För varje product: 2 Prices (monthly + annual med 17% rabatt = 2 månader gratis)
- Seat tier: Stripe "graduated pricing" för extra seat utöver included
- Metered usage: NO (krediter hanteras app-side, inte Stripe metered — mer flexibelt)

### Schema update

```prisma
model Organization {
  // ... existing fields ...
  
  // Billing (already added in T07, espanso qui)
  stripeCustomerId String?  @map("stripe_customer_id")
  stripeSubId      String?  @map("stripe_sub_id")
  plan             String   @default("free")            // free | starter | pro | agency | custom
  billingPeriod    String   @default("monthly") @map("billing_period")  // monthly | annual
  seatLimit        Int      @default(1) @map("seat_limit")               // included seats from plan
  extraSeats       Int      @default(0) @map("extra_seats")              // additional seats purchased
  
  status           String   @default("active")                            // active | trial | past_due | cancelled
  trialEndsAt      DateTime? @map("trial_ends_at")
  currentPeriodEnd DateTime? @map("current_period_end")
  cancelAtPeriodEnd Boolean  @default(false) @map("cancel_at_period_end")
  
  // ... rest ...
}
```

### UI changes

`/dashboard/org/billing`:
- Current plan card (with usage: seats used / seats available, credits used / credits available)
- Upgrade button → Stripe Checkout flow
- "Add seats" button → quick action
- Billing history table (invoices)
- Payment method management (Stripe Customer Portal embedded)
- "Cancel subscription" (with retention prompt)

### Acceptance criteria

- [ ] Org admin kan upgrade plan via Stripe Checkout
- [ ] När en member läggs till i workspace och överskrider `seatLimit + extraSeats` → prompt "Add seat €15/månad" + Stripe checkout
- [ ] Stripe webhook hanterar: subscription created/updated/deleted, payment succeeded/failed
- [ ] Org admin ser billing history (invoices) och kan ladda ner PDF
- [ ] Org admin kan ändra payment method via Stripe Customer Portal
- [ ] Annual billing erbjuds med rabatt (17% = 2 månader)
- [ ] Past-due state: warning banner i dashboard, ingen ny feature gate men read-only om >30 dagar past-due
- [ ] Audit log: `billing.plan.changed`, `billing.payment.succeeded`, `billing.payment.failed`, `billing.subscription.cancelled`
- [ ] Test: upgrade flow Free → Starter → Pro → Agency
- [ ] Test: downgrade flow
- [ ] Test: cancel + reactivate
- [ ] Test: payment fail handling

### Files

- `prisma/schema.prisma` (update Organization)
- `prisma/migrations/<timestamp>_seat_based_billing/`
- `src/app/api/v1/billing/checkout/route.ts` (Stripe Checkout session)
- `src/app/api/v1/billing/portal/route.ts` (Stripe Customer Portal session)
- `src/app/api/v1/billing/webhook/route.ts` (refactor existing webhook)
- `src/app/dashboard/org/billing/page.tsx`
- `src/components/billing/PlanCard.tsx`
- `src/components/billing/SeatLimitBanner.tsx`
- `src/lib/services/billing.ts`
- `BILLING_SETUP.md` (major update)

### Migrering av befintlig billing

Om det redan finns användare med `subscriptions` (legacy schema per-user):
1. För varje `subscription.userId` → hitta motsvarande `organization` (skapad i T07)
2. Migrera fälten till `organization.stripeCustomerId`, `organization.stripeSubId`, etc.
3. Stripe API: uppdatera customer metadata för att länka till `organizationId` istället för `userId`
4. Smoke test: invoice genereras korrekt på det nya schemat

Migrationsskript i `prisma/migrations/<timestamp>_seat_based_billing/data.sql` (manuellt kurerat — NO automation för billing).

---

## T16 — Manual invoicing per custom plan

**Effort**: 2-3 dagar
**Dependencies**: T15
**Owner**: TBD

### Use case

Founder stänger en mid-market-affär via call → kunden vill betala via invoice (NET-30) med custom seat count + custom features.

### Workflow

```
1. Founder in admin UI: /dashboard/admin/organizations/[orgId]/invoicing
2. Crea "Custom invoice":
   - Description: "AIO Pulse Custom — 30 seats + priority support"
   - Amount: €X (annual o quarterly)
   - Due date: +30 days
   - Org assigned
3. Backend:
   a. Stripe Invoicing API: create invoice
   b. Send to customer email
   c. Mark org.plan = 'custom'
   d. logAudit('billing.custom_invoice.created')
4. Customer riceve email Stripe con link payment
5. Customer paga (carta o bonifico)
6. Webhook: invoice.paid → org status updated
7. Founder può activate features extra (e.g. priority support flag) manualmente in admin UI
```

### Acceptance criteria

- [ ] `/dashboard/admin/organizations/[orgId]` admin UI (visible only to user with `isAdmin = true` flag in `OrganizationMember` o env-based superadmin list)
- [ ] Form "Create custom invoice": description, amount, currency, due date, NET term
- [ ] Stripe Invoice API integration fungerande
- [ ] Email send confirm med länk
- [ ] Invoice paid → org status uppdaterad automatiskt
- [ ] Audit log custom invoice flow
- [ ] Founder-intern dokumentation: `docs/operations/custom-invoicing-runbook.md`

### Files

- `src/app/dashboard/admin/organizations/[orgId]/page.tsx` (nytt admin UI)
- `src/app/dashboard/admin/organizations/[orgId]/invoicing/page.tsx`
- `src/app/api/v1/admin/invoicing/route.ts`
- `src/lib/services/custom-invoicing.ts`
- `docs/operations/custom-invoicing-runbook.md`

### Superadmin flag

För närvarande: env-based `SUPERADMIN_EMAILS=email1,email2`. Future: db-based.

---

## T17 — Onboarding wizard self-serve

**Effort**: 4-5 dagar
**Dependencies**: T07
**Owner**: TBD

### Goal

Ny user (signup) → första analysen slutförd på **<10 minuter** utan att leta i docs / handholding.

### Wizard steps

```
Step 0 — Signup (esistente)
   ↓
Step 1 — Welcome + role (Agency / Marketing director / Founder solo)
   ↓ (auto-create Organization + Default Workspace based on role)
Step 2 — First brand setup
   - Brand name + domain
   - Industry (dropdown)
   - 3 competitor URL (autofill da AI suggestion based on industry — nice-to-have)
   ↓
Step 3 — First prompts (10 suggested)
   - Show 10 query suggerite based on industry
   - User può selezionare/editare prima di import
   - 1-click "Import all"
   ↓
Step 4 — First scan
   - "Running your first AVI snapshot..."
   - Show 2-3 LLM running (loading state)
   - Render result quando ready (~30s)
   ↓
Step 5 — First insight + CTA
   - "Your AVI score is X/100"
   - "Top competitor: Y"
   - "Suggested action: upgrade to Pro for daily monitoring"
   - CTA: continue to dashboard
   ↓
Done — Dashboard
```

### In-app guides post-onboarding

- Empty state för varje dashboard panel: "No alerts yet. [Set up your first alert →]"
- Strategiska tooltips (3-5 max — ingen invasiv overlay)
- "What's next?" widget i dashboardens sidebar: 5 progressiva åtgärder (set up alert, invite team, integrate webhook, upgrade plan, etc.)

### Acceptance criteria

- [ ] Signup → går automatiskt in i onboarding (no skip-to-dashboard)
- [ ] Step 1 frågar role → personaliserar messaging
- [ ] Step 2 setup brand: input validation, autofill industry suggestion
- [ ] Step 3: 10 prompts suggested per industry, importable i 1 click
- [ ] Step 4: scan running (real, inte fake) — använder 2 LLM cheap (Gemini Flash + GPT-4o-mini) för onboarding (no waste credits på LLM expensive)
- [ ] Step 5: insight rendered + CTA upgrade
- [ ] Tid från signup till step 5: <10 minuter (tidtaget test)
- [ ] Skip option synlig men inte default
- [ ] Email "Welcome to AIO Pulse" send efter step 5
- [ ] Empty states för dashboardens huvudsakliga paneler: brands, prompts, alerts, citations
- [ ] "What's next?" widget i sidebar dashboard
- [ ] Test E2E: full onboarding komplett, från signup till första insight, <10 min
- [ ] Drop-off tracking: GA4 event per step completed/abandoned

### Files

- `src/app/onboarding/page.tsx` (wizard container)
- `src/app/onboarding/role/page.tsx`
- `src/app/onboarding/brand/page.tsx`
- `src/app/onboarding/prompts/page.tsx`
- `src/app/onboarding/scan/page.tsx`
- `src/app/onboarding/insight/page.tsx`
- `src/lib/onboarding/suggested-prompts.ts` (mapping industry → 10 query)
- `src/components/onboarding/WizardStepper.tsx`
- `src/components/dashboard/WhatsNextWidget.tsx`
- `src/components/dashboard/EmptyState.tsx` (återanvändbar)

### Suggested prompts per industry (data)

Underhåll filen `src/lib/onboarding/suggested-prompts.ts`:

```ts
export const SUGGESTED_PROMPTS: Record<string, string[]> = {
  'casting-talent': [
    'Best AI casting platform for ethical talent licensing',
    'How to license my likeness for AI ads',
    // ... 10 totali
  ],
  'marketing-saas': [
    'Best AI marketing analytics tool',
    'AI visibility tracking software',
    // ...
  ],
  // ... 15-20 industry coverage
}
```

→ För Acasting är bucketen `casting-talent`, de 10 inledande queries härledda från [query-inventory.md](file:///c:/Users/loren/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/06-assets/query-inventory.md).

---

## T18 — API docs complete + SDK starter

**Effort**: 3-4 dagar
**Dependencies**: T09 (scoped API keys)
**Owner**: TBD

### Nuvarande status

`src/app/docs/api/page.tsx` finns men CODE_REVIEW S4 signalerar "Documentation pourrait être plus complète". För Fas 3 måste den bli production-grade.

### Målinnehåll

#### `/docs/api` — Hub

- Overview
- Authentication (Bearer token, scopes)
- Rate limits + headers
- Error format
- Versioning
- Links till varje endpoint reference

#### `/docs/api/<endpoint>` — Per endpoint

För varje publikt endpoint `/api/v1/*`:
- HTTP method + path
- Auth required (Bearer scope X)
- Request schema (Zod-derived, auto-generated när möjligt)
- Response schema
- Example request (curl, JavaScript fetch, Python requests)
- Example response JSON
- Possible errors
- Rate limit

Valfritt verktyg: **Mintlify**, **Redocly**, **Scalar**, eller statisk markdown i `src/app/docs/api/<endpoint>/page.tsx`.

**Rekommendation**: statisk markdown för nu (ingen extra tooling), uppgradera till Mintlify om volymen växer.

#### SDK starter snippets

I `/docs/api/sdk` eller `/docs/quickstart`:

**TypeScript**:
```ts
// Install: npm install @aio-pulse/sdk (nice to have, but optional)
// Or use fetch directly:

const API_KEY = process.env.AIO_PULSE_API_KEY!

async function getBrandHealthScore(brandId: string) {
  const res = await fetch(`https://aio-pulse.com/api/v1/brands/${brandId}/health`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

**Python**:
```python
import os
import requests

API_KEY = os.getenv('AIO_PULSE_API_KEY')

def get_brand_health_score(brand_id):
    res = requests.get(
        f'https://aio-pulse.com/api/v1/brands/{brand_id}/health',
        headers={'Authorization': f'Bearer {API_KEY}'},
    )
    res.raise_for_status()
    return res.json()
```

**curl** för varje endpoint:
```bash
curl -X GET 'https://aio-pulse.com/api/v1/brands/<brand_id>/health' \
  -H 'Authorization: Bearer aipulse_<your_key>'
```

#### Use case docs (`/docs/use-cases`)

Dokument i stil med "5 min tutorial":
1. "Setup brand monitoring in 5 minutes" (signup → first scan)
2. "Track competitor citations" (setup competitor → run analysis → review)
3. "Generate llms.txt for your site" (input data → preview → download)
4. "Setup weekly review automation" (configure → review markdown export)
5. "Use Acasting case study" (för industry-specific, reference Acasting → tillämpa på liknande brand)

### Acceptance criteria

- [ ] `/docs/api` hub komplett med overview + links
- [ ] Minst 15 endpoint dokumenterade med full reference
- [ ] Example curl + TS + Python för varje huvudsaklig endpoint
- [ ] `/docs/api/authentication` page med komplett scope catalog
- [ ] `/docs/api/errors` page med error code reference
- [ ] `/docs/api/rate-limits` page med rate limit headers + tier
- [ ] `/docs/quickstart` page med 5-min tutorial
- [ ] `/docs/use-cases` med 5 use case docs
- [ ] Search bar i docs (Algolia DocSearch free för OSS-style, eller custom)
- [ ] Mobile-responsive
- [ ] OG tags + structured data (för AEO bonus)
- [ ] Länkad från dashboardens footer + onboarding step 5

### Files

- `src/app/docs/page.tsx` (hub)
- `src/app/docs/api/page.tsx` (refactor existing)
- `src/app/docs/api/authentication/page.tsx`
- `src/app/docs/api/errors/page.tsx`
- `src/app/docs/api/rate-limits/page.tsx`
- `src/app/docs/api/<endpoint>/page.tsx` (15+ nya)
- `src/app/docs/quickstart/page.tsx`
- `src/app/docs/use-cases/page.tsx`
- `src/app/docs/use-cases/<slug>/page.tsx` (5 use case)
- `src/components/docs/CodeBlock.tsx` (with copy + language switcher)
- `src/components/docs/ApiEndpointReference.tsx`

### Valfritt (V2)

- TypeScript SDK package publicerat på npm (`@aio-pulse/sdk`)
- OpenAPI spec auto-genererad från Zod schemas + Swagger UI

---

## ✅ Definition of Done Fas 3

- [ ] T15-T18 alla merged i `main`
- [ ] Seat-based billing fungerande i produktion (inklusive migrering av befintliga)
- [ ] Annual billing erbjuds med rabatt
- [ ] Custom invoicing flow operativt för founder-led sales
- [ ] Onboarding wizard: ny user från signup till first analysis <10 min
- [ ] API docs complete med 15+ endpoint reference
- [ ] SDK starter (TS, Python, curl) för varje endpoint
- [ ] Use case docs 5 tutorial publicerade
- [ ] Empty states + What's Next widget i dashboard
- [ ] BILLING_SETUP.md major rewrite återspeglar nytt schema
- [ ] task-tracker.md uppdaterad

---

## 🏁 Definition of Done Roadmap Complete

Se [README.md](README.md) sektionen "Definition of 'Roadmap Complete'" för de 12 slutkriterierna.

Vid denna punkt är AIO Pulse **shippable as paying SaaS** för målgruppen SMB/prosumer + enterprise-lite.

Next steps (post-roadmap, valfritt):
- Customer feedback loop iterationer
- Privat bug bounty (HackerOne private program)
- SOC 2 Type II-uppstart (om mid-market-signalen kräver det)
- International expansion EU regions (NO/DK/FI focus)
- Vertical-specific features (t.ex. casting-specific feature pack inspirerat av Acasting use case)

---

**Tillbaka till kartan**: [README.md](README.md).
