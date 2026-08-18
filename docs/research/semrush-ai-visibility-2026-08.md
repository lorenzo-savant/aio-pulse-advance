# Semrush AI Visibility — Metodologia, metriche e funzionalità

**Documento di riferimento tecnico** · Compilato il 17 agosto 2026
Fonte: Knowledge Base Semrush, studi originali del blog Semrush, newsroom. Tutti i contenuti sono riformulati; i link alle fonti primarie sono in fondo a ogni sezione.

> **Nota repo:** documento di riferimento esterno, salvato verbatim.
> L'analisi comparativa con AEO Pulse è in [semrush-vs-aeo-pulse.md](./semrush-vs-aeo-pulse.md).

---

## 1. Architettura dei dati: quattro database separati

Questo è il punto più importante da capire, perché ogni report Semrush parla di "AI visibility" ma pesca da fonti diverse con logiche e frequenze di aggiornamento diverse.

| Database                                | Alimenta                                                    | Frequenza                | Piattaforme coperte                                  |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| **Prompt Database**                     | Visibility Overview, Competitor Research, Prompt Research   | Giornaliera (rolling)    | ChatGPT, Gemini, Google AI Overviews, AI Mode        |
| **Brand Performance Database**          | Brand Performance, Perception, Narrative Drivers, Questions | Settimanale              | Google AI Mode, ChatGPT, Perplexity, Gemini          |
| **Position Tracking (Prompt Tracking)** | Prompt Tracking                                             | Giornaliera              | ChatGPT Search, Google AI Mode, AI Overviews, Gemini |
| **Crawler Site Audit**                  | AI Search Health, Blocked from AI Search                    | On demand (a ogni crawl) | 8 bot AI verificati                                  |

### 1.1 Prompt Database — il cuore del sistema

- Oltre **317 milioni** di prompt e relative risposte.
- **117 database regionali**.
- **Punto critico**: le risposte sono catturate da richieste reali, **non tramite API degli LLM**. Semrush dichiara esplicitamente questo. La materia prima arriva da _clickstream data_ di ricerca AI più il dataset keyword di Google per gli AI Overviews.
- I prompt grezzi vengono raggruppati in **Topic** semantici, deduplicati e semplificati nella formulazione, preservando intento e semantica originali.
- Limite operativo: 300 query al giorno nei report AI Analysis, 1.000 in Prompt Research.

### 1.2 Brand Performance Database — prompt sintetici

Meccanica diversa e spesso fraintesa: Semrush mantiene un repository di query inviate alle piattaforme AI e da lì identifica query **branded e non-branded** contestualmente associabili al dominio analizzato. La KB "Features" lo descrive come generazione di **prompt sintetici** basati su dominio + località, poi eseguiti e analizzati. L'identificazione è affidata a tecnologia proprietaria.

Conseguenza pratica: i numeri di Brand Performance non sono confrontabili 1:1 con quelli di Visibility Overview. Sono due campionamenti diversi dello stesso fenomeno.

