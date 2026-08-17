# Feature Memory Archive

This directory is the **single source of truth** for every user-facing feature in AEO Pulse. Each MD file documents one feature with the same trilingual structure so anyone (future devs, support, marketing, the user themselves) can answer "what does X do, what feeds it, what does it produce" without reading source.

Per-feature template (each file follows this exact layout):

```
1. ID + Route + Code paths
2. 🇬🇧 English      — What it does, Input, Output, Data signals, Links
3. 🇮🇹 Italiano     — Cosa fa, Input, Output, Dati generati, Link
4. 🇸🇪 Svenska      — Vad det gör, Indata, Utdata, Data, Länkar
5. Limits / known issues / cost
```

**Coverage.** The index below mirrors [`NAV_SECTIONS`](../../src/components/layout/Sidebar.tsx) — the authoritative list of what is actually reachable in the product — in sidebar order. Every active surface has a file. Features whose code exists but which are deliberately not exposed are listed separately at the bottom, marked as such, rather than silently omitted.

**No cost meter in the product.** With the commercial layer switched off (see [api-costs](./api-costs.md)), the `## Cost` section in each file is the only per-feature cost information an operator has. Keep it accurate — these docs *are* the cost model.

**The in-app docs derive from here.** The user-facing documentation at `/docs` and `/dashboard/docs` reads its content from [`src/content/docs/{en,it,sv}.ts`](../../src/content/docs), which mirrors this archive in the same three languages — this archive is the engineering view (routes, tables, services, limits), that one is the operator view (what to do and how to read it). When a feature changes, the order is: update the archive file here, then the three locale files, then the sidebar index above. `src/lib/__tests__/docs-content.test.ts` enforces that the three locale files stay structurally identical; nothing enforces that they agree with *this* archive, so that part is on the author.

---

## Index — by sidebar flow

### Overview
- [dashboard](./dashboard.md) — aggregate landing page: one headline number per Insights surface

### 1 · Setup
- [onboarding](./onboarding.md) — guided 4-step wizard from empty account to first scan
- [brands](./brands.md) — define monitored brand + competitors + aliases
- [prompts](./prompts.md) — questions to monitor on AI engines (hosts the AI generator inline)

### 2 · Monitor
- [monitoring](./monitoring.md) — run prompts → engine responses + brand detection
- [workflows](./workflows.md) — track background job executions
- [alerts](./alerts.md) — automated notifications on visibility events

### 3 · Insights
- [brand-overview](./brand-overview.md) — per-brand performance; **the only surface with Google Search Console data** (striking distance + cannibalisation)
- [geo-score](./geo-score.md) — composite 0-100 GEO performance index
- [citation-sources](./citation-sources.md) — domains AI engines cite when answering brand prompts
- [citations](./citations.md) — citation *rate* over time, per engine, vs competitors
- [sentiment](./sentiment.md) — tone, aspects, sentiment-by-source, semantic themes
- [aeo-snippets](./aeo-snippets.md) — answer-engine-ready Q&A pairs from Google PAA
- [keyword-tracking](./keyword-tracking.md) — keywords correlating with brand mentions
- [ai-funnel](./ai-funnel.md) — client-presentation narrative + executive-summary exports
- [competitor](./competitor.md) — share of voice, discovered rivals, LLM competitor analysis
- [snapshots](./snapshots.md) — daily aggregation layer every trend chart reads
- [reports](./reports.md) — CSV/JSON/PDF export + scheduled email delivery
- [scan-history](./scan-history.md) — log of ad-hoc analyses (not brand monitoring)

### 4 · Optimize
- [strategy-advisor](./strategy-advisor.md) — LLM-powered prioritised actions grounded in live brand data
- [recommendations](./recommendations.md) — persistent action list + weekly retrospective
- [content-audit](./content-audit.md) — full AEO/GEO + technical audit of any URL
- [content-optimizer](./content-optimizer.md) — drill-down analysis; owns the 5-signal citation-quality scorer
- [site-audit](./site-audit.md) — brand-scoped AI-readiness hub (5 panels)
- [content-generator](./content-generator.md) — draft articles auto-scored against the same 5 signals
- [engine-info](./engine-info.md) — AI provider status; the four availability states

### 5 · Account
- [settings](./settings.md) — profile, encrypted provider keys, notifications, interface language

### Reference (unlinked but live)
- [prompt-generator](./prompt-generator.md) — the generation engine; now inline in Prompts, standalone route unlinked

### ⚠️ Not active in this deployment
Code present, user-facing surfaces intentionally switched off via `AIO_MODE=unlimited`:
- [api-costs](./api-costs.md) — covers **API Costs, Billing and Credits**: all three routes render placeholders, the backend aggregation is intact

---

**How to update:** when a feature gains/loses a capability, edit the
relevant MD here. Treat it as part of the feature's definition of done.
**How to add:** copy any existing file as template, replace contents,
add a line to the index above.
**When a surface enters or leaves the sidebar:** update `NAV_SECTIONS` and this
index together — they are meant to be diffable against each other.
