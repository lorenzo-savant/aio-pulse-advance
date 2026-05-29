# Guide för Encryption Generator

Praktisk guide för att generera, hantera och rotera de kryptografiska hemligheter som AEO Pulse använder.

---

## 1. Hemligheter som applikationen kräver

Projektet använder 3 distinkta hemligheter, alla **256-bit random i hexadecimalt format** (64 tecken). De definieras i `.env.local` (utveckling) och i Vercels Environment Variables (produktion).

| Variabel | Syfte | Används av |
|---|---|---|
| `CRON_SECRET_TOKEN` | Autentiserar anropen till endpoints `/api/cron/*` | `src/app/api/cron/monitoring/route.ts`, `.../digest/route.ts`, `.../weekly-review/route.ts`, `.../aeo-bridge/route.ts` |
| `ENCRYPTION_KEY` | Krypterar användarnas API-nycklar sparade i Supabase (tabellen `user_api_keys`) | Archive Export System — de krypterade nycklarna är oåterkalleliga om denna förloras eller ändras |
| `WEBHOOK_SIGNING_SECRET` | HMAC-SHA256-signering av utgående webhooks mot subscribers | `src/lib/services/webhook-delivery.ts` |

---

## 2. Genereringskommandon

Välj **ett** av alternativen baserat på vilka verktyg du har installerade.

### Alternativ 1 — Node.js (ett kommando i taget)

Enklaste sättet om du har Node installerat (redan tillgängligt eftersom projektet körs på Next.js).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kör detta kommando **3 gånger** och kopiera varje output till respektive `CRON_SECRET_TOKEN`, `ENCRYPTION_KEY`, `WEBHOOK_SIGNING_SECRET`.

### Alternativ 2 — Node.js (alla 3 tillsammans, redo att klistra in)

```bash
node -e "const c=require('crypto'); ['CRON_SECRET_TOKEN','ENCRYPTION_KEY','WEBHOOK_SIGNING_SECRET'].forEach(k=>console.log(k+'='+c.randomBytes(32).toString('hex')))"
```

Output av typen:
```
CRON_SECRET_TOKEN=a1b2c3...
ENCRYPTION_KEY=d4e5f6...
WEBHOOK_SIGNING_SECRET=7890ab...
```

Kopiera-klistra direkt in i `.env.local`.

### Alternativ 3 — OpenSSL

Om du föredrar ett standard systemverktyg (tillgängligt på macOS, Linux, Git Bash på Windows):

```bash
openssl rand -hex 32
```

Kör 3 gånger.

### Alternativ 4 — Nativt PowerShell (Windows, utan Node eller OpenSSL)

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

> ⚠️ PowerShells `Get-Random` **är inte kryptografiskt säker** för produktionsbruk. Använd endast detta alternativ i lokal utveckling. För produktion, föredra Alternativ 1, 2 eller 3.

### Alternativ 5 — Kryptografiskt PowerShell (Windows)

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
```

Denna version använder en CSPRNG och är säker även för produktion.

---

## 3. Hanteringsregler

### Rotation

| Hemlighet | Går att regenerera efter första användning? | Påverkan av byte |
|---|---|---|
| `CRON_SECRET_TOKEN` | ✅ Ja, när du vill | Uppdatera samtidigt på Vercel Cron / externa schedulers som anropar endpoints |
| `WEBHOOK_SIGNING_SECRET` | ✅ Ja | Webhook-subscribers måste uppdatera sin verifieringsnyckel — koordinera bytet |
| `ENCRYPTION_KEY` | ❌ **NEJ — behandla som oföränderlig** | Att ändra den gör alla redan krypterade användar-API-nycklar **oåterkalleliga**. För att rotera den krävs en migrering: dekryptera allt med den gamla nyckeln, kryptera om med den nya, sedan switch |

### Miljöseparation

**Återanvänd aldrig samma hemligheter mellan utveckling och produktion.** Generera **två distinkta uppsättningar**:

- Uppsättning #1 → `.env.local` (dev, lokalt)
- Uppsättning #2 → Vercel Environment Variables → scope: Production

Om du delar samma `ENCRYPTION_KEY` mellan dev och prod komprometterar ett läckage av dev-miljön även produktionsdatan.

### Var de INTE ska placeras

- ❌ `.env.example` — den committas i git
- ❌ `README.md`, kommentarer i koden, issues/PR
- ❌ Skärmdumpar, skärmdelning, chattloggar
- ❌ Slack/Discord/e-post i plaintext
- ✅ `.env.local` (i `.gitignore`)
- ✅ Vercel Environment Variables (krypterade at-rest)
- ✅ Lösenordshanterare (1Password, Bitwarden) för backup

### Om en hemlighet exponeras

1. **Regenerera den omedelbart** med ett av kommandona ovan.
2. Uppdatera `.env.local` och Vercel.
3. För `CRON_SECRET_TOKEN`: uppdatera schedulers.
4. För `WEBHOOK_SIGNING_SECRET`: notifiera subscribers och tillhandahåll den nya nyckeln.
5. För exponerad `ENCRYPTION_KEY`: **ändra den inte utan att migrera datan**. Överväg att tvinga användarna att ange sina API-nycklar på nytt (renaste lösningen) eller utför en offline-migrering.

---

## 4. Mall för `.env.local`

Efter att du genererat de 3 hemligheterna, lägg till dem i `.env.local` i denna sektion:

```env
# ─── Cron Jobs & Security ─────────────────────────────────────────── [REQUIRED]
CRON_SECRET_TOKEN=<output comando 1>
ENCRYPTION_KEY=<output comando 2>
WEBHOOK_SIGNING_SECRET=<output comando 3>
```

För den fullständiga listan över övriga env var som krävs, se `.env.example`.

---

## 5. Snabbverifiering

Efter att du satt hemligheterna, verifiera att de laddas korrekt:

```bash
# Dovrebbe stampare 64 (lunghezza hex = 32 byte * 2)
node -e "require('dotenv').config({path:'.env.local'}); console.log('CRON:', (process.env.CRON_SECRET_TOKEN||'').length); console.log('ENC:', (process.env.ENCRYPTION_KEY||'').length); console.log('WH:', (process.env.WEBHOOK_SIGNING_SECRET||'').length)"
```

Alla 3 måste skriva ut `64`. Om de skriver ut `0` är hemligheten inte satt; om de skriver ut ett annat tal har den trunkerats eller har icke-hex-tecken.
