# Fas 2 — SSO + MFA + Trust Center + GDPR + Status Page (T10-T14)

> 2-3 veckor, 15-25k EUR. **Trust signal för mid-market.** Parallelliserbar med Fas 3 efter Fas 1.

---

## 🎯 Fasens mål

Låsa upp mid-market-affärerna (€20-50k ARR) genom att eliminera de 5 vanligaste blockerarna: "Har ni SSO?", "Finns det MFA?", "Nedladdningsbar DPA?", "Status page?", "Kan jag radera mina data?". Utan att vara SOC 2-certifierade (utanför omfattning), men trovärdiga ur ett trust-perspektiv.

## ⚠️ Förutsättning

[Fas 1](02-fase-1-workspace-audit.md) slutförd: SSO går på Organization-nivå, instrumentering av audit log klar, GDPR-export använder workspace-hierarkin.

## 📋 Task overview

| Task | Titel | Effort | Deps |
|---|---|---|---|
| T10 | SSO Google + Microsoft OAuth | 3-4 dagar | T07 |
| T11 | MFA TOTP valfritt + enforceable per workspace admin | 2-3 dagar | T07 |
| T12 | Trust Center page + DPA + sub-processor list | 2-3 dagar | — |
| T13 | Status page basic (Instatus) + monitoring config | 1-2 dagar | — |
| T14 | GDPR essentials: data export + deletion self-serve | 4-5 dagar | T07, T08 |

**Totalt**: ~2-3 veckor med 1 dev på heltid.

---

## T10 — SSO Google + Microsoft OAuth

**Effort**: 3-4 dagar
**Dependencies**: T07 (organization tier per SSO config)
**Owner**: TBD

### Scope

- ✅ Google OAuth (Workspace + personal)
- ✅ Microsoft OAuth (Azure AD personal + work)
- ❌ NO SAML 2.0 (utanför omfattning — se [00-mission-scope-rules.md](00-mission-scope-rules.md))
- ❌ NO OIDC custom IdP (uses SAML usually)

### Approach

Supabase Auth stöder Google + Microsoft nativt via OAuth. Det mesta av arbetet är:
1. Config providers i Supabase dashboard
2. UI signup/login med knappen "Continue with Google" / "Continue with Microsoft"
3. Account linking för befintliga email/password-användare som vill byta till SSO

### Acceptance criteria

- [ ] Google OAuth: konfigurerad i Supabase dashboard (client ID + secret i vault)
- [ ] Microsoft OAuth: konfigurerad i Supabase dashboard
- [ ] UI signup: knappar "Continue with Google" + "Continue with Microsoft" + email/password
- [ ] UI login: samma layout
- [ ] First-time SSO signup → skapar Organization + Default Workspace automatiskt
- [ ] Account linking: email/password-användare kan koppla SSO-provider från settings
- [ ] Användare som registrerar sig via SSO med en e-post som redan finns som password → linking-flow (inget duplicate account)
- [ ] Test E2E: signup via Google → workspace created → logged in
- [ ] Test E2E: existing user logs in via Microsoft per la prima volta → linked correctly
- [ ] Audit log: `auth.login` med `metadata.provider: 'google' | 'microsoft' | 'email'`
- [ ] Dokumentation: `ENVIRONMENTS.md` uppdaterad med OAuth env vars

### Files

- Supabase dashboard config (ingen kod, men dokumentera i `docs/auth/sso-setup.md`)
- `src/app/auth/login/page.tsx` (tillagd knapp)
- `src/app/auth/signup/page.tsx` (tillagd knapp)
- `src/app/auth/callback/route.ts` (callback-hantering med automatisk Org-skapande)
- `src/lib/services/auth.ts` (account linking logic)
- `src/app/dashboard/settings/account/page.tsx` (UI account linking)
- `docs/auth/sso-setup.md` (ny, runbook setup IdP)

### Implementationsnoteringar

- Microsoft OAuth: välj "common" tenant för att acceptera både personal (outlook.com, hotmail) och work (Azure AD). För att begränsa till enbart work, använd "organizations" tenant.
- Google: konfigurera consent screen med privacy policy + ToS URL
- Redirect URLs critical: `https://<your-domain>/auth/callback` + `http://localhost:3000/auth/callback` för dev
- Account linking: om en användare gör signup via Google med e-post X, sedan försöker göra signup med password med e-post X → visa "Existing account, sign in with Google" UI

---

## T11 — MFA TOTP valfritt + enforceable per workspace admin

**Effort**: 2-3 dagar
**Dependencies**: T07
**Owner**: TBD

### Scope

