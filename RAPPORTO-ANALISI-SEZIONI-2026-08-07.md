# Rapporto analisi per sezione — AIO Pulse

**Data:** 2026-08-07
**Branch:** `chore/mcp-supabase-features`
**Ambito:** analisi statica e dinamica di ogni sezione/sottosezione della navigazione, alla ricerca di codice rotto, incongruenze e metriche da correggere.
**Modifiche applicate:** **NESSUNA.** Questo documento è solo diagnostico. Nessuna query, migrazione o edit è stato eseguito sul database o sul codice.

---

## 0. Stato di salute di base

| Controllo | Comando | Esito |
|---|---|---|
| Type check | `tsc --noEmit` | ✅ 0 errori |
| Unit test | `vitest run` | ✅ 1826 passati, 34 skipped, 125 file |
| Lint | `eslint .` | ⚠️ 167 warning, 0 errori |
| Copertura RLS | `check:rls` | ✅ 57/57 tabelle |
| Copertura Zod | `check:zod` | ✅ 57/57 handler di scrittura |
| Dead code | `knip` | ⚠️ 2 file, 30 export, 13 tipi, 1 dipendenza inutilizzati |

La base è solida: non ci sono rotture di compilazione né test rossi. **Tutti i problemi sotto sono logici o architetturali** — passano i test perché nessun test li copre.

---

## 🔴 CRITICO — 1 problema

### C1. Perdita dati: due writer in conflitto su `citation_snapshots`

Due funzioni scrivono la **stessa riga** con la **stessa chiave di conflitto** `(brand_id, scan_date, engine, category, language)`, ma con contenuti diversi.

