# AIO Pulse Advance — Deployment Handoff (2026-05-29)

> Status efter deploy-session. Skriven för teamet (Rebecca + Lorenzo).
> Live: **https://aeo-pulse.savantmedia.se**

---

## 1. Sammanfattning

AIO Pulse (advance) är klonad, deployad till Vercel och live på en egen subdomän
med giltigt SSL. Appen fungerar (DB + rate limiting connected). Cron-jobben är
registrerade men kräver en kodfix innan de kör skarpt (se §5 — Lorenzos del).

| Område | Status |
|--------|--------|
| App live (SSL) | ✅ https://aeo-pulse.savantmedia.se (HTTP 200) |
| Vercel-projekt | ✅ `savant-media1/aio-pulse-advance` (`prj_wZHklZf7iXqNbePdzp1blwiJ1GF5`) |
| Supabase | ✅ "aio advance" (`ncnxsathmuhggliuayjx`, eu-west-1) |
| Env-vars (25 st) | ✅ satta i prod/preview/dev |
| Upstash Redis (ratelimit) | ✅ connected |
| Google Search Console | ✅ verifierad (Domän-property på subdomän) |
| Sitemap | ✅ /sitemap.xml → rätt domän |
| Cron-jobb | ⚠️ registrerade men kräver kodfix (§5) |
| GitHub auto-deploy | ❌ ej kopplad (se §6) |

---

## 2. Vad som är gjort (klart)

### Infrastruktur
- **Repo klonat:** `lorenzo-savant/aio-pulse-advance` → `~/projekt/aeo/aio-pulse-advance/`
- **Vercel-projekt skapat:** `savant-media1/aio-pulse-advance`, deploy via CLI
- **Custom domän kopplad:** `aeo-pulse.savantmedia.se`
  - DNS hostas hos **one.com** (ns01/ns02.one.com) — INTE Vercel
  - Poster i one.com:
    - `A`   `aeo-pulse` → `76.76.21.21` (pekar på Vercel)
    - `TXT` `aeo-pulse` → `google-site-verification=4h3MquAz-2T2UnD43UPKPK0sd9NJxohnRxiX-Ch0Fs4`
    - `TXT` `_vercel`   → `vc-domain-verify=aeo-pulse.savantmedia.se,3dd8bf319182c760eb2c`
  - Domänen verifierad + kopplad till projektet via Vercel API (`v10/projects/.../domains`)
    eftersom CLI `domains add` gav 403 (apex savantmedia.se ligger ej i Vercel)
  - SSL utfärdat automatiskt

### Tjänster
- **Supabase:** projekt "aio advance" (`ncnxsathmuhggliuayjx`)
- **Upstash Redis:** `working-treefrog-95810.upstash.io` (rate limiting/cache) — verifierad connected
- **Google Search Console:** `aeo-pulse.savantmedia.se` verifierad som Domän-property via DNS-TXT

### Konfiguration
- **25 env-vars** satta i Vercel (prod/preview/dev) — se §4
- **`.vercelignore`** tillagd → lokala `.env` laddas INTE upp vid deploy (best practice)
- **Sitemap-fix:** `NEXT_PUBLIC_APP_URL` korrigerad till subdomänen (styr sitemap + mail-länkar)
- **`CRON_SECRET`** tillagd (= `CRON_SECRET_TOKEN`) — löser auth-delen av cron-fixen

---

## 3. Hur teamet synkar (VIKTIGT)

Det finns två lager — kod och hemligheter — som synkas på olika sätt.

### A) Kod → via Git
Repo: `https://github.com/lorenzo-savant/aio-pulse-advance`
- Vanligt `git pull` / `git push`. Enda infra-ändringen från deploy-sessionen
  (`.vercelignore` + denna fil) ligger på branchen `chore/vercel-deploy-setup`.

### B) Hemligheter / env-vars → via Vercel (ALDRIG via git/chat)
`.env` är gitignored och laddas inte upp någonstans. Den delas INTE manuellt.
Alla env-vars bor i Vercel och hämtas identiskt av varje teammedlem:

```bash
# en gång per maskin:
npm i -g vercel
vercel login
cd aio-pulse-advance
vercel link            # välj scope: savant-media1, projekt: aio-pulse-advance

# hämta alla env-vars lokalt (skapar .env.local med exakt samma värden som prod):
vercel env pull .env.local
```

> ⚠️ **Lorenzo måste bjudas in till Vercel-teamet `savant-media1` först.**
> Just nu är bara `rebecca@savantmedia.se` (OWNER) medlem. Utan inbjudan kan
> Lorenzo varken se projektet eller köra `vercel env pull`.
> Bjud in: Vercel → Team Settings → Members → Invite → lorenzos mail (roll: Member).

### C) Master-källa för nycklar
Alla rånycklar finns även i `~/Desktop/Claude Code/.env` (med `AIO_PULSE_`-prefix)
hos Rebecca. Det är den manuella källan; Vercel är sanningen för deployen.

