# Enterprise Roadmap — AIO Pulse

> 4 fasi, 10-14 settimane, target **SMB/prosumer + enterprise-lite**. Decisione strategica del 2026-05-13.

---

## 📍 Sei qui per

Trasformare AIO Pulse da "production-grade boilerplate" a **SaaS commerciale vendibile a SMB e mid-market** senza il peso compliance di SOC 2 / ISO 27001 / SAML / SCIM.

**NON** stai costruendo un enterprise stack Fortune-1000-ready. Quella roadmap esiste ma costa €400-700k + 12-18 mesi. Qui costruiamo lean per validare PMF commerciale a €50-110k EUR / 10-14 settimane.

## 🗺️ Mappa dei documenti

| File | Cosa contiene |
|---|---|
| [README.md](README.md) | Sei qui |
| [00-mission-scope-rules.md](00-mission-scope-rules.md) | Mission, scope esplicito IN/OUT, coding standards complete, definition of done universale |
| [01-fase-0-pulizia.md](01-fase-0-pulizia.md) | 6 task (T01-T06) — fix S1/S2 da CODE_REVIEW.md, type safety, logger, Sentry |
| [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md) | 3 task (T07-T09) — Workspace/Org migration + audit log + scoped API keys + design schema |
| [03-fase-2-trust-gdpr.md](03-fase-2-trust-gdpr.md) | 5 task (T10-T14) — SSO Google/MS, MFA, Trust Center, status page, GDPR essentials |
| [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md) | 4 task (T15-T18) — seat billing, manual invoicing, onboarding flow, API docs |
| [task-tracker.md](task-tracker.md) | Kanban view di tutti i 18 task con stato corrente |

## 🚦 Sequenza obbligata

```
Fase 0 (T01-T06) ─── precondizione ───►  Fase 1 (T07-T09)
                                                │
                                                ├── parallel ───►  Fase 2 (T10-T14)
                                                │
                                                └── parallel ───►  Fase 3 (T15-T18)
```

Fase 2 e Fase 3 possono partire in parallelo dopo che Fase 1 è completata. Mai partire Fase 1 con Fase 0 incompleta — il debito tecnico crescerebbe esponenzialmente.

## ⏱️ Timeline indicativa

| Settimana | Fase | Output atteso |
|---|---|---|
| 1-4 | Fase 0 | Codebase type-safe, logger strutturato, zero console.log produzione |
| 5-8 | Fase 1 | Organization + Workspace + AuditLog + Scoped API keys live |
| 9-11 | Fase 2 (può parallelizzare con Fase 3) | SSO Google/MS, MFA, Trust Center, status page, GDPR self-serve |
| 9-12 | Fase 3 (può parallelizzare con Fase 2) | Seat-based billing, onboarding wizard, API docs complete |
| 13-14 | Buffer / polish | Bug fixes, customer feedback adjustments |

## 💰 Budget per fase

| Fase | Settimane | EUR (lean) | EUR (standard) |
|---|---|---|---|
| Fase 0 | 3-4 | 25.000 | 40.000 |
| Fase 1 | 3-4 | 20.000 | 30.000 |
| Fase 2 | 2-3 | 15.000 | 25.000 |
| Fase 3 | 2-3 | 10.000 | 15.000 |
| **Totale** | **10-14** | **70.000** | **110.000** |

Stima basata su 1 senior fullstack TypeScript/React + 1 part-time devops/security. Range varia con seniority freelance vs employed.

## ✅ Definition of "Roadmap Complete"

A fine Fase 3, AIO Pulse dovrebbe:

1. **Type-safe end-to-end**: 0 `(db as any)` non documentati, `pnpm type-check` PASS
2. **Multi-tenant vera**: Organization → Workspace → Brand hierarchy live, migration esistenti completata
3. **Audit trail completo**: ogni azione critical loggata in `audit_logs`, exportabile CSV
4. **API keys scoped**: nessuna chiave "full access", scopes granulari
5. **SSO live**: signup/login via Google + Microsoft OAuth oltre email/password
6. **MFA disponibile**: TOTP opzionale per utenti, enforceable per workspace admin
7. **GDPR self-serve**: data export + deletion in dashboard, DPA template scaricabile
8. **Trust Center pubblico**: `/trust` con security overview, sub-processor list, contact
9. **Status page live**: `status.aio-pulse.com` con monitoring real-time
10. **Seat billing**: workspace member = seat fatturato, manual invoicing per custom plan
11. **Onboarding self-serve**: nuovo user da signup a first analysis in <10 min senza handholding
12. **API docs complete**: `/docs/api` con esempi per ogni endpoint + SDK starter

## 🎯 Cosa fare ORA (giorno 1)

1. **Leggi** [00-mission-scope-rules.md](00-mission-scope-rules.md) per capire le regole di ingaggio
2. **Apri** [task-tracker.md](task-tracker.md) e scegli T01 (primo task Fase 0)
3. **Leggi il task** completo in [01-fase-0-pulizia.md](01-fase-0-pulizia.md)
4. **Crea branch** `fase-0/T01-fix-onboarding-imports`
5. **Esegui** rispettando le coding standards
6. **Apri PR** con DoD checklist
7. **Continua** con T02, T03, ecc.

## 🔗 Documenti correlati (root del repo)

- [../../AGENTS.md](../../AGENTS.md) — istruzioni universali per coding agent (OpenCode, Cursor, Claude Code)
- [../../README.md](../../README.md) — overview progetto
- [../../SECURITY.md](../../SECURITY.md) — security baseline marzo 2026
- [../../CODE_REVIEW.md](../../CODE_REVIEW.md) — issue list da Fase 0
- [../../BILLING_SETUP.md](../../BILLING_SETUP.md) — Stripe config (rilevante Fase 3)
- [../../ENVIRONMENTS.md](../../ENVIRONMENTS.md) — env vars

---

**Mantra**: lean, focused, type-safe, shippable. SMB-first, enterprise later.
