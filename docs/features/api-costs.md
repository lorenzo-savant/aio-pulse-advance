# API Costs & Usage

| Field | Value |
|---|---|
| **Route** | `/dashboard/api-costs` |
| **API** | `GET /api/api-costs` |
| **Service** | [`src/lib/services/api-cost-overview.ts`](../../src/lib/services/api-cost-overview.ts) |
| **Sidebar step** | Account |

---

## 🇬🇧 English

### What it does
Single page that answers "how much have we spent this month, across every API key?" by aggregating 3 sources:

1. **SERP providers**: Brave (free-tier call counts), DataForSEO (cents + cap), SerpApi (legacy if rows remain)
2. **AI providers**: aggregated from `ai_cost_logs` for the current UTC month — per-provider calls, input tokens, output tokens, cost USD → cents
3. **Credits ledger**: purchased - used = balance, with earliest unexpired credit expiry date

### Input
- Auth-required (AI logs + credits are user-scoped). No other params.

### Output
```ts
{
  month: 'YYYY-MM',
  totalSpendCents: number,
  serp: {
    providers: [{
      provider: 'brave'|'dataforseo'|'serpapi',
      configured: boolean,
      calls: number,
      costCents: number,
      capCents: number | null,
      capCalls: number | null,
      utilization: 0..1,
      label: string
    }],
    totalCostCents: number
  },
  ai: {
    providers: [{
      provider: string,
      calls, inputTokens, outputTokens, totalTokens, costCents
    }],
    totalCostCents: number
  },
  credits: {
    purchased, used, balance,
    earliestExpiry: ISO date | null
  }
}
```

### UI sections
- Top: 3 summary cards (total / SERP / AI in dollars).
- SERP detail: utilization bar per provider (green <50%, emerald 50-79%, amber 80-94%, red 95%+), call count + cap, deep link to each provider's billing dashboard.
- AI detail: provider × calls × input tok × output tok × cost table, sorted by cost desc.
- Credits: 4 stats (purchased / used / balance / earliest expiry) with low-balance warning.

### Links
- Brave dashboard: https://api.search.brave.com/app/dashboard
- DataForSEO dashboard: https://app.dataforseo.com/api-dashboard
- OpenAI pricing: https://openai.com/pricing
- Anthropic pricing: https://www.anthropic.com/pricing
- Groq pricing: https://console.groq.com/docs/pricing
- Gemini pricing: https://ai.google.dev/pricing

---

## 🇮🇹 Italiano

### Cosa fa
Pagina unica che risponde "quanto stiamo spendendo questo mese, su ogni API key?" aggregando 3 sorgenti:

1. **Provider SERP**: Brave (call count free-tier), DataForSEO (centesimi + cap), SerpApi (legacy se restano righe)
2. **Provider AI**: aggregati da `ai_cost_logs` per il mese UTC corrente — chiamate, token in/out, costo USD → centesimi per provider
3. **Ledger crediti**: acquistati - usati = saldo, con data di scadenza più vicina

### Input
- Auth obbligatoria (i log AI e i crediti sono per-utente). Nessun altro parametro.

### Output
Stessa shape EN.

### Sezioni UI
- Top: 3 card di sintesi (totale / SERP / AI in dollari).
- Dettaglio SERP: barra di utilizzo per provider (verde <50%, smeraldo 50-79%, ambra 80-94%, rosso 95%+), conteggio chiamate + cap, deep link alla dashboard di billing di ogni provider.
- Dettaglio AI: tabella provider × chiamate × token in × token out × costo, ordinata per costo desc.
- Crediti: 4 metriche (acquistati / usati / saldo / scadenza più vicina) con warning saldo basso.

---

## 🇸🇪 Svenska

### Vad det gör
En enda sida som svarar på "hur mycket har vi spenderat denna månad, över varje API-nyckel?" genom att aggregera 3 källor:

1. **SERP-providers**: Brave (gratis-tier-anrop), DataForSEO (cent + tak), SerpApi (legacy om rader kvarstår)
2. **AI-providers**: aggregerat från `ai_cost_logs` för aktuell UTC-månad — anrop, in/ut-tokens, kostnad USD → cent per provider
3. **Kreditreskontra**: köpta - använda = saldo, med tidigaste utgångsdatum

### Indata
- Autentisering krävs (AI-loggar och krediter är användarscope). Inga andra parametrar.

### Utdata
Samma form som EN.

### UI-sektioner
- Topp: 3 sammanfattningskort (totalt / SERP / AI i dollar).
- SERP-detalj: utnyttjandestapel per provider (grön <50%, smaragd 50-79%, gul 80-94%, röd 95%+), anropsantal + tak, djuplänk till varje providers faktureringspanel.
- AI-detalj: provider × anrop × in-tokens × ut-tokens × kostnad-tabell, sorterad efter kostnad fallande.
- Krediter: 4 statistik (köpta / använda / saldo / tidigaste utgång) med låg-saldo-varning.

---

## Limits & known issues
- **AI cost depends on writers** — every monitoring call / advisor call / AEO snippet must log a row in `ai_cost_logs.cost_usd` with the accurate per-call cost. If a path forgets to log, that cost is invisible here.
- **SerpApi legacy detection is best-effort** — table may have been dropped; the query soft-fails.
- **Credits ledger is user-scoped, SERP quotas are global** — bundled here for one-page UX. If you go multi-tenant the SERP section needs splitting per workspace.

## Cost
- 3 small parallel Supabase queries + 1 call to `getSpendingSnapshot`. ~50-200ms per page load.

## Valuta + data info
- Tutti i prezzi normalizzati in **integer cents (USD)**.
- `dataforseo_usage.cost_cents` è la fonte canonical per DFS.
- `ai_cost_logs.cost_usd` (Float USD) viene convertito × 100 → cents al render.
- Time window: UTC `YYYY-MM` calendar month, no rolling 30-day option (yet).
- Cap default DFS: 2000 cents ($20/mo). Override via `DATAFORSEO_MONTHLY_CAP_CENTS`.
- Brave default cap: 2000 calls/mo (free tier). Override via `BRAVE_MONTHLY_LIMIT`.
