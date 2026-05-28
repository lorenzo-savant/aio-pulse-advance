# Lorenzo — Production Readiness TODO

> Lista delle azioni manuali (vendor dashboard) per chiudere il 100% del
> production-readiness audit. **Non sono cose che si fanno da codice** —
> servono click reali da parte tua.
>
> 🚧 **STATO ATTUALE** — non ancora fatto deploy su Vercel + non ancora
> registrato dominio `aio-pulse.com`. Questo blocca step 2, 3, 4, 5.
> Step 1 (MFA Supabase) si può fare oggi.

---

## 🚦 Sequenza consigliata

```
STEP 1 (oggi, 5 min)
   ↓
STEP 0 (1-2 h: registra dominio + deploy)
   ↓
STEP 5 (Log Drain — solo Vercel, no dominio richiesto)
   ↓
STEP 2 (Monitor uptime — richiede URL pubblica)
   ↓
STEP 4 (Email aliases — richiede MX records sul dominio)
   ↓
STEP 3 (Status page — DNS CNAME)
```

---

## STEP 0 — Deploy Vercel + dominio aio-pulse.com 🚧 BLOCCANTE

- [ ] Done on YYYY-MM-DD

### 0.A — Registrare il dominio `aio-pulse.com`

- [ ] Verificare disponibilità su https://www.namecheap.com o
      https://www.cloudflare.com/products/registrar/
- [ ] Acquistare (Cloudflare Registrar = at-cost, ~$10/anno; Namecheap
      ~$13/anno + privacy guard)
- [ ] **Attivare 2FA sul registrar IMMEDIATAMENTE** (TOTP, no SMS)
- [ ] Salvare credenziali in 1Password
- [ ] Scrivere data di rinnovo nel calendario (annuale)

### 0.B — Deploy Vercel del progetto

- [ ] Vercel → New Project → Import da GitHub
      (`Looziolooz/aio-pulse-advance` o `lorenzo-savant/aio-pulse-advance`)
