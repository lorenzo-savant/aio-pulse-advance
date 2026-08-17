# Site Audit

| Field | Value |
|---|---|
| **Route** | `/dashboard/site-audit` |
| **API** | `GET /api/brands`, `GET /api/brands/[id]/site-audit-foundations`, `/crawler-audit`, `/citation-capture`, `/topic-finder`, `POST /api/citation-quality` |
| **Page** | [`src/app/dashboard/site-audit/page.tsx`](../../src/app/dashboard/site-audit/page.tsx) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
The **Site Audit Hub** — a single page bundling every AI-readiness check in the product, brand-scoped. The individual pieces already existed scattered across other surfaces ([`citations`](./citations.md) hosts crawler access and citation capture; [`content-optimizer`](./content-optimizer.md) hosts citation quality); this is the consolidated view so an operator does not have to hop between pages to answer **"is my brand AI-ready?"**

Five panels, ordered by dependency — fix red items at the top before optimising anything below:

| # | Panel | What it checks | Trigger |
|---|---|---|---|
| 1 | Foundations | Binary presence checks: HTTPS, `llms.txt` variants, sitemap. If these fail nothing else matters | auto |
| 2 | AI crawler access | `robots.txt` parsed for the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) | auto |
| 3 | Citation capture | Whether existing monitoring data shows the domain actually being cited | auto |
| 4 | Topic Finder | Clusters the citation-gap list into ranked content opportunities | auto |
| 5 | Citation Quality | Scores the homepage HTML against the 5 AI-citation signals | **manual — operator clicks "Score"** |

Panel 5 is deliberately click-to-run: it fetches the live URL, and firing that automatically on every page view would be a silent cost against the customer's server. The probe URL is derived from the brand domain, normalised to the bare origin (`https://` + host, path stripped).

Brand selection: single-brand accounts render directly; multi-brand accounts get a selector. With zero brands the page renders an explicit instruction to configure one first, because a site audit needs a brand domain to probe.

### Input
- `brand_id` — from the brand selector; every panel takes it.
- Citation Quality additionally takes the derived homepage URL in `url` mode.

### Output
Per-panel; the shared scorer output is documented in [`content-optimizer`](./content-optimizer.md). Foundations and crawler access return per-check pass/fail with the observed value.

### Data signals
Reads brand configuration and `monitoring_results` (citation capture). Panels 1, 2 and 5 make **outbound HTTP requests to the customer domain**; panels 3 and 4 are DB-only.

### Links
- Same scorer as the Citation Quality card in [`content-optimizer`](./content-optimizer.md)
- Single-URL, non-brand version: [`content-audit`](./content-audit.md)
- `llms.txt` generation: `GET /api/brands/[id]/llms-text`

---

## 🇮🇹 Italiano

### Cosa fa
Il **Site Audit Hub** — una pagina unica che raccoglie tutti i controlli di AI-readiness del prodotto, con scope sul brand. I singoli pezzi esistevano già sparsi su altre superfici ([`citations`](./citations.md) ospita accesso crawler e citation capture; [`content-optimizer`](./content-optimizer.md) ospita citation quality); questa è la vista consolidata, così l'operatore non deve saltare fra pagine per rispondere a **"il mio brand è pronto per l'AI?"**

Cinque pannelli, ordinati per dipendenza — correggi le voci rosse in alto prima di ottimizzare quelle sotto:

| # | Pannello | Cosa controlla | Avvio |
|---|---|---|---|
| 1 | Fondamenta | Controlli binari di presenza: HTTPS, varianti `llms.txt`, sitemap. Se questi falliscono il resto non conta | auto |
| 2 | Accesso crawler AI | `robots.txt` analizzato per i crawler AI (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) | auto |
| 3 | Citation capture | Se i dati di monitoraggio esistenti mostrano il dominio effettivamente citato | auto |
| 4 | Topic Finder | Raggruppa la lista dei gap di citazione in opportunità di contenuto ordinate | auto |
| 5 | Citation Quality | Valuta l'HTML della homepage sui 5 segnali di citazione AI | **manuale — l'operatore clicca "Score"** |

