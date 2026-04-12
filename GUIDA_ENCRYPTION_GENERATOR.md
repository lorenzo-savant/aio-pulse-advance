# Guida Encryption Generator

Guida pratica per generare, gestire e ruotare i secret crittografici usati da AIO Pulse.

---

## 1. Secret richiesti dall'applicazione

Il progetto utilizza 3 secret distinti, tutti **256-bit random in formato esadecimale** (64 caratteri). Sono definiti in `.env.local` (sviluppo) e nelle Environment Variables di Vercel (produzione).

| Variabile | Scopo | Usata da |
|---|---|---|
| `CRON_SECRET_TOKEN` | Autentica le chiamate agli endpoint `/api/cron/*` | `src/app/api/cron/monitoring/route.ts`, `.../digest/route.ts`, `.../weekly-review/route.ts`, `.../aeo-bridge/route.ts` |
| `ENCRYPTION_KEY` | Cripta le API key degli utenti salvate in Supabase (tabella `user_api_keys`) | Archive Export System — le chiavi criptate sono irrecuperabili se si perde o si cambia questa |
| `WEBHOOK_SIGNING_SECRET` | Firma HMAC-SHA256 dei webhook in uscita verso i subscriber | `src/lib/services/webhook-delivery.ts` |

---

## 2. Comandi di generazione

Scegli **una** delle opzioni in base agli strumenti che hai installati.

### Opzione 1 — Node.js (un comando per volta)

Il modo più semplice se hai Node installato (già presente perché il progetto gira su Next.js).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lancia questo comando **3 volte** e copia ogni output rispettivamente in `CRON_SECRET_TOKEN`, `ENCRYPTION_KEY`, `WEBHOOK_SIGNING_SECRET`.

### Opzione 2 — Node.js (tutti e 3 insieme, pronti da incollare)

```bash
node -e "const c=require('crypto'); ['CRON_SECRET_TOKEN','ENCRYPTION_KEY','WEBHOOK_SIGNING_SECRET'].forEach(k=>console.log(k+'='+c.randomBytes(32).toString('hex')))"
```

Output tipo:
```
CRON_SECRET_TOKEN=a1b2c3...
ENCRYPTION_KEY=d4e5f6...
WEBHOOK_SIGNING_SECRET=7890ab...
```

Copia-incolla diretto in `.env.local`.

### Opzione 3 — OpenSSL

Se preferisci uno strumento di sistema standard (disponibile su macOS, Linux, Git Bash su Windows):

```bash
openssl rand -hex 32
```

Lancia 3 volte.

### Opzione 4 — PowerShell nativo (Windows, senza Node né OpenSSL)

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

> ⚠️ `Get-Random` di PowerShell **non è crittograficamente sicuro** per uso in produzione. Usa questa opzione solo in sviluppo locale. Per produzione preferisci Opzione 1, 2 o 3.

### Opzione 5 — PowerShell crittografico (Windows)

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
```

Questa versione usa un CSPRNG ed è sicura anche per produzione.

---

## 3. Regole di gestione

### Rotazione

| Secret | Rigenerabile dopo il primo uso? | Impatto del cambio |
|---|---|---|
| `CRON_SECRET_TOKEN` | ✅ Sì, quando vuoi | Aggiornare contestualmente su Vercel Cron / scheduler esterni che chiamano gli endpoint |
| `WEBHOOK_SIGNING_SECRET` | ✅ Sì | I subscriber dei webhook dovranno aggiornare la loro chiave di verifica — coordinare il cambio |
| `ENCRYPTION_KEY` | ❌ **NO — trattare come immutabile** | Cambiarla rende **irrecuperabili** tutte le API key utente già criptate. Per ruotarla serve una migrazione: decripta tutto con la vecchia chiave, ri-cripta con la nuova, poi switch |

### Separazione ambienti

**Non riutilizzare mai gli stessi secret tra sviluppo e produzione.** Genera **due set distinti**:

- Set #1 → `.env.local` (dev, locale)
- Set #2 → Vercel Environment Variables → scope: Production

Se condividi lo stesso `ENCRYPTION_KEY` tra dev e prod, un leak dell'ambiente dev compromette anche i dati di produzione.

### Dove NON metterli

- ❌ `.env.example` — è committato in git
- ❌ `README.md`, commenti nel codice, issue/PR
- ❌ Screenshot, screen-share, log di chat
- ❌ Slack/Discord/email in plaintext
- ✅ `.env.local` (nel `.gitignore`)
- ✅ Vercel Environment Variables (cifrate at-rest)
- ✅ Password manager (1Password, Bitwarden) per backup

### Se un secret viene esposto

1. **Rigeneralo immediatamente** con uno dei comandi sopra.
2. Aggiorna `.env.local` e Vercel.
3. Per `CRON_SECRET_TOKEN`: aggiorna gli scheduler.
4. Per `WEBHOOK_SIGNING_SECRET`: notifica i subscriber e fornisci la nuova chiave.
5. Per `ENCRYPTION_KEY` esposta: **non cambiarla senza migrare i dati**. Valuta se forzare gli utenti a reinserire le loro API key (soluzione più pulita) oppure esegui una migrazione offline.

---

## 4. Template `.env.local`

Dopo aver generato i 3 secret, aggiungili a `.env.local` in questa sezione:

```env
# ─── Cron Jobs & Security ─────────────────────────────────────────── [REQUIRED]
CRON_SECRET_TOKEN=<output comando 1>
ENCRYPTION_KEY=<output comando 2>
WEBHOOK_SIGNING_SECRET=<output comando 3>
```

Per l'elenco completo delle altre env var richieste, consulta `.env.example`.

---

## 5. Verifica rapida

Dopo aver settato i secret, verifica che siano caricati correttamente:

```bash
# Dovrebbe stampare 64 (lunghezza hex = 32 byte * 2)
node -e "require('dotenv').config({path:'.env.local'}); console.log('CRON:', (process.env.CRON_SECRET_TOKEN||'').length); console.log('ENC:', (process.env.ENCRYPTION_KEY||'').length); console.log('WH:', (process.env.WEBHOOK_SIGNING_SECRET||'').length)"
```

Tutti e 3 devono stampare `64`. Se stampano `0` il secret non è settato; se stampano un altro numero è stato troncato o ha caratteri non-hex.