- ✅ TOTP (Google Authenticator, Authy, 1Password, etc.)
- ✅ Opt-in från användarens settings
- ✅ Enforceable på workspace-nivå ("All admins must have MFA")
- ✅ Backup codes
- ❌ NO SMS OTP (insecure, deprecated by NIST)
- ❌ NO WebAuthn/passkey (kan läggas till senare, inte blocking)

### Approach

Supabase Auth stöder MFA nativt. Huvudarbetet är UI flow + enforcement policy.

### Acceptance criteria

- [ ] Användare kan aktivera MFA TOTP från `/dashboard/settings/security`
- [ ] QR code genererad för setup av authenticator-app
- [ ] Backup codes (10 single-use) genererade och visade en gång
- [ ] Login med MFA aktiverat kräver TOTP code efter password
- [ ] Användare kan inaktivera MFA (med password re-prompt)
- [ ] Användare kan regenerera backup codes
- [ ] Workspace admin (med role `admin` eller `owner`) kan aktivera policyn "Require MFA for admins" — tillämpbar endast om de själva har MFA
- [ ] När policyn är aktiv, användare utan MFA som öppnar dashboard → forced onboarding MFA flow
- [ ] Audit log: `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.mfa.backup_codes_regenerated`
- [ ] Test E2E: enable MFA → logout → login → TOTP required → success

### Files

- `src/app/dashboard/settings/security/page.tsx`
- `src/components/security/MfaSetup.tsx`
- `src/components/security/MfaVerifyModal.tsx`
- `src/lib/services/mfa.ts`
- `src/app/api/v1/auth/mfa/enable/route.ts`
- `src/app/api/v1/auth/mfa/disable/route.ts`
- `src/app/api/v1/auth/mfa/verify/route.ts`
- `src/app/api/v1/workspaces/[id]/security-policy/route.ts` (för enforce)
- `src/app/auth/login/page.tsx` (TOTP step)

---

## T12 — Trust Center page + DPA + sub-processor list

**Effort**: 2-3 dagar
**Dependencies**: ingen (kan starta parallellt)
**Owner**: TBD

### Goal

Sidan `/trust` med all information som mid-market-köparen söker innan signering. **Man behöver inte vara SOC 2-certifierad för att ha ett bra Trust Center** — det som behövs är transparens.

### Obligatoriskt innehåll

1. **Security overview** — sammanfattning av [SECURITY.md](../../SECURITY.md) (security score, OWASP coverage, tooling)
2. **Sub-processor list** — offentlig och underhållen:
   - Supabase (database, auth, storage)
   - Vercel (hosting)
   - Stripe (payments)
   - Sentry (error monitoring)
   - OpenAI (LLM queries)
   - Anthropic (LLM queries)
   - Google AI (Gemini queries)
   - Perplexity (LLM queries)
   - SerpAPI (SERP data, om i bruk)
   - Upstash (Redis + rate limit)
   - Resend / SendGrid (transactional email — verifiera vilken)
   - Lägg till: location data residency för var och en
3. **Data residency** — EU (Supabase EU region)
4. **DPA template** — nedladdningsbar PDF, för-signerad från Acastings sida, med fält för-ifyllda enligt standard EU DPA
5. **GDPR rights** — länk till self-serve export/deletion (Fas 2 T14)
6. **Compliance status** — ärlig:
   - GDPR: ✅ Compliant (DPA, RoPA, data export/deletion)
   - SOC 2: 🚧 Not yet certified (consider Fase enterprise)
   - ISO 27001: 🚧 Not yet certified
   - CCPA: ✅ Compliant
7. **Security practices** — länk till `SECURITY.md` eller sammanfattning:
   - Encryption at rest (Supabase default AES-256)
   - Encryption in transit (HTTPS/TLS 1.3 via Vercel)
   - Access control (RLS Postgres + RBAC application layer)
   - Audit logs (immutable, exportable)
   - Backup (Supabase daily snapshots, retention 7 days standard / 30 days paid)
8. **Vulnerability disclosure** — `security@aio-pulse.com` (konfigurera alias)
9. **Pen test status** — "Internal audit Mars 2026 (85/100), external pen test planned Q4 2026" (ärlig, framtid)
10. **Contact** — security@, dpo@ (Data Protection Officer — utse även om part-time legal counsel)

### Format

Två acceptabla alternativ:
- **Statisk Next.js** — `/trust` page, `/trust/dpa.pdf`, `/trust/sub-processors`. Fördel: i repo, versionshanterad.
- **Notion site** eller **Webflow** — mindre tekniskt att underhålla, men utanför repo.

**Rekommendation**: statisk Next.js i `src/app/trust/` för kontroll + SEO (Trust Center är även en positiv AEO signal).

### Acceptance criteria

