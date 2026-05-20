# Feature Memory Archive

This directory is the **single source of truth** for every user-facing feature in AIO Pulse. Each MD file documents one feature with the same trilingual structure so anyone (future devs, support, marketing, the user themselves) can answer "what does X do, what feeds it, what does it produce" without reading source.

Per-feature template (each file follows this exact layout):

```
1. ID + Route + Code paths
2. 🇬🇧 English      — What it does, Input, Output, Data signals, Links
3. 🇮🇹 Italiano     — Cosa fa, Input, Output, Dati generati, Link
4. 🇸🇪 Svenska      — Vad det gör, Indata, Utdata, Data, Länkar
5. Limits / known issues / cost
```

## Index — by sidebar flow

### 1 · Setup
- [brands](./brands.md) — define monitored brand + competitors + aliases
- [prompts](./prompts.md) — questions to monitor on AI engines

### 2 · Monitor
- [monitoring](./monitoring.md) — run prompts → engine responses + brand detection
- [workflows](./workflows.md) — track background job executions
- [alerts](./alerts.md) — automated notifications on visibility events

### 3 · Insights
- [geo-score](./geo-score.md) — composite 0-100 GEO performance index
- [citation-sources](./citation-sources.md) — domains AI engines cite when answering brand prompts
- [aeo-snippets](./aeo-snippets.md) — answer-engine-ready Q&A pairs from Google PAA
- [keyword-tracking](./keyword-tracking.md) — keywords correlating with brand mentions

### 4 · Optimize
- [strategy-advisor](./strategy-advisor.md) — LLM-powered prioritised actions grounded in live brand data

### Tools
- [prompt-generator](./prompt-generator.md) — expand seed keywords into ready monitoring prompts

### Account
- [api-costs](./api-costs.md) — unified spend + usage across SERP, AI, credits

---

**How to update:** when a feature gains/loses a capability, edit the
relevant MD here. Treat it as part of the feature's definition of done.
**How to add:** copy any existing file as template, replace contents,
add a line to the index above.
