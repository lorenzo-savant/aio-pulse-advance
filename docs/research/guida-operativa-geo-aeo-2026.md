# Guida operativa GEO / AEO / AI SEO 2026

### Come farsi citare e raccomandare dagli LLM — passo per passo

> Base metodologica: articolo di Edward Sturm, _"AI SEO/GEO/AEO: How to Get Shown in LLMs in 2026"_ (edwardsturm.com, marzo 2026), rielaborato e ampliato con tool, template e workflow operativi.

> **Nota repo:** documento esterno salvato verbatim (fornito il 19/8/2026). Per AEO Pulse
> il punto strategico è la Fase 1 (query fan-out): il pipeline di monitoraggio riceve già
> le query di ricerca da Gemini (`webSearchQueries` / step `google_search_call` della
> Interactions API) e **oggi le scarta** — catturarle automatizzerebbe "la fase che quasi
> nessuno fa". Vedi la valutazione in coda alla sessione del 19/8 e la proposta fan-out.

---

## Il principio in una frase

Gli LLM **non inventano le raccomandazioni**: quando una domanda dipende da "cosa è vero adesso", il modello lancia 1–3 ricerche reali su motori (in larga parte Google/Bing) e cita ciò che trova. Quindi il lavoro è: **scoprire con quali stringhe cerca l'AI**, e poi **dominare quelle stringhe** con pagine, video e citazioni di terzi.

**Regola pratica per capire se scatta la ricerca:**

| Tipo di domanda | Ricerca web? |
|---|---|
| "Qual è il miglior X nel 2026", "prezzi di", "chi offre", "recensioni" | **Sì**, quasi sempre |
| "Come funziona X", "cosa significa Y", definizioni, concetti | **No**, risponde dai pesi del modello |

Corollario importante: **GEO ≠ disciplina separata dalla SEO.** È SEO applicata a query in linguaggio naturale, lunghe, conversazionali. Tutto ciò che sai già di SEO tecnica, on-page e link building resta valido.

---

# FASE 0 — Setup: cosa ti serve prima di iniziare

Prepara questi account/strumenti. Segnati dove sono, ti serviranno in continuazione.

### Obbligatori (gratis)

| Strumento | Dove | A cosa serve qui |
|---|---|---|
| **ChatGPT** (account free basta) | chatgpt.com | Estrarre il query fan-out via DevTools |
| **Perplexity** | perplexity.ai | Vedere le query in chiaro, senza DevTools |
| **Google AI Mode / Gemini** | google.com → tab "AI Mode" / gemini.google.com | Verificare le citazioni su ecosistema Google |
| **Google Search Console** | search.google.com/search-console | Trovare le query lunghe in linguaggio naturale reali |
| **Google Analytics 4** | analytics.google.com | Misurare il traffico referral che arriva dagli LLM |
| **Browser desktop con DevTools** | Chrome, Edge, Brave o Arc (F12) | Ispezionare la rete di ChatGPT |
| **Foglio di calcolo** | Google Sheets / Airtable / Notion | La "Prompt Map", il cuore operativo |

### Consigliati (a pagamento)

| Strumento | Costo indicativo | Uso |
|---|---|---|
| **Ahrefs** o **Semrush** | ~€100+/mese | Volumi, SERP analysis, backlink gap, tool GEO integrati |
| **Profound / Peec AI / Otterly / AIO Pulse** | €50–500/mese | Monitoraggio ricorrente delle menzioni brand negli LLM |
| **AB Newswire** (o simili) | ~$80/comunicato, ~$6 se a pacchetto | Distribuzione comunicati stampa indicizzabili |
| **Descript / CapCut / Opus Clip** | €0–30/mese | Produzione e sottotitolazione video YouTube |
| **Screaming Frog** | €239/anno | Audit tecnico, verifica title/H1/meta a tappeto |

> **Nota per il tuo caso (AIO Pulse):** le Fasi 1, 5 e 6 di questa guida sono esattamente il ciclo che un tool di AI visibility automatizza. Farle a mano una volta, su un cliente reale, ti serve sia come deliverable sia come specifica di prodotto.

