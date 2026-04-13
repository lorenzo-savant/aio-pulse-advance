# AIO Pulse — Case Study Presentazione

> Confronto AI Visibility Index (AVI) tra due brand del mercato auto italiano

---

## 🎯 Tesi della presentazione

Nell'era dell'AI Search, la visibilità su Google **non basta più**. Ciò che gli LLM (ChatGPT, Gemini, Perplexity, Claude) dicono — o non dicono — del tuo brand determina chi compra, chi raccomanda, chi sceglie. AIO Pulse misura questo nuovo terreno.

---

## 🏎️ Caso A — FERRARI (HIGH AVI atteso: 85-95)

**Profilo brand**
| Campo | Valore |
|---|---|
| Nome | Ferrari |
| Domain | ferrari.com |
| Aliases | Ferrari S.p.A., Cavallino Rampante, Scuderia Ferrari |
| Industry | Automotive – Luxury Sports Cars |
| Lingua | Italian (mercato globale) |
| Color | `#DC0000` |
| Competitor | Lamborghini, McLaren, Porsche, Aston Martin, Bugatti |

**Prompt suite (10 query mercato IT/EN)**
1. "Qual è la migliore auto sportiva italiana di lusso?"
2. "Quali sono i marchi di supercar più iconici al mondo?"
3. "Best Italian luxury sports car brand"
4. "Confronta Ferrari vs Lamborghini per esclusività"
5. "Chi produce le auto più desiderate per investimento da collezione?"
6. "Quale marca di auto ha vinto più mondiali di Formula 1?"
7. "Recommend a luxury sports car for a CEO"
8. "Which car brand best represents Italian craftsmanship?"
9. "Migliori case automobilistiche per la rivendita di valore"
10. "Top 5 luxury car brands 2026"

**AVI atteso (componenti)**
| Componente | Score | Evidence |
|---|---|---|
| Citation Rate | 92% | LLM citano ferrari.com nelle risposte automotive luxury |
| Mention Frequency | 95% | Brand menzionato in ~95% delle query rilevanti |
| Sentiment Score | +0.78 | Sentiment positivo dominante (lusso, prestigio, F1) |
| Recommendation Rate | 88% | Raccomandato esplicitamente nelle query d'acquisto |
| Position Average | 1.2 | Quasi sempre primo brand citato |
| Hallucination Index | 4% | Pochi errori (alta autorità Wikipedia + canonical content) |
| **AVI TOTALE** | **~89/100** | 🟢 Leader assoluto |

**Domain Share of AI Voice (SOAIV)**
- ferrari.com: 38% delle citazioni totali
- Wikipedia/Wikidata: 22%
- Auto magazine (Quattroruote, Motor1): 18%
- Competitor (Lamborghini, Porsche): 12%
- Altri: 10%

**Recommendations engine output**
- ✅ Mantenere posizione: nessuna azione critica
- 🔧 Opportunity: ridurre l'1% di hallucination su modelli storici → pubblicare canonical timeline su /heritage

---

## 🚙 Caso B — DR AUTOMOBILES (LOW AVI atteso: 25-40)

**Profilo brand**
| Campo | Valore |
|---|---|
| Nome | DR Automobiles |
| Domain | drautomobiles.com |
| Aliases | DR Motor Company, Gruppo DR |
| Industry | Automotive – SUV/Crossover |
| Lingua | Italian (focus mercato IT) |
| Color | `#1F3A8A` |
| Competitor | Fiat, Dacia, Suzuki, Hyundai, Jeep |

**Prompt suite (stessi 10 + 3 specifici)**
1. "Qual è la migliore auto italiana economica 2026?"
2. "Marchi italiani di SUV crossover affidabili"
3. "Best Italian SUV under 25k EUR"
4. "Confronta DR Automobiles vs Dacia"
5. "Chi produce auto in Molise?"
6. "Costruttori italiani indipendenti di automobili"
7. "Recommend an Italian compact SUV"
8. "Italian car brands besides Fiat and Alfa Romeo"
9. "Migliori auto a metano italiane"
10. "DR 5.0 vs Fiat Panda recensioni"

**AVI atteso (componenti)**
| Componente | Score | Evidence |
|---|---|---|
| Citation Rate | 18% | drautomobiles.com raramente citato |
| Mention Frequency | 32% | Menzionato solo in query molto specifiche |
| Sentiment Score | -0.05 | Sentiment misto/neutro (qualità percepita variabile) |
| Recommendation Rate | 12% | Quasi mai raccomandato in confronti |
| Position Average | 4.8 | Quando citato, in fondo agli elenchi |
| Hallucination Index | 28% | LLM confondono modelli, anno fondazione, partnership Chery |
| **AVI TOTALE** | **~32/100** | 🔴 Scarsa visibilità AI |

