# Fase 3 — Seat billing + Onboarding + API docs (T15-T18)

> 2-3 settimane, 10-15k EUR. **Polish commerciale.** Parallelizable con Fase 2 dopo Fase 1.

---

## 🎯 Goal della fase

Trasformare AIO Pulse da "tool tecnico" a **prodotto vendibile self-serve**: pricing chiaro, onboarding 10-minute, docs API che un dev capisce subito. + flessibilità billing per il founder-led sales custom mid-market.

## ⚠️ Prerequisito

[Fase 1](02-fase-1-workspace-audit.md) completata: seat billing richiede Organization tier, onboarding wizard guida nuovo user attraverso Org/Workspace creation.

## 📋 Task overview

| Task | Titolo | Effort | Deps |
|---|---|---|---|
| T15 | Seat-based billing via Stripe | 4-5 giorni | T07 |
| T16 | Manual invoicing per custom plan | 2-3 giorni | T15 |
| T17 | Onboarding wizard self-serve | 4-5 giorni | T07 |
| T18 | API docs complete + SDK starter | 3-4 giorni | T09 |

**Totale**: ~2-3 settimane con 1 dev fulltime.

---

## T15 — Seat-based billing via Stripe

**Effort**: 4-5 giorni
**Dependencies**: T07 (Organization tier)
**Owner**: TBD

### Cambio paradigma

**Attualmente**: 1 user → 1 subscription. Credit-based + monthly plan.

**Target**: 1 organization → 1 subscription con **N seat** (= N workspace member attivi). Stripe gestisce seat count dinamicamente.

### Pricing model proposto (da validare con founder)

| Plan | Seat included | Extra seat | Crediti incluso /mese | Features |
|---|---|---|---|---|
| **Free** | 1 | n/a | 500 (50 query) | 1 workspace, 1 brand |
| **Starter** | 1 | €15/seat | 5.000 (500 query) | 3 workspace, 5 brand/workspace, basic alerts |
| **Pro** | 3 | €25/seat | 25.000 (2.500 query) | 10 workspace, unlimited brand, advanced alerts, API |
| **Agency** | 10 | €35/seat | 100.000 (10k query) | Unlimited workspace, white-label, priority support |
| **Custom** | Negotiated | Negotiated | Custom | Custom SLA, dedicated CSM, custom integrations |

→ **Da validare con founder**. Pricing è strategic decision, non dev decision.

### Stripe configuration

In Stripe dashboard:
- Crea 4 Products: Starter / Pro / Agency / Custom (Custom = no price, hidden)
- Per ogni product: 2 Prices (monthly + annual con sconto 17% = 2 mesi gratis)
- Seat tier: Stripe "graduated pricing" per extra seat oltre included
- Metered usage: NO (crediti gestiti app-side, non Stripe metered — più flessibile)

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

- [ ] Org admin può upgrade plan via Stripe Checkout
- [ ] Quando member viene aggiunto al workspace e supera `seatLimit + extraSeats` → prompt "Add seat €15/mese" + Stripe checkout
- [ ] Stripe webhook gestisce: subscription created/updated/deleted, payment succeeded/failed
- [ ] Org admin vede billing history (invoices) e può scaricare PDF
- [ ] Org admin può modificare payment method via Stripe Customer Portal
- [ ] Annual billing offerto con sconto (17% = 2 mesi)
- [ ] Past-due state: warning banner in dashboard, no nuova feature gate ma read-only se >30 day past-due
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

### Migrazione billing esistenti

Se esistono già user con `subscriptions` (legacy schema per-user):
1. Per ogni `subscription.userId` → trovare la corrispondente `organization` (creata in T07)
2. Migrare i campi a `organization.stripeCustomerId`, `organization.stripeSubId`, etc.
3. Stripe API: aggiornare customer metadata per linkare a `organizationId` invece di `userId`
4. Smoke test: invoice viene generata correttamente sul nuovo schema

Script di migration in `prisma/migrations/<timestamp>_seat_based_billing/data.sql` (manualmente curato — NO automation per billing).

