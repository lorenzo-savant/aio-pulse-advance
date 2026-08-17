# Onboarding — Start Here

| Field | Value |
|---|---|
| **Route** | `/dashboard/onboarding` |
| **API** | `GET /api/industries`, `POST /api/brands`, `POST /api/prompts`, `POST /api/monitoring` |
| **Page** | [`src/app/dashboard/onboarding/page.tsx`](../../src/app/dashboard/onboarding/page.tsx) |
| **Sidebar step** | 1 · Setup (first item, badged `Begin` while `brands === 0`) |

---

## 🇬🇧 English

### What it does
A guided 4-step wizard that takes a brand-new account from empty to a running first scan without ever visiting another page. It exists because the same setup done manually spans three surfaces (Brands → Prompts → Live Monitoring) and a new operator does not yet know that order.

The four steps, defined as `onboarding.steps.*` translation keys:

| Step | Id | What happens |
|---|---|---|
| 1 | `welcome` | Explains the model (AI engines answer, we measure whether you are named) and asks for interface language: 🇬🇧 English / 🇮🇹 Italiano / 🇸🇪 Svenska |
| 2 | `brand` | Brand name, domain, aliases, competitors, industry preset, locale, brand colour → `POST /api/brands` |
| 3 | `prompts` | Generates prompts from the chosen industry preset, or accepts hand-written ones → `POST /api/prompts` |
| 4 | `launch` | Fires the first monitoring run and streams progress per stage → `POST /api/monitoring` |

Forward navigation is gated: step 2 requires a valid brand payload, step 3 requires `prompts.length > 0`. Backward navigation to any completed step is allowed; jumping forward past an incomplete step is not.

### Input
- Interface locale — one of `en` | `it` | `sv`.
- Brand fields, same schema as [`brands`](./brands.md).
- Engine selection for the first run — `chatgpt`, `gemini`, `perplexity`. Claude is retired on cost and not offered.

### Output
- One `brands` row, N `prompts` rows, and one monitoring run whose progress is reported per stage (`onboarding.launch_progress.*`).
- On completion the sidebar `Begin` badge disappears (`s.brands === 0` no longer holds) and the Live Monitoring lock lifts.

### Data signals
Writes `brands` and `prompts`, then triggers the monitoring pipeline which writes `monitoring_results`. All three via the normal endpoints — no privileged path.

### Links
- Industry presets come from [`prompt-generator.ts`](../../src/lib/services/prompt-generator.ts) via `GET /api/industries`
- Same generation engine documented in [`prompt-generator`](./prompt-generator.md)

---

## 🇮🇹 Italiano

### Cosa fa
Wizard guidato in 4 passi che porta un account appena creato da vuoto a una prima scansione in corso senza mai uscire dalla pagina. Esiste perché la stessa configurazione fatta a mano attraversa tre superfici (Brand → Prompt → Monitoraggio Live) e un operatore nuovo non conosce ancora quell'ordine.

| Passo | Id | Cosa avviene |
|---|---|---|
| 1 | `welcome` | Spiega il modello (i motori AI rispondono, noi misuriamo se ti nominano) e chiede la lingua dell'interfaccia |
| 2 | `brand` | Nome, dominio, alias, competitor, preset di settore, locale, colore → `POST /api/brands` |
| 3 | `prompts` | Genera prompt dal preset scelto, oppure accetta quelli scritti a mano → `POST /api/prompts` |
| 4 | `launch` | Avvia la prima esecuzione di monitoraggio e mostra il progresso per stadio → `POST /api/monitoring` |

L'avanzamento è vincolato: il passo 2 richiede un payload brand valido, il passo 3 richiede `prompts.length > 0`. Si può tornare indietro su un passo completato, non saltare avanti su uno incompleto.

### Input
- Lingua interfaccia — `en` | `it` | `sv`.
- Campi brand, stesso schema di [`brands`](./brands.md).
- Motori per la prima esecuzione — `chatgpt`, `gemini`, `perplexity`. Claude è ritirato per costo e non viene offerto.

### Output
Una riga `brands`, N righe `prompts`, una esecuzione di monitoraggio con progresso per stadio. Al termine il badge `Begin` in sidebar scompare e si sblocca Monitoraggio Live.

### Dati generati
Scrive `brands` e `prompts`, poi innesca la pipeline che scrive `monitoring_results`. Tutto tramite gli endpoint normali, nessuna via privilegiata.

---

## 🇸🇪 Svenska

### Vad det gör
En guidad wizard i 4 steg som tar ett nytt konto från tomt till en första körning utan att lämna sidan. Den finns eftersom samma uppsättning gjord manuellt sträcker sig över tre ytor (Varumärken → Prompts → Live-övervakning), och en ny operatör känner ännu inte till den ordningen.

| Steg | Id | Vad som händer |
|---|---|---|
| 1 | `welcome` | Förklarar modellen (AI-motorerna svarar, vi mäter om ni nämns) och frågar efter gränssnittsspråk |
| 2 | `brand` | Namn, domän, alias, konkurrenter, branschmall, locale, färg → `POST /api/brands` |
| 3 | `prompts` | Genererar prompts från vald branschmall, eller tar emot egna → `POST /api/prompts` |
| 4 | `launch` | Startar första övervakningskörningen och visar förlopp per steg → `POST /api/monitoring` |

Framåtnavigering är villkorad: steg 2 kräver giltig varumärkesdata, steg 3 kräver `prompts.length > 0`.

### Indata
- Gränssnittsspråk — `en` | `it` | `sv`.
- Varumärkesfält, samma schema som [`brands`](./brands.md).
- Motorval för första körningen — `chatgpt`, `gemini`, `perplexity`. Claude är pensionerad av kostnadsskäl.

### Utdata
En `brands`-rad, N `prompts`-rader, en övervakningskörning med förlopp per steg. Efter slutförande försvinner `Begin`-märket i sidofältet och Live-övervakning låses upp.

### Data
Skriver `brands` och `prompts`, utlöser sedan pipelinen som skriver `monitoring_results`.

---

## Limits & known issues
- **No resume across sessions** — wizard progress lives in component state (`useState(0)`). Reloading mid-wizard restarts at step 1; already-created rows persist, so a reload after step 2 leaves an orphan brand the operator must finish or delete manually.
- **Step 4 is fire-and-watch** — closing the tab does not cancel the monitoring run; it continues server-side and lands in [`monitoring`](./monitoring.md).
- **Locale choice is interface-only** — it sets the UI language, not the brand's `locale` field. A Swedish brand still needs Swedish prompts to surface in Swedish AI answers; the two are set independently.

## Cost
- Steps 1-3 are free (DB writes + preset expansion). Step 4 costs one full monitoring run: one billed AI call per prompt × selected engine. See [`monitoring`](./monitoring.md) for the per-run arithmetic.

## Data scope
- Creates rows owned by the calling user; the brand becomes shared per the rules in [`brands`](./brands.md).
