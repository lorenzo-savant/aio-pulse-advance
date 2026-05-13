# Fase 2 — SSO + MFA + Trust Center + GDPR + Status Page (T10-T14)

> 2-3 settimane, 15-25k EUR. **Trust signal per mid-market.** Parallelizable con Fase 3 dopo Fase 1.

---

## 🎯 Goal della fase

Sbloccare i deal mid-market (€20-50k ARR) eliminando i 5 blocker più comuni: "Avete SSO?", "C'è MFA?", "DPA scaricabile?", "Status page?", "Posso cancellare i miei dati?". Senza essere SOC 2 certified (fuori scope), ma trust-credibile.

## ⚠️ Prerequisito

[Fase 1](02-fase-1-workspace-audit.md) completata: SSO va a livello Organization, audit log instrumentation pronto, GDPR export usa la gerarchia workspace.

## 📋 Task overview

| Task | Titolo | Effort | Deps |
|---|---|---|---|
| T10 | SSO Google + Microsoft OAuth | 3-4 giorni | T07 |
| T11 | MFA TOTP opzionale + enforceable per workspace admin | 2-3 giorni | T07 |
| T12 | Trust Center page + DPA + sub-processor list | 2-3 giorni | — |
| T13 | Status page basic (Instatus) + monitoring config | 1-2 giorni | — |
| T14 | GDPR essentials: data export + deletion self-serve | 4-5 giorni | T07, T08 |

**Totale**: ~2-3 settimane con 1 dev fulltime.

---

## T10 — SSO Google + Microsoft OAuth

**Effort**: 3-4 giorni
**Dependencies**: T07 (organization tier per SSO config)
**Owner**: TBD

### Scope

- ✅ Google OAuth (Workspace + personal)
- ✅ Microsoft OAuth (Azure AD personal + work)
- ❌ NO SAML 2.0 (fuori scope — vedi [00-mission-scope-rules.md](00-mission-scope-rules.md))
- ❌ NO OIDC custom IdP (uses SAML usually)

### Approach

Supabase Auth supporta nativamente Google + Microsoft via OAuth. La maggior parte del lavoro è:
1. Config providers in Supabase dashboard
2. UI signup/login con button "Continue with Google" / "Continue with Microsoft"
3. Account linking per user esistenti email/password che vogliono switchare a SSO

### Acceptance criteria

- [ ] Google OAuth: configurato in Supabase dashboard (client ID + secret in vault)
- [ ] Microsoft OAuth: configurato in Supabase dashboard
- [ ] UI signup: bottoni "Continue with Google" + "Continue with Microsoft" + email/password
- [ ] UI login: stesso layout
- [ ] First-time SSO signup → crea Organization + Default Workspace automatico
- [ ] Account linking: user email/password può collegare provider SSO da settings
- [ ] User che si registra via SSO con email già esistente come password → flow di linking (no duplicate account)
- [ ] Test E2E: signup via Google → workspace created → logged in
- [ ] Test E2E: existing user logs in via Microsoft per la prima volta → linked correctly
- [ ] Audit log: `auth.login` con `metadata.provider: 'google' | 'microsoft' | 'email'`
- [ ] Documentazione: `ENVIRONMENTS.md` aggiornato con env vars OAuth

### Files

- Supabase dashboard config (no codice, ma documentare in `docs/auth/sso-setup.md`)
- `src/app/auth/login/page.tsx` (aggiunta button)
- `src/app/auth/signup/page.tsx` (aggiunta button)
- `src/app/auth/callback/route.ts` (gestione callback con Org auto-creation)
- `src/lib/services/auth.ts` (account linking logic)
- `src/app/dashboard/settings/account/page.tsx` (UI account linking)
- `docs/auth/sso-setup.md` (nuovo, runbook setup IdP)

### Note implementative

- Microsoft OAuth: scegli "common" tenant per accettare sia personal (outlook.com, hotmail) sia work (Azure AD). Per restrict a solo work, usare "organizations" tenant.
- Google: configurare consent screen con privacy policy + ToS URL
- Redirect URLs critical: `https://<your-domain>/auth/callback` + `http://localhost:3000/auth/callback` per dev
- Account linking: se user signup via Google con email X, poi tenta signup con password con email X → mostra "Existing account, sign in with Google" UI

---

## T11 — MFA TOTP opzionale + enforceable per workspace admin

**Effort**: 2-3 giorni
**Dependencies**: T07
**Owner**: TBD

### Scope

- ✅ TOTP (Google Authenticator, Authy, 1Password, etc.)
- ✅ Opt-in da settings utente
- ✅ Enforceable a livello workspace ("All admins must have MFA")
- ✅ Backup codes
- ❌ NO SMS OTP (insecure, deprecated by NIST)
- ❌ NO WebAuthn/passkey (può essere added later, non blocking)