---

## 4. Env-variabler (namn — värden finns i Vercel)

Satta (prod/preview/dev):
```
NEXT_PUBLIC_SUPABASE_URL          SUPABASE_SERVICE_KEY        ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY     SUPABASE_PROJECT_ID         GROQ_API_KEY
NEXT_PUBLIC_APP_URL               OPENAI_API_KEY              RESEND_API_KEY
ENCRYPTION_KEY                    GEMINI_API_KEY              RESEND_FROM_EMAIL
CRON_SECRET_TOKEN                 PERPLEXITY_API_KEY          BRAVE_API_KEYS
CRON_SECRET                       BRAVE_MONTHLY_LIMIT         DATAFORSEO_LOGIN
WEBHOOK_SIGNING_SECRET            DATAFORSEO_KEY              DATAFORSEO_MONTHLY_CAP_CENTS
GSC_ACCESS_TOKEN                  GSC_REFRESH_TOKEN           UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

EJ satta (frivilliga — ger health-status "degraded" men blockerar inte):
```
STRIPE_SECRET_KEY        STRIPE_WEBHOOK_SECRET     (billing/credits)
SENTRY_AUTH_TOKEN        (source maps i Sentry)
GSC_SITE_URL             (appens egna GSC-integration)
```

Gotcha att känna till:
- **`CRON_SECRET` måste = `CRON_SECRET_TOKEN`** (Vercel bifogar `CRON_SECRET` som Bearer; appen jämför mot `CRON_SECRET_TOKEN`).
- **`.env`-filen får inte upp till Vercel** (därav `.vercelignore`) — annars läser Next.js den vid bygget och kan överrida Vercels env.

---

## 5. Kvarstår för Lorenzo (KODFIX)

Cron-jobben (10 st) är registrerade i produktions-deployen och Pro-planen tillåter
dem, MEN de kör inte skarpt p.g.a. tre saker i koden:

### 5.1 Metod-mismatch (kritiskt) → 405
Vercel-cron anropar alltid med **GET**, men dessa routes exporterar bara **POST**:
```
/api/cron/monitoring        /api/cron/digest          /api/cron/gsc-sync
/api/cron/brightdata-sync   /api/cron/keyword-refresh /api/cron/weekly-review
/api/cron/report-delivery
```
(Endast `/api/cron/aeo-bridge` har redan både GET + POST.)
**Fix:** lägg till en `GET`-handler i varje route som delegerar till samma logik
som `POST` (auth via `verifyCronAuth` i `src/lib/cron-auth.ts` fungerar för båda).

### 5.2 Saknad route (kritiskt) → 404
`vercel.json` schemalägger `/api/cron/geo-analysis` men `src/app/api/cron/geo-analysis/route.ts`
**saknas**. **Fix:** bygg routen, eller ta bort cron-posten ur `vercel.json` tills den finns.

### 5.3 Överbliven route (städning)
`src/app/api/cron/report-delivery/route.ts` finns men är **inte** schemalagd i `vercel.json`.
Lägg till i schema om den ska köras, annars lämna som manuell/extern endpoint.

### 5.4 Efter kodfix
- `CRON_SECRET` är redan satt i Vercel → ingen env-ändring behövs.
- Redeploya produktion: `vercel deploy --prod` (eller via git push om auto-deploy kopplas, §6).
- Verifiera: cron-anrop ska ge 200, inte 405/401. Testa lokalt:
  `curl -H "Authorization: Bearer <CRON_SECRET_TOKEN>" https://aeo-pulse.savantmedia.se/api/cron/monitoring`

---

## 6. GitHub auto-deploy (valfritt nästa steg)

Auto-deploy vid `git push` är INTE kopplad — repot ligger under Lorenzos GitHub-konto
och Vercel-appen (savant-media1) saknar åtkomst. Idag deployas via `vercel deploy --prod` (CLI).

För push-to-deploy, välj ett:
- **Lorenzo** installerar Vercels GitHub-app på `lorenzo-savant/aio-pulse-advance` och
  kopplar repot till projektet i Vercel (Settings → Git).
- eller forka/flytta repot till ett Savant Media-org och koppla det.

---

## 7. Snabbreferens

| Sak | Värde |
|-----|-------|
| Live-URL | https://aeo-pulse.savantmedia.se |
| Vercel-projekt | savant-media1/aio-pulse-advance |
| Vercel-projekt-ID | prj_wZHklZf7iXqNbePdzp1blwiJ1GF5 |
| Supabase-projekt | ncnxsathmuhggliuayjx ("aio advance") |
| Upstash | working-treefrog-95810.upstash.io |
| DNS-host | one.com (savantmedia.se) |
| Health-check | https://aeo-pulse.savantmedia.se/api/health |
| Sitemap | https://aeo-pulse.savantmedia.se/sitemap.xml |
