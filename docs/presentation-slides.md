---
marp: true
theme: default
paginate: true
size: 16:9
backgroundColor: '#0a0a0a'
color: '#e5e7eb'
style: |
  section {
    font-family: 'Inter', system-ui, sans-serif;
    padding: 60px 80px;
  }
  h1, h2 { color: #6366f1; }
  h1 { font-size: 2.4em; }
  h2 { font-size: 1.8em; border-bottom: 2px solid #6366f122; padding-bottom: 8px; }
  strong { color: #f59e0b; }
  table { font-size: 0.85em; }
  th { background: #1f2937; color: #6366f1; }
  td { background: #111827; }
  .ferrari { color: #DC0000; font-weight: 700; }
  .dr { color: #1F3A8A; font-weight: 700; }
  .high { color: #10b981; }
  .low { color: #ef4444; }
  .meta { color: #9ca3af; font-size: 0.7em; }
  pre { background: #111827; border-left: 3px solid #6366f1; }
  ul li { margin: 8px 0; }
---

<!-- _class: lead -->

# AIO Pulse

## La piattaforma per l'**AI Search Visibility** dell'era post-Google

<br>

Misura, ottimizza e domina la presenza del tuo brand su
**ChatGPT · Gemini · Perplexity · Claude · Google AI Overview**

<br>

<span class="meta">Lorenzo · Aprile 2026</span>

---

## Il problema in una frase

> Quando un cliente chiede a ChatGPT
> *"Qual è la migliore [prodotto] in Italia?"*
> il tuo brand viene **citato, raccomandato, o ignorato?**

<br>

**Il 60% delle ricerche sta migrando verso AI conversazionali.**
**Google non basta più. SEO non basta più.**

---

## La nuova metrica: AVI

# AI Visibility Index

6 componenti pesati, scala 0-100:

| Componente | Peso |
|---|---|
| Citation Rate (% URL citati) | 20% |
| Mention Frequency (% brand name) | 20% |
| Recommendation Rate (% raccomandazioni) | 20% |
| Sentiment Score (-1 → +1 normalizzato) | 15% |
| Position Average (1 = primo citato) | 15% |
| Hallucination Index (errori AI) | 10% |

---

## Caso Studio: due brand auto italiani

<br>

## 🏎️ <span class="ferrari">Ferrari</span> vs <span class="dr">DR Automobiles</span> 🚙

<br>

Stesso settore. Stesso mercato. **Risultati opposti.**

Vediamo cosa misura AIO Pulse — su query reali, engine reali.

---

## Setup Caso A — <span class="ferrari">Ferrari</span>

| Campo | Valore |
|---|---|
| Domain | ferrari.com |
| Aliases | Ferrari S.p.A., Cavallino Rampante, Scuderia Ferrari |
| Competitor | Lamborghini · McLaren · Porsche · Aston Martin · Bugatti |
| Industry | Automotive – Luxury Sports Cars |
| Mercato | Italian (globale) |

**10 prompt rappresentativi** in italiano e inglese.
Eseguiti su tutti i 4 engine AI + Google AI Overview.

---

## Setup Caso B — <span class="dr">DR Automobiles</span>

| Campo | Valore |
|---|---|
| Domain | drautomobiles.com |
| Aliases | DR Motor Company, Gruppo DR |
| Competitor | Fiat · Dacia · Suzuki · Hyundai · Jeep |
| Industry | Automotive – SUV/Crossover |
| Mercato | Italian |

Stessa metodologia. Stessi engine. **Stessa intent commerciale.**

---

## I numeri non mentono

| Componente | <span class="ferrari">Ferrari</span> | <span class="dr">DR Automobiles</span> | Δ |
|---|---|---|---|
| **AVI Totale** | <span class="high">89/100</span> | <span class="low">32/100</span> | **−57** |
| Citation Rate | 92% | 18% | −74pp |
| Mention Frequency | 95% | 32% | −63pp |
| Sentiment | +0.78 | −0.05 | −0.83 |
| Recommendation | 88% | 12% | −76pp |
| Position avg | 1.2 (primo) | 4.8 (ultimo) | +3.6 |
| Hallucination | 4% | 28% | +24pp |

---

## Share of AI Voice (SOAIV)

### Chi viene citato dagli LLM nelle query "auto italiana"?

```
🏎️ Ferrari       ferrari.com         ████████████████████ 38%
                   Wikipedia          ████████████ 22%
                   Auto magazine      ██████████ 18%

🚙 DR Automobiles  drautomobiles.com  ██ 4%      ← problema!
                   Wikipedia          ████ 8%
                   Forum/Recensioni   ████████████████ 31%
                   Competitor diretti █████████████████ 33%
```

**DR perde mind-share verso forum e competitor.**

---

## Recommendation Engine — output per <span class="dr">DR</span>

5 azioni prioritizzate (impatto × effort), nessuna LLM-magic:

1. 🔴 **HIGH** — Citation rate 18%
   → Pubblicare 8-10 pagine pillar SEO con schema Article + FAQ

2. 🔴 **HIGH** — Hallucination 28%
   → "Canonical facts" page (timeline, partnership Chery, modelli)

3. 🟠 **MED** — Sentiment neutro
   → Case study clienti + recensioni terze parti su domini autorevoli

4. 🟠 **MED** — Position avg 4.8
   → Riscrivere intro pagine modello con brand name nelle prime 2 frasi

5. 🟡 **LOW** — Aggiungere `sameAs` Wikipedia/Wikidata/LinkedIn

---

## Cosa AIO Pulse fa diversamente

|   | SEMrush / Ahrefs | **AIO Pulse** |
|---|---|---|
| Tracking SERP Google | ✅ | ✅ |
| Multi-engine AI (ChatGPT, Gemini, Perplexity, Claude) | ❌ | ✅ |
| AVI Score 6 componenti | ❌ | ✅ |
| Domain SOAIV per AI engine | ❌ | ✅ |
| Bot crawlability (GPTBot, ClaudeBot, PerplexityBot) | ❌ | ✅ |
| llms.txt generator | ❌ | ✅ |
| Knowledge graph + E-E-A-T audit | ❌ | ✅ |
| Multi-lingua **EN/IT/SV** nativo | parziale | ✅ |

---

## Stack tecnico

- **Next.js 16** App Router · React 18 · TypeScript strict
- **Supabase** PostgreSQL · Prisma ORM · Edge Functions
- **AI providers**: OpenAI · Google Gemini · Anthropic · Perplexity
- **DataForSEO** per SERP/AI Overview tracking
- **Stripe** billing + credit system per-modello
- **Sentry · Resend · Upstash Redis** rate limiting
- **47 API routes · 25+ dashboard pages · 14 modelli DB**
- **637 test (100% pass) · zero errori TypeScript**
- **SHA-256 API keys · SSRF hardening · RBAC 4 ruoli**

---

## Demo live (10 min)

| Min | Step |
|---|---|
| 1 | Crea brand <span class="ferrari">Ferrari</span> via UI (i18n EN/IT/SV) |
| 2 | AVI widget — score 89, breakdown 6 componenti |
| 4 | Domain SOAIV — ferrari.com 38% |
| 5 | Switch a <span class="dr">DR Automobiles</span> — score 32 |
| 7 | Competitor gap analysis — Ferrari +57 |
| 8 | Recommendation engine — 5 azioni |
| 9 | Report HTML/PDF white-label |
| 10 | Closing: "Da invisible a leader" |

---

## Roadmap Q2 / Q3 2026

- 🎨 **UI widgets** per SOAIV, heatmap engine×category, journey player
- 🌍 **Voice search tracking** (Alexa, Google Assistant, Siri)
- 🧠 **Agentic journey simulator** UI (multi-turn discovery → decision)
- 🔐 **Public API v1** + webhook + multi-tenant workspaces (già backend)
- 🛡️ **Training data leakage monitor** (brand nei dataset pubblici?)
- 🤝 **Integrazioni**: Slack alerts · Zapier · Obsidian sync bidirezionale

---

<!-- _class: lead -->

# Grazie

## Domande?

<br>

**AIO Pulse** — *L'AI Search Visibility platform per il mercato europeo*

<br>

<span class="meta">Lorenzo · github.com/Looziolooz/aio-pulse-advance</span>