### Approach

Supabase Auth supporta MFA nativo. Lavoro principale è UI flow + enforcement policy.

### Acceptance criteria

- [ ] User può abilitare MFA TOTP da `/dashboard/settings/security`
- [ ] QR code generato per setup app authenticator
- [ ] Backup codes (10 single-use) generati e mostrati una volta
- [ ] Login con MFA abilitato richiede TOTP code dopo password
- [ ] User può disabilitare MFA (con password re-prompt)
- [ ] User può rigenerare backup codes
- [ ] Workspace admin (con role `admin` o `owner`) può abilitare policy "Require MFA for admins" — applicabile solo se loro stesso ha MFA
- [ ] Quando policy attiva, user senza MFA che apre dashboard → forced onboarding MFA flow
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
- `src/app/api/v1/workspaces/[id]/security-policy/route.ts` (per enforce)
- `src/app/auth/login/page.tsx` (TOTP step)

---

## T12 — Trust Center page + DPA + sub-processor list

**Effort**: 2-3 giorni
**Dependencies**: nessuna (può partire in parallelo)
**Owner**: TBD

### Goal

Pagina `/trust` con tutte le informazioni che il mid-market buyer cerca prima di firmare. **Non serve essere certificati SOC 2 per avere una buona Trust Center** — serve trasparenza.

### Contenuti obbligatori

1. **Security overview** — sintesi di [SECURITY.md](../../SECURITY.md) (security score, OWASP coverage, tooling)
2. **Sub-processor list** — pubblica e mantenuta:
   - Supabase (database, auth, storage)
   - Vercel (hosting)
   - Stripe (payments)
   - Sentry (error monitoring)
   - OpenAI (LLM queries)
   - Anthropic (LLM queries)
   - Google AI (Gemini queries)
   - Perplexity (LLM queries)
   - SerpAPI (SERP data, se in uso)
   - Upstash (Redis + rate limit)
   - Resend / SendGrid (transactional email — verifica quale)
   - Aggiungere: location data residency per ognuno
3. **Data residency** — EU (Supabase EU region)
4. **DPA template** — scaricabile PDF, pre-firmato lato Acasting, con campi pre-compilati su DPA standard EU
5. **GDPR rights** — link a self-serve export/deletion (Fase 2 T14)
6. **Compliance status** — onesto:
   - GDPR: ✅ Compliant (DPA, RoPA, data export/deletion)
   - SOC 2: 🚧 Not yet certified (consider Fase enterprise)
   - ISO 27001: 🚧 Not yet certified
   - CCPA: ✅ Compliant
7. **Security practices** — link a `SECURITY.md` o sintesi:
   - Encryption at rest (Supabase default AES-256)
   - Encryption in transit (HTTPS/TLS 1.3 via Vercel)
   - Access control (RLS Postgres + RBAC application layer)
   - Audit logs (immutable, exportable)
   - Backup (Supabase daily snapshots, retention 7 days standard / 30 days paid)
8. **Vulnerability disclosure** — `security@aio-pulse.com` (configurare alias)
9. **Pen test status** — "Internal audit Marzo 2026 (85/100), external pen test planned Q4 2026" (onesto, futuro)
10. **Contact** — security@, dpo@ (Data Protection Officer — designare anche se part-time legal counsel)

### Format

Due opzioni acceptable:
- **Statica Next.js** — `/trust` page, `/trust/dpa.pdf`, `/trust/sub-processors`. Vantaggio: in repo, versionato.
- **Notion site** o **Webflow** — meno tecnico da maintain, ma fuori repo.

**Raccomandazione**: statica Next.js in `src/app/trust/` per controllo + SEO (Trust Center è anche AEO signal positivo).

### Acceptance criteria

- [ ] `/trust` route funzionante con tutti i contenuti sopra
- [ ] `/trust/dpa` route con DPA scaricabile PDF
- [ ] `/trust/sub-processors` route con tabella aggiornata
- [ ] `/trust/security` route con security practices detail
- [ ] DPA PDF reviewed da legal counsel (1-2h consultancy, ~500-1500 EUR — vedi note)
- [ ] Sub-processor list ha colonna "data location" + "purpose"
- [ ] Footer di dashboard include link a `/trust`
- [ ] OG tags + structured data per `/trust` (per SEO + AEO bonus)
- [ ] `security@aio-pulse.com` alias configurato (Google Workspace o equivalent)

### Files