---

## T16 — Manual invoicing per custom plan

**Effort**: 2-3 giorni
**Dependencies**: T15
**Owner**: TBD

### Use case

Founder chiude deal mid-market via call → cliente vuole pagare via invoice (NET-30) con custom seat count + custom features.

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
- [ ] Stripe Invoice API integration funzionante
- [ ] Email send confirm con link
- [ ] Invoice paid → org status updated automaticamente
- [ ] Audit log custom invoice flow
- [ ] Documentazione founder-internal: `docs/operations/custom-invoicing-runbook.md`

### Files

- `src/app/dashboard/admin/organizations/[orgId]/page.tsx` (nuovo admin UI)
- `src/app/dashboard/admin/organizations/[orgId]/invoicing/page.tsx`
- `src/app/api/v1/admin/invoicing/route.ts`
- `src/lib/services/custom-invoicing.ts`
- `docs/operations/custom-invoicing-runbook.md`

### Superadmin flag

Per ora: env-based `SUPERADMIN_EMAILS=email1,email2`. Future: db-based.

---

## T17 — Onboarding wizard self-serve

**Effort**: 4-5 giorni
**Dependencies**: T07
**Owner**: TBD

### Goal

Nuovo user (signup) → first analysis completata in **<10 minuti** senza ricerca docs / handholding.

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

- Empty state per ogni dashboard panel: "No alerts yet. [Set up your first alert →]"
- Tooltips strategici (3-5 max — no overlay invasivo)
- "What's next?" widget in dashboard sidebar: 5 azioni progressive (set up alert, invite team, integrate webhook, upgrade plan, etc.)

### Acceptance criteria

- [ ] Signup → automaticamente entra in onboarding (no skip-to-dashboard)
- [ ] Step 1 chiede role → personalizza messaging
- [ ] Step 2 setup brand: input validation, autofill industry suggestion
- [ ] Step 3: 10 prompts suggested per industry, importable in 1 click
- [ ] Step 4: scan running (real, non fake) — usa 2 LLM cheap (Gemini Flash + GPT-4o-mini) per onboarding (no waste credits su LLM expensive)
- [ ] Step 5: insight rendered + CTA upgrade
- [ ] Time from signup to step 5: <10 minuti (test cronometrato)
- [ ] Skip option visibile ma non default
- [ ] Email "Welcome to AIO Pulse" send dopo step 5
- [ ] Empty states per dashboard panel principali: brands, prompts, alerts, citations
- [ ] "What's next?" widget in sidebar dashboard
- [ ] Test E2E: full onboarding completo, da signup a primo insight, <10 min
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
- `src/components/dashboard/EmptyState.tsx` (riusabile)

### Suggested prompts per industry (data)

Mantenere file `src/lib/onboarding/suggested-prompts.ts`:

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

