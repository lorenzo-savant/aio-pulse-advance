# API Costs, Billing & Credits

> ## ⚠️ NOT ACTIVE IN THIS DEPLOYMENT
>
> The whole commercial layer is **intentionally not exposed**. This deployment runs
> internally with **`AIO_MODE=unlimited`**: every query is allowed at zero cost, no
> balance is consumed, the credit ledger is disabled and Stripe checkout is not connected.
>
> The three routes below still resolve, but each renders a **placeholder card** explaining
> the state — kept deliberately so a stale bookmark or a typed URL renders something
> meaningful instead of a broken checkout flow. None of them appear in the sidebar:
> [`NAV_SECTIONS`](../../src/components/layout/Sidebar.tsx) documents the omission at
> step 5 · Account.
>
> The **backend is intact**: `/api/api-costs` and
> [`api-cost-overview.ts`](../../src/lib/services/api-cost-overview.ts) are still in the
> tree and still work. Only the user-facing surfaces are switched off. Re-exposing the
> layer is a nav + flag change, not a rebuild.

| Field | Value |
|---|---|
| **Routes** | `/dashboard/api-costs`, `/dashboard/billing`, `/dashboard/credits` — all placeholders |
| **API** | `GET /api/api-costs` (live), `/api/credits`, `/api/billing` |
| **Service** | [`api-cost-overview.ts`](../../src/lib/services/api-cost-overview.ts) (live, unused by the UI) |
| **Tables** | `credits`, `subscriptions`, `ai_cost_logs` |
| **Sidebar step** | — (not exposed) |
| **Gate** | `AIO_MODE=unlimited` |

---

## 🇬🇧 English

### What the placeholders say
| Route | Heading | Message |
|---|---|---|
| `/dashboard/api-costs` | API costs hidden | Unlimited mode, so credit-based cost tracking is not exposed. Live provider spend remains visible in the operational logs. |
| `/dashboard/billing` | Billing not exposed | Credit ledger and Stripe checkout disabled, nothing to manage. |
| `/dashboard/credits` | Credits disabled | Every query allowed at zero cost, no balance consumed. |

### What the retained backend does
`GET /api/api-costs` answers "how much have we spent this month, across every API key?" by aggregating three sources:

1. **SERP providers** — Brave (free-tier call counts), DataForSEO (cents + cap), SerpApi (legacy, if rows remain).
2. **AI providers** — aggregated from `ai_cost_logs` for the current UTC month: per-provider calls, input tokens, output tokens, cost USD → cents.
3. **Credit ledger** — `credits` and `subscriptions`, which are the tables the unlimited mode bypasses.

### Where cost actually surfaces today
Since the metering UI is off, **cost is only observable in two places**:
- Operational logs, for live provider spend.
- The per-feature **Cost** section in each doc in this archive — which is why every feature file here states its cost profile explicitly. With no meter in the product, these docs are the cost model.

### Links
- Provider availability and exhausted-balance states: [`engine-info`](./engine-info.md)
- The most expensive single actions in the product: [`recommendations`](./recommendations.md), [`content-generator`](./content-generator.md), [`monitoring`](./monitoring.md)

---

## 🇮🇹 Italiano

### ⚠️ Non attivo in questo deployment
L'intero livello commerciale è **volutamente non esposto**. Il deployment gira internamente con **`AIO_MODE=unlimited`**: ogni query è permessa a costo zero, nessun saldo viene consumato, il ledger dei crediti è disabilitato e il checkout Stripe non è collegato.

Le tre route risolvono ancora ma mostrano una **card placeholder** che spiega lo stato — mantenuta di proposito così un bookmark vecchio o un URL digitato rende qualcosa di sensato invece di un flusso di checkout rotto. Nessuna appare in sidebar.

Il **backend è intatto**: `/api/api-costs` e il servizio `api-cost-overview.ts` sono ancora nell'albero e funzionano. Sono spente solo le superfici utente. Riesporre il livello è una modifica di nav + flag, non una riscrittura.

### Cosa dicono i placeholder
| Route | Titolo | Messaggio |
|---|---|---|
| `/dashboard/api-costs` | API costs hidden | Modalità unlimited, tracciamento costi a crediti non esposto. La spesa provider live resta visibile nei log operativi. |
| `/dashboard/billing` | Billing not exposed | Ledger crediti e checkout Stripe disabilitati, niente da gestire. |
| `/dashboard/credits` | Credits disabled | Ogni query permessa a costo zero, nessun saldo consumato. |