- `src/app/trust/page.tsx`
- `src/app/trust/dpa/page.tsx` (+ download endpoint o link a static PDF)
- `src/app/trust/sub-processors/page.tsx`
- `src/app/trust/security/page.tsx`
- `public/trust/dpa-template.pdf` (statico)
- `src/components/trust/SubProcessorTable.tsx`

### Note: DPA template

- Usa template standard EU DPA (template gratuiti da IAPP, GDPR.eu)
- 1-2h con legal counsel per personalizzazione + sign
- Esempio sourcing: privacypartners.com template, modificato per Acasting

---

## T13 — Status page basic (Instatus)

**Effort**: 1-2 giorni
**Dependencies**: nessuna
**Owner**: TBD

### Scope

Status page pubblica che mostra:
- Stato corrente: All Systems Operational / Partial Outage / Major Outage
- Component status: Web App, API, AI Providers, Database, Auth
- Incident history (storico)
- Uptime % ultimi 30/90 giorni

### Strumento raccomandato

**Instatus** (free tier OK per SMB):
- Dominio custom: `status.aio-pulse.com`
- Auto-monitoring via uptime checks
- Componenti: Web (Vercel passthrough), API (`/api/health`), Database (custom check), Auth (Supabase passthrough), AI Providers (probe per ogni)
- Incident management UI

Alternative: BetterStack (più costoso ma migliore UX), self-hosted (overkill).

### Acceptance criteria

- [ ] Account Instatus creato, dominio custom configurato
- [ ] 5 component monitorati: Web, API, Database, Auth, AI Providers
- [ ] Uptime monitoring attivo per ogni component
- [ ] Status page accessibile pubblicamente
- [ ] Footer di dashboard include link a status page
- [ ] In caso di incident: founder può aggiornare via Instatus UI
- [ ] Incident template pre-scritto: investigating / identified / monitoring / resolved
- [ ] Webhook Sentry → Instatus per auto-create incident su error spike (opzionale)
- [ ] Status badge embedded nella homepage (opzionale)

### Files

- Nessuna code change essenziale (config su Instatus)
- `src/components/layout/Footer.tsx` (aggiungere link)
- `docs/operations/incident-response.md` (runbook: cosa fare quando c'è un incident)

---

## T14 — GDPR essentials: data export + deletion self-serve

**Effort**: 4-5 giorni
**Dependencies**: T07, T08 completati
**Owner**: TBD

### Goal

Permettere a un utente di:
1. **Esportare** tutti i suoi dati (GDPR Art. 15 + Art. 20)
2. **Cancellare** il suo account + dati (GDPR Art. 17 — Right to Erasure)

Self-serve, senza intervento operatore.

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

- [ ] `/dashboard/settings/data` UI con due button "Export data" / "Delete account"
- [ ] Export flow funzionante end-to-end (request → ZIP ready → email → download)
- [ ] Deletion flow funzionante: request → 30 day countdown → email reminders day 28/29 → hard delete day 30
- [ ] User può cancellare deletion request entro 30 giorni
- [ ] Background jobs configurati (Vercel Cron + Inngest o equiv)
- [ ] ZIP export contiene tutti i dati: profile, orgs, workspaces, brands, prompts, monitoring, audit logs
- [ ] ZIP export è formato leggibile (JSON + CSV per tabella)
- [ ] File expire 7 giorni dopo generation
- [ ] Hard delete cascades correttamente (orgs, workspaces, brands, prompts, etc.)
- [ ] Audit log anonymized post-deletion (campo `actor_id` mantenuto, ma `metadata` con email rimosso)
- [ ] Email: export ready, deletion scheduled, deletion 1-day reminder, deletion completed
- [ ] Test E2E: full export → download ZIP → verify content
- [ ] Test E2E: full deletion → 30-day timer → cron triggers → all data gone
- [ ] Documentation: `/trust/gdpr` page con explanation del flow

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
- `src/lib/services/email.ts` (estendere con templates)
- `src/app/trust/gdpr/page.tsx` (sub-page)

---

## ✅ Definition of Done Fase 2

- [ ] T10-T14 tutti merged in `main`
- [ ] SSO Google + Microsoft funzionante in produzione
- [ ] MFA disponibile + enforceable a workspace level
- [ ] `/trust` page live con DPA, sub-processors, security, GDPR rights
- [ ] `status.aio-pulse.com` live con 5 component monitorati
- [ ] GDPR export + deletion self-serve testati end-to-end
- [ ] Email transactional setup: export ready, deletion scheduled, etc.
- [ ] AGENTS.md aggiornato con env vars OAuth + MFA notes
- [ ] SECURITY.md aggiornato: 2FA enforcement risolto, GDPR compliance "Full"
- [ ] task-tracker.md aggiornato

---

**Tornare alla mappa**: [README.md](README.md).
**Parallela / prossima fase**: [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md).