---

# FASE 1 — Scoprire con cosa cerca davvero l'AI

Questa è la fase che quasi nessuno fa. È il vantaggio competitivo.

## 1.A — Estrarre il query fan-out da ChatGPT (metodo DevTools)

Serve un **browser desktop**. Non funziona da app mobile.

**Passo per passo:**

1. Vai su **chatgpt.com** e fai la domanda che un tuo cliente ideale farebbe.
   _Esempio per un cliente contabile svedese:_ `Vilken redovisningsbyrå ska jag välja i Falun?`
2. Attendi che la risposta sia completa (deve aver mostrato "Ricerca sul web…").
3. Click destro sulla pagina → **Ispeziona** (o `F12` / `Ctrl+Shift+I` / `Cmd+Option+I` su Mac).
4. Nel pannello DevTools apri la tab **Network** (Rete).
5. Guarda la **barra degli indirizzi**: l'URL è tipo `chatgpt.com/c/68f2a1b3-...`. **Copia tutto ciò che viene dopo `/c/`** — è l'ID della conversazione.
6. Incolla quell'ID nel campo **Filter** in alto a sinistra nel pannello Network.
7. **Ricarica la pagina** (`F5`). Ora nella lista compaiono solo le chiamate relative a quella conversazione.
8. Clicca sulla riga che corrisponde alla conversazione (spesso ha l'icona arancione/gialla delle parentesi graffe `{}`, tipo `conversation/<id>`).
9. Apri la tab **Response** (o **Preview**).
10. Cerca dentro il codice con `Ctrl+F` la parola **`queries`** (prova anche `search_query`, `open_url`, `citations`).
11. **Ecco le stringhe con cui ChatGPT ha cercato su Google.** Di solito ne trovi **da 1 a 3**.

> Questo è il famoso **"query fan-out"**: l'LLM espande la tua domanda in più ricerche parallele e sintetizza i risultati.

**Se non trovi nulla:**

- La domanda non ha attivato la ricerca (era concettuale) → riformulala in modo che dipenda dall'attualità: aggiungi "2026", "migliore", "prezzi", "vicino a me", "recensioni".
- Prova con **Preview** invece di Response, o cerca `"search"` invece di `"queries"`.
- Assicurati di aver ricaricato la pagina **dopo** aver impostato il filtro.

## 1.B — Il metodo veloce: Perplexity

Perplexity **mostra le ricerche apertamente**, senza DevTools.

1. Vai su **perplexity.ai**.
2. Fai la stessa domanda.
3. Sotto la risposta clicca su **"Sources"** / sull'icona delle ricerche: vedrai elencate le query testuali usate.
4. Annota anche **quali domini vengono citati** — è la tua lista di competitor GEO e di target per link/PR.

Usa Perplexity per **scoprire velocemente** e ChatGPT/DevTools per **confermare** (i fan-out differiscono tra modelli).

## 1.C — Google AI Mode e Gemini

1. Fai la ricerca su **google.com**, apri la scheda **"AI Mode"** (o AI Overview in cima ai risultati).
2. Espandi le fonti citate (icona link / "Mostra tutto").
3. Annota i domini citati e i formati (pagina prodotto? listicle? YouTube? Reddit? PDF?).
4. Ripeti su **gemini.google.com** con web grounding attivo.

## 1.D — Ripetere in modo sistematico

Non fare 3 domande. Fanne **30–60**, organizzate in categorie:

| Categoria di prompt | Esempio | Perché conta |
|---|---|---|
| **Branded** | "Cosa fa [tuo brand]?" "[tuo brand] recensioni" | Controlli la narrativa su di te |
| **Competitor branded** | "Alternative a [competitor]" "[competitor] vs" | Rubi traffico caldo |
| **Categoria / non-branded** | "Miglior software di [categoria] 2026" | Volume alto, competizione alta |
| **Problema / job-to-be-done** | "Come faccio a [problema che risolvi]" | Intento reale, converte |
| **Locale** | "[servizio] a [città]" | Facilissimo da vincere in nicchia geo |
| **Comparativo** | "X è meglio di Y per [caso d'uso]?" | Gli LLM adorano le tabelle comparative |
| **Prezzi / commerciale** | "Quanto costa [servizio]" | Intento transazionale |

Fai ogni domanda **nella lingua del mercato**. Un prompt in svedese produce un fan-out completamente diverso da uno in inglese: se lavori su clienti svedesi, il set di test va fatto in **svedese**, non tradotto.

---

# FASE 2 — Costruire la "Prompt Map" (il documento madre)

Apri un Google Sheet e crea queste colonne. È il documento che guiderà tutto il resto del lavoro (e che consegni al cliente).

| Colonna | Contenuto | Note |
|---|---|---|
| `Prompt` | La domanda utente testata | Nella lingua del mercato |
| `Lingua` | IT / SV / EN | |
| `Motore` | ChatGPT / Perplexity / AI Mode / Gemini | |
| `Data test` | | Ritesta ogni 30 giorni |
| `Query fan-out 1/2/3` | Le stringhe estratte | **Il campo più prezioso** |
| `Siamo citati?` | Sì / No / Menzione senza link | |
| `Posizione menzione` | 1° / in lista / nota a margine | |
| `Domini citati` | I 3–8 domini nelle fonti | Target per link e PR |
| `Formato vincente` | Pagina servizio / listicle / YouTube / Reddit / forum / PDF | Ti dice **cosa produrre** |
| `Sentiment` | Positivo / neutro / negativo | Alert per reputation |
| `Abbiamo una pagina?` | URL o "manca" | |
| `Priorità` | Alta / Media / Bassa | Vedi criterio sotto |
| `Azione` | Creare pagina / aggiungere H2 / FAQ / video / PR | |
| `Owner + deadline` | | |

### Come assegnare la priorità (non tutti i prompt valgono uguale)

Un LLM può raccomandarti per un prompt che porta: **(a) nessun traffico**, **(b) traffico ma zero conversioni**, **(c) conversioni**. Ovvio quale vuoi.

Punteggio 1–5 su tre assi, poi ordina per totale:

- **Intento commerciale** — chi fa questa domanda è vicino all'acquisto?
- **Vincibilità** — i domini citati sono battibili o è tutto G2/Wikipedia/testate nazionali?
- **Rilevanza** — se ci citano, il lead è davvero in target?

Parti dai prompt **ad alto intento e alta vincibilità**, anche se "piccoli". I prompt locali e i comparativi di nicchia si vincono in settimane; "miglior CRM 2026" no.

---

# FASE 3 — Vedere quanto traffico AI stai già ricevendo (GA4)

Configurazione dell'esplorazione, passo per passo.

1. Vai su **analytics.google.com** → seleziona la proprietà.
2. Menu a sinistra: **Esplora** (Explore).
3. Clicca **Esplorazione in formato libero** (Blank / Free form).
4. **Dimensioni** → `+` → aggiungi:
   - `Origine/mezzo sessione` (Session source / medium)
   - `Percorso pagina + stringa di query` (Page path + query string)
5. **Metriche** → `+` → aggiungi: `Visualizzazioni` (Views) e `Accessi` (Entrances).
6. Nella colonna **Impostazioni tab**:
   - **Righe**: trascina `Origine/mezzo sessione`, poi `Percorso pagina + stringa di query`
   - **Mostra righe**: `250`
   - **Righe nidificate**: `Sì`
   - **Valori**: `Accessi` e `Visualizzazioni`
7. **Filtri** → seleziona `Origine/mezzo sessione` → condizione **corrisponde a regex** → incolla:

```
.*chatgpt.*|.*openai.*|.*perplexity.*|.*gemini.*google.*|.*copilot.*|.*claude.*|.*anthropic.*|.*mistral.*|.*deepseek.*|.*grok.*|.*x\.ai.*|.*meta\.ai.*|.*edgeservices.*|.*bing.*chat.*|.*writesonic.*|.*jasper.*|.*copy\.ai.*|.*phind.*|.*you\.com.*|.*neeva.*|.*poe\.com.*
```

8. **Applica**. Imposta l'intervallo date su **ultimi 90 giorni** e confronta col periodo precedente.

**Cosa leggere nel report:**

- Quali **pagine specifiche** vengono citate più spesso → sono il tuo modello da replicare.
- Il trend mese su mese come **% del traffico totale** (in molti settori l'AI referral è passato dallo 0,5% al 3–8%).
- Le pagine con molti accessi ma **zero conversioni** → l'LLM ti cita per il prompt sbagliato.

> **Salva l'esplorazione** con un nome tipo `AI Referral — [cliente]` così la riapri ogni mese senza rifare il setup. E in **Amministrazione → Eventi conversione** assicurati che almeno un evento di conversione sia attivo, altrimenti misuri solo vanity metrics.

---

# FASE 4 — Estrarre le query "AI-assisted" da Search Console

Le ricerche generate o influenzate dall'AI sono **lunghe e in linguaggio naturale**. Filtrale così:

1. Vai su **search.google.com/search-console** → seleziona la proprietà.
2. Menu a sinistra → **Rendimento** → **Risultati della ricerca**.
3. In alto clicca **+ Nuovo** / **Aggiungi filtro** → **Query**.
4. Nel menu a tendina scegli **Personalizzato (regex)**.
5. Verifica che l'operatore sia **"Corrisponde a regex"** e incolla:

```
(\b\w+\b\s){7,}
```

_(= query con almeno 7 parole)_

6. Clicca **Applica**.
7. In alto attiva anche il toggle **Posizione media** (oltre a Clic e Impressioni).
8. Scorri fino alla tabella **Query** e ordina per Impressioni, poi per Clic.

**Varianti utili del filtro:**

- Solo domande: regex `^(come|quale|qual|perché|dove|quanto|chi|cosa|migliore)` — in svedese: `^(hur|vilken|vilket|varför|var|hur mycket|vem|vad|bäst)`
- Confronti: regex `\b(vs|contro|oppure|alternativa|meglio di)\b`
- Escludi il brand: filtro Query → "Non contiene" → nome brand

9. **Esporta** in Google Sheets (icona export in alto a destra) e incolla nella Prompt Map.

**Cosa cerchi:** query con **molte impressioni, pochi clic, posizione 5–20**. Sono quelle dove esisti ma non abbastanza: sono i quick win.

> In Search Console trovi anche il rapporto sulle **prestazioni in AI Mode** dove disponibile — controlla se il tuo account lo espone, perché separa il traffico AI dai blue link classici.

---

# FASE 5 — Cosa fare con le query trovate (on-page)

Qui trasformi i dati in pagine. Per ogni query fan-out ad alta priorità:

## 5.A — Pagina dedicata (per le query top)

Una query = una pagina. Usa la **stringa esatta del fan-out** in tutti e cinque questi punti:

| Elemento | Come scriverlo |
|---|---|
| **Title tag** | La query all'inizio, max ~60 caratteri. `Redovisningsbyrå i Falun — priser och tjänster \| [Brand]` |
| **Meta description** | La query nei primi 90 caratteri + un motivo per cliccare, max ~155 |
| **URL slug** | La query in kebab-case, corto: `/redovisningsbyra-falun/` |
| **H1** | La query, quasi identica al title ma non copia-incolla |
| **Prima frase** | La query dentro la **prima frase del primo paragrafo**, con la risposta diretta |

**Struttura della pagina che gli LLM citano volentieri:**

1. **Risposta diretta in 40–60 parole subito sotto l'H1.** Autoconclusiva, estraibile senza contesto. È il blocco che l'LLM copia.
2. **Elenco puntato o tabella** con i fatti chiave (prezzi, tempi, requisiti, specifiche). Le tabelle vengono citate in modo sproporzionato.
3. **H2 = domande correlate**, ognuna seguita dalla sua risposta breve.
4. **Dati concreti, numeri, date, nomi.** Gli LLM privilegiano contenuti verificabili e specifici rispetto al marketing vago.
5. **Autore + data aggiornamento visibili.** Segnale di freschezza e di E-E-A-T.
6. **Fonti citate** con link in uscita a fonti autorevoli.
7. **FAQ in fondo** con le domande esatte prese da GSC.
8. **Markup Schema.org**: `FAQPage`, `Article`, `Organization`, `Product`/`Service`, `BreadcrumbList`. Validalo su `validator.schema.org`.

## 5.B — Sezioni H2 nelle pagine esistenti (per le query medie)

Non serve una pagina nuova per tutto. Se hai già una pagina semanticamente vicina, **aggiungi un H2 con la query esatta** e 100–200 parole di risposta. È l'intervento a più alto ROI/ora.

## 5.C — Interlinking

- Da ogni pagina rilevante, **linka alla nuova pagina con anchor text = la query**.
- Dalla home o dalle pagine più forti, almeno 1 link diretto.
- Massimo 3 click dalla home.
- Aggiorna la sitemap XML e inviala in GSC (**Sitemap → Aggiungi**), poi usa **Controllo URL → Richiedi indicizzazione**.

## 5.D — Accessibilità tecnica ai crawler AI

Verifica nel `robots.txt` di **non bloccare** i bot che ti servono:

```
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /
```

Altri controlli:

- **Il contenuto deve essere nell'HTML server-side.** Contenuto che appare solo dopo idratazione JS spesso non viene visto. Su Next.js: usa SSR/SSG per le pagine target, non client-side fetching.
- Niente contenuti chiave dentro accordion che caricano via JS.
- Tempi di risposta bassi: molti crawler AI hanno timeout aggressivi.
- Considera un file **`/llms.txt`** in root con indice e descrizione delle pagine chiave (standard emergente, costo zero, potenziale upside).

---

# FASE 6 — Off-page: farsi citare da altri

Gli LLM citano **fonti terze** più volentieri del tuo sito. Qui si vince davvero.

## 6.A — YouTube (priorità massima)

YouTube è oggi il sito più citato nella ricerca AI — ed è anche il più cliccato su Google secondo i report trimestrali di Datos.

**Operativamente:**

1. Per **ogni pagina importante** che crei, fai un video.
2. **Titolo del video** = la query target, quasi identica.
3. **Descrizione**: la query nelle prime 2 righe + trascrizione riassunta + link alla pagina.
4. **Pronuncia la query ad alta voce nel video** → finisce nella trascrizione automatica, che è ciò che gli LLM leggono.
5. Carica una **trascrizione/sottotitoli manuali** (Descript o YouTube Studio → Sottotitoli).
6. Capitoli con timestamp nella descrizione, nominati con le query correlate.
7. Per gli **Shorts**: gira una volta, ridistribuisci su TikTok, Instagram Reels, LinkedIn e Facebook. Massimizzi copertura AI e brand insieme.

## 6.B — Contenuti "best-of" auto-promozionali e annunci positivi

Due formati che gli LLM citano in modo dimostrabile:

**1. Listicle "migliori X" sul tuo sito dove ti includi.** Esempio noto: Asana pubblica una classifica dei migliori software di project management dove si posiziona al primo posto — e gli LLM la citano. Glen Allsopp (Ahrefs) ha documentato il fenomeno: `ahrefs.com/blog/best-lists-research/`

**2. Blog post di annuncio positivo aziendale.** Tipo "[Brand] nominata Migliore [categoria] 2026". Ranka, viene citato, segnala credibilità.

**Regole d'uso:**

- Gli **annunci positivi**: quanti ne vuoi, sono comunicazione aziendale normale.
- I **listicle auto-promozionali**: con parsimonia, e **onestamente**. Includi competitor reali, criteri dichiarati, e vinci dove sei realmente il migliore (per un caso d'uso specifico, non in assoluto). Un listicle palesemente falso danneggia il brand quando qualcuno lo verifica — e sempre più utenti verificano.

## 6.C — Comunicati stampa a basso costo

Meccanismo: il comunicato viene distribuito su portali che rankano su Google → gli LLM li leggono e li citano → chi cerca il tuo brand trova conferme positive.

**Come si fa:**

1. Scrivi il comunicato: chi sei, per cosa sei il riferimento, riconoscimenti, valutazioni.
2. Distribuisci via **AB Newswire** (~$80 a comunicato, oppure pacchetti che portano il costo unitario molto più in basso) o servizi equivalenti. In Europa esistono anteprime locali: **MyNewsdesk** (forte in Svezia), **Presskontakt**, **PR Newswire**.
3. Il comunicato viene indicizzato, gli LLM lo trovano quando cercano il tuo brand o la tua categoria.
4. Ripeti con cadenza regolare su notizie reali.

**Avvertenza onesta:** questa tattica funziona ma sta in zona grigia. Se il comunicato afferma "5/5 stelle" o "top rated" **senza che sia vero e verificabile**, stai producendo pubblicità ingannevole — con implicazioni legali concrete in UE (Direttiva sulle pratiche commerciali sleali) e in Svezia (Marknadsföringslagen, sorveglianza Konsumentverket). Google penalizza già i network di comunicati di puro spam. **Usa la meccanica di distribuzione, ma con claim veri e attribuibili**: "valutazione 4,8/5 su 120 recensioni Google", "certificati ISO 27001 da marzo 2026". Funziona uguale e regge alla verifica.

## 6.D — Le altre fonti che gli LLM adorano

Guarda la colonna "Domini citati" della tua Prompt Map: probabilmente vedrai ricorrere questi.

| Fonte | Come lavorarci |
|---|---|
| **Reddit** | Partecipa ai subreddit di settore in modo genuino, per mesi. Rispondi nei thread che rankano per le tue query. Mai spam. |
| **Wikipedia** | Se il brand ha notabilità reale, cura la voce. Se no, contribuisci a voci di categoria correlate con fonti solide. |
| **Directory / marketplace di settore** | G2, Capterra, Trustpilot, Clutch — profili completi e recensioni reali |
| **Podcast come ospite** | Le trascrizioni vengono indicizzate e citate. Cerca podcast di nicchia, non i grandi. |
| **LinkedIn** | Post con la query nel testo; rankano e vengono citati |
| **Forum verticali e Q&A** | Quora, Stack Exchange, forum settoriali locali |
| **Testate di settore** | Guest post e digital PR con dati originali (survey, benchmark) |

**Il trucco più efficace:** invece di farti citare tu, **fatti includere nelle liste che l'AI già cita**. Prendi le 5 URL che compaiono nei fan-out del tuo prompt principale, contatta gli autori e chiedi l'inserimento. È molto più veloce che costruire autorevolezza da zero.

---

# FASE 7 — Difendersi dagli attacchi reputazionali

Se un LLM ripete affermazioni false o negative sul tuo brand, il metodo di questa guida è anche l'antidoto:

1. Estrai il **fan-out esatto** che il modello usa quando l'utente chiede del tuo brand (Fase 1).
2. Scopri **quale fonte** genera il contenuto negativo (colonna "Domini citati").
3. **Copri quelle stesse query** con contenuti tuoi di ogni tipo: pagina, video, comunicato, post social, risposte in thread.
4. Pubblica **recensioni positive vere e verificabili** su quelle stesse query.
5. Se la fonte negativa è diffamatoria e falsa, richiedi la rimozione al publisher; in seconda battuta usa i canali di segnalazione dei singoli provider AI.
6. Ritesta ogni 2 settimane finché la narrativa non cambia.

---

# FASE 8 — Ritmo operativo: cosa fare e quando

## Settimana 1 — Baseline

- [ ] Setup GA4 exploration + GSC regex (Fasi 3 e 4)
- [ ] Test di 30–60 prompt su ChatGPT, Perplexity, AI Mode (Fase 1)
- [ ] Compilazione completa della Prompt Map (Fase 2)
- [ ] Audit tecnico: robots.txt, SSR, schema, velocità (Fase 5.D)
- [ ] **Deliverable:** report baseline con % di visibilità per categoria di prompt

## Settimane 2–4 — Produzione

- [ ] 3–5 pagine dedicate per i prompt top priority
- [ ] 10–15 sezioni H2 aggiunte su pagine esistenti
- [ ] FAQ aggiornate con le query GSC reali
- [ ] Interlinking + rinvio sitemap
- [ ] 2–3 video YouTube sui prompt principali

## Mensile — Ciclo continuo

- [ ] Ritestare gli stessi prompt (stesso wording, altrimenti non è comparabile) e aggiornare la Prompt Map
- [ ] Controllare GA4: trend AI referral e conversioni per pagina
- [ ] Controllare GSC: nuove query lunghe emerse
- [ ] 1 annuncio/comunicato aziendale
- [ ] 2–4 video
- [ ] Outreach: 5 inserimenti richiesti in liste già citate

## Trimestrale

- [ ] Espandere il set di prompt (+20)
- [ ] Analisi competitor: chi ha guadagnato citazioni e con quale formato
- [ ] Revisione contenuti vecchi: aggiornare date, dati, prezzi
- [ ] Report al cliente: prima/dopo su share of voice negli LLM

---

# Le metriche che contano davvero

| Metrica | Dove | Target |
|---|---|---|
| **Citation rate** | Prompt Map: % di prompt in cui compari | Crescita mese su mese |
| **Share of voice** | Tue menzioni / totale brand menzionati nei fan-out | vs. competitor diretti |
| **Sentiment** | Prompt Map | ≥90% positivo/neutro |
| **AI referral sessions** | GA4 exploration | Crescita + % sul totale |
| **Conversioni da AI referral** | GA4 (evento conversione) | **La metrica finale** |
| **Query 7+ parole in top 10** | GSC regex | Crescita |

Attenzione a un limite reale: il traffico AI referral **sottostima** l'impatto. Molti utenti leggono la risposta dell'LLM, non cliccano, e arrivano da te più tardi via ricerca diretta del brand. Monitora quindi anche il **volume di ricerche branded** in GSC come proxy dell'effetto indiretto.

---

# Errori da evitare

1. **Testare i prompt in inglese per un mercato locale.** Il fan-out cambia completamente per lingua.
2. **Cambiare il wording del prompt tra un test e l'altro** → i dati non sono più comparabili. Congela il set di test.
3. **Ottimizzare per volume invece che per intento.** Meglio essere citati per 20 prompt che convertono che per 200 che non portano nulla.
4. **Contenuto gonfiato.** Gli LLM estraggono fatti. 500 parole dense battono 3000 parole di riempimento.
5. **Ignorare la SEO classica.** Se non ranki su Google, l'LLM non ti trova. Il fan-out passa dai motori.
6. **Fare tutto una volta sola.** I modelli si aggiornano, le SERP cambiano. È un ciclo, non un progetto.
7. **Claim falsi nei comunicati.** Rischio legale reale e danno reputazionale quando emergono.
8. **Bloccare i crawler AI** nel robots.txt senza saperlo (succede spessissimo con configurazioni di sicurezza standard).

---

# Fonti e approfondimenti

- Articolo originale: `https://edwardsturm.com/articles/ai-seo-geo-aeo-get-shown-llms-2026/`
- Struttura pagine dedicate (metodo Pareto SEO): `https://edwardsturm.com/articles/pareto-seo/`
- Ricerca sui "best-of" listicle di Ahrefs: `https://ahrefs.com/blog/best-lists-research/`
- Comunicati stampa per SEO e LLM: `https://edwardsturm.com/articles/how-to-use-press-releases-for-seo-and-llms/`
- Dati sul click share: `https://datos.live/`

> **Nota di trasparenza:** l'articolo originale si chiude con la promozione di un corso a pagamento dell'autore. Il metodo descritto sopra è però completamente eseguibile con gli strumenti gratuiti elencati in Fase 0.

---

## Documenti collegati

- `sintesi-critica-paper-aeo-sharma-dhiman.md` — il quadro accademico e i suoi limiti
- `semrush-vs-aeo-pulse.md` — confronto metodologico con il concorrente principale
- `guida-reddit-seo-strategy.md` — architettura resource → bridge → money page _(non ancora nel repo)_
- `guida-aggiornamento-seo-1-ora.md` — potenziare pagine forti e deboli con dati GSC _(non ancora nel repo)_