### Cosa fa il backend conservato
Il `GET /api/api-costs` risponde a "quanto abbiamo speso questo mese, su ogni chiave API?" aggregando tre fonti: **provider SERP** (Brave conteggi free-tier, DataForSEO centesimi + cap, SerpApi legacy), **provider AI** (da `ai_cost_logs` per il mese UTC corrente: chiamate, token input, token output, costo USD → centesimi), **ledger crediti** (`credits`, `subscriptions` — le tabelle che la modalità unlimited scavalca).

### Dove il costo affiora oggi
Con la UI di metering spenta, il costo è osservabile solo in due posti: i **log operativi** per la spesa provider live, e la sezione **Cost** di ogni documento di questo archivio. È per questo che ogni file feature qui dichiara esplicitamente il proprio profilo di costo: senza un contatore nel prodotto, questi documenti *sono* il modello di costo.

---

## 🇸🇪 Svenska

### ⚠️ Inte aktivt i denna driftsättning
Hela det kommersiella lagret är **medvetet inte exponerat**. Driftsättningen körs internt med **`AIO_MODE=unlimited`**: varje förfrågan tillåts utan kostnad, inget saldo förbrukas, kreditredovisningen är avstängd och Stripe-checkout är inte ansluten.

De tre routerna svarar fortfarande men visar ett **platshållarkort** som förklarar läget — medvetet bevarat så att ett gammalt bokmärke renderar något meningsfullt istället för ett trasigt kassaflöde. Ingen av dem finns i sidofältet.

**Backenden är intakt**: `/api/api-costs` och tjänsten `api-cost-overview.ts` finns kvar i trädet och fungerar. Bara användarytorna är avstängda. Att exponera lagret igen är en nav- och flaggändring, inte en ombyggnad.

### Vad platshållarna säger
| Route | Rubrik | Meddelande |
|---|---|---|
| `/dashboard/api-costs` | API costs hidden | Unlimited-läge, kreditbaserad kostnadsspårning är inte exponerad. Levande leverantörskostnad syns i driftloggarna. |
| `/dashboard/billing` | Billing not exposed | Kreditredovisning och Stripe-checkout avstängda. |
| `/dashboard/credits` | Credits disabled | Varje förfrågan tillåts utan kostnad, inget saldo förbrukas. |

### Vad den bevarade backenden gör
`GET /api/api-costs` besvarar "hur mycket har vi spenderat denna månad, över varje API-nyckel?" genom att aggregera tre källor: **SERP-leverantörer** (Brave, DataForSEO, SerpApi), **AI-leverantörer** (från `ai_cost_logs` för aktuell UTC-månad), och **kreditredovisningen** (`credits`, `subscriptions`).

### Var kostnaden syns idag
Med mätgränssnittet avstängt är kostnaden observerbar på två ställen: **driftloggarna** för levande leverantörskostnad, och **Cost**-avsnittet i varje dokument i detta arkiv. Det är därför varje funktionsfil här uttalat anger sin kostnadsprofil — utan mätare i produkten *är* dessa dokument kostnadsmodellen.

---

## Limits & known issues
- **The docs are the cost model.** With no meter exposed, the only per-feature cost information available to an operator is the `## Cost` section in this archive. If a feature gains a billed call and its doc is not updated, nothing else in the system will report it.
- **`ai_cost_logs` keeps filling** — the logging path is not gated by `AIO_MODE`, so cost rows accumulate even though nothing displays them. Useful for later reconciliation; worth knowing before assuming the table is dead.
- **Unlimited mode is deployment-wide, not per user** — there is no partial metering. Turning it off re-enables the ledger for everyone at once, and any user without credits is immediately blocked.
- **Placeholder pages still ship `SectionHelp`** — the help content for these sections exists and describes the disabled features, so in-app help can read as if the feature were available.

## Cost
- The placeholders are free. `GET /api/api-costs`, if called, is a DB aggregation with no external calls.

## Data scope
- `ai_cost_logs` is aggregated per UTC calendar month; provider spend is normalised to cents.