- [ ] `/trust` route fungerande med allt innehåll ovan
- [ ] `/trust/dpa` route med nedladdningsbar DPA PDF
- [ ] `/trust/sub-processors` route med uppdaterad tabell
- [ ] `/trust/security` route med security practices detail
- [ ] DPA PDF reviewed av legal counsel (1-2h consultancy, ~500-1500 EUR — se noteringar)
- [ ] Sub-processor list har kolumnen "data location" + "purpose"
- [ ] Dashboardens footer inkluderar länk till `/trust`
- [ ] OG tags + structured data för `/trust` (för SEO + AEO bonus)
- [ ] `security@aio-pulse.com` alias konfigurerat (Google Workspace eller motsvarande)

### Files

- `src/app/trust/page.tsx`
- `src/app/trust/dpa/page.tsx` (+ download endpoint eller länk till statisk PDF)
- `src/app/trust/sub-processors/page.tsx`
- `src/app/trust/security/page.tsx`
- `public/trust/dpa-template.pdf` (statisk)
- `src/components/trust/SubProcessorTable.tsx`

### Notering: DPA template

- Använd standard EU DPA template (gratis templates från IAPP, GDPR.eu)
- 1-2h med legal counsel för anpassning + sign
- Exempel på sourcing: privacypartners.com template, modifierad för Acasting

---

## T13 — Status page basic (Instatus)

**Effort**: 1-2 dagar
**Dependencies**: ingen
**Owner**: TBD

### Scope

Offentlig status page som visar:
- Aktuellt tillstånd: All Systems Operational / Partial Outage / Major Outage
- Component status: Web App, API, AI Providers, Database, Auth
- Incident history (historik)
- Uptime % senaste 30/90 dagarna

### Rekommenderat verktyg

**Instatus** (free tier OK för SMB):
- Custom domän: `status.aio-pulse.com`
- Auto-monitoring via uptime checks
- Komponenter: Web (Vercel passthrough), API (`/api/health`), Database (custom check), Auth (Supabase passthrough), AI Providers (probe för var och en)
- Incident management UI

Alternativ: BetterStack (dyrare men bättre UX), self-hosted (overkill).

### Acceptance criteria

- [ ] Instatus-konto skapat, custom domän konfigurerad
- [ ] 5 component monitorerade: Web, API, Database, Auth, AI Providers
- [ ] Uptime monitoring aktivt för varje component
- [ ] Status page tillgänglig publikt
- [ ] Dashboardens footer inkluderar länk till status page
- [ ] Vid en incident: founder kan uppdatera via Instatus UI
- [ ] Incident template förskrivet: investigating / identified / monitoring / resolved
- [ ] Webhook Sentry → Instatus för auto-create incident vid error spike (valfritt)
- [ ] Status badge embedded på homepage (valfritt)

### Files

- Ingen kodändring nödvändig (config på Instatus)
- `src/components/layout/Footer.tsx` (lägg till länk)
- `docs/operations/incident-response.md` (runbook: vad man gör när det finns en incident)

---

## T14 — GDPR essentials: data export + deletion self-serve

**Effort**: 4-5 dagar
**Dependencies**: T07, T08 slutförda
**Owner**: TBD

### Goal

Tillåta en användare att:
1. **Exportera** alla sina data (GDPR Art. 15 + Art. 20)
2. **Radera** sitt konto + data (GDPR Art. 17 — Right to Erasure)

Self-serve, utan operatörsingripande.

### Export flow

Trigger: user clicks "Export my data" in `/dashboard/settings/data`.

```
1. UI → POST /api/v1/data-export/request
2. Backend:
   a. Crea record in data_export_requests (status: 'pending')
   b. Lancia background job (Vercel Cron + Inngest, o Supabase edge function)
   c. logAudit('data.export.requested')
3. Background job:
   a. Raccoglie dati: profile, organizations owned, workspaces, brands, prompts, monitoring results, audit logs (own actions), API keys (metadata only, NO hash)
   b. Genera ZIP con CSV + JSON per ogni tabella
   c. Upload a Supabase Storage (private bucket, signed URL)
   d. Update record: status='ready', download_url=<signed_url>, expires_at=<7 days>
   e. Send email con link download
   f. logAudit('data.exported')
4. User clicks email → autenticato → download
5. After 7 days: file scaduto, ZIP deleted da storage
```

### Deletion flow

GDPR mandates 30-day grace period (so user can change mind), then hard delete.

