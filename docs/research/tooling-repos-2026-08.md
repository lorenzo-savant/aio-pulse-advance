# Repo e tooling esterni — valutazione per migliorare le ricerche (agosto 2026)

**Compilata il 18 agosto 2026.** Richiesta: valutare se 7 repo/docs esterni possono migliorare
"le ricerche" in AEO Pulse. Ho interpretato "ricerche" in due sensi, entrambi presenti nel codice:

1. **Ricerca interna della piattaforma** — [`src/app/api/search/route.ts`](../../src/app/api/search/route.ts):
   cerca brand e prompt via PostgREST `ilike`, con sanitizzazione manuale della grammatica del filtro.
2. **Retrieval verso i motori** — il pipeline che esegue le query di monitoraggio
   ([`query-orchestrator.ts`](../../src/lib/services/query-orchestrator.ts)), il grounding delle citazioni
   ([`citation-grounding.ts`](../../src/lib/services/citation-grounding.ts)), e la ricerca web
   ([`brave-search.ts`](../../src/lib/services/brave-search.ts)).

Giudizio in una riga per ciascuna voce, poi dettaglio e raccomandazione.

> **Stato implementazione (18/08):** i tre ✅ sono stati implementati in TS nativo e committati in
> questa sessione — vedi [§ Riepilogo e ordine di intervento suggerito](#riepilogo-e-ordine-di-intervento-suggerito).

| Repo / doc                                   | Pertinente a           | Verdetto                                        |
| -------------------------------------------- | ---------------------- | ----------------------------------------------- |
| **meilisearch/meilisearch**                  | Ricerca interna (1)    | ✅ **Sì — massima priorità.** Sostituisce l'ILIKE con search typo-tolerant + hybrid, multi-tenant, MIT |
| **assafelovic/gpt-researcher**               | Retrieval / report     | ✅ **Sì — alto valore come feature.** Deep-research con citazioni; integrazione come servizio separato |
| **LibreChat web_search** (docs)              | Retrieval (2)          | ✅ **Sì — come riferimento di architettura.** Pattern provider → scraper → reranker già quasi nostro |
| **Panniantong/Agent-Reach**                  | Retrieval (2)          | ⚠️ **Forse — solo come espansione social listening.** Non per le ricerche attuali |
| **google-research/timesfm**                  | Analytics predittivi   | ⚠️ **Forse — forecasting dei trend AVI**, non le ricerche. Sforzo alto, stack Python |
| **unslothai/unsloth**                        | Fine-tuning             | ❌ **No ora.** Il monitoraggio usa API esterne; Studio è AGPL-3.0 (rischio SaaS) |
| **GoogleCloudPlatform/training-data-analyst**| —                       | ❌ **No.** Materiale didattico GCP, non uno strumento |
| **HKUDS/CLI-Anything**                       | —                       | ❌ **No.** Tooling per rendere software agent-native via CLI; non tocca le ricerche |
| **ConardLi/easy-dataset**                    | —                       | ❌ **No.** Creazione dataset per fine-tuning/RAG/Eval; licenza e stack estranei |
| **huggingface/datasets**                     | —                       | ❌ **No ora.** Libreria Python per load/preprocessing dataset ML; solo riferimento interno |

---

## 1. meilisearch/meilisearch — ✅ Sì, massima priorità (ricerca interna)

Motore di ricerca full-text + hybrid (semantico) in Rust, API REST, SDK JS ufficiale.
Licenza: **MIT** (Community Edition — quella che ci serve) → compatibile con SaaS commerciale.

**Cosa risolve oggi:** [`src/app/api/search/route.ts`](../../src/app/api/search/route.ts:46) sanitizza
manualmente il filtro PostgREST (stringhe `,`/`)`/`%`/`_`), e la ricerca è solo `ilike` su 2 tabelle.
Con Meilisearch:

- **typo tolerance** e **search-as-you-type** (le query del cliente arrivano piene di errori di battitura);
- **hybrid search** (full-text + embeddings) per trovare prompt per *significato*, non solo per sottostringa;
- **tenant tokens** per il multi-tenant nativo — il vincolo "cerca solo nei brand accessibili"
  ([`getAccessibleBrandIds`](../../src/lib/authorize.ts)) diventa un filtro di sicurezza, non logica custom;
- **<50ms** di latenza e facet/ranking configurabili.

**Sforzo:** medio. Self-hosted (server binary Rust) o Meilisearch Cloud. Indicizzazione da popolare a
ogni scrittura su `brands` / `prompts` (webhook o job): i volumi attuali (brand del cliente) sono minimi.

**Raccomandazione:** scheda come task di prodotto per la ricerca interna (un solo endpoint `/api/search`
da riscrivere dietro lo stesso schema `SearchInput` di [`src/lib/validations.ts`](../../src/lib/validations.ts:105)).
Nessun impatto sul billing o sullo schema Prisma — solo una nuova dipendenza infra (Vercel/self-host).

---

## 2. assafelovic/gpt-researcher — ✅ Sì, come feature (retrieval / report)

Agente autonomo di deep research: pianifica domande, lancia crawler in parallelo, aggrega 20+ fonti
con citazioni. Apache-2.0, 29k★, attivo.

**Dove si incastra:** non nel monitoraggio (i nostri prompt sono fissi e ripetuti), ma nella
**generazione di ricerca approfondita**: la versione "deep" del nostro `article-generator`
([`article-generator.ts`](../../src/lib/services/article-generator.ts)) e dell'advisor competitivo.
Il cliente chiede "qual è lo stato del mercato X, con fonti?" — oggi rispondiamo dai dati interni,
domani con un report che aggrega il web con citazioni verificabili. È lo stesso valore che già
vendiamo (output di ricerca con fonti), automatizzato.

**Costo/rischio:** stack **Python (FastAPI)** — non si importa in Next.js. Integrazione solo come
microservizio separato o via **MCP** (espongono un MCP server). Sforzo medio-alto: deploy dedicato,
monitoraggio costi LLM (il loro deep research costa ~$0.4/run), rate limiting.

**Raccomandazione:** vederlo come **servizio out-of-process**, non come libreria. Prima di investire,
spuntare se [`agentic-journey.ts`](../../src/lib/services/agentic-journey.ts) o i specialized-agents
possono già coprire il 70% del caso d'uso con i provider già presenti (Anthropic/OpenAI/Gemini) —
in tal caso gpt-researcher diventa solo il riferimento di pattern (planner → execution → publisher).

---

## 3. LibreChat web_search (docs) — ✅ Sì, come riferimento di architettura (retrieval)

Non è un repo ma la documentazione della feature web search di LibreChat. Il pattern è esplicito e
già il nostro:

> **search provider** (Serper / SearXNG / Tavily) → **scraper** (Firecrawl / Tavily) → **reranker** (Jina / Cohere)

Confronto con lo stato attuale:
- provider: ✅ abbiamo DataForSEO (SERP) + Brave (`brave-search.ts`);
- scraper: ~ Firecrawl/reader (estrazione contenuto dalle citazioni in `citation-grounding.ts`);
- **reranker: ❌ non risulta presente** — è l'unico pezzo mancante del pattern.

**Cosa copiare:** il concetto di **reranking delle fonti citate** (Jina Reranker o Cohere) per
migliorare la qualità delle citazioni che il pipeline passa ai motori — coerente con la distinzione
"essere citati è fiducia" che è il nostro asse. Lo **SSRF guard** documentato (blocco di destinazioni
private/loopback) è già parte della nostra postura di sicurezza sul grounding.

**Sforzo:** basso (solo il reranker da aggiungere; la pipeline già esiste).

**Raccomandazione:** leggere la pagina come check-list; se il reranker manca davvero, task separato
~½g. Niente dipendenze nuove — Jina/Cohere sono solo API.

---

## 4. Panniantong/Agent-Reach — ⚠️ Forse, solo come espansione (social listening)

CLI "capability layer" che dà a un agente accesso a Twitter/X, Reddit, YouTube, GitHub, RSS con
back-end a rotazione (yt-dlp, OpenCLI, Exa…), zero API fee. MIT. 72k★ (trending #1).

**Perché non è per le ricerche attuali:** il nostro retrieval è verso LLM e SERP gestiti da provider
commerciali con SLA; Agent-Reach è pensato per **agenti** che esplorano social, con back-end che
cambiano (loro stessi dichiarano: "la piattaforma ci blocca, cambiamo strada"). Dipendenza fragile
per un SaaS che vende affidabilità misurata.

**Dove avrebbe senso (e dove rischia):**
- ✅ Espandere il monitoraggio del brand a **Reddit/Twitter/YouTube** (sentiment, menzioni organiche) —
  complementa [`brand-presence.ts`](../../src/lib/services/brand-presence.ts) / [`brand-mention.ts`](../../src/lib/services/brand-mention.ts).
- ⚠️ Rischio ToS/account: usano cookie di login su alcuni canali (Twitter, Reddit) → **rischio ban
  account** e di pulizia legale per un prodotto enterprise-lite. Da usare solo con account dedicati.

**Raccomandazione:** NON introdurlo per le ricerche core. Se un cliente chiede social listening,
valutarlo come proof-of-concept out-of-band con account dedicati, con gate legale. Tenere d'occhio
come riferimento per il routing "primario + fallback" dei canali (pattern applicabile anche al nostro
ai-router).

---

## 5. google-research/timesfm — ⚠️ Forse, ma per forecasting, non per le ricerche

TimesFM 2.5 è un foundation model per **time-series forecasting** (200M params, Apache-2.0, 28k★).

**Dove si incastra:** non nel retrieval. Il caso d'uso è **predire i trend del punteggio AVI /
share-of-voice** per il cliente ("se non intervieni, la visibilità scenderà a N entro 2 mesi").
Siamo in una posizione rara: abbiamo serie storiche giornaliere dei nostri stessi punteggi
(tabella `monitoring_results`, history di `geo-score`)
che TimesFM può modellare senza feature engineering manuale.

**Costo:** stack **Python/torch/flax** → servizio out-of-process, modello 200M da hostare
o usare via BigQuery ML (lo supportano in SQL). Sforzo alto; utile solo dopo che la serie storica
ha abbastanza punti e il throughput (C2) regge il volume.

**Raccomandazione:** backlog "predictive AVI", NON ora. Se si fa, preferire **BigQuery ML** (SQL,
zero infra Python) dato che i dati sono già in Supabase Postgres. È una feature di vendita forte
("non solo cosa è visibile ora, ma dove andrà") ma non tocca "le ricerche".

---

## 6. unslothai/unsloth — ❌ No ora

Fine-tuning di LLM 2× più veloce con 70% meno VRAM (LoRA/QLoRA/GRPO), 73k★.

**Perché no:** il monitoraggio AEO Pulse chiama **API di provider esterni** (ChatGPT, Claude,
Perplexity, Gemini) — non eseguiamo modelli nostri. Fine-tunare un modello significherebbe
(parsare le risposte? classificare sentiment? estrarre menzioni?) che oggi risolviamo con
logica deterministica spiegabile ([`competitor-identity.ts`](../../src/lib/services/competitor-identity.ts))
— e la spiegabilità è un argomento di vendita. Il primo modello "nostro" con senso sarebbe un
**classifier di menzioni/sentiment custom**, ma serve GPU/ML infra che non abbiamo e cambia la
postura di privacy (i dati del cliente finirebbero su un modello allenato da noi).

**Licenza:** core Apache-2.0 ma **Studio/UI è AGPL-3.0** → una UI AGPL dentro un SaaS chiuso è un
rischio legale non necessario. Per il fine-tuning esterno su HF il core Apache va bene, ma resta il
problema di "perché".

**Raccomandazione:** non valutare finché non esiste un caso d'uso concreto (es. sentiment classifier
su volumi). Allora confrontarlo con servizi hosted (OpenAI fine-tuning) prima di self-hostare GPU.

---

## 7. GoogleCloudPlatform/training-data-analyst — ❌ No

Repo di **lab e demo per i corsi GCP** (notebook, quests, self-paced labs). Apache-2.0, 8.6k★.

Non è uno strumento: non si integra nel prodotto. L'unico valore possibile è di **cultura interna**
(notebook di analytics/ML su GCP) se e quando si lavora sul forecasting (punto 5) o su BigQuery ML.
Non tocca le ricerche né il monitoraggio.

---

## Riepilogo e ordine di intervento suggerito

| Ordine | Azione                                             | Riferimento                  | Sforzo      |
| ------ | -------------------------------------------------- | ---------------------------- | ----------- |
| 1      | **Meilisearch** per la ricerca interna (brand/prompts) con tenant tokens | `api/search` + `validations.ts` | medio (~2-3g) |
| 2      | **Reranker (Jina/Cohere)** sul grounding delle citazioni — pattern LibreChat | `citation-grounding.ts`      | basso (~½g) |
| 3      | **gpt-researcher** come deep-research report (servizio out-of-process o MCP) | `article-generator` / advisor | alto (servizio dedicato) |
| 4      | **timesfm** forecasting AVI (BigQuery ML) — backlog | serie storica `geo-score`    | alto, non ora |
| 5      | **Agent-Reach** social listening — solo su richiesta cliente, con gate legale | `brand-mention`              | PoC, non ora |

Da non toccare: **unsloth**, **training-data-analyst**, **CLI-Anything**, **easy-dataset**, **huggingface/datasets** (nessun caso d'uso che li giustifichi oggi).

---

## 8. HKUDS/CLI-Anything — ❌ No

**Repo**: `HKUDS/CLI-Anything` · Apache-2.0 · "Making ALL Software Agent-Native"

**Cosa fa**: framework che genera uno strato CLI attorno a qualsiasi software, così un agente AI (o un utente in terminale) può pilotarlo programmaticamente invece di scrivere codice per ogni tool.

**Perché non per noi**: è un acceleratore di sviluppo software per agenti (costruzione di wrapper CLI), non uno strumento di ricerca o retrieval. AEO Pulse non ha tool CLI interni da esporre agli agenti; integrare questo framework servirebbe solo a "agentificare" utilità di sviluppo, fuori dallo scope prodotto. Resta interessante come *riferimento di architettura* se un domani vorremo rendere alcuni servizi interni richiamabili da agenti esterni, ma non per le ricerche.

## 9. ConardLi/easy-dataset — ❌ No

**Repo**: `ConardLi/easy-dataset` · tool per costruire dataset di fine-tuning / RAG / eval

**Cosa fa**: genera dataset di addestramento (fine-tuning, RAG, benchmark) da sorgenti varie, pensato per chi prepara dati per modelli AI.

**Perché non per noi**: il prodotto non fa fine-tuning né training di modelli proprietari; il monitoraggio AEO usa LLM esterni via API. Creare dataset eval interni potrebbe avere un caso d'uso *eventuale* (valutare la qualità delle risposte del pipeline), ma oggi sarebbe uno sforzo senza ritorno diretto sulle ricerche. Licenza non verificata in dettaglio, quindi nessun beneficio che valga il rischio.

## 10. huggingface/datasets — ❌ No ora

**Repo**: `huggingface/datasets` · Apache-2.0 · libreria Python per caricare, preprocessare e versionare dataset ML

**Cosa fa**: libreria standard dell'ecosistema Hugging Face per accedere e manipolare dataset (streaming, caching, trasformazioni, versioning) per training/eval di modelli.

**Perché non per noi**: stack Python, orientato al training ML offline. Nessun punto di contatto con la ricerca interna né con il retrieval LLM in Next.js. Potenzialmente utile solo come riferimento per eventuali *eval set* del pipeline di grounding (con i benchmark pubblici caricabili, es. dataset di citazioni), quindi "solo riferimento interno", non dipendenza.

---

### Stato implementazione (18/08/2026)

I tre ✅ sono implementati e committati in questa sessione, in TS nativo dentro il codebase (zero nuove dipendenze npm):

| Feature            | Servizio                              | Stato |
| ------------------ | ------------------------------------- | ----- |
| **Reranker**       | `src/lib/services/reranker.ts`        | ✅ Implementato + test (Jina primario, Cohere fallback, soft-fail a ordine originale). Integrato in `citation-grounding.ts` dietro l'opzione `rerank?: boolean` |
| **Deep-research**  | `src/lib/services/deep-research.ts`   | ✅ Implementato + test (planner → execution → publisher, dipendenze iniettabili `llmCaller`/`searchFn`/`pageFetcher`). Route `POST /api/research/deep` |
| **Meilisearch**    | `src/lib/services/search-index.ts`    | ✅ Implementato + test (REST diretto, multi-tenant via filtro `brand_id`, fallback automatico a ILIKE). Integrato in `api/search/route.ts` |

Note operative:

- **Reranker**: attivo solo se `JINA_API_KEY` o `COHERE_API_KEY` sono configurate (da aggiungere in `ENVIRONMENTS.md`). Disattivato → nessuna variazione di comportamento.
- **Meilisearch**: attivo solo se `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY` sono configurate. Necessaria la **popolazione dell'indice** (`uid = "search"`, `filterableAttributes: ["brand_id"]`, documenti `{ id, type: "brand"|"prompt", name, brand_id }`) — finché l'indice è vuoto il search degrada silenziosamente all'ILIKE attuale.
- **Deep-research**: la route è protetta (auth + rate limit 5/min) e fallisce pulito a 503 se nessun LLM provider è configurato.

Quality gate: `npm run type-check`, `npm run lint`, `npm test -- --run` (tutti i test: reranker, deep-research, search-index, citation-grounding) devono passare.