> Fonti: [KB 1607 — Where does the data come from](https://www.semrush.com/kb/1607-semrush-ai-visibility-data) · [KB 1626 — Features for AI Visibility](https://www.semrush.com/kb/1626-ai-visibility-features)

---

## 2. Come vengono calcolati i punteggi

### 2.1 AI Visibility Score (0–100)

Combinazione di **due fattori**:

1. **Topic Coverage** — su quanti topic il brand compare nelle risposte AI, rapportato a tutti gli altri domini.
2. **Mention Consistency** — dentro quei topic, con quale frequenza il brand viene menzionato attraverso tutte le risposte.

L'esempio ufficiale di Semrush chiarisce la logica: Google e Reddit compaiono su moltissimi topic ma una volta sola per topic; Lego compare su meno topic ma li domina — e ottiene punteggio più alto. **Non è un semplice conteggio di menzioni: è ampiezza × intensità.**

Nella FAQ dell'hub c'è una formulazione alternativa, più grezza: il punteggio riflette quanto spesso il brand è menzionato rispetto alla **mediana** dei principali competitor di settore, identificati automaticamente. Le due descrizioni convivono nella documentazione — la seconda è probabilmente la normalizzazione applicata sopra il calcolo coverage × consistency.

### 2.2 AI Topic Volume

I singoli prompt sono troppo specifici e unici per essere misurati direttamente. Semrush calcola quindi il volume **a livello di topic**: cluster di prompt che si muovono nella stessa "direzione semantica". La stima combina dati di terze parti su interazioni AI reali con modelli ML proprietari.

### 2.3 Topic Difficulty (0–100%)

Due input:

1. **Forza dei competitor** — se i brand più menzionati per quel topic sono già autorevoli e noti, entrare è più difficile.
2. **Dimensione dell'opportunità** — quante "posizioni" sono disponibili per quel topic rispetto alla media di tutti i topic. Meno slot disponibili = difficoltà maggiore.

### 2.4 Share of Voice

Formula base dichiarata da Semrush:

```
AI SoV = (menzioni del tuo brand ÷ menzioni totali di tutti i brand della categoria) × 100
```

Ma nel report Brand Performance il calcolo è **pesato anche dalla posizione**: conta quante volte il brand è menzionato _e quanto in alto compare_ nella risposta. In Enterprise AIO la stessa logica è applicata su un intervallo temporale selezionabile.

### 2.5 Visibility (Prompt Tracking)

Metrica diversa dall'AI Visibility Score. Misura il progresso del dominio nelle **top citation** della campagna: 0% = mai nelle top citation di nessun prompt tracciato; 100% = prima citazione su tutti i prompt.

> Fonti: [KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data) · [KB 1594 — AI Visibility Metrics](https://www.semrush.com/kb/1594-ai-seo-metrics) · [Blog — How to measure AI share of voice](https://www.semrush.com/blog/how-to-measure-ai-share-of-voice/)

---

## 3. Brand extraction: come Semrush riconosce un brand in una risposta LLM

Sistema proprietario di estrazione basato su AI, non su string matching. Capacità dichiarate:

- Comprensione del **contesto**, non solo del nome.
- Riconoscimento di **sub-brand e prodotti** ricondotti al brand principale.
- Disambiguazione di entità omonime — l'esempio ufficiale: distinguere Tesla (azienda EV) da Nikola Tesla (scienziato) da Aeroporto Nikola Tesla di Belgrado.
- Tolleranza a varianti di grafia e scrittura.

Semrush ammette esplicitamente che il database è in miglioramento continuo, in particolare per l'accuratezza sui brand piccoli. **Questo è il punto di debolezza dichiarato più rilevante** — per brand locali o di nicchia l'estrazione è meno affidabile.

Modello usato per la raccolta: la versione più recente di **ChatGPT in search mode**.

> Fonte: [KB 1607](https://www.semrush.com/kb/1607-semrush-ai-visibility-data)

---

## 4. Sentiment: su cosa si basa realmente il giudizio

Questa è l'area dove la documentazione Semrush è più reticente sulla meccanica, ma alcune cose sono esplicite e importanti.

### 4.1 Struttura delle metriche di sentiment

| Metrica                           | Definizione                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Overall Sentiment**             | Bilanciamento tra menzioni _favorevoli_ e _generiche_ del brand nelle risposte AI                           |
| **Favorable Sentiment**           | Percentuale di menzioni favorevoli, confrontabile con i competitor e nel tempo                              |
| **Key Sentiment Drivers**         | Temi/attributi che generano percezione positiva (Brand Strength Factors) o negativa (Areas for Improvement) |
| **Sentiment by Feature Category** | Sentiment assegnato per singola categoria di feature di prodotto                                            |
| **Cited Pages + sentiment**       | Pagine del sito citate, con sentiment associato                                                             |

### 4.2 Dettagli metodologici critici

- **La tassonomia non è positivo/neutro/negativo.** Semrush lavora su un asse **favorable vs. general**. Le prime recensioni di terze parti (Avenue Z, marzo 2025) descrivevano un modello a tre classi positivo/neutro/negativo — quella descrizione è ormai superata per il toolkit consumer, mentre **Enterprise AIO** mantiene sentiment analysis con identificazione esplicita dei _driver di sentiment negativo_.
- **Il sentiment nel report Perception è calcolato SOLO su query non-branded.** Scelta metodologica dichiarata, per ottenere una lettura più realistica di come il brand performa in scenari di scoperta e ricerca generica anziché in query dove l'utente cerca già il brand. Questo è probabilmente il singolo dettaglio più importante di tutta la documentazione sul sentiment.
- **Trasparenza sul dato grezzo**: il pannello _Answers for_ mostra il testo integrale e non editato della risposta AI da cui è derivato il dato. Apribile da tabelle, Business Drivers, Feature Categories, Feature Descriptions, con attribuzione contestuale ("brand attribuiti a questo driver", ecc.).
- **AI Feature Descriptions**: sintesi AI-generated dei temi di feedback estratti da migliaia di menzioni.
- **Historical snapshot settimanali**: si può navigare indietro nel tempo per vedere l'evoluzione di insight, raccomandazioni, risposte AI, business driver, sentiment, descrizioni feature e citazioni.

### 4.3 Cosa Semrush non dichiara

Non è pubblico: quale modello classifica il sentiment, con quale prompt/rubrica, come vengono gestiti disaccordo tra modelli, ambiguità e ironia, né se esiste validazione umana. Da trattare come black box.

> Fonti: [KB 1595 — Brand Performance Reports](https://www.semrush.com/kb/1595-brand-performance-reports) · [KB 1594](https://www.semrush.com/kb/1594-ai-seo-metrics)

---

## 5. Citation vs. Mention: due assi indipendenti

Distinzione fondamentale, quantificata nell'AI Visibility Index 2026:

- **Mention** = il brand compare nel testo della risposta.
- **Citation** = il dominio del brand è usato come fonte a supporto.

Su Gemini la sovrapposizione tra brand menzionati e domini citati **scende fino al 30%**. In gran parte dei settori, **meno di 1 brand su 5** riesce a essere sia frequentemente menzionato sia costantemente citato come fonte.

Implicazione strategica: sono due competizioni separate. Autorevolezza e rilevanza per essere _menzionati_; contenuto credibile e strutturato per essere _citati_.

### Comportamento di citazione per piattaforma

| Piattaforma        | Fonti medie per risposta | Pattern                                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------------------------- |
| **ChatGPT**        | ~15                      | Si appoggia molto a piattaforme community e reference (Reddit, Wikipedia) |
| **Gemini**         | ~3                       | Pool ristretto: Wikipedia, Reddit, YouTube                                |
| **Google AI Mode** | —                        | Predilige autorità strutturate (Bankrate, LinkedIn, Amazon)               |

> Fonti: [Newsroom — 2026 AI Visibility Index](https://www.semrush.com/news/463141-semrush-releases-expanded-2026-ai-visibility-index-analyzing-126-million-ai-search-prompts/) · [ai-visibility-index.semrush.com](https://ai-visibility-index.semrush.com/)

---

## 6. I report, uno per uno

### 6.1 Visibility Overview

Benchmark di qualsiasi brand. Scala worldwide o 41 regioni specifiche.

Metriche: AI Visibility (0–100), Mentions (numero di prompt in cui il brand compare), Monthly Audience (stima dell'audience totale delle query sui topic dove il brand appare), Your Performing Topics, **Topic Opportunities** (prompt dove i competitor sono visibili e tu no), **Source Opportunities** (fonti citate che menzionano i competitor ma non te), Citations, Cited Sources, Cited Pages.

Viste: Distribution by LLM (toggle Mentions/Cited Pages), Mentions by Country, selettore storico mensile.

### 6.2 Competitor Research

Confronto diretto fino a 4 competitor.

Metriche differenzianti — la tassonomia delle fonti è la parte più utile:

- **Missing Sources**: citate per i competitor, mai per te → target di outreach.
- **Shared Sources**: citate per tutti i brand del confronto.
- **Strong Sources**: ti citano più dei competitor.
- **Unique Sources**: citano te e nessun competitor.
- **Weak Topics/Prompts**: sei visibile ma i competitor lo sono di più.
- **Missing Topics/Prompts**: assenza totale.

### 6.3 Prompt Research

"Keyword research per l'era AI". Input: una frase seed.

Output: Related Topics AI Volume, numero di Topics e Prompts, Intent Breakdown, Brands mentioned (con top 3), Source Domains (con top 3), Relevance per topic e per prompt.

**Tassonomia intent a 6 classi**: Informational, Navigational, Commercial, Transactional, **Task-based** (l'utente chiede all'AI di eseguire un'azione o generare un output: "scrivimi una scaletta", "crea un headline"), **Other** (catch-all per query ambigue).

Azioni dirette: creare contenuto con un click (integrazione Content Toolkit) o inviare il prompt a Prompt Tracking.

### 6.4 Brand Performance (suite di 4 report)

Struttura comune a tutti: **Insights** (priorità strategiche AI-generated) in alto → deep dive dati al centro → **AI Strategic Opportunities** (azioni concrete) in fondo.

Filtri: fino a 9 competitor, selettore piattaforma (All / Google AI Mode / ChatGPT / Perplexity / Gemini), selettore storico settimanale.

| Report                | Contenuto chiave                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand Performance** | Bubble chart SoV (asse X) × Sentiment (asse Y); Overall Sentiment; Share of Voice; **Key Business Drivers by Frequency** (pricing, gamma prodotto, customer service — con icona trofeo per il leader); Competitor Comparison Cards              |
| **Perception**        | Competitive Perception by Platform; Favorable Sentiment nel tempo; Key Sentiment Drivers; Sentiment/Mentions by Feature Category; AI Feature Descriptions                                                                                       |
| **Narrative Drivers** | Share of Voice by Platform; tabbed widget SoV/Mentions/Average Position; **Top Cited Domains** con % di citazione nel tempo; Breakdown by Question con 4 preset: Answers Non-branded, Answers Branded, Citations Non-branded, Citations Branded |
| **Questions**         | Topic Distribution; Query Intent Distribution; Intent by Topic; Query Topics                                                                                                                                                                    |

Copertura: 68.500 località, 53 lingue. Cooldown di 14 giorni per slot dominio dopo un cambio (lo storico non si perde, si crea un gap). Nessuna analisi a livello di sottocartella.

### 6.5 Prompt Tracking

**Come vengono assegnate le posizioni — dettaglio non ovvio:**

- **ChatGPT Search**: i domini nell'area citazioni sono ordinati dall'alto verso il basso.
- **Google AI Mode**: l'**area di risposta stessa è posizione 1**, le citazioni partono da 2. Sezioni "Quick results from around the web" possono occupare posizioni anteriori. Gli Shopping ads sono tracciati come SERP feature distinta.
- **Gemini**: le fonti citate sono ordinate, prima citazione = posizione 1.

SERP feature tracciate: Response, **Double Response** (quando ChatGPT fornisce due sezioni di risposta distinte), Citations, Search results, Shopping ads.

**Report Sources** — la parte più azionabile: ogni dominio e URL citato per i prompt tracciati, categorizzato (tuo dominio / competitor / social / knowledge base / altro), con Cited for Prompts, Your mentions, Diff, **Mention Rate**. Per ogni pagina citata: raccomandazioni contestuali alla categoria della fonte (es. per una knowledge base → rafforzare l'entity profile; per un thread di forum → strutturare gli insight in FAQ sul proprio sito).

Analisi trasversale: Tags (etichette custom) e **Topics** (raggruppamenti AI-generated per similarità semantica). Confronto affiancato con Google/Bing/Baidu in Devices & Locations.

Limiti: solo desktop. Niente Estimated Traffic né Share of Voice. Volumes e Topics disponibili solo in 15 paesi (Svezia e Italia inclusi).

> Fonti: [KB 1596](https://www.semrush.com/kb/1596-visibility-overview-report) · [KB 1598](https://www.semrush.com/kb/1598-competitor-research-report) · [KB 1597](https://www.semrush.com/kb/1597-prompt-research-report) · [KB 1595](https://www.semrush.com/kb/1595-brand-performance-reports) · [KB 1503](https://www.semrush.com/kb/1503-prompt-tracking)

---

## 7. Audit: AI Search Health

### 7.1 Composizione del punteggio

Tre gruppi di fattori:

1. **AI search checks in Site Audit** — problemi comuni che impattano la visibilità AI: crawlability, structured data, internal linking.
2. **AI bot access** — se i crawler AI sono bloccati da robots.txt.
3. **Technical readiness** — elementi mancanti o mal configurati: schema markup, navigazione crawlabile, internal link, **llms.txt**.

Semrush non pubblica i pesi relativi.

### 7.2 Gli 8 bot verificati e la loro tassonomia

Semrush classifica i bot AI in 4 tipi. **La distinzione è operativamente decisiva**: bloccare un training bot non danneggia la visibilità, bloccare un search crawler sì.

| Bot                | Tipo                                 | Impatto del blocco                             |
| ------------------ | ------------------------------------ | ---------------------------------------------- |
| `ChatGPT-User`     | On-demand fetcher                    | Esclusione dalle risposte conversazionali      |
| `OAI-SearchBot`    | AI search crawler                    | **Esclusione da ChatGPT/SearchGPT search**     |
| `Googlebot`        | SEO tradizionale + AI search crawler | **Esclusione da AI Overviews e AI Mode**       |
| `Google-Extended`  | AI training bot (+ search)           | Nessun impatto diretto sulla visibilità search |
| `Perplexity-User`  | On-demand fetcher                    | Esclusione dalle risposte Perplexity live      |
| `PerplexityBot`    | AI search crawler                    | **Esclusione dall'indice Perplexity**          |
| `Claude-User`      | On-demand fetcher                    | Esclusione dalle risposte Claude live          |
| `Claude-SearchBot` | AI search crawler                    | **Esclusione da Claude search**                |

Semrush segnala esplicitamente che `Google-Extended` è spesso frainteso: la descrizione pubblica lo fa sembrare un search crawler, ma è un training bot per i modelli generativi Google. Stesso discorso per `GPTBot` (OpenAI) e `ClaudeBot` (Anthropic) — training, non search.

### 7.3 Procedura d'audit consigliata

1. Setup campagna Site Audit.
2. In _Crawler settings_, impostare User agent = **OpenAI-Search** per vedere il sito come lo vede ChatGPT search.
3. Eseguire l'audit.
4. Widget **AI Search Health** → punteggio.
5. Widget **Blocked from AI Search** → bot bloccati (visibile anche nel report Crawled Pages).
6. Tab **Issues**, filtro **AI Search** → problemi specifici e fix.

> Fonti: [KB 1601 — AI Search Health](https://www.semrush.com/kb/1601-ai-search-health-audit) · [KB 1571 — Blocked from AI Search](https://www.semrush.com/kb/1571-blocked-from-ai-search-site-audit)

---

## 8. Su cosa si basano davvero le citazioni: i due studi originali

Questa è la parte con più valore ingegneristico — Semrush ha pubblicato metodologia e numeri di due studi correlazionali su cui è costruito il Content Toolkit.

### 8.1 Studio sui fattori di contenuto (gennaio 2026)

**Metodo**: confronto tra due campioni — URL citati da piattaforme AI (positivo) vs. URL nella top 20 di Google per keyword correlate (negativo). Scoring su 13 parametri di contenuto, misurata la differenza percentuale.

Deliberatamente **solo testo visibile**: esclusi metadata, struttura HTML, schema markup, layout, fattori tecnici. L'obiettivo era isolare come gli LLM rispondono al contenuto come testo. I criteri sono stati costruiti "dalla prospettiva dell'LLM", non cercando di far coincidere il giudizio del modello con quello umano.

**Campione** (15 luglio – 6 agosto 2025): 11.882 prompt (ChatGPT Search, Google AI Mode, Perplexity), 59.410 keyword, 304.805 URL citati, 921.614 URL ranking su Google, 337.785 URL unici totali.

**Risultati — 5 qualità positive:**

| Fattore                   | Differenza  |
| ------------------------- | ----------- |
| Clarity and summarization | **+32,83%** |
| E-E-A-T signals           | **+30,64%** |
| Q&A format                | **+25,45%** |
| Section structure         | **+22,91%** |
| Structured data elements  | **+21,60%** |

**1 fattore negativo:** Non-promotional tone **−26,19%**.

L'interpretazione di Semrush sul dato negativo è importante e controintuitiva: non significa che gli LLM preferiscano linguaggio promozionale. Gli articoli scritti da copywriter professionisti sono ben strutturati, ben documentati e ottimizzati — e proprio perché scritti da professionisti per attrarre traffico o vendere, tendono a usare un tono commerciale. La variabile confondente è la qualità professionale, non il tono.

Gli altri 7 parametri non hanno mostrato differenza significativa: comparivano con frequenza simile in entrambi i campioni.

### 8.2 Studio sui fattori tecnici (gennaio 2026)

**Metodo**: 5 milioni di URL citati da ChatGPT Search e Google AI Mode; 378.000 citazioni analizzate via Botpresso per pattern di struttura; metriche di engagement da Traffic Analytics; schema markup da Site Audit.

Semrush avverte esplicitamente: **correlazione, non causalità**.

**Finding 1 — Engagement**: le pagine citate in posizione 1–5 hanno visite più numerose, sessioni più lunghe, più pagine per visita, conversion rate più alto. Google AI Mode tende a citare pagine con engagement superiore rispetto a ChatGPT.

Nota metodologica onesta di Semrush: l'engagement si misura _dopo_ il click, la citazione avviene _prima_. Quindi l'engagement non può essere un segnale di input diretto — funziona da proxy di qualità, affidabilità e utilità.

**Finding 2 — Struttura URL**: gli slug di **21–25 caratteri** ricevono il massimo delle citazioni (~87.000), seguiti da 6–10 caratteri (~57.000). L'intervallo **17–40 caratteri** batte costantemente sia gli slug molto brevi (1–5, tipicamente homepage e categorie) sia quelli molto lunghi (56+, tipicamente nested o keyword-stuffed).

**Finding 3 — Structured data**, presenza sulle pagine citate:

| Schema              | ChatGPT | AI Mode |
| ------------------- | ------- | ------- |
| Organization        | 25%     | 34%     |
| Article             | 20%     | 26%     |
| Breadcrumb          | 15%     | 20%     |
| SiteLinks_SearchBox | 5%      | 7,5%    |
| FAQ                 | 3%      | 5,5%    |
| LocalBusiness       | 2%      | 3,5%    |
| ReviewSnippet       | 2%      | 3,5%    |
| Product             | 1,5%    | 2,5%    |
| Video               | 0,5%    | 1,5%    |

Per formato di markup: Open Graph ~60% (AI Mode) / ~40% (ChatGPT); Twitter Cards ~50% / ~30%; JSON-LD ~40% / ~30%; Microdata ~10% entrambi; Microformats ~5% entrambi.

Conclusione di Semrush: non serve implementare ogni formato — le piattaforme AI sembrano capaci di estrarre entità e metadati da formati diversi.

**Raccomandazioni tecniche aggiuntive**: server-side rendering (i siti JS-heavy sono problematici per i crawler AI), formattazione conversazionale Q&A, copertura schema estesa a entità/autori/articoli per il riconoscimento semantico, monitoraggio dei log file per capire quali pagine i crawler AI privilegiano, gestione del crawl budget se `OAI-SearchBot` consuma risorse.

> Fonti: [Content optimization study](https://www.semrush.com/blog/content-optimization-ai-search-study/) · [Technical SEO impact study](https://www.semrush.com/blog/technical-seo-impact-on-ai-search-study/)

---

## 9. Enterprise AIO — il livello superiore

Piattaforma custom, separata dal toolkit consumer.

**Dati**: database di 261M+ prompt reali, uniti a training data degli LLM, traffic log, segnali di autorità e dati SEO Semrush. Integrazione con Adobe Analytics per il contesto traffico.

**Piattaforme aggiuntive** rispetto al toolkit: Claude, DeepSeek, Grok, Microsoft Copilot.

**Capacità esclusive**:

- **Concept analysis** — analisi dei concetti associati al brand, oltre il semplice sentiment.
- **Sentiment analysis avanzata** — identificazione dei driver di sentiment _negativo_ e tracciamento nel tempo per misurare l'impatto delle ottimizzazioni.
- **Source analysis** — quali fonti influenzano la rappresentazione del brand, incluse fonti ad alta autorità dove i competitor sono presenti e tu no.
- **ChatGPT Shopping** — come i prodotti compaiono nelle raccomandazioni shopping, posizionamento, attributi che influenzano la raccomandazione.
- Granularità per **brand, mercato, città, prodotto, persona, categoria**.
- Prompt tracking illimitato, generazione automatica di prompt, integrazioni custom.

Caso Roche citato da Semrush: 67,3% di share of voice con 97% di sentiment positivo o neutro (83% positivo, 14% neutro) su 1.500 prompt tracciati in 3 mesi.

> Fonti: [Enterprise AIO](https://www.semrush.com/lp/enterprise-aio/en/) · [Roche case study](https://enterprise.semrush.com/customer-stories/roche/)

---

## 10. AI Visibility Index — il benchmark pubblico

Studio flagship, gratuito e consultabile.

- **2025 (v1)**: 2.500 prompt.
- **2026 (v2)**: **126 milioni** di prompt US, gennaio–aprile 2026, 22 settori, 4 piattaforme (ChatGPT, Gemini, Google AI Mode, Google AI Overviews).

**Finding rilevanti per il benchmarking:**

- Concentrazione per settore (quota dei top 3 brand sulla visibilità di categoria): News & Media 82,9% · Consumer Electronics 76,9% · Finance 41,4% · Industrial 42,2%. Le categorie meno concentrate offrono più spazio di ingresso.
- **"Universal 36"**: solo 36 brand globali hanno mantenuto visibilità top-100 su tutte e 4 le piattaforme ogni mese dello studio (YouTube, Google, Reddit, Amazon, Facebook, Apple, Walmart, Disney, Nintendo tra questi).
- Le fonti di terze parti sono determinanti: Patagonia ha mantenuto un AI visibility score di ~79–80 sostenuta da descrizioni coerenti su OutdoorGearLab, REI, Switchback Travel, GearJunkie e Reddit.
- Survey collegata: 81% delle organizzazioni che integrano SEO e AI visibility in un workflow unificato riportano aumento di traffico/lead da piattaforme AI, contro il 36% di chi li gestisce separatamente.
- 45% dei marketing leader non riesce a misurare accuratamente la visibilità del brand nelle risposte AI; solo il 9% ha strumenti per tracciare tutte le metriche rilevanti su tutte le piattaforme.

> Fonte: [ai-visibility-index.semrush.com](https://ai-visibility-index.semrush.com/) · [Comunicato 2026](https://www.semrush.com/news/463141-semrush-releases-expanded-2026-ai-visibility-index-analyzing-126-million-ai-search-prompts/)

---

## 11. Copertura, limiti, pricing

### Copertura geografica

- Visibility Overview / Competitor Research / Prompt Research: 41 paesi (Italia e Svezia inclusi) + scala worldwide.
- Brand Performance: 68.500 località (paesi, stati, regioni, città, globale), 53 lingue.
- Prompt Tracking: 220+ paesi e territori.

### Limiti dichiarati

- **Nessun trial gratuito** per l'AI Visibility Toolkit.
- Export CSV: max 1.000 righe per export, 10 export/giorno.
- Prompt Tracking: solo desktop, niente Estimated Traffic né SoV.
- Brand Performance: nessuna analisi per sottocartella; il dominio è trattato come rappresentazione del brand complessivo.
- Cooldown 14 giorni per slot dominio.

### Pricing (agosto 2026)

| Piano                 | Prezzo       | Contenuto AI                                                                                                                               |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Free                  | $0           | AI mentions, citations, visibility score; audit 100 pagine                                                                                 |
| AI Visibility Toolkit | $99/mese     | 1 folder, 1 dominio Brand Performance, 300 query/giorno AI Analysis, 1.000 Prompt Research, 25 prompt tracking, 100 pagine AI Search Check |
| Semrush One Starter   | da $199/mese | 5 siti, 50 prompt, 500 keyword                                                                                                             |
| Semrush One Pro+      | —            | 15 siti, 100 prompt, 1.500 keyword                                                                                                         |
| Semrush One Advanced  | —            | 40 siti, 200 prompt, 5.000 keyword                                                                                                         |
| Enterprise AIO        | custom       | Tracking illimitato                                                                                                                        |

Add-on: dominio aggiuntivo Brand Performance $99/mese; +50 prompt $60/mese; licenza per sub-user $99.

### Disclaimer metodologico di Semrush

Dichiarazione esplicita e onesta nella KB: la ricerca AI e le risposte degli LLM sono in rapido cambiamento e altamente personalizzate, quindi **nessuna piattaforma può fornire numeri esatti** sulla visibilità. Le metriche sono presentate come **"segnali direzionali affidabili"**, utili per individuare trend e fare benchmark, non come valori assoluti.

---

## 12. Accesso programmatico

- **Semrush API**: https://developer.semrush.com/api/
- **Semrush MCP**: https://www.semrush.com/mcp/ — server MCP ufficiale per accedere al dataset dagli assistenti AI. Documentazione: [KB 1618](https://www.semrush.com/kb/1618-mcp)
- **App Center**: https://www.semrush.com/apps/

Nota: la documentazione pubblica non chiarisce quali metriche AI Visibility siano esposte via API pubblica. Da verificare direttamente sul portale developer.

---

## 13. Indice delle fonti primarie

**Metodologia e dati**

- KB 1607 — Where does the data come from: https://www.semrush.com/kb/1607-semrush-ai-visibility-data
- KB 1594 — AI Visibility Metrics: https://www.semrush.com/kb/1594-ai-seo-metrics
- KB 1626 — Semrush Features for AI Visibility: https://www.semrush.com/kb/1626-ai-visibility-features

**Report**

- KB 1493 — AI Visibility Toolkit (hub): https://www.semrush.com/kb/1493-ai-visibility-toolkit
- KB 1496 — Getting Started: https://www.semrush.com/kb/1496-getting-started-with-ai-visibility-toolkit
- KB 1596 — Visibility Overview: https://www.semrush.com/kb/1596-visibility-overview-report
- KB 1598 — Competitor Research: https://www.semrush.com/kb/1598-competitor-research-report
- KB 1597 — Prompt Research: https://www.semrush.com/kb/1597-prompt-research-report
- KB 1595 — Brand Performance: https://www.semrush.com/kb/1595-brand-performance-reports
- KB 1503 — Prompt Tracking: https://www.semrush.com/kb/1503-prompt-tracking

**Audit**

- KB 1601 — AI Search Health: https://www.semrush.com/kb/1601-ai-search-health-audit
- KB 1571 — Blocked from AI Search: https://www.semrush.com/kb/1571-blocked-from-ai-search-site-audit
- KB 31 — Site Audit: https://www.semrush.com/kb/31-site-audit

**Studi originali**

- Content optimization for AI search: https://www.semrush.com/blog/content-optimization-ai-search-study/
- Technical SEO impact on AI search: https://www.semrush.com/blog/technical-seo-impact-on-ai-search-study/
- How to measure AI share of voice: https://www.semrush.com/blog/how-to-measure-ai-share-of-voice/

**Benchmark e enterprise**

- AI Visibility Index: https://ai-visibility-index.semrush.com/
- Comunicato Index 2026: https://www.semrush.com/news/463141-semrush-releases-expanded-2026-ai-visibility-index-analyzing-126-million-ai-search-prompts/
- Enterprise AIO: https://www.semrush.com/lp/enterprise-aio/en/

**Altri report AI**

- KB 1573 — AI PR: https://www.semrush.com/kb/1573-ai-pr
- KB 812 — Content Toolkit: https://www.semrush.com/kb/812-content-toolkit
- AI Traffic dashboard: https://www.semrush.com/analytics/traffic/ai-traffic