**Writer "buono"** — [citation-snapshots.ts:160](src/lib/services/citation-snapshots.ts#L160)
Calcola e scrive valori reali:
- `avg_position` calcolato dalle menzioni posizionate ([riga 106-110](src/lib/services/citation-snapshots.ts#L106-L110))
- `competitor_rates` calcolato per ogni competitor con match a confine di parola ([riga 117-130](src/lib/services/citation-snapshots.ts#L117-L130))
- Scrive anche la combinazione `('all','all','all')` — confermato: `engineList`, `categories` e `languages` includono tutti `'all'` ([righe 81-83](src/lib/services/citation-snapshots.ts#L81-L83))

**Writer "distruttivo"** — [analytics-service.ts:358](src/lib/services/analytics-service.ts#L358)
Scrive la stessa riga `('all','all','all')` con:
```ts
avg_position: null,      // ← hardcoded, riga 368
competitor_rates: {},    // ← hardcoded vuoto, riga 371
```

**È un `upsert` con set di colonne completo, non un merge.** Chi scrive per ultimo vince: `avg_position` e `competitor_rates` calcolati vengono azzerati.

#### Percorsi di attivazione

| Chiamante | Guardia | Rischio |
|---|---|---|
| [analytics-service.ts:83](src/lib/services/analytics-service.ts#L83) (`getHistoricalAnalytics`) | ✅ solo se 0 snapshot nella finestra | Parziale — vedi sotto |
| [analytics-service.ts:265](src/lib/services/analytics-service.ts#L265) (`getCompetitorComparison`) | ✅ solo se 0 snapshot | Parziale |
| [analytics/historical/route.ts:77](src/app/api/analytics/historical/route.ts#L77) `GET ?action=generate` | ❌ **nessuna** | Alto |
| [analytics/historical/route.ts:181](src/app/api/analytics/historical/route.ts#L181) `POST` | ❌ **nessuna** | Alto |
| [analytics/historical/route.ts:162](src/app/api/analytics/historical/route.ts#L162) `POST {generate_all:true}` | ❌ **nessuna**, cicla su **tutti** i brand scrivibili | **Critico** |

Anche le due chiamate "protette" hanno una falla: la guardia interroga solo la **finestra temporale corrente** (ultimi 30/90 gg), ma `autoGenerateSnapshots` rigenera **tutte le date presenti negli ultimi 1000 `monitoring_results`** ([riga 329](src/lib/services/analytics-service.ts#L329)). Un brand con dati storici ma nessun risultato recente → la guardia passa → vengono riscritti anche gli snapshot vecchi, azzerandone posizione e competitor.

**Impatto:** perdita silenziosa e irreversibile di `avg_position` e `competitor_rates` storici. Nessun errore, nessun log.

**Nota:** è esattamente lo scenario di perdita dati da evitare. Va risolto **prima** di qualsiasi altro intervento, e prima di far girare di nuovo Analytics/Competitor su brand con storico.

**Direzione di fix (da validare, non applicata):** far scrivere `autoGenerateSnapshots` solo le colonne che effettivamente calcola, oppure eliminarlo del tutto e usare `calculateCitationSnapshots` come unico writer (calcola già un superset).

---

## 🟠 ALTO — metriche sbagliate o incoerenti

### M1. Normalizzazione della posizione: due scale diverse per lo stesso dato

Lo stesso `position_avg` viene normalizzato con due formule incompatibili.

| | Formula | File |
|---|---|---|
| **AVI** | `((20 − pos) / 19) × 100` | [monitoring.ts:604](src/lib/services/monitoring.ts#L604), `POSITION_SCALE_MAX = 20` |
| **GEO Score** | `((5 − pos) / 4) × 100` | [geo-score.ts:110](src/lib/services/geo-score.ts#L110) |

Divergenza concreta sullo stesso brand:

| `position_avg` | Pillar posizione AVI | Pillar posizione GEO |
|---|---|---|
| 1 | 100 | 100 |
| 3 | 89,5 | 50 |
| **5** | **78,9** | **0** |
| 10 | 52,6 | 0 |

**Ogni brand con posizione media ≥ 5 riceve 0/100 nel pillar posizione del GEO Score** (peso 15%), mentre l'AVI gli dà 78,9. Il GEO Score è sistematicamente depresso.

Aggravante: il commento a [geo-score.ts:104](src/lib/services/geo-score.ts#L104) afferma *"Mirrors the position normalization in calculateAVI: positions 1→100, 5+→0"*. **È falso** — l'AVI mappa 1→100 e 20+→0. Il commento documenta un allineamento che non esiste, quindi il bug è invisibile a chi legge.

Aggravante 2: il GEO Score usa i numeri magici `5` e `4` inline, l'AVI usa la costante `POSITION_SCALE_MAX`. Nessun legame tra i due.

### M2. AVI e GEO Score pesano gli stessi sei segnali in modo diverso

Due punteggi compositi headline, stessi input, pesi divergenti:

| Segnale | Peso AVI | Peso GEO |
|---|---|---|
| Citation rate | 20% | **30%** |
| Mention / presence | 20% | **25%** |
| Recommendation | 20% | 20% |
| Position | 15% | 15% |
| Sentiment | 15% | ┐ **10% combinati** |
| Hallucination | 10% | ┘ (media dei due) |

Fonti: [monitoring.ts:586-611](src/lib/services/monitoring.ts#L586-L611), [geo-score.ts:77-83](src/lib/services/geo-score.ts#L77-L83).

I due numeri divergeranno sempre e non c'è nulla nell'UI che spieghi perché. Se sono due lenti diverse va detto esplicitamente; se dovrebbero coincidere, uno dei due set di pesi è sbagliato.

*Nota positiva:* entrambi gestiscono l'assenza di dato in modo corretto e identico (peso ri-normalizzato, l'assenza non diventa mai un 50 finto). Quella parte è ben fatta.

### M3. Crawlability: robots.txt in minuscolo → punteggio 100 falso

`checkBotAccess` fa una lookup esatta sulla Map: `rules.rules.get(bot)` ([crawlability.ts:160](src/lib/services/crawlability.ts#L160)). Il parser salva lo user-agent **senza normalizzare il case** ([riga 119](src/lib/services/crawlability.ts#L119)). Ma per RFC 9309 il match degli user-agent in robots.txt è **case-insensitive**.

Verificato eseguendo il codice reale:

```
robots.txt:  user-agent: gptbot
             disallow: /

chiavi parsate : ["gptbot"]
bot bloccati   : (nessuno)          ← GPTBot è bloccato al 100%
score          : 100                ← dovrebbe essere 92
```

Esiste già la funzione `matchUserAgent` ([riga 57](src/lib/services/crawlability.ts#L57)) che gestirebbe case-insensitive e wildcard — **non è mai chiamata da nessuna parte**.

**Impatto:** il prodotto dice "tutti i crawler AI possono accedere" a un sito che li blocca. È il falso positivo peggiore possibile per questa metrica.

### M4. Crawlability: user-agent raggruppati → regole perse

Pattern standard di robots.txt: più `User-agent` consecutivi che condividono un blocco di regole. Il parser scarta il primo.

```
robots.txt:  User-agent: GPTBot
             User-agent: ClaudeBot
             Disallow: /

chiavi parsate : ["ClaudeBot"]      ← GPTBot sparito
bot bloccati   : ClaudeBot           ← GPTBot risulta permesso
score          : 92                  ← dovrebbe essere 85
```

Causa: a [riga 103-107](src/lib/services/crawlability.ts#L103-L107) il salvataggio della regola precedente avviene solo se `disallow`/`allow`/`crawlDelay` non sono vuoti. Con UA consecutivi sono vuoti, quindi il primo UA viene sovrascritto senza salvare.

*Casi che funzionano correttamente:* UA singolo con case esatto, e `User-agent: *`.

### M5. "Citation rate" misura in realtà le menzioni

In entrambi i writer di snapshot il tasso chiamato `citation_rate` è calcolato da `brand_mentioned`, non da citazioni:

- [analytics-service.ts:351-352](src/lib/services/analytics-service.ts#L351-L352) — `brandMentions = filter(r => r.brand_mentioned)` → `citationRate`
- [citation-snapshots.ts:100-101](src/lib/services/citation-snapshots.ts#L100-L101) — `brandCitations = filter(r => r.brand_mentioned)` → `citationRate`

Ma il GEO Score tratta `citationRate` e `mentionRate` come **due pillar distinti** con pesi diversi (30% e 25%). Se a monte sono lo stesso numero, i due pillar sono correlati al 100% e il 55% del punteggio misura una cosa sola.

Da verificare come viene popolato `brand_health_scores.citation_rate` (fonte del GEO Score) rispetto a `citation_snapshots.citation_rate`: se coincidono, il GEO Score è dominato da un segnale duplicato.

---

## 🟠 ALTO — funzionalità che mentono all'utente

### F1. Engine Info: stato dei motori completamente finto

[/dashboard/monitor](src/app/dashboard/monitor/page.tsx) — **zero chiamate `fetch` nell'intera pagina** (verificato: `grep -c "fetch("` → `0`).

Tutto è hardcoded nell'array `ENGINES` a [riga 22](src/app/dashboard/monitor/page.tsx#L22):

```ts
status: 'operational' as const,     // ← letterale
lastChecked: '2 min ago',           // ← stringa fissa, non una data
version: 'Gemini 1.5 Pro',          // ← obsoleto: il codice usa gemini-2.5-flash
```

E [riga 237](src/app/dashboard/monitor/page.tsx#L237): `allOperational = ENGINES.every(e => e.status === 'operational')` → sempre `true`, per costruzione.

**Dimostrazione pratica, oggi:** la chiave Anthropic era a credito esaurito (HTTP 400 su ogni chiamata `/v1/messages`). La pagina Engine Info mostrava comunque **Claude: operational, last checked 2 min ago**.

Esiste già l'endpoint reale [/api/providers/health](src/app/api/providers/health/route.ts) che restituisce `isConfigured` / `isAvailable` per provider — con **zero consumatori** in tutto il codice. La macchina c'è, la pagina non la usa.

Correlato: `getEngineSignals`/`ENGINE_SIGNALS` ([gemini.ts](src/lib/services/gemini.ts)) e `getEngineProfile`/`getTacticsForEngine` ([geo-knowledge.ts](src/lib/geo/geo-knowledge.ts)) sono anch'essi dead code — altra conoscenza sui motori costruita e mai mostrata.

### F2. Settings → Notifiche: il salvataggio non esiste

[settings/page.tsx:352-382](src/app/dashboard/settings/page.tsx#L352-L382), componente `NotificationsSection`:

- Campo email con `value={email}` / `onChange={setEmail}` ✅
- `const [saving, setSaving] = useState(false)` — **`setSaving` non è mai chiamato**
- `<Button loading={saving}>` — **nessun `onClick`, nessun `onSubmit`, nessun `<form>`**
- `email` non viene mai inviato a nessun endpoint

L'utente digita l'email per gli alert, preme "Salva", non succede nulla e non c'è alcun feedback d'errore. Il campo è puramente decorativo.

### F3. Export PDF: il logo white-label viene letto e buttato via

[export/route.ts:105](src/app/api/export/route.ts#L105) legge `brand.report_logo_url` in `reportLogoUrl`. La variabile **non viene mai usata**: l'header del PDF ([righe 158-167](src/app/api/export/route.ts#L158-L167)) disegna solo il rettangolo colorato e il testo. Nessuna `doc.addImage`.

Risultato: del white-label funzionano colore (`report_primary_color`) e nome (`report_brand_name`), **il logo no** — silenziosamente. L'utente lo configura, lo salva nel DB, e non compare mai.

---

## 🟡 MEDIO — pagine irraggiungibili e navigazione incoerente

### N1. Pagine senza alcun punto di ingresso

Confronto tra `NAV_SECTIONS` ([Sidebar.tsx:71-255](src/components/layout/Sidebar.tsx#L71-L255)) e le 47 pagine dashboard esistenti:

| Pagina | Righe | Link entranti | Nota |
|---|---|---|---|
| `/dashboard/overview` | **683** | **0** | Duplicato più ricco di `/dashboard` (408 righe). Usa `useRealtime`. Sepolto. |
| `/dashboard/cost-monitor` | **513** | **0** | UI costi completa, orfana |
| `/dashboard/analytics` | **505** | 0 link reali | Ha solo un titolo nel `BREADCRUMB_MAP` |
| `/dashboard/glossary` | 135 | **0** | |
| `/dashboard/billing` | — | 0 link reali | Placeholder intenzionale |
| `/dashboard/credits` | — | 0 link reali | Placeholder intenzionale |

**~1.800 righe di UI funzionante spedite e irraggiungibili** (overview + cost-monitor + analytics + glossary).

*Non problemi:* `/dashboard/tools/prompt-generator` è un redirect intenzionale a `/dashboard/prompts` ([codice](src/app/dashboard/tools/prompt-generator/page.tsx)); `api-costs`/`billing`/`credits` sono placeholder deliberati per la modalità "unlimited".

### N2. La nav che hai descritto ≠ la nav che l'app mostra

La struttura che hai elencato include **Billing, Credits, API Costs** sotto "5 · Account". La sidebar li esclude esplicitamente ([Sidebar.tsx:247-249](src/components/layout/Sidebar.tsx#L247-L249)):

> *"Internal deployment: the commercial layer (Billing, Credits, API Costs) is intentionally not exposed — the platform runs unmetered."*

Sezione 5 in produzione contiene solo **Settings** e **Documentation**. Va deciso quale delle due è la verità e allineata la documentazione.

### N3. Breadcrumb assente per 7 pagine della sidebar

`BREADCRUMB_MAP` ([TopBar.tsx:13-37](src/components/layout/TopBar.tsx#L13-L37)) non è stato aggiornato con le pagine aggiunte dopo. Mancano:

`geo-score` · `citation-sources` · `aeo-snippets` · `ai-funnel` · `advisor` · `site-audit` · `content-generator`

Tutte e 7 ricadono nel fallback ([riga 46](src/components/layout/TopBar.tsx#L46)) e mostrano il titolo generico **"Dashboard"** nella barra superiore. Include il **GEO Score**, che è la metrica headline del prodotto.

### N4. Tre sottosistemi di costo paralleli

1. `api-cost-overview.ts` (507 righe) + `/api/api-costs` + `/api/api-costs/export` + `cost-export.ts` + test → la pagina `/dashboard/api-costs` è un **placeholder** che non li usa
2. `/dashboard/cost-monitor` (513 righe) + `/api/cost-monitor` → **orfana**
3. `src/lib/cost-monitor/*` (`CostTracker`, `CostAnalyticsService`, `PROVIDER_PRICING`, `PROVIDER_DEFAULT_MODELS`) → **interamente morto** secondo knip

Tre implementazioni della stessa cosa, zero visibili all'utente. Da consolidare su una.

### N5. Nessun sottosistema rileva le chiavi API esaurite

Nessuna delle tre surface di costo, né `/api/health`, controlla lo **stato di credito** dei provider. Oggi: Anthropic restituiva `"Your credit balance is too low"` su ogni chiamata e nessuna parte del prodotto se ne accorgeva — né Engine Info (F1), né il cost dashboard, né gli alert.

Suggerimento: `/api/providers/health` è il posto naturale dove distinguere `configured` / `available` / **`out_of_credit`**, e da lì alimentare Engine Info.

---

## 🟡 MEDIO — limiti dichiarati ma non applicati

[constants.ts:118-121](src/lib/constants.ts#L118-L121) dichiara quattro limiti. **Nessuno è referenziato da alcun file** (verificato con grep su tutto `src/`):

```ts
export const MAX_COMPETITORS = 3          // mai usato
export const MAX_SCAN_HISTORY = 50        // mai usato
export const MAX_TEXT_LENGTH = 15_000     // mai usato
export const KEYWORD_DENSITY_TARGET = 2.5 // mai usato
```

Conseguenza concreta sui competitor — **due tetti diversi nello stesso codice**:

| Schema | Tetto | Dove |
|---|---|---|
| `competitorSchema` | **3** | [validations.ts:46](src/lib/validations.ts#L46), hardcoded (duplica `MAX_COMPETITORS`) |
| `brandStringArray` | **100** | [validations.ts:123](src/lib/validations.ts#L123), usato dai brand |

Un brand creato via API pubblica può avere 100 competitor, mentre l'UI e il confronto competitor assumono 3. `calculateCitationSnapshots` cicla su tutti i competitor per ogni combinazione engine × category × language → con 100 competitor il costo di calcolo esplode.

---

## 🟢 BASSO — pulizia e coerenza

| # | Problema | Riferimento |
|---|---|---|
| B1 | `email.ts` espone `sendAlertEmail`, `sendWelcomeEmail`, `sendPasswordResetEmail` — **tutte morte**. Gli alert funzionano tramite un mailer Resend **separato** dentro `alerts.ts`. Due percorsi email, due template. | [email.ts:94](src/lib/services/email.ts#L94), [alerts.ts:39](src/lib/services/alerts.ts#L39) |
| B2 | `response-cache` espone `invalidate`/`invalidatePrefix`, **mai chiamate**. I 4 consumer (AVI, health-scores, technical-seo-audit) restano stantii fino a scadenza TTL (300 s) anche dopo un nuovo run. | [response-cache.ts:111](src/lib/response-cache.ts#L111) |
| B3 | Validazione schema: `itemscopeRegex` e `vocabRegex` dichiarati e mai usati → **microdata e RDFa non vengono validati**, solo JSON-LD. Il report non lo dichiara. | [schema-validator.ts:109,132](src/lib/services/schema-validator.ts#L109) |
| B4 | `hasRobotsMeta` calcolato e mai riportato nel site audit | [site-audit.ts:393](src/lib/audit/site-audit.ts#L393) |
| B5 | `lastStatusCode` calcolato e mai usato nel base provider → la logica di retry non distingue per status code | [base-provider.ts:51](src/lib/providers/base-provider.ts#L51) |
| B6 | `DEFAULT_PROVIDER_PRIORITY` esportato e mai usato → l'ordine di priorità dei provider non viene applicato | [types.ts](src/lib/providers/types.ts) |
| B7 | `/api/analyze` legge il parametro `mode` e lo ignora | [analyze/route.ts:32](src/app/api/analyze/route.ts#L32) |
| B8 | Stato React morto: `selectedEngine`/`languageSnapshots` (citations), `previewMode` (reports), `setMetric` (analytics), `engineBreakdown` (snapshots), `theme`/`setTheme`/`mounted` (TopBar — toggle tema rimosso, hook rimasto) | vari |
| B9 | 6 warning `setState` sincrono dentro `useEffect` → render a cascata | `AnimatedStats`, `Reveal`, `TopicFinderPanel`, `Chart`, `useAeoRunStatus`, `chart-tokens` |
| B10 | `useRealtimeAlerts` esiste ma non è usata: la pagina Alerts non ha realtime, richiede refresh manuale | [use-realtime.ts:80](src/hooks/use-realtime.ts#L80) |
| B11 | Dipendenza `lottie-web` installata e mai usata; `LottieAnimation.tsx` e `use-scroll-reveal.ts` sono file morti | knip |
| B12 | `TODO` di schema drift non risolto: `prompt_id` nel tipo generato | [orchestrate/route.ts:96](src/app/api/queries/orchestrate/route.ts#L96) |

---

## Ordine di intervento consigliato

1. **C1** — bloccare il writer distruttivo su `citation_snapshots` prima di qualsiasi altra cosa e prima di riaprire Analytics/Competitor su brand con storico. È l'unico problema che *perde dati*.
2. **M3 + M4** — crawlability: due bug che producono un "va tutto bene" falso sulla metrica più consequenziale del prodotto. Il fix è contenuto (normalizzare il case + gestire gli UA raggruppati) e `matchUserAgent` è già scritta.
3. **M1** — allineare la scala della posizione. Decidere quale scala è corretta (20 o 5), estrarre una costante condivisa, correggere il commento falso in `geo-score.ts`.
4. **F1** — collegare Engine Info a `/api/providers/health`. L'endpoint esiste già ed è pronto.
5. **F2 + F3** — due funzionalità che l'utente crede attive: salvataggio email di notifica e logo white-label.
6. **M2 + M5** — decidere la relazione tra AVI e GEO Score e se `citation_rate` debba misurare le citazioni davvero.
7. **N1–N4** — decidere per ogni pagina orfana: collegarla o rimuoverla. Consolidare i tre sottosistemi di costo.
8. **N5** — rilevamento credito esaurito per provider.
9. Il resto (limiti, pulizia) a seguire.

---

## Copertura di questa analisi

**Verificato eseguendo codice o con evidenza diretta (file:riga):** baseline completa, mappa navigazione vs rotte (tutte le 47 pagine), formule GEO Score / AVI / crawlability / snapshot, Engine Info, Settings, export PDF, wiring email/alert/realtime/cache, limiti e validazioni.

**Analisi statica ma non eseguita end-to-end:** sezione 3 (AEO Snippets, Keywords, AI Funnel, Sentiment nel dettaglio), sezione 4 (Advisor, Recommendations, Content Optimizer, Content Generator nel dettaglio). Le rotte esistono, hanno test e tipizzano correttamente; non ho verificato la correttezza semantica dei loro output contro dati reali.

**Non coperto:** verifica runtime contro il database di produzione (deliberatamente — nessuna query eseguita), e test E2E Playwright.