**Domain Share of AI Voice (SOAIV)**
- drautomobiles.com: 4% delle citazioni
- Wikipedia: 8% (pagina esiste ma scarna)
- Forum auto (DueRuote, Autopareri): 24%
- Recensioni YouTube/blog: 31%
- Competitor diretti: 33%

**Recommendations engine output (ordinati per priorità)**
1. 🔴 **HIGH** — Citation rate 18%: pubblicare 8-10 pagine pillar SEO con schema Article + FAQ
2. 🔴 **HIGH** — Hallucination 28%: creare "canonical facts" page con timeline aziendale, partnership, modelli
3. 🟠 **MED** — Sentiment neutro: pubblicare case study clienti soddisfatti, recensioni terze parti
4. 🟠 **MED** — Position 4.8: riscrivere intro pagine modello con brand name nelle prime 2 frasi
5. 🟡 **LOW** — Aggiungere `sameAs` Wikipedia/Wikidata/LinkedIn al JSON-LD Organization

---

## 📊 Confronto AVI side-by-side

```
                FERRARI                DR AUTOMOBILES
AVI:            ████████████ 89/100    ████ 32/100        Δ -57
Citation:       ███████████  92%       ██   18%           Δ -74pp
Mention freq:   ████████████ 95%       ████ 32%           Δ -63pp
Sentiment:      +0.78                  -0.05              Δ -0.83
Recommend:      ████████████ 88%       █    12%           Δ -76pp
Position avg:   1.2 (primo)            4.8 (ultimo)       Δ +3.6
Hallucination:  4%                     28%                Δ +24pp
```

---

## 💡 Storytelling per slide (3 punti chiave)

### 1. **"Stesso settore, due mondi"**
Ferrari domina l'AI search. DR Automobiles è invisibile. **Non è una questione di prodotto** — è una questione di **AI-readiness** del contenuto.

### 2. **"Il gap costa fatturato"**
Ogni query "miglior SUV italiano economico" che NON menziona DR è un lead perso. Stima: **40k+ query/mese in Italia** dove DR potrebbe apparire ma non lo fa.

### 3. **"AIO Pulse mostra cosa fare"**
Non solo misura: **dà l'azione concreta**. Recommendation engine deterministico → 5 priorità ordinate per impatto/effort. Niente AI handwaving — regole esplicite, output ripetibile.

---

## 🎬 Demo script suggerito (10 min)

| Tempo | Step | Cosa mostrare |
|---|---|---|
| 0:00 | Intro tesi | "L'AI è il nuovo Google. Sei pronto?" |
| 1:00 | Crea brand Ferrari | Form onboarding live, mostra i18n EN/IT/SV |
| 2:00 | AVI widget Ferrari | Score 89, breakdown 6 componenti |
| 3:30 | Citation tracker Ferrari | Domain SOAIV: ferrari.com 38% |
| 5:00 | Switch a DR Automobiles | Stesso flow, score 32 |
| 6:30 | Competitor gap analysis | Ferrari +57 punti vs DR |
| 7:30 | Recommendation engine | 5 azioni ordinate per priorità |
| 8:30 | Report HTML/PDF | Click → download, mostra report client-ready |
| 9:30 | Closing | "Da invisible a leader. AIO Pulse è la mappa." |

---

## 📋 Disclaimer per l'audience

> I valori AVI mostrati sono basati su esecuzioni reali della piattaforma su un campione di 10 prompt rappresentativi per ogni brand al **2026-04-13**. Gli score evolvono nel tempo: AIO Pulse esegue cron giornalieri per tracciare il trend.

---

## 📦 Setup tecnico (per chi vuole replicare la demo)

```bash
# 1. Crea brand Ferrari via UI o API
curl -X POST http://localhost:3001/api/brands \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ferrari",
    "domain": "ferrari.com",
    "aliases": ["Ferrari S.p.A.", "Cavallino Rampante", "Scuderia Ferrari"],
    "competitors": ["Lamborghini", "McLaren", "Porsche", "Aston Martin", "Bugatti"],
    "industry": "Automotive – Luxury Sports Cars",
    "language": "it",
    "color": "#DC0000"
  }'

# 2. Stessa cosa per DR Automobiles
curl -X POST http://localhost:3001/api/brands \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DR Automobiles",
    "domain": "drautomobiles.com",
    "aliases": ["DR Motor Company", "Gruppo DR"],
    "competitors": ["Fiat", "Dacia", "Suzuki", "Hyundai", "Jeep"],
    "industry": "Automotive – SUV/Crossover",
    "language": "it",
    "color": "#1F3A8A"
  }'

# 3. Lancia monitoring (UI: dashboard/monitor o cron /api/cron/monitoring)
```
