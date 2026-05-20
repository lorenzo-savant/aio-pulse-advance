# Enterprise Roadmap — AIO Pulse

> 4 faser, 10-14 veckor, mål **SMB/prosumer + enterprise-lite**. Strategiskt beslut från 2026-05-13.

---

## 📍 Du är här för att

Förvandla AIO Pulse från "production-grade boilerplate" till **kommersiell SaaS säljbar till SMB och mid-market** utan compliance-bördan från SOC 2 / ISO 27001 / SAML / SCIM.

Du bygger **INTE** en enterprise-stack redo för Fortune-1000. Den roadmappen finns men kostar €400-700k + 12-18 månader. Här bygger vi lean för att validera kommersiell PMF för €50-110k EUR / 10-14 veckor.

## 🗺️ Dokumentkarta

| File                                                               | Vad det innehåller                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [README.md](README.md)                                             | Du är här                                                                                 |
| [00-mission-scope-rules.md](00-mission-scope-rules.md)             | Mission, explicit IN/OUT-scope, kompletta coding standards, universell definition of done |
| [01-fase-0-pulizia.md](01-fase-0-pulizia.md)                       | 6 tasks (T01-T06) — fix S1/S2 från CODE_REVIEW.md, type safety, logger, Sentry            |
| [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md)       | 3 tasks (T07-T09) — Workspace/Org migration + audit log + scoped API keys + design schema |
| [03-fase-2-trust-gdpr.md](03-fase-2-trust-gdpr.md)                 | 5 tasks (T10-T14) — SSO Google/MS, MFA, Trust Center, status page, GDPR essentials        |
| [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md) | 4 tasks (T15-T18) — seat billing, manuell fakturering, onboarding-flöde, API docs         |
| [task-tracker.md](task-tracker.md)                                 | Kanban-vy över alla 18 tasks med aktuell status                                           |

## 🚦 Obligatorisk sekvens

```
Fase 0 (T01-T06) ─── precondizione ───►  Fase 1 (T07-T09)
                                                │
                                                ├── parallel ───►  Fase 2 (T10-T14)
                                                │
                                                └── parallel ───►  Fase 3 (T15-T18)
```

Fas 2 och Fas 3 kan startas parallellt efter att Fas 1 är slutförd. Starta aldrig Fas 1 med Fas 0 ofullständig — den tekniska skulden skulle växa exponentiellt.

## ⏱️ Vägledande tidslinje

| Settimana | Fase                                   | Förväntad output                                                    |
| --------- | -------------------------------------- | ------------------------------------------------------------------- |
| 1-4       | Fase 0                                 | Type-safe kodbas, strukturerad logger, noll console.log i produktion |
| 5-8       | Fase 1                                 | Organization + Workspace + AuditLog + Scoped API keys live          |
| 9-11      | Fase 2 (kan parallelliseras med Fas 3) | SSO Google/MS, MFA, Trust Center, status page, GDPR self-serve      |
| 9-12      | Fase 3 (kan parallelliseras med Fas 2) | Seat-based billing, onboarding-wizard, kompletta API docs           |
| 13-14     | Buffer / polish                        | Bug fixes, justeringar utifrån kundfeedback                         |

## 💰 Budget per fas

| Fase       | Settimane | EUR (lean) | EUR (standard) |
| ---------- | --------- | ---------- | -------------- |
| Fase 0     | 3-4       | 25.000     | 40.000         |
| Fase 1     | 3-4       | 20.000     | 30.000         |
| Fase 2     | 2-3       | 15.000     | 25.000         |
| Fase 3     | 2-3       | 10.000     | 15.000         |
| **Totale** | **10-14** | **70.000** | **110.000**    |

Uppskattning baserad på 1 senior fullstack TypeScript/React + 1 part-time devops/security. Intervallet varierar med seniority freelance vs anställd.

## ✅ Definition of "Roadmap Complete"

I slutet av Fas 3 bör AIO Pulse:

1. **Type-safe end-to-end**: 0 odokumenterade `(db as any)`, `pnpm type-check` PASS
2. **Äkta multi-tenant**: Organization → Workspace → Brand hierarki live, befintlig migration slutförd
3. **Komplett audit trail**: varje kritisk åtgärd loggad i `audit_logs`, exporterbar som CSV
4. **API keys scoped**: ingen "full access"-nyckel, granulära scopes
5. **SSO live**: signup/login via Google + Microsoft OAuth utöver e-post/lösenord
6. **MFA tillgängligt**: TOTP valfritt för användare, framtvingbart för workspace-admin
7. **GDPR self-serve**: data export + deletion i dashboard, nedladdningsbar DPA-mall
8. **Publikt Trust Center**: `/trust` med security overview, sub-processor list, contact
9. **Status page live**: `status.aio-pulse.com` med real-time monitoring
10. **Seat billing**: workspace-medlem = fakturerad seat, manuell fakturering för custom plan
11. **Onboarding self-serve**: ny användare från signup till första analys på <10 min utan handholding
12. **Kompletta API docs**: `/docs/api` med exempel för varje endpoint + SDK starter

## 🎯 Vad du ska göra NU (dag 1)

1. **Läs** [00-mission-scope-rules.md](00-mission-scope-rules.md) för att förstå spelreglerna
2. **Öppna** [task-tracker.md](task-tracker.md) och välj T01 (första task i Fas 0)
3. **Läs hela tasken** i [01-fase-0-pulizia.md](01-fase-0-pulizia.md)
4. **Skapa branch** `fase-0/T01-fix-onboarding-imports`
5. **Genomför** med respekt för coding standards
6. **Öppna PR** med DoD checklist
7. **Fortsätt** med T02, T03, osv.

## 🔗 Relaterade dokument (repo-roten)

- [../../AGENTS.md](../../AGENTS.md) — universella instruktioner för coding agents (Cursor, Claude Code, andra)
- [../../README.md](../../README.md) — projektöversikt
- [../../SECURITY.md](../../SECURITY.md) — security baseline mars 2026
- CODE_REVIEW.md — issue-lista från Fas 0 (historisk rapport borttagen från repot)
- [../../BILLING_SETUP.md](../../BILLING_SETUP.md) — Stripe config (relevant Fas 3)
- [../../ENVIRONMENTS.md](../../ENVIRONMENTS.md) — env vars

---

**Mantra**: lean, focused, type-safe, shippable. SMB-first, enterprise later.
