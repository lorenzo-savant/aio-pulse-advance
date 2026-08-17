# Engine Info

| Field | Value |
|---|---|
| **Route** | `/dashboard/monitor` |
| **API** | `GET/POST /api/providers/health` |
| **Service** | [`src/lib/providers`](../../src/lib/providers) — `getProviderManager()` |
| **Sidebar step** | 4 · Optimize (reference, last item) |

---

## 🇬🇧 English

### What it does
The **operational status board for the AI providers**. It answers the question that blocks every other surface when it goes wrong: *is monitoring failing because of our data, or because a provider key is dead?*

The route name (`/dashboard/monitor`) is a historical artefact — this is not [`monitoring`](./monitoring.md). It runs no prompts and touches no tenant data.

The reason this page exists as its own surface is a distinction the provider layer makes explicit and that a naive health check gets wrong: **a key with an exhausted balance authenticates perfectly and then refuses every billed request.** So availability is reported in four states, not two:

| Summary field | Meaning |
|---|---|
| `totalConfigured` | a key is present |
| `totalAvailable` | key authenticates **and** `creditExhausted !== true` |
| `totalOutOfCredit` | authenticates but balance is exhausted — unusable |
| `totalCreditUnknown` | configured and reachable, but no real call has reported on billing yet |

`totalCreditUnknown` is the honest state for a freshly added key: the layer refuses to claim a key is usable before a billed call has confirmed it.

`GET` is read-only and carries no tenant data, so it is public but **rate-limited at 30 requests** per window (`rateLimitGate(req, 'providers-health', 30)`) so it cannot be hammered anonymously.

### Input
- None for `GET`. No `brand_id` — this surface is account-wide, not per brand.

### Output
```ts
{
  success: true,
  providers: [{
    name: string,
    isConfigured: boolean,
    isAvailable: boolean,
    creditExhausted: boolean | null   // null = unknown, not false
  }],
  stats: { ... },                      // per-provider call statistics
  summary: {
    totalConfigured: number,
    totalAvailable: number,
    totalOutOfCredit: number,
    totalCreditUnknown: number
  }
}
```

### Data signals
No tenant tables. Reads live provider state from the provider manager.

### Links
- Where provider keys are entered: [`settings`](./settings.md)
- The fallback chain that consumes this health state: [`content-generator`](./content-generator.md)

---

## 🇮🇹 Italiano

### Cosa fa
La **bacheca di stato operativo dei provider AI**. Risponde alla domanda che blocca ogni altra superficie quando qualcosa va storto: *il monitoraggio sta fallendo per i nostri dati, o perché una chiave provider è morta?*

Il nome della route (`/dashboard/monitor`) è un residuo storico — questa **non** è [`monitoring`](./monitoring.md). Non esegue prompt e non tocca dati tenant.

La ragione per cui questa pagina è una superficie a sé è una distinzione che il livello provider rende esplicita e che un health check ingenuo sbaglia: **una chiave con saldo esaurito si autentica perfettamente e poi rifiuta ogni richiesta a pagamento.** Perciò la disponibilità è riportata in quattro stati, non due:

| Campo summary | Significato |
|---|---|
| `totalConfigured` | la chiave è presente |
| `totalAvailable` | la chiave autentica **e** `creditExhausted !== true` |
| `totalOutOfCredit` | autentica ma il saldo è esaurito — inutilizzabile |
| `totalCreditUnknown` | configurata e raggiungibile, ma nessuna chiamata reale ha ancora riportato sul billing |

`totalCreditUnknown` è lo stato onesto per una chiave appena aggiunta: il livello si rifiuta di dichiarare usabile una chiave prima che una chiamata a pagamento lo confermi.

Il `GET` è di sola lettura e non trasporta dati tenant, quindi è pubblico ma **limitato a 30 richieste** per finestra, così non può essere martellato in anonimo.

### Input
- Nessuno per il `GET`. Nessun `brand_id`: questa superficie è a livello account, non per brand.

### Output
Stessa shape della versione EN.

### Dati generati
Nessuna tabella tenant. Legge lo stato live dal provider manager.

---

## 🇸🇪 Svenska

### Vad det gör
**Driftstatustavlan för AI-leverantörerna.** Den besvarar frågan som blockerar alla andra ytor när något går fel: *misslyckas övervakningen på grund av våra data, eller på grund av en död leverantörsnyckel?*

Routenamnet (`/dashboard/monitor`) är en historisk rest — detta är **inte** [`monitoring`](./monitoring.md). Den kör inga prompts och rör ingen tenant-data.

Skälet till att sidan är en egen yta är en distinktion som leverantörslagret gör explicit och som en naiv hälsokontroll får fel: **en nyckel med tömt saldo autentiserar utmärkt och vägrar sedan varje debiterad förfrågan.** Därför rapporteras tillgänglighet i fyra tillstånd, inte två:

| Summary-fält | Betydelse |
|---|---|
| `totalConfigured` | en nyckel finns |
| `totalAvailable` | nyckeln autentiserar **och** `creditExhausted !== true` |
| `totalOutOfCredit` | autentiserar men saldot är tömt — oanvändbar |
| `totalCreditUnknown` | konfigurerad och nåbar, men inget verkligt anrop har ännu rapporterat om debitering |

`totalCreditUnknown` är det ärliga tillståndet för en nyss tillagd nyckel: lagret vägrar hävda att en nyckel är användbar innan ett debiterat anrop bekräftat det.

`GET` är läsbar och bär ingen tenant-data, så den är publik men **begränsad till 30 anrop** per fönster.

### Indata
- Inga för `GET`. Inget `brand_id` — ytan är kontoövergripande.

### Utdata
Samma form som EN-versionen.

### Data
Inga tenant-tabeller. Läser levande leverantörstillstånd från provider-hanteraren.

---

## Limits & known issues
- **Route name collides conceptually with [`monitoring`](./monitoring.md)** — `/dashboard/monitor` versus `/dashboard/monitoring`. Two different features one character apart; the sidebar label ("Engine Info") is the only thing disambiguating them in the UI.
- **`creditExhausted: null` reads as healthy in most UIs** — it is neither true nor false, and a component doing `!creditExhausted` will treat unknown as fine. Check the state explicitly.
- **Public endpoint** — no tenant data is exposed, but the set of configured providers is inferable by an unauthenticated caller within the 30-request budget.
- **Health is point-in-time** — a provider healthy at page load can exhaust its balance mid-run; the fallback chains, not this page, are what keep runs alive.

## Cost
- Free. Health checks do not make billed model calls; balance state comes from what previous billed calls reported.

## Data scope
- Account-wide. Nothing on this page is brand-scoped or tenant-specific.