→ Per Acasting il bucket è `casting-talent`, le 10 query iniziali derivate da [query-inventory.md](file:///c:/Users/loren/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/06-assets/query-inventory.md).

---

## T18 — API docs complete + SDK starter

**Effort**: 3-4 giorni
**Dependencies**: T09 (scoped API keys)
**Owner**: TBD

### Status attuale

Esiste `src/app/docs/api/page.tsx` ma CODE_REVIEW S4 segnala "Documentation pourrait être plus complète". Per Fase 3, deve diventare production-grade.

### Contenuti target

#### `/docs/api` — Hub

- Overview
- Authentication (Bearer token, scopes)
- Rate limits + headers
- Error format
- Versioning
- Links a ogni endpoint reference

#### `/docs/api/<endpoint>` — Per endpoint

Per ogni endpoint pubblico `/api/v1/*`:
- HTTP method + path
- Auth required (Bearer scope X)
- Request schema (Zod-derived, auto-generated quando possibile)
- Response schema
- Example request (curl, JavaScript fetch, Python requests)
- Example response JSON
- Possible errors
- Rate limit

Strumento opzionale: **Mintlify**, **Redocly**, **Scalar**, o markdown statico in `src/app/docs/api/<endpoint>/page.tsx`.

**Raccomandazione**: markdown statico per ora (no extra tooling), upgrade a Mintlify se volume cresce.

#### SDK starter snippets

In `/docs/api/sdk` o `/docs/quickstart`:

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

**curl** per ogni endpoint:
```bash
curl -X GET 'https://aio-pulse.com/api/v1/brands/<brand_id>/health' \
  -H 'Authorization: Bearer aipulse_<your_key>'
```

#### Use case docs (`/docs/use-cases`)

Documenti come "5 min tutorial":
1. "Setup brand monitoring in 5 minutes" (signup → first scan)
2. "Track competitor citations" (setup competitor → run analysis → review)
3. "Generate llms.txt for your site" (input data → preview → download)
4. "Setup weekly review automation" (configure → review markdown export)
5. "Use Acasting case study" (per industry-specific, reference Acasting → applicare a brand simile)

### Acceptance criteria

- [ ] `/docs/api` hub completo con overview + links
- [ ] Almeno 15 endpoint documentati con full reference
- [ ] Example curl + TS + Python per ogni endpoint principale
- [ ] `/docs/api/authentication` page con scope catalog completo
- [ ] `/docs/api/errors` page con error code reference
- [ ] `/docs/api/rate-limits` page con rate limit headers + tier
- [ ] `/docs/quickstart` page con 5-min tutorial
- [ ] `/docs/use-cases` con 5 use case docs
- [ ] Search bar in docs (Algolia DocSearch free per OSS-style, o custom)
- [ ] Mobile-responsive
- [ ] OG tags + structured data (per AEO bonus)
- [ ] Linked dal dashboard footer + onboarding step 5

### Files

- `src/app/docs/page.tsx` (hub)
- `src/app/docs/api/page.tsx` (refactor existing)
- `src/app/docs/api/authentication/page.tsx`
- `src/app/docs/api/errors/page.tsx`
- `src/app/docs/api/rate-limits/page.tsx`
- `src/app/docs/api/<endpoint>/page.tsx` (15+ nuovi)
- `src/app/docs/quickstart/page.tsx`
- `src/app/docs/use-cases/page.tsx`
- `src/app/docs/use-cases/<slug>/page.tsx` (5 use case)
- `src/components/docs/CodeBlock.tsx` (with copy + language switcher)
- `src/components/docs/ApiEndpointReference.tsx`

### Opzionale (V2)

- TypeScript SDK package pubblicato su npm (`@aio-pulse/sdk`)
- OpenAPI spec auto-generato da Zod schemas + Swagger UI

---

## ✅ Definition of Done Fase 3

- [ ] T15-T18 tutti merged in `main`
- [ ] Seat-based billing funzionante in produzione (incluse migration esistenti)
- [ ] Annual billing offerto con sconto
- [ ] Custom invoicing flow operativo per founder-led sales
- [ ] Onboarding wizard: nuovo user da signup a first analysis <10 min
- [ ] API docs complete con 15+ endpoint reference
- [ ] SDK starter (TS, Python, curl) per ogni endpoint
- [ ] Use case docs 5 tutorial pubblicati
- [ ] Empty states + What's Next widget in dashboard
- [ ] BILLING_SETUP.md major rewrite riflette nuovo schema
- [ ] task-tracker.md aggiornato

---

## 🏁 Definition of Done Roadmap Complete

Vedi [README.md](README.md) sezione "Definition of 'Roadmap Complete'" per i 12 criteri finali.

A questo punto AIO Pulse è **shippable as paying SaaS** per il target SMB/prosumer + enterprise-lite.

Next steps (post-roadmap, opzionale):
- Customer feedback loop iterazioni
- Bug bounty privato (HackerOne private program)
- SOC 2 Type II avvio (se signal mid-market lo richiede)
- International expansion EU regions (NO/DK/FI focus)
- Vertical-specific features (es. casting-specific feature pack ispirato a Acasting use case)

---

**Tornare alla mappa**: [README.md](README.md).