```
1. UI → POST /api/v1/data-deletion/request
2. Backend:
   a. Re-authenticate user (password prompt)
   b. Crea record in data_deletion_requests (status: 'pending', execute_at=<now + 30 days>)
   c. Soft-delete account: User.deletedAt = NOW (login blocked)
   d. logAudit('data.deletion.requested')
   e. Send email "Your account is scheduled for deletion in 30 days. Cancel within X days."
3. Background job (daily cron):
   a. Find data_deletion_requests with execute_at < NOW and status='pending'
   b. Hard delete: orgs (cascade), workspaces, brands, prompts, etc.
   c. Anonymize audit logs related (keep ID for legal/compliance, replace email/name with '[DELETED]')
   d. Stripe customer delete (via API)
   e. Sentry user delete
   f. Update record: status='completed', completed_at=NOW
   g. logAudit('data.deleted') — last log before audit_logs entries are anonymized
   h. Cannot send email after deletion — but send 1 day before "Your data is being deleted tomorrow"
```

### Schema additions

```prisma
model DataExportRequest {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")
  organizationId  String?   @map("organization_id")
  status          String    @default("pending")  // pending | processing | ready | downloaded | expired | failed
  downloadUrl     String?   @map("download_url")
  expiresAt       DateTime? @map("expires_at")
  fileSizeBytes   BigInt?   @map("file_size_bytes")
  errorMessage    String?   @map("error_message")
  
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  
  @@map("data_export_requests")
  @@index([userId])
  @@index([status])
}

model DataDeletionRequest {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")
  organizationId  String?   @map("organization_id")  // se è org-wide delete
  scope           String    @default("user")          // user | organization
  status          String    @default("pending")       // pending | confirmed | executing | completed | cancelled
  executeAt       DateTime  @map("execute_at")        // now + 30 days
  cancelledAt     DateTime? @map("cancelled_at")
  cancelledBy     String?   @map("cancelled_by")
  
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  
  @@map("data_deletion_requests")
  @@index([userId])
  @@index([status])
  @@index([executeAt])
}
```

### Acceptance criteria

- [ ] `/dashboard/settings/data` UI med två knappar "Export data" / "Delete account"
- [ ] Export flow fungerande end-to-end (request → ZIP ready → email → download)
- [ ] Deletion flow fungerande: request → 30 day countdown → email reminders day 28/29 → hard delete day 30
- [ ] Användare kan avbryta deletion request inom 30 dagar
- [ ] Background jobs konfigurerade (Vercel Cron + Inngest eller motsv)
- [ ] ZIP export innehåller alla data: profile, orgs, workspaces, brands, prompts, monitoring, audit logs
- [ ] ZIP export är i läsbart format (JSON + CSV per tabell)
- [ ] Filen expire 7 dagar efter generation
- [ ] Hard delete cascades korrekt (orgs, workspaces, brands, prompts, etc.)
- [ ] Audit log anonymized post-deletion (fältet `actor_id` bevaras, men `metadata` med email borttaget)
- [ ] Email: export ready, deletion scheduled, deletion 1-day reminder, deletion completed
- [ ] Test E2E: full export → download ZIP → verify content
- [ ] Test E2E: full deletion → 30-day timer → cron triggers → all data gone
- [ ] Dokumentation: `/trust/gdpr` page med explanation av flödet

### Files

- `prisma/schema.prisma` (add DataExportRequest, DataDeletionRequest)
- `prisma/migrations/<timestamp>_add_data_subject_requests/`
- `src/app/api/v1/data-export/request/route.ts`
- `src/app/api/v1/data-export/[id]/route.ts`
- `src/app/api/v1/data-deletion/request/route.ts`
- `src/app/api/v1/data-deletion/[id]/cancel/route.ts`
- `src/lib/services/data-export.ts` (job worker)
- `src/lib/services/data-deletion.ts` (job worker)
- `src/app/dashboard/settings/data/page.tsx`
- `src/app/cron/data-deletion-executor/route.ts` (cron handler)
- `src/lib/services/email.ts` (utöka med templates)
- `src/app/trust/gdpr/page.tsx` (sub-page)

---

## ✅ Definition of Done Fas 2

- [ ] T10-T14 alla merged i `main`
- [ ] SSO Google + Microsoft fungerande i produktion
- [ ] MFA tillgängligt + enforceable på workspace-nivå
- [ ] `/trust` page live med DPA, sub-processors, security, GDPR rights
- [ ] `status.aio-pulse.com` live med 5 component monitorerade
- [ ] GDPR export + deletion self-serve testade end-to-end
- [ ] Email transactional setup: export ready, deletion scheduled, etc.
- [ ] AGENTS.md uppdaterad med OAuth env vars + MFA notes
- [ ] SECURITY.md uppdaterad: 2FA enforcement löst, GDPR compliance "Full"
- [ ] task-tracker.md uppdaterad

---

**Tillbaka till kartan**: [README.md](README.md).
**Parallell / nästa fas**: [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md).
