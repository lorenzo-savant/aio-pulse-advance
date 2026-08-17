# Content Optimizer

| Field | Value |
|---|---|
| **Route** | `/dashboard/optimizer` |
| **API** | `GET/POST /api/analyze` |
| **Service** | [`analysis.ts`](../../src/lib/services/analysis.ts), [`citation-quality-scorer.ts`](../../src/lib/services/citation-quality-scorer.ts) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
"Analyze content for AI search visibility & citation readiness." Where [`content-audit`](./content-audit.md) answers *is this URL AI-ready, yes or no, with technical checks*, this page is the **drill-down editing tool**: paste text or point at a URL, pick provider / model / target engine, and get an editable breakdown of why the content scores what it scores.

Panels: overall score, AI summary, intent classification (intent / type / tone / level / audience), intent mapping, per-engine breakdown, keyword density with an optimal-range indicator, SEO radar, cross-engine comparison, and expandable improvement suggestions. Previous analyses are listed inline.

**Citation Quality card.** Scored by [`citation-quality-scorer.ts`](../../src/lib/services/citation-quality-scorer.ts) — pure, deterministic, dependency-free heuristics over HTML and text, **no LLM calls**. It operationalises five measured positive-correlation signals (study period Jul–Aug 2025, 304k cited URLs vs 921k Google-ranking-only URLs):

| Signal | Measured citation lift |
|---|---|
| Clarity & summarization | +33% |
| E-E-A-T signals | +30% |
| Q&A format | +25% |
| Section structure | +23% |
| Structured data | +22% |

Pillar weights are anchored to those correlations, then normalised to sum to 100 so the overall reads as a clean percentage. Secondary content-shape heuristics come from featured-snippet research: low reading level, image alt-text density, lists ≥8 items, tables ≥5 rows / ≥7 columns, ≥10 outbound links — the same shape that wins Google featured snippets also wins AI citations.

The same scorer feeds the Citation Quality card in [`site-audit`](./site-audit.md), so the two surfaces cannot disagree.

### Input
- `mode` — `text` (paste) or `url`.
- `input` — the text or address.
- `provider`, `model`, `engine` (target engine) — all operator-selected.

### Output
```ts
{
  score: number,                 // 0-100 overall
  summary: string,
  intent: { intent, type, tone, level, audience },
  engineBreakdown: Record<string, number>,
  keywords: [{ term: string, occurrences: number, density: number }],
  recommendations: string[]
}
```

### Data signals
Writes `analysis_results` per run (shared with [`content-audit`](./content-audit.md)), which is why runs appear in [`scan-history`](./scan-history.md).

### Links
- Technical/checklist counterpart: [`content-audit`](./content-audit.md)
- Brand-scoped consolidated view: [`site-audit`](./site-audit.md)
- Generation side of the loop: [`content-generator`](./content-generator.md)

---

## 🇮🇹 Italiano

### Cosa fa
"Analizza il contenuto per visibilità nella ricerca AI e prontezza alla citazione." Dove [`content-audit`](./content-audit.md) risponde *questo URL è AI-ready, sì o no, con controlli tecnici*, questa pagina è lo **strumento di drill-down e editing**: si incolla un testo o si punta a un URL, si scelgono provider / modello / motore target, e si ottiene una scomposizione modificabile del perché il contenuto ottiene quel punteggio.

Pannelli: punteggio complessivo, riassunto AI, classificazione dell'intento (intento / tipo / tono / livello / pubblico), mappatura intento, scomposizione per motore, densità parole chiave con indicatore di range ottimale, radar SEO, confronto cross-engine, suggerimenti di miglioramento espandibili. Le analisi precedenti sono elencate inline.

**Card Citation Quality.** Calcolata da euristiche **pure, deterministiche e senza dipendenze** su HTML e testo, **senza chiamate LLM**. Operazionalizza cinque segnali a correlazione positiva misurati (periodo studio lug–ago 2025, 304k URL citati contro 921k URL solo-ranking-Google):

| Segnale | Aumento di citazione misurato |
|---|---|
| Chiarezza e sintesi | +33% |
| Segnali E-E-A-T | +30% |
| Formato domanda-risposta | +25% |
| Struttura in sezioni | +23% |
| Dati strutturati | +22% |