- [ ] Framework: Next.js (auto-detected)
- [ ] Production branch: `main`
- [ ] Wire delle env vars (copia da `.env.local` locale):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
        `PERPLEXITY_API_KEY`
  - [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `RESEND_API_KEY`
  - [ ] `CRON_SECRET_TOKEN`
  - [ ] `SENTRY_AUTH_TOKEN` (build only)
  - [ ] Eventuali altre da [SECRETS_ROTATION.md](docs/runbooks/SECRETS_ROTATION.md)
- [ ] Region: `arn1` (Stockholm) → coerente con `vercel.json`
- [ ] Deploy → aspetta build (3-5 min)
- [ ] Verifica `https://aio-pulse-advance.vercel.app/api/health` →
      restituisce JSON `status: healthy`

### 0.C — Collegare dominio custom a Vercel

- [ ] Vercel project → Settings → Domains → Add
- [ ] Inserisci `aio-pulse.com` + `www.aio-pulse.com`
- [ ] Vercel ti dice quali DNS record aggiungere:
  - `aio-pulse.com` → `A 76.76.21.21`
  - `www.aio-pulse.com` → `CNAME cname.vercel-dns.com`
- [ ] Vai sul registrar → DNS settings → aggiungi i record
- [ ] Aspetta propagazione (5-30 min)
- [ ] Vercel rileva → auto-provisiona SSL → diventa Active ✅
- [ ] Verifica `https://aio-pulse.com/api/health` → healthy

---

## STEP 1 — MFA / 2FA su Supabase ✅ DONE

- [x] Done on 2026-05-28

### Pre-requisiti
- App authenticator installata (1Password, Google Authenticator, Authy,
  Microsoft Authenticator)

### Passi
- [ ] https://supabase.com/dashboard → login
- [ ] Top-right → avatar → **Account** (NON Project Settings)
- [ ] Sidebar → **Security**
- [ ] Sezione **Two-Factor Authentication** → **Add new factor** →
      **Authenticator app (TOTP)**
- [ ] Scansiona QR code con l'app authenticator
- [ ] Copia anche la **secret string** in 1Password come backup
- [ ] Inserisci il codice 6 cifre nel form Supabase → **Verify**
- [ ] **SALVA gli 8 Recovery Codes** in 1Password sotto entry
      "Supabase MFA recovery"

### Verifica
- [ ] Logout da Supabase
- [ ] Login → ti chiede TOTP dopo email+password
- [ ] Entri ✅

### Bonus
- [ ] Se hai membri team con accesso al progetto: ognuno fa lo stesso
      processo sul proprio account

---

## STEP 2 — BetterStack Uptime Monitor 🔒 blocked by STEP 0

- [ ] Done on YYYY-MM-DD

### Pre-requisiti
- `https://aio-pulse.com/api/health` raggiungibile (STEP 0 completato)
- Telefono per SMS (free tier = 1 numero)

### Passi
- [ ] https://betterstack.com/uptime → Sign up (Google o email)
- [ ] All'onboarding "How would you like to use Better Stack?" seleziona:
  - ✅ Uptime monitoring
  - ✅ Status page
  - ✅ Log management
  - ✅ On-call & Incident management (opzionale, free)
  - ❌ Tutto il resto
- [ ] All'onboarding "What integrations":
  - ✅ Sentry
  - ✅ Slack (se ce l'hai)
  - ❌ Tutto il resto
- [ ] Dashboard → sidebar **Monitors** → **Create monitor**

### Form principale (Monitor 1: API Health)
- [ ] URL: `https://aio-pulse.com/api/health`
- [ ] Monitor type: HTTPS
- [ ] Check frequency: **30 seconds**
- [ ] Request timeout: 10 seconds
- [ ] Regions: scegli almeno 2-3 (Stockholm + Frankfurt + US East)
- [ ] Expected status codes: 200-299
- [ ] Spunta "Verify SSL certificate"
- [ ] Keyword in response body: `"status":"healthy"` (alert se NON
      contiene questa stringa — degraded passa il check, unhealthy alerta)
- [ ] Use HTTP HEAD method: **NO** (vogliamo il body)
- [ ] Domain expiration alerts: ON, advance notice 30 giorni
- [ ] SSL expiration alerts: ON, advance notice 14 giorni
- [ ] Recovery period: 1 minute
- [ ] On-call escalation: email + SMS al tuo numero, immediato
- [ ] **Create monitor**

### Monitor 2: Homepage (consigliato)
- [ ] Stessa procedura ma:
  - URL: `https://aio-pulse.com/`
  - Method: HEAD
  - Check freq: 60s
  - Nessun keyword check

### Configura notifiche
- [ ] Sidebar → **Notifications** → **Channels** → verifica email + SMS
      abilitati

### Test reale dell'alert
- [ ] Apri `https://aio-pulse.com/api/health` in browser → JSON healthy
- [ ] Vercel dashboard → temporaneamente togli `UPSTASH_REDIS_REST_TOKEN`
- [ ] Redeploy
- [ ] `/api/health` ora ritorna `degraded` → BetterStack alerta in
      1-2 min con email + SMS ✅
- [ ] **Rimetti il token + redeploy** → recovery alert in 1-2 min

### Salva URL del monitor
- [ ] URL pagina BetterStack monitor: `https://___________________`

---

## STEP 3 — status.aio-pulse.com (BetterStack Status Page) 🔒 blocked by STEP 0 + 2

- [ ] Done on YYYY-MM-DD

### Pre-requisiti
- Monitor BetterStack configurato (STEP 2)
- Accesso al DNS provider del dominio

### Passi
- [ ] BetterStack → sidebar **Status pages** → **Create status page**
- [ ] Form:
  - Name: `AIO Pulse`
  - Subdomain temporaneo: lascia `aio-pulse.betteruptime.com`
  - Add monitors: spunta i 2 monitor del STEP 2
  - Aggregation: separate resources
- [ ] **Create status page**
- [ ] Verifica `https://aio-pulse.betteruptime.com` → badge verde

### Custom domain
- [ ] Status page settings → **Custom domain** → **Enable**
- [ ] Inserisci: `status.aio-pulse.com`
- [ ] BetterStack mostra:
  - CNAME `status` → `proxy.betteruptime.com` (copia valore esatto)
  - TXT record opzionale per ownership
- [ ] Vai sul DNS provider → aggiungi CNAME:
  - Name: `status`
  - Target: `proxy.betteruptime.com`
  - TTL: Auto (o 3600)
  - **Se Cloudflare**: proxy OFF (cloud grigio, non arancione)
- [ ] Torna su BetterStack → **Verify**
- [ ] Aspetta 1-15 min propagazione → **Verify** di nuovo
- [ ] BetterStack provisiona SSL → pollice verde ✅
- [ ] `https://status.aio-pulse.com` raggiungibile con SSL valido

### Update footer codice
- [ ] Dimmi quando il subdomain è up → io aggiorno il link "Status" nel
      footer del repo (in `src/app/HomeContent.tsx`)

---

## STEP 4 — Email aliases `support@` / `security@` / `dpo@` / `legal@` 🔒 blocked by STEP 0 (dominio)

- [ ] Done on YYYY-MM-DD

### Pre-requisiti
- Google Workspace (o Microsoft 365) connesso al dominio `aio-pulse.com`
- MX records già puntati a Google

### Se NON hai ancora Workspace su aio-pulse.com
- [ ] https://workspace.google.com → "Start free trial"
- [ ] Verify domain ownership via TXT record
- [ ] Setup MX records (Google te li dà — `aspmx.l.google.com` etc.)
- [ ] Crea il tuo primary account `lorenzo@aio-pulse.com`
- [ ] Plan: Business Starter $6/utente/mese sufficiente

### Setup gli alias come Groups
- [ ] https://admin.google.com → login admin
- [ ] Sidebar → **Directory** → **Groups** → **Create group**

#### a. Support
- [ ] Group name: `Support`
- [ ] Group email: `support@aio-pulse.com`
- [ ] Description: "General customer questions, billing, account help"
- [ ] Members: te (+ team)
- [ ] **Posting permissions: Anyone on the internet** ✅ critico
- [ ] Save

#### b. Security
- [ ] Group email: `security@aio-pulse.com`
- [ ] Description: "Vulnerability disclosure, security inquiries"
- [ ] Members: solo te + security-conscious people
- [ ] **Posting permissions: Anyone on the internet**
- [ ] Save

#### c. DPO
- [ ] Group email: `dpo@aio-pulse.com`
- [ ] Description: "GDPR rights requests, data protection officer"
- [ ] Members: te (+ DPO se non sei tu)
- [ ] **Posting permissions: Anyone on the internet**
- [ ] Save

#### d. Legal
- [ ] Group email: `legal@aio-pulse.com`
- [ ] Description: "DPA, contracts, legal inquiries"
- [ ] Members: te (+ legale)
- [ ] **Posting permissions: Anyone on the internet**
- [ ] Save

### Auto-responder (consigliato per support@)
- [ ] Gmail → ⚙️ → See all settings → **Filters and Blocked Addresses**
- [ ] Create new filter:
  - To: `support@aio-pulse.com`
  - Action: Send canned response (crearne uno con: "Thanks for reaching
    AIO Pulse Support. We'll get back to you within 24 hours.")
- [ ] Stesso pattern per `security@` (response: "Disclosure received,
      response within 48h") e `dpo@` ("GDPR request received, response
      within the 30-day deadline")

### Verifica
- [ ] Da gmail personale → invia test a `support@aio-pulse.com` →
      arriva nella tua inbox entro 30s
- [ ] Stesso test per `security@`, `dpo@`, `legal@`

---

## STEP 5 — Vercel Log Drain → BetterStack Logs 🔒 blocked by STEP 0 (deploy Vercel)

- [ ] Done on YYYY-MM-DD

### Pre-requisiti
- Account BetterStack attivo (STEP 2)
- Progetto Vercel `aio-pulse-advance` deployato (STEP 0)
- ⚠️ Log Drains richiede **Vercel Pro tier ($20/mese)** per
      Production. Su Hobby non disponibile → usa Axiom (vedi alt sotto)

### Setup BetterStack Logs
- [ ] BetterStack → sidebar **Logs**
- [ ] **Connect source** → cerca **Vercel**
- [ ] Form:
  - Source name: `aio-pulse-production`
  - Platform: Vercel
  - Data region: **EU** (GDPR)
- [ ] BetterStack genera:
  - Endpoint URL `https://in.logs.betterstack.com/...`
  - Source token (long string)
- [ ] **Copia entrambi** temporaneamente
- [ ] Click **Create source**

### Setup Vercel Log Drain
- [ ] Vercel → team → **Settings** → **Log Drains**
- [ ] **Add Log Drain**
- [ ] Form:
  - Source: `aio-pulse-advance`
  - Filter Stdout: ✅
  - Filter Stderr: ✅
  - Filter Edge Logs: ✅
  - Filter External: ❌
  - Endpoint: paste URL BetterStack
  - Headers → Add: `Authorization` = `Bearer <SOURCE_TOKEN>`
  - Sampling Rate: 100%
- [ ] **Create Log Drain** → Vercel manda test event
- [ ] Verifica delivery con tick verde

### Verifica funziona
- [ ] Apri `https://aio-pulse.com/api/health` → genera un log
- [ ] BetterStack → Logs → vedi entry entro 30s
- [ ] Filtra `level:error` → poche/zero entry (good signal-to-noise)

### Setup alert spike errori
- [ ] BetterStack → Logs → **Alerts** → **Create alert**
- [ ] Condition: `level = "error" AND count > 10 in last 5 minutes`
- [ ] Notify: email + SMS
- [ ] Save

### Alternativa Axiom (se Vercel Hobby tier)
- [ ] https://app.axiom.co → Sign up
- [ ] Create dataset `aio-pulse-vercel`
- [ ] https://vercel.com/integrations/axiom → Add Integration
- [ ] Select team + projects + dataset → Authorize
- [ ] Logs streaming automatico, no env vars manuali
- [ ] Free tier Axiom = 500 GB/mese (vs BetterStack 1 GB/mese)

---

## ✅ Checklist finale post-completamento

Quando hai chiuso tutti gli step:

- [x] MFA Supabase attivo (data: 2026-05-28)
- [ ] Monitor BetterStack attivo (URL: __________)
- [ ] `status.aio-pulse.com` raggiungibile → dimmelo, aggiorno footer
- [ ] Email aliases attivi (test inviato a tutti e 4)
- [ ] Log drain Vercel → BetterStack/Axiom attivo (test event ricevuto)

### Attivazione finale MFA enforcement (dopo tutti gli step)

Quando MFA è impostato sul tuo account Supabase **E** vuoi forzarlo a
livello applicazione per le route sensibili (`/dashboard/org`,
`/dashboard/billing`, `/dashboard/audit-logs`):

```bash
vercel env add AIO_REQUIRE_MFA production
# value quando chiede: true
vercel --prod  # redeploy
```

Il middleware in `src/middleware.ts` legge questo flag — se `true`,
redirige a `/auth/mfa` per AAL2 challenge. Se `false` o assente, MFA è
solo "available", non enforced.

### Update runbook dates

Apri [docs/runbooks/ADMIN_ACTIONS_CHECKLIST.md](docs/runbooks/ADMIN_ACTIONS_CHECKLIST.md)
e sostituisci i `YYYY-MM-DD` con le date reali → committa.

```bash
git add docs/runbooks/ADMIN_ACTIONS_CHECKLIST.md
git commit -m "ops: close admin actions checklist — all tasks done"
git push origin main
```

**Score finale: 100/100** 🎯

---

## ⏱️ Tempi stimati

| Step | Tempo attivo | Tempo totale (incl. propagazione) |
|------|--------------|-----------------------------------|
| 0    | 30-45 min    | 1-2 h (DNS propagation)           |
| 1    | 5 min        | 5 min                             |
| 2    | 12-15 min    | 15 min                            |
| 3    | 10 min       | 30-60 min (DNS)                   |
| 4    | 10-15 min    | 30-60 min (se Workspace da zero)  |
| 5    | 10-12 min    | 15 min                            |
| **TOT** | **~80 min** | **3-4 ore** (calendario)       |

---

## 🔗 Riferimenti runbook

- [docs/runbooks/README.md](docs/runbooks/README.md) — indice
- [docs/runbooks/ADMIN_ACTIONS_CHECKLIST.md](docs/runbooks/ADMIN_ACTIONS_CHECKLIST.md) — versione canonica (questo file è il tuo TODO operativo)
- [docs/runbooks/SLA_TARGETS.md](docs/runbooks/SLA_TARGETS.md) — RPO/RTO
- [docs/runbooks/SECRETS_ROTATION.md](docs/runbooks/SECRETS_ROTATION.md) — inventory completo secrets per STEP 0
- [docs/runbooks/INCIDENT_RESPONSE.md](docs/runbooks/INCIDENT_RESPONSE.md) — playbook quando le cose vanno male
