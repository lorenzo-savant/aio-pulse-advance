# Sentiment

| Field | Value |
|---|---|
| **Route** | `/dashboard/sentiment` |
| **API** | `GET/POST /api/sentiment`, `GET /api/sentiment/by-source`, `GET /api/themes` |
| **Service** | [`src/lib/services/monitoring.ts`](../../src/lib/services/monitoring.ts), [`response-clustering.ts`](../../src/lib/services/response-clustering.ts), [`semantic.ts`](../../src/lib/services/semantic.ts) |
| **Sidebar step** | 3 · Insights (locked until `hasData`) |

---

## 🇬🇧 English

### What it does
Answers "**what do the engines actually say about us, and is it good?**" across four distinct views:

1. **Average sentiment** — the positive / neutral / negative split over the period.
2. **Aspect breakdown** — sentiment resolved per *aspect* (price, service, quality, …) rather than per response, so "positive overall but negative on price" is visible instead of averaged away.
3. **Sentiment by source** (`/api/sentiment/by-source`, 30-day window) — the same tone split grouped by the domain the engine cited. This is what tells you whether a negative tone traces back to one bad third-party source.
4. **Themes** (`/api/themes`) — semantic clusters of the response text, built from `response_embeddings` via [`response-clustering.ts`](../../src/lib/services/response-clustering.ts), so recurring narratives surface without anyone reading 270 answers.

There is also a **manual analyzer** (`POST /api/sentiment`): paste arbitrary text and get the same sentiment + aspect classification, for ad-hoc checks outside the monitoring set.

### Input
- `brand_id` (UUID), required for all three GET endpoints.
- `days` — window for `by-source`, default `30`.
- `POST /api/sentiment` body — free text to classify.

### Output
```ts
// GET /api/sentiment
{
  average: number,                    // -1.0 … +1.0
  distribution: { positive: number, neutral: number, negative: number },
  aspectBreakdown?: [{ aspect: string, sentiment: string, count: number }]
}
// POST /api/sentiment
{
  sentiment: {
    label: 'positive'|'neutral'|'negative',
    score: number,
    aspects: [{ aspect: string, sentiment: string, explanation: string }]
  }
}
// GET /api/themes
{ themes: [{ label: string, size: number, examples: string[] }] }
```

### Data signals
Reads `monitoring_results` (`sentiment`, `sentiment_aspects`) and `response_embeddings`. `POST /api/sentiment` calls a model and does **not** persist the result — the manual analyzer is stateless by design.

### Links
- Sentiment is written during monitoring: [`monitoring`](./monitoring.md)
- Trust pillar of the composite: [`geo-score`](./geo-score.md)

---

## 🇮🇹 Italiano

### Cosa fa
Risponde a "**cosa dicono davvero i motori di noi, ed è positivo?**" con quattro viste distinte:

1. **Sentiment medio** — ripartizione positivo / neutro / negativo sul periodo.
2. **Scomposizione per aspetto** — sentiment risolto per *aspetto* (prezzo, servizio, qualità…) invece che per risposta: così "positivo in generale ma negativo sul prezzo" resta visibile invece di essere annullato dalla media.
3. **Sentiment per fonte** (finestra 30 giorni) — la stessa ripartizione raggruppata per dominio citato dal motore. È ciò che dice se un tono negativo risale a una singola fonte terza.
4. **Temi** — cluster semantici del testo delle risposte, costruiti da `response_embeddings`, così le narrative ricorrenti emergono senza che nessuno legga 270 risposte.

C'è anche un **analizzatore manuale**: si incolla un testo qualsiasi e si ottiene la stessa classificazione sentiment + aspetti, per controlli fuori dal set monitorato.

### Input
- `brand_id` (UUID), obbligatorio per i tre GET.
- `days` — finestra per `by-source`, default `30`.
- Body del POST — testo libero da classificare.

### Output
Stessa shape della versione EN.

### Dati generati
Legge `monitoring_results` (`sentiment`, `sentiment_aspects`) e `response_embeddings`. Il POST chiama un modello e **non** persiste il risultato: l'analizzatore manuale è stateless per scelta.

---

## 🇸🇪 Svenska

### Vad det gör
Svarar på "**vad säger motorerna faktiskt om oss, och är det bra?**" i fyra vyer:

1. **Genomsnittligt sentiment** — fördelningen positiv / neutral / negativ för perioden.
2. **Aspektuppdelning** — sentiment per *aspekt* (pris, service, kvalitet…) istället för per svar, så att "positiv överlag men negativ på pris" syns istället för att jämnas ut.
3. **Sentiment per källa** (30-dagarsfönster) — samma fördelning grupperad efter den domän motorn citerade. Det är vad som avslöjar om en negativ ton går tillbaka till en enda tredjepartskälla.
4. **Teman** — semantiska kluster av svarstexten, byggda från `response_embeddings`, så återkommande berättelser framträder utan att någon läser 270 svar.

Det finns även en **manuell analysator**: klistra in valfri text och få samma sentiment- och aspektklassificering.

### Indata
- `brand_id` (UUID), obligatorisk för de tre GET-anropen.
- `days` — fönster för `by-source`, standard `30`.
- POST-body — fritext att klassificera.

### Utdata
Samma form som EN-versionen.

### Data
Läser `monitoring_results` (`sentiment`, `sentiment_aspects`) och `response_embeddings`. POST anropar en modell och sparar **inte** resultatet.

---

## Limits & known issues
- **Themes need embeddings** — `response_embeddings` is populated separately from monitoring. A brand with plenty of `monitoring_results` but no embeddings shows an empty Themes panel, and the cause is not stated in the UI.
- **`by-source` window is fixed at the call site** — the page requests `days=30`; the period selector elsewhere on the page does not drive it, so this panel can disagree with the panels above it.
- **Aspect vocabulary is model-decided** — aspects are whatever the analyzer emitted, not a controlled list, so labels drift over time and are not safe as chart categories across long periods.
- **Manual analyzer results are not saved** — reloading loses them; they never enter `monitoring_results` and never affect any score.

## Cost
- The three GET endpoints are DB reads. Each manual analyzer submission is one billed model call.

## Data scope
- `sentiment` is stored as a label plus a score normalised `-1.0 … +1.0`; the Trust pillar in [`geo-score`](./geo-score.md) rescales it to `0-100`.