I pesi dei pilastri sono ancorati a quelle correlazioni, poi normalizzati a somma 100 così il totale si legge come percentuale pulita. Le euristiche secondarie di forma del contenuto vengono dalla ricerca sui featured snippet: livello di lettura basso, densità di alt-text, liste ≥8 elementi, tabelle ≥5 righe / ≥7 colonne, ≥10 link in uscita — la stessa forma che vince i featured snippet di Google vince anche le citazioni AI.

Lo stesso scorer alimenta la card Citation Quality in [`site-audit`](./site-audit.md), quindi le due superfici non possono divergere.

### Input
- `mode` — `text` (incolla) o `url`.
- `input` — il testo o l'indirizzo.
- `provider`, `model`, `engine` (motore target) — scelti dall'operatore.

### Output
Stessa shape della versione EN.

### Dati generati
Scrive `analysis_results` per esecuzione (condiviso con [`content-audit`](./content-audit.md)).

---

## 🇸🇪 Svenska

### Vad det gör
"Analysera innehåll för AI-söksynlighet och citeringsberedskap." Där [`content-audit`](./content-audit.md) svarar *är den här URL:en AI-redo, ja eller nej, med tekniska kontroller*, är den här sidan **verktyget för fördjupning och redigering**: klistra in text eller peka på en URL, välj leverantör / modell / målmotor, och få en redigerbar uppdelning av varför innehållet får sin poäng.

Paneler: totalpoäng, AI-sammanfattning, avsiktsklassificering (avsikt / typ / ton / nivå / målgrupp), avsiktsmappning, uppdelning per motor, nyckelordstäthet med optimalt intervall, SEO-radar, jämförelse mellan motorer, och expanderbara förbättringsförslag.

**Citation Quality-kortet.** Beräknat med **rena, deterministiska, beroendefria** heuristiker över HTML och text, **utan LLM-anrop**. Det operationaliserar fem mätta positivt korrelerade signaler (studieperiod jul–aug 2025, 304k citerade URL:er mot 921k enbart Google-rankande):

| Signal | Mätt citeringslyft |
|---|---|
| Tydlighet och sammanfattning | +33 % |
| E-E-A-T-signaler | +30 % |
| Fråga-svar-format | +25 % |
| Sektionsstruktur | +23 % |
| Strukturerad data | +22 % |

Pelarvikterna är ankrade i dessa korrelationer och normaliserade till summan 100. Sekundära heuristiker för innehållsform kommer från forskning om featured snippets: låg läsnivå, alt-textdensitet, listor ≥8 poster, tabeller ≥5 rader / ≥7 kolumner, ≥10 utgående länkar.

Samma poängsättare driver Citation Quality-kortet i [`site-audit`](./site-audit.md), så de två ytorna kan inte säga emot varandra.

### Indata
- `mode` — `text` eller `url`.
- `input` — texten eller adressen.
- `provider`, `model`, `engine` (målmotor).

### Utdata
Samma form som EN-versionen.

### Data
Skriver `analysis_results` per körning (delas med [`content-audit`](./content-audit.md)).

---

## Limits & known issues
- **Two scores with different natures on one page** — the overall analysis score comes from a model and varies between runs on identical input; the Citation Quality score is deterministic and does not. Presenting them side by side without that distinction invites the question "why did the number change when I changed nothing?"
- **Citation-lift percentages are correlations from a third-party study**, not causal guarantees for a specific page. Safe as prioritisation, unsafe as a promised outcome in client work.
- **Keyword density carries an "optimal" range** that is a heuristic, not a per-industry target. Hitting the band does not imply the content will be cited.
- **Shares `analysis_results` with [`content-audit`](./content-audit.md)** — runs from both pages interleave in [`scan-history`](./scan-history.md) with only `input_mode` and `source` to tell them apart.

## Cost
- Citation Quality: free, no model calls. The main analysis: one billed model call per run, on the operator-selected provider and model.

## Data scope
- All scores are `0-100`; the Citation Quality pillars are normalised to sum to 100.
