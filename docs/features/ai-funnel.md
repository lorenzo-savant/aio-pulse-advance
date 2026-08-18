# AI Funnel

| Field | Value |
|---|---|
| **Route** | `/dashboard/ai-funnel` |
| **API** | `GET /api/reports/exec-summary?brand_id=…` |
| **Service** | [`src/lib/services/exec-summary.ts`](../../src/lib/services/exec-summary.ts) |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
The **client-presentation surface**. Where the other Insights pages each own one metric, this page arranges the existing metrics into a funnel narrative that can be walked top to bottom in a meeting, and exports that narrative in three formats.

Three funnel stages, in render order:

| Stage | Title | What it answers |
|---|---|---|
| Top | Visibility | Where you show up across AI engines and how share of voice compares to competitors — the headline that starts the conversation |
| Middle | Visual proof — Real AI responses | The latest answers naming the brand, response text highlighted. Concrete evidence to drop into a deck |
| Bottom | Downstream signal | Branded-search growth + the AI-assist verdict (is AI exposure driving direct searches, or cannibalising top-of-funnel?) plus citation freshness for the pages AI actually pulls |

The middle stage is the reason the page exists: abstract percentages do not persuade a client, verbatim engine answers do.

Three exports sit in the header:
- **Executive summary** (Markdown) — the 4-question structure from `exec-summary.ts`: Q1 where do we appear (citation frequency + prompt coverage), Q2 how accurately are we described (sentiment + driver narrative), Q3 are we winning or losing vs competitors (share of voice + drivers), Q4 are business objectives improving (branded search + AI assist).
- **Client deck** — Tier 1 / Tier 2 / Tier 3 framing.
- **6-month trend** — mention rate, sentiment, and branded search on one timeline.

### Input
- `brand_id` (UUID), required.

### Output
```ts
{
  period: { from: string, to: string },
  q1: { citationFrequency: number, promptCoverage: number, engines: [...] },
  q2: { sentiment: ..., drivers: string[] },
  q3: { shareOfVoice: ..., drivers: string[] },
  q4: { brandedSearch: ..., aiAssist: ... }
}
```

### Data signals
Read-only. Composes over `monitoring_results`, `citation_snapshots`, `brand_health_scores` and `gsc_performance` (the branded-search half of Q4 needs GSC).

### Links
- Q4's branded-search and AI-assist inputs come from the same GSC ingestion as [`brand-overview`](./brand-overview.md)
- Share-of-voice arithmetic: [`competitor`](./competitor.md)

---

## 🇮🇹 Italiano

### Cosa fa
La **superficie da presentazione al cliente**. Dove le altre pagine di Analisi possiedono una metrica ciascuna, questa dispone le metriche esistenti in una narrativa a imbuto percorribile dall'alto al basso in riunione, e la esporta in tre formati.

Tre stadi, in ordine di rendering:

| Stadio | Titolo | A cosa risponde |
|---|---|---|
| Alto | Visibilità | Dove compari sui motori AI e come si confronta la tua quota di voce — il numero che apre la conversazione |
| Medio | Prova visiva — risposte AI reali | Le risposte più recenti che nominano il brand, con il testo evidenziato. Evidenza concreta da mettere in una presentazione |
| Basso | Segnale a valle | Crescita della ricerca brandizzata + verdetto AI-assist (l'esposizione AI genera ricerche dirette o cannibalizza la parte alta dell'imbuto?) più freschezza delle citazioni |

Lo stadio medio è la ragione per cui la pagina esiste: le percentuali astratte non convincono un cliente, le risposte testuali dei motori sì.

Tre export nell'header: **executive summary** (Markdown, struttura a 4 domande), **client deck** (Tier 1 / 2 / 3), **trend 6 mesi** (mention rate, sentiment, ricerca brandizzata su un'unica timeline).

Le quattro domande dell'executive summary: Q1 dove compariamo, Q2 quanto accuratamente veniamo descritti, Q3 stiamo vincendo o perdendo sui competitor, Q4 gli obiettivi di business stanno migliorando.

### Input
- `brand_id` (UUID), obbligatorio.

### Output
Stessa shape della versione EN.

### Dati generati
Sola lettura. Compone su `monitoring_results`, `citation_snapshots`, `brand_health_scores` e `gsc_performance`.

---

## 🇸🇪 Svenska

### Vad det gör
**Ytan för kundpresentation.** Där de andra Insikter-sidorna äger ett mätvärde var, ordnar den här sidan de befintliga mätvärdena i en trattberättelse som kan gås igenom uppifrån och ner i ett möte — och exporterar berättelsen i tre format.

Tre steg, i renderingsordning:

| Steg | Titel | Vad det svarar på |
|---|---|---|
| Topp | Synlighet | Var ni syns i AI-motorerna och hur er röstandel står sig mot konkurrenterna |
| Mitt | Visuellt bevis — verkliga AI-svar | De senaste svaren som nämner varumärket, med texten markerad. Konkret underlag för en deck |
| Botten | Nedströmssignal | Tillväxt i varumärkessökningar + AI-assist-domen (driver AI-exponeringen direkta sökningar, eller kannibaliserar den toppen av tratten?) plus citeringsfärskhet |

Mittsteget är skälet till att sidan finns: abstrakta procent övertygar inte en kund, ordagranna motorsvar gör det.

Tre exporter i huvudet: **executive summary** (Markdown, fyrfrågestruktur), **kunddeck** (Tier 1 / 2 / 3), **6-månaderstrend**.

### Indata
- `brand_id` (UUID), obligatorisk.

### Utdata
Samma form som EN-versionen.

### Data
Endast läsning. Komponerar över `monitoring_results`, `citation_snapshots`, `brand_health_scores` och `gsc_performance`.

---

## Limits & known issues
- **Q4 silently degrades without GSC** — branded search and the AI-assist verdict both need `gsc_performance`. Without a connected Search Console property the bottom of the funnel renders with empty values rather than an explanation, which is the worst place for a gap since it is the stage a client cares about most.
- **6-month trend needs 6 months** — the export runs on whatever history exists; a brand monitored for two weeks produces a two-week "6-month" chart with no warning on the artefact itself.
- **Exports are point-in-time** — nothing is stored. Regenerating after new monitoring data produces a different document with the same filename.

## Cost
- DB reads only; the exec-summary service composes existing rows and does not call a model.

## Data scope
- Period is derived from available data, not from a user-supplied range.
