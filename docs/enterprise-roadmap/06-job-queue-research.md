# Job Queue per il lavoro LLM — ricerca (P1) — 2026-08-04

Istruttoria sull'item **P1** di [`05-hardening-2026-08.md`](05-hardening-2026-08.md):
_"Tutto il lavoro costoso (fan-out LLM, PDF, audit) gira inline nelle request …
**QStash** si integra con l'infra Upstash già presente"_.

Questo documento risponde a tre domande: **cosa è davvero rotto oggi**,
**se QStash è la scelta giusta**, e **qual è la prima fetta che lo dimostra**.
Nessuna modifica al codice, nessuna migrazione, nessun dato toccato.

**Metodo**: solo fonti primarie — documentazione ufficiale Upstash, Vercel,
Next.js, Supabase, e il codice di questo repo. Ogni affermazione ha un link o
un riferimento `file:riga`. Quello che non ho potuto verificare è elencato
in fondo, sezione [§7](#7--cosa-non-ho-potuto-verificare).

---

## 1. 📍 Lo stato attuale, letto dal codice

### 1.1 Dove gira davvero il lavoro costoso

| # | Superficie | File | Cosa esegue inline |
|---|-----------|------|--------------------|
| 1 | Cron monitoring | `src/app/api/cron/monitoring/route.ts` | Loop **seriale** sui prompt (L205), fan-out engine in parallelo (L250-252), insert DB + valutazione alert + `dispatchAlert` **seriali** (L254-362), poi snapshot citazioni per brand (L411-421) |
| 2 | Monitoring manuale | `src/app/api/monitoring/route.ts` | `Promise.all` su tutti gli engine (L246-345), poi upsert health score (L362), `calculateCitationSnapshots` (L388), `trackKeywords` (L404) — tutto **prima** di rispondere (L436) |
| 3 | Rerun workflow | `src/app/api/workflows/route.ts` | `await fetch('/api/monitoring')` (L327) e `await res.json()` (L340) |
| 4 | Altre superfici LLM | `advisor`, `analyze`, `sentiment`, `recommendations`, `prompts/suggestions`, `audit/fanout`, `reports/html` | Chiamata al router LLM dentro l'handler HTTP |

Il costo unitario: `runMonitoringCheck` fa **due** chiamate LLM sequenziali —
la simulazione engine (`src/lib/services/monitoring.ts:218-230`) e l'analisi
(L242-257) — più, se la risposta non contiene URL, una terza chiamata esterna
a Brave (L300). Con 4 engine per prompt ⇒ **fino a 8 chiamate LLM + 4 Brave
per singolo prompt**.

### 1.2 Le mitigazioni che esistono già (e funzionano)

Il roadmap item P1 va letto sapendo che il pass 2 di hardening ha già chiuso
una buona parte del problema. Elencarlo con precisione serve a non ri-risolvere
cose risolte:

| Mitigazione | Dove | Effetto reale |
|---|---|---|
| `maxDuration = 300` sui cron | `cron/monitoring/route.ts:140` (+ digest, weekly-review, report-delivery, keyword-refresh, gsc-sync, brightdata-sync, aeo-bridge) | Alza il budget dal default. Su Vercel oggi il default è **già** 300s su tutti i piani ([Vercel — Functions Limits](https://vercel.com/docs/functions/limitations)), quindi l'export è a costo zero ma non guadagna nulla rispetto al default |
| Fan-out engine parallelo | `cron/monitoring/route.ts:250-252` (`Promise.allSettled`), `monitoring/route.ts:246` (`Promise.all`) | Un prompt costa ~1 round-trip LLM di wall-clock, non 4 |
| Cap prompt/run | `cron/monitoring/route.ts:148-151` — `CRON_MONITORING_MAX_PROMPTS`, default 6, clamp 1–20 | Impedisce di sforare i 300s. **È il sintomo, non la cura** |
| `withLlmCache` — coalescing | `src/lib/services/llm-cache.ts:101,132-134,181-185` | Promise map **in-process**: due chiamate concorrenti identiche *nello stesso processo* condividono un round-trip |
| `withLlmCache` — TTL Redis | `llm-cache.ts:141-177` | Persiste tra lambda. Attivo **solo** sul pass di analisi (TTL 1h, `monitoring.ts:243-257`); il pass di simulazione ha `ttl 0` di proposito (`monitoring.ts:218-230`) perché è la misura stessa |
| Fail-closed sui crediti | `monitoring/route.ts:150-185` | Nessun lavoro LLM pagato se il gate crediti non è valutabile |

### 1.3 Cosa resta davvero irrisolto

Tolto tutto quanto sopra, il problema residuo **non è** "le funzioni sono
troppo corte". È:

1. **Il throughput è cappato da una costante, non dalla domanda.**
   3 esecuzioni cron/giorno (`vercel.json`: `0 6`, `0 12`, `0 18 * * *`)
   × 6 prompt = **18 esecuzioni prompt/giorno per l'intero sistema**, tutti i
   tenant insieme. Anche col clamp al massimo (20) restano 60/giorno. Il cap
   esiste perché tutto deve entrare in **una** invocazione da 300s.

2. **Non c'è nessuna nozione di equità tra tenant.** La query di selezione
   (`cron/monitoring/route.ts:175-182`) applica `.limit(MAX_PROMPTS_PER_RUN)`
   **senza `.order()`**. Quali 6 prompt vincono dipende dall'ordine di riga di
   Postgres. Un tenant con molti prompt scaduti può affamare gli altri, in modo
   non diagnosticabile.

3. **Un fallimento cron è definitivo.** Vercel documenta esplicitamente:
   _"Vercel will not retry an invocation if a cron job fails."_
   ([Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)).
   Se la lambda va in `FUNCTION_INVOCATION_TIMEOUT` al prompt 5 di 6, i prompt
   1-4 hanno risultati salvati, il 5 è a metà, il 6 non è mai partito, e
   `prompts.last_run_at` (L374) non è stato aggiornato per gli ultimi due — che
   quindi ritenteranno al giro dopo, mentre i primi quattro no. Il recupero è
   accidentale, non progettato.

4. **Il rerun è un 202 che mente.** `rerunWorkflowExecution`
   (`workflows/route.ts:299-349`) risponde `202 Accepted` (L347) ma solo **dopo**
   aver atteso l'intera esecuzione di `/api/monitoring` (`await fetch` L327 +
   `await res.json()` L340). Il chiamante paga il wall-clock completo. Inoltre
   la route non esporta `maxDuration`, quindi si affida al default di piattaforma.

5. **Il path cron non contabilizza crediti.** `consumeCreditsForQuery` è chiamato
   solo dal path manuale (`monitoring/route.ts:150`); `grep` su `src/app/api/cron/`
   non trova alcun riferimento a `consumeCredits*` / `deduct_credits`. Le
   esecuzioni schedulate spendono token dei provider senza toccare il ledger.
   Questo è un problema di prodotto che una coda **amplifica** se non lo si
   affronta prima di alzare i cap.

> **Formulazione onesta del problema P1**: non "il lavoro costoso gira dentro
> una request" (girerà dentro una request anche dopo), ma **"tutto il lavoro
> costoso gira dentro _la stessa_ request, senza retry, senza equità e senza
> un ledger di esecuzione affidabile"**.

---

## 2. 🔎 QStash — cosa dicono i doc ufficiali

### 2.1 Modello di consegna e semantica

| Aspetto | Comportamento documentato | Fonte |
|---|---|---|
| **Modello** | Middleman HTTP: si pubblica un messaggio verso una URL, QStash la chiama per conto tuo — _"acts as a middleman between you and an API to guarantee delivery, perform automatic retries on failure"_ | [Get Started](https://upstash.com/docs/qstash/overall/getstarted) |
| **Garanzia** | **At-least-once**, dichiarata testualmente: _"Since QStash has at least once delivery guarantee, there is a very small chance that a step will run twice. This is why we suggest idempotency."_ | [Workflow — Troubleshooting](https://upstash.com/docs/workflow/troubleshooting/general) |
| **Successo** | _"If you API responds with a status code between `200 - 299`, the task is considered successful and will be marked as `DELIVERED`"_ | [Debug / Logs](https://upstash.com/docs/qstash/howto/debug-logs) |
| **Stati** | `CREATED` → `ACTIVE` → `RETRY` / `ERROR` → `DELIVERED` / `FAILED`; più `CANCEL_REQUESTED`, `CANCELLED` | [Debug / Logs](https://upstash.com/docs/qstash/howto/debug-logs) |
| **Retry** | Default **3 retry**; _"The total number of deliveries is 1 (initial attempt) + retries"_. Override con `Upstash-Retries` | [Retry](https://upstash.com/docs/qstash/features/retry) · [API publish](https://upstash.com/docs/qstash/api/publish) |
| **Backoff** | `delay = min(86400, e ** (2.5*n))` secondi ⇒ ~12s, 2m28s, 30m8s, 6h7m, tetto 24h | [Retry](https://upstash.com/docs/qstash/features/retry) |
| **Header di attempt** | `Upstash-Retried` sulla request in ingresso, _"indicates how many times the request has been retried"_, parte da 0 | [Retry](https://upstash.com/docs/qstash/features/retry) |
| **Retry-After** | Rispetta `Retry-After`, `X-RateLimit-Reset` e simili (secondi, RFC1123, o durata tipo `6m5s`), _"you can only delay retries up to the maximum value of the default backoff algorithm, which is one day"_ | [Retry](https://upstash.com/docs/qstash/features/retry) |
| **Deduplica** | `Upstash-Deduplication-Id` oppure `Upstash-Content-Based-Deduplication: true` (hash di URL + body + header forwardati). _"The deduplication window is 10 minutes."_ Un duplicato riceve `202 Accepted` con l'id del messaggio originale invece di `201 Created` | [Deduplication](https://upstash.com/docs/qstash/features/deduplication) |
| **DLQ** | _"QStash automatically retries messages that fail due to a temporary issue but eventually stops and moves the message to a dead letter queue to be handled manually."_ Da console: **Retry** (ripubblica e rimuove dalla DLQ) o **Delete** | [DLQ](https://upstash.com/docs/qstash/features/dlq) |
| **Callback** | `Upstash-Callback` (invocata a ogni tentativo, con `status`, `body` base64, `retried`, `maxRetries`, `sourceMessageId`, `url`, `method`) e `Upstash-Failure-Callback` (_"when all the retries are exhausted"_, include `dlqId`) | [Callbacks](https://upstash.com/docs/qstash/features/callbacks) |
| **Schedule** | Header `Upstash-Cron`, espressioni cron standard, valutate in UTC salvo prefisso `CRON_TZ=` (tutte le timezone IANA). _"It can take up to 60 seconds for the schedule to be loaded on an active node and triggered for the first time."_ | [Schedules](https://upstash.com/docs/qstash/features/schedules) |
| **Flow control** | `Upstash-Flow-Control-Key` + `Upstash-Flow-Control-Value: parallelism=5,rate=10,period=1m`. _"The limits are applied per flow-control key, not per URL"_ e _"There are no limits to number of keys you can use"_ | [Flow Control](https://upstash.com/docs/qstash/features/flowcontrol) |
| **Queue (FIFO)** | _"Your messages will be queued without blocking the REST API and sent one by one in FIFO order"_, parallelismo default 1. La doc segnala che l'API Queue _"will be deprecated at some point"_ a favore di Flow Control | [Queues](https://upstash.com/docs/qstash/features/queues) |
| **Batch** | Endpoint `/v2/batch` / `batchJSON()`, destinazioni miste, header per-messaggio; se un messaggio fallisce _"that message will have an error response, but the other messages will still be sent"_ | [Batch](https://upstash.com/docs/qstash/features/batch) |
| **Redazione** | `Upstash-Redact-Fields` per non far comparire campi sensibili nei log | [API publish](https://upstash.com/docs/qstash/api/messages/create) |

### 2.2 Firma delle request

QStash firma ogni chiamata con un JWT nell'header `Upstash-Signature`, con
chiavi **current** e **next** per la rotazione senza downtime. Il claim `body`
è lo SHA-256 del corpo — da cui il vincolo operativo:
_"Ensure you use the raw body string as is"_ (ri-serializzare il JSON parsato
rompe la verifica).
([Signature](https://upstash.com/docs/qstash/howto/signature))

Per App Router esiste il wrapper diretto:

```ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

export const POST = verifySignatureAppRouter(async (req: Request) => { /* … */ })
```

con env `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
([Quickstart Vercel/Next.js](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs)).

### 2.3 Piani e limiti

Da [upstash.com/pricing/qstash](https://upstash.com/pricing/qstash) e
[docs — Pricing & Limits](https://upstash.com/docs/qstash/overall/pricing):

| | **Free** | **Pay as you go** | **Fixed 1M** | **Fixed 10M** |
|---|---|---|---|---|
| Prezzo | $0 | **$1 / 100K messaggi** | $180/mese | $420/mese |
| Max messaggi/giorno | 1.000 | Illimitati | 1M | 10M |
| Max dimensione messaggio | 1 MB | 10 MB | 50 MB | 50 MB |
| **Max parallelismo** | **10** | **100** | 200 | 1.000 |
| Max HTTP response duration | 15 min | 2 ore | 6 ore | 12 ore |
| Max delay | 7 giorni | 1 anno | Illimitato | Illimitato |
| Retention DLQ | 3 giorni | 7 giorni | 30 giorni | 3 mesi |
| Max schedule attivi | 10 | 1.000 | 10.000 | 50.000 |

Nota: non esiste un limite RPS sulle API di delivery; il throttling avviene via
**Max Parallelism** — i messaggi in eccesso vengono accodati, non persi
([Flow Control](https://upstash.com/docs/qstash/features/flowcontrol)).

---

## 3. ⚖️ Fit e frizione: QStash risolve il problema o lo sposta?

### 3.1 Il tetto vero resta quello di Vercel

QStash richiama **una URL HTTP**. Il lavoro gira quindi ancora in una Vercel
Function, con i suoi limiti ([Vercel — Functions Limits](https://vercel.com/docs/functions/limitations),
[Configuring duration](https://vercel.com/docs/functions/configuring-functions/duration)):

| | Default | Massimo | Extended maximum |
|---|---|---|---|
| Hobby | 300s | 300s | — |
| Pro | 300s | **800s** | **1800s** (30 min, beta) |
| Enterprise | 300s | 800s | 1800s (beta) |

- L'extended maximum >800s è **beta**, richiede configurazione per-funzione
  (non default di progetto) e runtime `nodejs20.x/22.x/24.x` o `python3.12–3.14`;
  Secure Compute e Static IPs non lo supportano.
- Payload massimo request **e** response: **4,5 MB** (`FUNCTION_PAYLOAD_TOO_LARGE`).
- `maxDuration` di Next.js ha come default letterale _"Set by deployment platform"_
  ([Next.js — Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)).

> Il commento a `cron/monitoring/route.ts:140` (`// 5 min (Vercel Pro) or 60s (Hobby)`)
> è **obsoleto** rispetto alla doc corrente: Hobby oggi ha 300s di default *e* di
> massimo. Correzione cosmetica, ma va fatta se si tocca il file.
> (Inciso: `vercel.json` dichiara 11 cron con schedule sub-giornaliere — es.
> `0 */6 * * *` e tre monitoring/giorno. Su Hobby _"Cron expressions that would run
> more frequently will fail during deployment"_
> ([Vercel — Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)),
> quindi il progetto è **necessariamente su Pro o superiore**: 800s sono
> disponibili, 1800s solo in beta.)

QStash lato suo consente una `Max HTTP response duration` di 15 min (Free) o 2 ore
(PAYG): **molto più lunga del limite Vercel**. Questo significa che, se non si
imposta `Upstash-Timeout`, QStash continua ad aspettare una risposta che Vercel
ha già ucciso a 300/800s — e l'orologio dei retry parte tardi.

### 3.2 Cosa QStash risolve davvero

Il guadagno **non** è "una funzione più lunga". È **"N funzioni corte invece di
una lunga"**:

| Problema §1.3 | Come lo chiude QStash |
|---|---|
| Throughput cappato a 18 prompt/giorno | Ogni prompt diventa un messaggio ⇒ una invocazione dedicata con il **suo** budget da 300s. Il cap smette di essere "quanto lavoro entra in 300s" e diventa "quanti publish entro in 300s" — con `/v2/batch` è un ordine di grandezza diverso |
| Nessuna equità tra tenant | La selezione diventa "enumera **tutti** i prompt scaduti e pubblicali"; l'ordine di consumo lo governa il flow control, non l'ordine di riga di Postgres |
| Nessun retry sul fallimento | 1 + `Upstash-Retries` consegne, backoff esponenziale, `Retry-After` rispettato, e DLQ per ciò che non passa — dove Vercel Cron _non ritenta mai_ |
| Rerun sincrono travestito da 202 | Il rerun diventa un publish: risposta immediata e onesta |
| Nessun rate limiting verso i provider LLM | `Upstash-Flow-Control-Key` per provider con `parallelism` — cosa che nessun `Promise.allSettled` può dare, perché è un limite **globale sulla flotta**, non per-invocazione |

### 3.3 Cosa QStash **non** risolve (e che va detto)

1. **Il lavoro costoso resta dentro una request HTTP.** Cambia solo *quale*
   request. Se una singola unità (1 prompt × 4 engine) dovesse superare 300s,
   QStash non aiuta: servirebbe spezzarla ancora (1 messaggio per coppia
   prompt×engine) o passare a un modello a step (§4.5, §4.4).

2. **Aggiunge una superficie pubblica.** Il consumer deve essere raggiungibile
   da Internet e protetto **solo** dalla firma. Oggi tutte le route di lavoro
   sono dietro sessione Supabase o `verifyCronAuth`; una route
   `/api/jobs/*` invertirebbe il modello: il payload firmato diventa una
   *capability*. Va progettata assumendo che l'autorizzazione **non** derivi
   più dal chiamante ma sia ri-derivata server-side da `promptId`/`brandId`.

3. **Il middleware del repo la strozza.** `src/middleware.ts:205-234` applica
   un rate limit **per IP a 100 req/min su ogni `/api/*`**, e `publicApiRoutes`
   è `[]` (L173), quindi ogni request `/api/*` esegue anche `supabase.auth.getUser()`
   (L264-266) — un round-trip di rete per consegna. Le consegne QStash arrivano
   da un insieme ristretto di IP Upstash: **collassano tutte nello stesso bucket**.
   Un fan-out sopra ~100 msg/min riceverebbe 429. Ironia utile: il 429 include
   `Retry-After` (L229) e QStash lo rispetta — quindi degrada invece di perdere
   messaggi, ma il throughput resta tappato al 100/min del middleware finché non
   si esenta `/api/jobs/*`.

4. **`withLlmCache` non protegge attraverso i retry.** Vedi §5 — è il punto più
   importante del documento.

5. **Il ledger crediti va deciso prima, non dopo.** Alzare i cap senza chiudere
   §1.3 punto 5 significa moltiplicare una spesa non contabilizzata.

---

## 4. 🔀 Alternative, confrontate onestamente

### 4.1 `waitUntil()` / `after()` — non è una coda

`waitUntil` da `@vercel/functions`, e da Next.js ≥15.1 il preferito `after()` da
`next/server`, spostano lavoro **dopo** la response. Ma la doc è esplicita:
_"Promises passed to `waitUntil()` will have the same timeout as the function
itself. If the function times out, the promises will be cancelled."_
([@vercel/functions API Reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)).

Nessuna durabilità, nessun retry, nessuna visibilità. Utile per il logging e le
scritture accessorie (`trackKeywords` a `monitoring/route.ts:404` è un candidato
legittimo per `after()`), **inutile** come coda.

- **Costo**: zero. **Cambia**: 1 import. **Failure mode**: lavoro perso in silenzio.

### 4.2 Vercel Cron — cosa è oggi

Trigger via **HTTP GET** sulla production deployment, user-agent `vercel-cron/1.0`,
header `x-vercel-cron-schedule`; sicurezza via `CRON_SECRET` iniettato come
`Authorization: Bearer` ([Cron Jobs](https://vercel.com/docs/cron-jobs),
[Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)) — che è
esattamente ciò che `src/lib/cron-auth.ts` verifica in tempo costante.

Limiti: 100 cron/progetto su tutti i piani; minimo **una volta al giorno** su
Hobby (precisione ±59 min), al minuto su Pro/Enterprise
([usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)).

I due fatti decisivi, testuali:
- _"Vercel will not retry an invocation if a cron job fails."_
- _"Cron job delivery is best effort … Cron delivery can also occasionally invoke
  the same scheduled run more than once. Because of this, cron jobs should be
  resilient to both missed runs and duplicate runs."_

Vercel raccomanda inoltre un **lock distribuito Redis** contro le esecuzioni
sovrapposte. Nota: il cron monitoring gira 3×/giorno con `maxDuration = 300`, quindi
la sovrapposizione oggi non è realistica — ma **lo diventa** appena si alzano
i cap. E Upstash Redis è già in dipendenza.

- **Costo**: incluso. **Cambia**: nulla. **Failure mode**: run persi *e* run
  duplicati, entrambi documentati come normali.

### 4.3 Vercel Queues

Esiste, è documentato, ed è **la sorpresa architetturalmente più interessante**
([Queues](https://vercel.com/docs/queues), [Concepts](https://vercel.com/docs/queues/concepts),
[Pricing & Limits](https://vercel.com/docs/queues/pricing)):

- _"Delivery is at-least-once, so consumers should be idempotent."_
- Consumer **non raggiungibili da Internet**: si dichiarano in `vercel.json` con
  un trigger `queue/v2beta` sotto `experimentalTriggers`; _"the function is
  completely air-gapped from the internet … you don't need to add authentication
  or authorization logic to your consumer functions"_. Elimina in blocco la
  frizione §3.3 punto 2 e 3.
- Idempotency key con finestra **pari alla vita del messaggio** (fino al TTL,
  max 7 giorni) — contro i 10 minuti di QStash.
- Visibility timeout default 60s, max 3.600s; retention 60s–7 giorni (default 24h);
  message size fino a 100 MB; concorrenza massima per consumer group configurabile.
- Retry automatici fino alla scadenza; _"For the first 32 delivery attempts,
  Vercel respects your configured retry delay. After 32 attempts, the system
  begins forcing exponential backoff"_.
- **Nessuna DLQ built-in**: _"Vercel Queues doesn't have a built-in dead-letter
  queue"_ — si gestisce a livello applicativo con l'handler `retry`.
- **Ordine solo approssimativo**: _"No FIFO guarantee."_
- Billing per operazione, metered a chunk di 4 KiB; i send con idempotency key
  costano **2×**.

Segnali di maturità da pesare: la pagina Queues è marcata `🔒 Permissions Required`,
il trigger si chiama `queue/v2beta` e sta sotto `experimentalTriggers`. Inoltre
_"Strict data residency … is not supported yet"_ — rilevante dato che
`src/app/trust/sub-processors/page.tsx` e `src/app/trust/page.tsx:193` dichiarano
esplicitamente localizzazione EU dei sub-processor e `vercel.json` pinna
`regions: ["arn1"]`.

- **Costo**: per operazione, su assi di billing nuovi. **Cambia**: `vercel.json`
  + una route consumer, **zero gestione firme**. **Failure mode**: beta, nessuna
  DLQ, residency non garantita.

### 4.4 Vercel Workflows

Costruito **sopra** Vercel Queues ([Workflows](https://vercel.com/docs/workflows),
[Pricing & Limits](https://vercel.com/docs/workflows/pricing)). Direttive
`'use workflow'` / `'use step'`, replay deterministico, `sleep()` da minuti a mesi.

- **Maximum run duration: No limit**; **Maximum `sleep` duration: No limit**;
  ma _"Max runtime of individual step: see Vercel Functions limits"_ — cioè
  **il singolo step resta dentro 300/800/1800s**. Esattamente lo stesso vincolo
  di §3.1, esposto onestamente.
- Limiti: 10.000 step/run, 25.000 eventi/run, payload 50 MB, replay max 240s,
  2 GB storage/run.
- Billing su tre assi: Workflow Events ($0,02/1K eventi, 50.000/mese inclusi su
  Hobby), Data Written ($0,50/GB, 1 GB incluso), Data Retained ($0,50/GB-mese,
  non disponibile su Hobby). **Più** Queues **più** il compute delle funzioni.
  Uno step normale produce 3 eventi (`step_created`, `step_started`, `step_completed`).
- Retention post-run: Hobby 1 giorno, Pro 7, Enterprise 30.

Ottimo se un giorno serve un pipeline multi-step con stato (es. audit → analisi →
PDF → email). **Sovradimensionato** per "esegui questo prompt su 4 engine".

### 4.5 Upstash Workflow

Stesso vendor di QStash, ci gira sopra ([Get Started](https://upstash.com/docs/workflow/getstarted)).
Il valore è la frase chiave: _"instead of the entire business logic, **each step**
can take up your serverless function execution duration"_ — ogni `context.run()`
è una request separata, quindi il budget da 300s si applica **per step** e
_"a failed step is retried individually without needing to re-run any previous steps"_.
At-least-once + DLQ.

È letteralmente la risposta al caso "un'unità di lavoro non entra in 300s", e non
richiede un vendor nuovo rispetto a QStash. Da tenere come **evoluzione**, non
come punto di partenza: introduce un modello di programmazione (replay
deterministico, idempotenza per step) che è un costo cognitivo reale.

### 4.6 Inngest

[inngest.com/pricing](https://www.inngest.com/pricing): Hobby gratis con 50k
esecuzioni/mese, **5 step concorrenti**, 500K eventi/mese. Pro **da $99/mese**
con 1M esecuzioni e concorrenza 100 (+$25 ogni 25). Enterprise custom.

Modello event-driven con step function, fan-out, concurrency/throttling
dichiarativi, replay. Tecnicamente il più ricco della lista per il caso
"fan-out con rate limit per provider". Ma: 5 step concorrenti sul piano gratuito
significa che il free tier non regge nemmeno il fan-out attuale a 4 engine ×
più prompt; e $99/mese è un ordine di grandezza sopra il costo QStash a questi
volumi. Aggiunge inoltre un sub-processor nuovo da dichiarare in `/trust`.

- **Failure mode**: dipendenza da un piano a pagamento per superare 5 concorrenze;
  vendor lock sul modello a step.

### 4.7 Trigger.dev

[trigger.dev/pricing](https://trigger.dev/pricing): Free $0 con $5 di credito/mese,
20 run concorrenti, 10 schedule, log retention 1 giorno. Hobby $10/mese ($10 credito,
50 concorrenti). Pro $50/mese ($50 credito, 200+ concorrenti). Compute
$0,0000169–$0,00068/secondo per macchina + $0,000025 per invocazione.

Il punto forte è dichiarato: _"Tasks can run for as long as you need, with no
timeouts."_ — perché i task **non girano su Vercel**, girano su worker gestiti da
loro. Questo è insieme il vantaggio (nessun limite di durata) e il costo: il
codice del task va deployato sulla loro infrastruttura, quindi si spacca il
modello "una codebase, un deploy" e si duplicano env/segreti (chiavi OpenAI,
Anthropic, service key Supabase) presso un terzo vendor.

- **Failure mode**: drift tra il deploy Vercel e il deploy Trigger; superficie
  di segreti duplicata; billing a consumo su secondi di compute (le attese I/O
  su LLM **si pagano**, a differenza dell'Active CPU di Vercel Fluid dove
  _"Waiting for I/O … does not count towards active CPU time"_).

### 4.8 Supabase-native (pg_cron + pgmq + Edge Functions)

- **Supabase Cron (`pg_cron`)**: _"can run anywhere from every second to once a
  year"_, può invocare SQL, funzioni DB, o HTTP/Edge Function. Ma le
  raccomandazioni ufficiali sono strette: _"For best performance, we recommend no
  more than 8 Jobs run concurrently"_ e _"Each Job should run no more than 10 minutes."_
  ([Supabase — Cron](https://supabase.com/docs/guides/cron))
- **Supabase Queues (`pgmq`)**: _"a Postgres-native durable Message Queue system
  with guaranteed delivery"_, con _"exactly once message delivery"_ **entro una
  visibility window configurabile** ([Queues](https://supabase.com/docs/guides/queues)).
  Attenzione a non leggere "exactly once" come esenzione dall'idempotenza: è
  esattamente-una-volta *dentro la finestra di visibilità*; scaduta quella, il
  messaggio torna disponibile. L'API è `send`/`read`/`pop`/`archive`/`delete`
  ([API](https://supabase.com/docs/guides/queues/api)) — **pull-based**: non
  esiste alcun dispatcher push.
- **Edge Functions**: memoria 256 MB, wall clock **150s (Free) / 400s (Paid)**,
  **CPU time 2s**, idle timeout 150s ([Limits](https://supabase.com/docs/guides/functions/limits)).

Il difetto strutturale per questo repo: **serve comunque un poller**. Su Vercel
il poller è un cron — cioè esattamente la cosa da cui stiamo scappando. L'alternativa
è portare il consumer su Edge Functions, il che significa riscrivere in Deno
`ai-router`, `monitoring`, `llm-cache`, `credits`, `alerts` — settimane di lavoro
e una seconda copia della logica di business, contro un problema che è di
scheduling, non di runtime.

Il pezzo **davvero utile** di questa famiglia è diverso e va segnalato:
`pgmq`/`pg_cron` sono la risposta giusta se un giorno serve una coda
transazionale nella **stessa transazione** delle scritture applicative
(outbox pattern). Non è il problema di P1.

### 4.9 Tabella di sintesi

| Opzione | Costo a questi volumi | Cosa cambia qui | Failure mode principale |
|---|---|---|---|
| `after()` / `waitUntil` | €0 | 1 import | Lavoro cancellato al timeout, in silenzio |
| Vercel Cron (status quo) | €0 | nulla | Nessun retry; run duplicati o mancanti documentati |
| **QStash** | **~€0** (free 1.000 msg/giorno; poi $1/100K) | 1 dep, 1 route consumer + firma, esenzione middleware | Superficie pubblica; dedup solo 10 min; retry ri-paga la chiamata LLM |
| Vercel Queues | per-operazione (4 KiB/op; 2× con idempotency key) | `vercel.json` + route consumer, **zero firme** | Beta (`v2beta`), nessuna DLQ, no strict residency |
| Vercel Workflows | eventi + data written + retained + Queues + compute | modello a step | Sovradimensionato; 3 assi di billing nuovi |
| Upstash Workflow | come QStash | modello a step sullo stesso vendor | Replay deterministico da rispettare |
| Inngest | $0 (max 5 concorrenti) → **$99/mese** | SDK + nuovo sub-processor | Free tier insufficiente al fan-out |
| Trigger.dev | $0 + $5 credito → **$50/mese** Pro | deploy separato su loro infra | Segreti duplicati; si paga l'attesa I/O |
| pgmq + pg_cron + Edge Fn | €0 (incluso Supabase) | riscrittura consumer in Deno | Serve comunque un poller; CPU 2s / wall 400s |

---

## 5. 🔁 At-least-once contro il double-spend guard

Questo è il punto in cui la scelta smette di essere un confronto di feature.

### 5.1 Perché `withLlmCache` **non** copre i retry

`withLlmCache` è documentato in `llm-cache.ts:11-14` come _"il double-spend guard:
un doppio click, un cron che si sovrappone a un run manuale, o un retry storm
costa UNA chiamata invece di N"_. È vero — **con un vincolo che i retry di una
coda violano per costruzione**:

| Livello | Riga | Scope | Regge un retry QStash? |
|---|---|---|---|
| Promise map `inflight` | `llm-cache.ts:101` | **In-process** (`new Map`), svuotata nel `finally` a L181 | **No.** Un retry arriva ~12s dopo (backoff `e^2.5`), su una lambda diversa, e comunque dopo che la promise è stata rimossa |
| TTL Redis | `llm-cache.ts:141-177` | Cross-lambda | **Solo dove è attivo.** Il pass **simulazione** ha `ttl 0` per scelta di prodotto (`monitoring.ts:218-230`) ⇒ **ogni retry ri-paga la chiamata all'engine**. Il pass **analisi** ha TTL 1h (`monitoring.ts:243-257`) ⇒ un retry entro l'ora è gratis, ma solo se `responseText` è identico — e non lo è, perché la simulazione è stata rifatta |

**Conseguenza netta**: con `Upstash-Retries` al default 3, il caso peggiore di un
endpoint che fallisce dopo aver completato il lavoro (es. timeout sulla scrittura
finale, o 429 del middleware **dopo** le chiamate LLM) è **4 consegne × 4 engine
× 1 simulazione pagata = 16 chiamate LLM per 1 prompt**. Più le scritture duplicate:
`monitoring_results` non ha vincolo di unicità su `(prompt_id, engine)` per run,
quindi ogni tentativo inserisce una riga nuova — che poi **falsa l'AVI**, perché
`calculateAVIFromResults` (`monitoring.ts:479-525`) normalizza su `results.length`.

E la deduplica QStash non aiuta: `Upstash-Deduplication-Id` deduplica **le
pubblicazioni**, entro 10 minuti
([Deduplication](https://upstash.com/docs/qstash/features/deduplication)). Un retry
**non è un duplicato**: è lo stesso messaggio riconsegnato per design. Protegge il
produttore, non il consumatore.

### 5.2 Strategia di idempotency key richiesta

Servono **tre** livelli, non uno:

**(a) Al publish — chiave deterministica, contro il doppio-enqueue.**
```
dedupId = sha256(`monitoring:${promptId}:${slotIso}`)
```
dove `slotIso` è la finestra di schedulazione (es. `2026-08-04T06:00Z`), non
`Date.now()`. Copre il caso "il cron è stato invocato due volte" — che Vercel
documenta come possibile ([Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)).
Attenzione al limite: **10 minuti**, quindi non copre due run cron distanti 6 ore
(cosa corretta: sono lavori diversi).

**(b) Al consumo — claim atomico prima di qualunque chiamata pagata.**
Il repo ha già il ledger giusto: `workflow_executions`. Oggi l'id è
`randomUUID()` (`cron/monitoring/route.ts:42`, `monitoring/route.ts:209`). Se per
i job in coda l'id diventa **UUIDv5 deterministico** dello stesso `jobKey`, allora
`INSERT` è il lock:

- insert riuscito ⇒ sono il primo tentativo, procedo;
- conflitto su PK **e** riga in stato terminale (`completed`/`failed`) ⇒ rispondo
  **200** subito, così QStash marca `DELIVERED` e **smette** di ritentare;
- conflitto e riga `running` più recente di `maxDuration` ⇒ rispondo 200 (un
  altro tentativo la sta lavorando): meglio perdere un retry che pagare due volte;
- conflitto e riga `running` più vecchia di `maxDuration` ⇒ il tentativo
  precedente è morto, la rivendico e procedo.

Additivo: nessuna colonna nuova, nessuna migrazione distruttiva. La riga
`workflow_executions` diventa *sia* la UI di avanzamento *sia* il record di
idempotenza — che è anche il motivo per cui è preferibile a una tabella `job_runs`
nuova.

**(c) Alla scrittura — unicità sui risultati.**
Un indice unico su `monitoring_results (prompt_id, engine, <slot>)` renderebbe la
duplicazione impossibile invece che improbabile. **Da verificare prima**: se
esistono già righe duplicate, la creazione dell'indice fallisce. Va sondato in
read-only, e comunque è additivo (`CREATE UNIQUE INDEX CONCURRENTLY`), mai
`DELETE`.

**(d) Segnali da usare, già disponibili.**
- `Upstash-Retried` in ingresso ⇒ ramo esplicito "questo è un ritentativo":
  logga a WARN, e non ripetere i side-effect non-idempotenti (`dispatchAlert`
  manda email — `cron/monitoring/route.ts:329`; una doppia consegna è visibile
  al cliente).
- `Upstash-Timeout` in uscita, impostato **appena sotto** il `maxDuration` della
  route (es. 290 su 300): altrimenti QStash aspetta il proprio default di piano
  (2h su PAYG) su una lambda già morta.
- `Upstash-Retries` **basso** (1–2, cioè 2–3 consegne totali). Il default 3 è
  tarato su chiamate gratuite; qui ogni consegna è denaro.
- `Upstash-Failure-Callback` ⇒ una route che scrive `workflow_executions` come
  `failed` con il `dlqId`. Senza, un job in DLQ resta invisibile nel prodotto.

**(e) Il gate crediti.**
Se il consumer riusa la logica di `monitoring/route.ts:150`, il claim (b) deve
avvenire **prima** di `consumeCreditsForQuery`, altrimenti ogni retry riaddebita.
Ordine corretto: `claim → crediti → LLM → risultati → stato terminale`.

---

## 6. ✅ Raccomandazione

### 6.1 La decisione

**Sì a QStash**, con una riformulazione dell'obiettivo: adottarlo come
**dispatcher di fan-out con retry e flow control**, non come "modo per far
girare lavoro lungo". Il lavoro resta ≤300s per unità, per scelta, non per
limitazione subita.

Il ragionamento, in chiaro:

1. **Il problema reale è il fan-out, non la durata.** Un prompt × 4 engine sta
   comodamente in 300s oggi (2 chiamate LLM sequenziali per engine, engine in
   parallelo). Ciò che non sta in 300s sono *N prompt insieme*. QStash è
   esattamente lo strumento per "N invocazioni invece di una".
2. **Costo marginale ≈ zero.** A 50 brand × 10 prompt × 3 run/giorno = 1.500
   messaggi/giorno ⇒ ~45.000/mese ⇒ **$0,45/mese** in PAYG. Inngest Pro ($99) e
   Trigger.dev Pro ($50) sono due ordini di grandezza sopra per un problema che
   oggi non li richiede.
3. **Zero vendor nuovi.** Upstash è già dipendenza (`@upstash/redis`,
   `@upstash/ratelimit` in `package.json`) ed è **già dichiarato** come
   sub-processor in `src/app/trust/sub-processors/page.tsx:80` e
   `src/app/trust/page.tsx:193`. Inngest e Trigger.dev richiederebbero un
   aggiornamento del Trust Center e una nuova valutazione GDPR.
4. **Maturità.** QStash è GA e documentato in dettaglio; Vercel Queues, che è
   architetturalmente **superiore** su due punti concreti (consumer air-gapped ⇒
   niente firme né esenzioni middleware; dedup per l'intera vita del messaggio
   invece di 10 minuti), è marcato `queue/v2beta` sotto `experimentalTriggers`,
   permission-gated, e senza strict data residency — che con un Trust Center
   pubblico che promette EU è un rischio da non prendere adesso.
5. **Il flow control è un beneficio che nessuna alternativa gratuita dà.**
   `parallelism` per chiave = rate limit **globale sulla flotta** verso OpenAI /
   Anthropic / Perplexity. Oggi non esiste: `Promise.allSettled` limita dentro
   un'invocazione, non tra invocazioni.

**Da riconsiderare tra 6 mesi** se: (a) Vercel Queues esce da beta con residency
garantita ⇒ è la scelta migliore per questo stack; (b) nasce un pipeline
multi-step con stato (audit → analisi → PDF → email) ⇒ Upstash Workflow, stesso
vendor, migrazione incrementale dalla base QStash.

### 6.2 La prima fetta — una sola route, misurabile

**Obiettivo**: `/api/cron/monitoring` smette di **eseguire** e comincia a
**accodare**. Nient'altro.

| # | Passo | Nota |
|---|---|---|
| 1 | `npm i @upstash/qstash`; env `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` in `.env.example` + Vercel | [Quickstart](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs) |
| 2 | Estrarre il corpo del loop per-prompt (`cron/monitoring/route.ts:215-408`) in `src/lib/services/monitoring-job.ts` — funzione pura `runPromptJob({promptId, slotIso})` | Nessun cambio di comportamento; testabile da solo |
| 3 | Nuova route `POST /api/jobs/monitoring-prompt` con `verifySignatureAppRouter`, `export const maxDuration = 300`, che chiama `runPromptJob` | Il body **raw** deve arrivare intatto alla verifica firma |
| 4 | **Esentare `/api/jobs/*` dal rate limiter IP del middleware** (`src/middleware.ts:205-234`), sostituendolo con la sola verifica firma | Altrimenti il fan-out si auto-strozza a 100/min (§3.3.3) |
| 5 | Il cron diventa produttore: enumera **tutti** i prompt scaduti (via `.order('last_run_at', {nullsFirst: true})` — la mancanza di `ORDER BY` a L175-182 è un bug di equità) e pubblica in batch con `client.batchJSON()` | [Batch](https://upstash.com/docs/qstash/features/batch) |
| 6 | Per messaggio: `Upstash-Deduplication-Id` = hash(promptId+slot); `Upstash-Retries: 2`; `Upstash-Timeout: 290s`; `Upstash-Flow-Control-Key: llm-monitoring` con `parallelism=5`; `Upstash-Failure-Callback` → `/api/jobs/monitoring-failed` | §2.1 |
| 7 | Idempotenza: `workflow_executions.id` = UUIDv5(promptId+slot), claim per insert (§5.2b), ordine `claim → crediti → LLM → risultati → terminale` | Additivo, nessuna migrazione |
| 8 | Tenere `vercel.json` invariato in questa fetta: lo scheduler resta Vercel Cron | Riduce il blast radius. Passare a `Upstash-Cron` è la fetta 3 |

**Come si dimostra che ha funzionato** (metriche, non impressioni):
- wall-clock di `/api/cron/monitoring` da ~decine di secondi a **< 2s** (solo
  query + batch publish);
- `CRON_MONITORING_MAX_PROMPTS` **eliminato**, non alzato — smette di esistere
  come concetto; prompt processati/giorno passa da 18 al numero reale di prompt
  scaduti;
- iniettando un fallimento su un engine, il retry appare nella console QStash e
  il job termina `completed` senza righe duplicate in `monitoring_results`;
- il costo LLM per run **non** cresce più del numero di prompt (prova che §5.2
  regge).

### 6.3 Cosa NON fare nella prima fetta

- **Non spostare `/api/monitoring`.** Restituisce i risultati in modo sincrono al
  frontend (`data.results`, L436-448); accodarlo è un breaking change della UI e
  richiede il canale realtime (`src/hooks/use-realtime.ts`) come sostituto. Fetta 2.
- **Non sostituire i cron di `vercel.json` con gli `Upstash-Cron`** finché la
  fetta 1 non è in produzione da almeno un ciclo settimanale. Due scheduler
  attivi insieme = doppia esecuzione.
- **Non alzare i cap senza chiudere prima §1.3 punto 5** (crediti non contabilizzati
  nel path cron). Una coda che funziona moltiplica una spesa che nessuno sta
  misurando.
- **Non toccare le altre 8 superfici LLM** (`advisor`, `analyze`, `sentiment`, …).
  Una route per volta, con la prova in mano.

---

## 7. ❓ Cosa non ho potuto verificare

| # | Domanda aperta | Perché resta aperta |
|---|---|---|
| 1 | **Valore massimo di `Upstash-Timeout`** e **massimo di `Upstash-Retries`** | La doc API descrive gli header ma _"does not specify exact maximum values"_ ([API publish](https://upstash.com/docs/qstash/api/publish), [messages/create](https://upstash.com/docs/qstash/api/messages/create)). Ho inferito il tetto dalla riga "Max HTTP Response Duration" della pricing page; la relazione tra le due non è dichiarata esplicitamente |
| 2 | **Residenza dei dati QStash** | Il body del messaggio conterrebbe `promptId`/`brandId` (e, se non progettato con cura, testo prompt). Non ho trovato una pagina ufficiale su regione/retention dei body QStash. Rilevante perché `/trust` dichiara Upstash come "EU (Frankfurt)" — ma quella riga si riferisce al **Redis**, non a QStash. **Da verificare prima di pubblicare qualunque payload non-opaco.** Mitigazione nota: `Upstash-Redact-Fields` per i soli log |
| 3 | **Retention dei log QStash per piano** | La doc rimanda alla pricing page ([Debug/Logs](https://upstash.com/docs/qstash/howto/debug-logs)), ma la tabella prezzi che ho letto espone `Max DLQ Retention`, non la retention dei log messaggio |
| 4 | **Limite di messaggi per singola richiesta `/v2/batch`** | Non documentato nella pagina Batch |
| 5 | **Blocchi IP delle consegne QStash** | Serve per decidere se esentare `/api/jobs/*` dal rate limiter per path (semplice) o per IP sorgente (più stretto ma richiede una lista pubblicata e stabile). Non trovata |
| 6 | **Piano Vercel effettivo del progetto** | **Dedotto**, non verificato: `vercel.json` dichiara cron sub-giornalieri, che su Hobby _"will fail during deployment"_ ⇒ Pro o superiore. Va confermato in dashboard, perché decide se 800s sono disponibili |
| 7 | **Esistenza di duplicati in `monitoring_results`** | Serve per sapere se l'indice unico di §5.2c è applicabile. Non sondato: la regola del repo è non toccare il DB in ricerca |
| 8 | **Disponibilità di Vercel Queues per questo team** | La pagina è marcata `🔒 Permissions Required: Vercel Queues`. Non ho potuto verificare se il team ha l'accesso, cosa che cambierebbe il peso relativo di §4.3 |
| 9 | **Durata massima delle funzioni Inngest** | La pricing page non la espone e non l'ho trovata in una pagina di limiti ufficiale |
| 10 | **Semantica formale di delivery di `pgmq`** | La pagina overview di Supabase dice "exactly once … within a customizable visibility window", ma la pagina API _"does not explicitly specify delivery guarantees"_. Ho preferito trattarla come at-least-once oltre la finestra |

**Nessuna fonte secondaria** (blog post, tutorial, thread) è stata usata come base
per un'affermazione. Un blog Upstash è comparso nei risultati di ricerca sul flow
control ma il contenuto riportato qui viene solo dalle pagine `docs.` e
`upstash.com/pricing/qstash`.

---

## Nota operativa

Questa è **ricerca**, non un piano approvato. Prima di aprire il branch servono
due decisioni di prodotto che il codice non può prendere:

1. **Chi paga le esecuzioni schedulate?** Oggi nessuno (§1.3.5). Una coda le
   moltiplica.
2. **Qual è il SLA per tenant?** Il cap a 6 prompt/run è, di fatto, un SLA
   implicito e casuale. Rimuovendolo va sostituito con uno esplicito, perché è
   quello che determina i parametri di `parallelism` e `rate` del flow control.

Le azioni da dashboard vendor (creazione progetto QStash, copia dei signing key
in Vercel) restano tracciate in `lorenzotodolist.md` come le altre.