Il pannello 5 è click-to-run di proposito: scarica l'URL live, e lanciarlo automaticamente a ogni visita sarebbe un costo silenzioso sul server del cliente. L'URL di probe è derivato dal dominio del brand, normalizzato all'origine nuda (`https://` + host, path rimosso).

Selezione brand: gli account con un solo brand rendono direttamente; con più brand appare un selettore. Con zero brand la pagina mostra l'istruzione esplicita di configurarne uno prima, perché un site audit ha bisogno di un dominio da sondare.

### Input
- `brand_id` — dal selettore; lo prendono tutti i pannelli.
- Citation Quality prende inoltre l'URL homepage derivato, in modalità `url`.

### Output
Per pannello; l'output dello scorer condiviso è documentato in [`content-optimizer`](./content-optimizer.md). Fondamenta e accesso crawler restituiscono pass/fail per controllo con il valore osservato.

### Dati generati
Legge la configurazione brand e `monitoring_results`. I pannelli 1, 2 e 5 fanno **richieste HTTP in uscita verso il dominio del cliente**; i pannelli 3 e 4 sono solo DB.

---

## 🇸🇪 Svenska

### Vad det gör
**Site Audit Hub** — en enda sida som samlar produktens alla AI-beredskapskontroller, avgränsat per varumärke. Delarna fanns redan utspridda på andra ytor ([`citations`](./citations.md) har crawler-åtkomst och citation capture; [`content-optimizer`](./content-optimizer.md) har citation quality); detta är den konsoliderade vyn så att en operatör inte behöver hoppa mellan sidor för att besvara **"är mitt varumärke AI-redo?"**

Fem paneler, ordnade efter beroende — åtgärda röda poster högst upp innan något nedanför optimeras:

| # | Panel | Vad den kontrollerar | Start |
|---|---|---|---|
| 1 | Grunder | Binära närvarokontroller: HTTPS, `llms.txt`-varianter, sitemap | auto |
| 2 | AI-crawler-åtkomst | `robots.txt` tolkad för AI-crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) | auto |
| 3 | Citation capture | Om befintlig övervakningsdata visar att domänen faktiskt citeras | auto |
| 4 | Topic Finder | Klustrar listan över citeringsluckor till rangordnade innehållsmöjligheter | auto |
| 5 | Citation Quality | Poängsätter startsidans HTML mot de 5 AI-citeringssignalerna | **manuellt — operatören klickar "Score"** |

Panel 5 är medvetet klick-för-att-köra: den hämtar den live-URL:en, och att göra det automatiskt vid varje sidvisning skulle vara en tyst kostnad mot kundens server. Probe-URL:en härleds från varumärkets domän, normaliserad till rent origin.

Varumärkesval: konton med ett varumärke renderar direkt; med flera visas en väljare. Med noll varumärken visas en tydlig instruktion att först konfigurera ett.

### Indata
- `brand_id` — från väljaren; samtliga paneler tar den.
- Citation Quality tar dessutom den härledda startsides-URL:en i `url`-läge.

### Utdata
Per panel; den delade poängsättarens utdata dokumenteras i [`content-optimizer`](./content-optimizer.md).

### Data
Läser varumärkeskonfiguration och `monitoring_results`. Panel 1, 2 och 5 gör **utgående HTTP-anrop mot kundens domän**.

---

## Limits & known issues
- **No aggregate score** — five panels, five separate verdicts, no single headline number for "AI-ready". The composite that comes closest is [`geo-score`](./geo-score.md), which reads different inputs and will not match panel-by-panel.
- **Four panels auto-fire on brand switch** — changing the brand in the selector re-runs foundations, crawler audit, citation capture and topic finder, including the outbound requests. Switching between brands repeatedly hits customer domains repeatedly.
- **Citation Quality probes only the homepage** — the derived origin, path stripped. A site whose citable content lives on subpages scores its weakest page here.
- **Panel 3 depends on monitoring** — with no `monitoring_results` the citation-capture panel is empty, and that is indistinguishable in the UI from "captured nothing".

## Cost
- Panels 1-4 free (DB reads + robots.txt/sitemap fetches). Panel 5 is free of model cost but does fetch the customer homepage on each click.

## Data scope
- Brand-scoped throughout; unlike [`content-audit`](./content-audit.md) nothing here is stored against an arbitrary URL.
