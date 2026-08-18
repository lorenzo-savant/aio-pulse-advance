# Semrush AI Visibility vs AEO Pulse — analisi comparativa

**Compilata il 18 agosto 2026** · Base: [semrush-ai-visibility-2026-08.md](./semrush-ai-visibility-2026-08.md) confrontato con il codice del repo (riferimenti file:riga verificati alla data di compilazione).

Tre sezioni: cosa lo studio Semrush **valida** delle nostre scelte, cosa loro hanno e noi no (con giudizio su cosa vale la pena copiare), e la **differenza di natura** fra i due strumenti — che è l'argomento di vendita, non un gap.

---

## 1. Validazioni — scelte nostre confermate dalla loro documentazione

### 1.1 Il nostro citation-quality-scorer è costruito sul loro studio — e i numeri coincidono

[`src/lib/services/citation-quality-scorer.ts`](../../src/lib/services/citation-quality-scorer.ts) dichiara come fonte "industry research, study period Jul–Aug 2025, 304k cited URLs vs 921k Google-ranking-only URLs". È lo **studio Semrush §8.1** (15 lug–6 ago 2025, 304.805 vs 921.614). I cinque pesi coincidono con gli arrotondamenti dei loro numeri:

| Segnale                 | Semrush | Nostro scorer |
| ----------------------- | ------- | ------------- |
| Clarity & summarization | +32,83% | +33%          |
| E-E-A-T                 | +30,64% | +30%          |
| Q&A format              | +25,45% | +25%          |
| Section structure       | +22,91% | +23%          |
| Structured data         | +21,60% | +22%          |

Conseguenze: (a) ora abbiamo la fonte primaria da citare — fatto nel header dello scorer; (b) lo scorer condiviso alimenta anche [`article-generator.ts`](../../src/lib/services/article-generator.ts), quindi _generiamo contenuto ottimizzato sugli stessi segnali che Semrush ha misurato_ — con una differenza che loro non hanno: il nostro ciclo misura→genera→rimisura usa un solo scorer nei due sensi.

Da notare il **fattore negativo che non abbiamo implementato**: non-promotional tone −26,19%, con la spiegazione del confondente (qualità professionale, non tono). Giusto non averlo come segnale: Semrush stessa lo tratta come artefatto.

### 1.2 Mention ≠ citation — il nostro asse portante, quantificato da loro

La distinzione che ripetiamo in ogni doc e report ("essere nominati è portata, essere citati è fiducia" — [`docs/features/README.md`](../features/README.md), pilastro Citazioni 30% in [`geo-score.ts`](../../src/lib/services/geo-score.ts)) è quantificata dal loro Index 2026: sovrapposizione fino al 30% su Gemini, meno di 1 brand su 5 forte su entrambi gli assi. Su Relovie abbiamo osservato esattamente questo pattern: dominio più citato del mercato E pilastro citazioni debole, contemporaneamente.

### 1.3 Sentiment solo su query non-branded — la loro scelta conferma il nostro finding

Semrush calcola il sentiment del report Perception **solo su query non-branded** (§4.2, "il singolo dettaglio più importante"). Noi siamo arrivati alla stessa distinzione dai dati: su Relovie, 100% di menzioni sulle domande branded contro 57,4% su quelle di scoperta — due popolazioni che non vanno mischiate. **Ma il nostro sentiment le mischia ancora** → vedi §2.3.

### 1.4 Tassonomia bot: training vs search — già implementata

[`crawler-access-audit.ts`](../../src/lib/services/crawler-access-audit.ts) classifica già `engine: 'training'` per GPTBot, Google-Extended, ClaudeBot — la stessa distinzione che Semrush segnala come "operativamente decisiva" e spesso fraintesa. Vedi però il gap §2.1.

### 1.5 Il disclaimer "segnali direzionali"

La loro formula ("nessuna piattaforma può fornire numeri esatti; segnali direzionali affidabili") è la stessa posizione dei nostri §7/§9 in _Dentro AEO Pulse_ / _Vad AEO Pulse mätte_ (finestra minima 7 giorni, non-determinismo). Se Semrush a 126M di prompt lo dichiara, la nostra versione a 427 scansioni è ancora più necessaria — e citabile come prassi di settore.

### 1.6 Concorrenti scoperti automaticamente

Il loro punteggio usa competitor "identificati automaticamente"; il nostro `SovDiscovered` in [`share-of-voice.ts`](../../src/lib/services/share-of-voice.ts) fa la stessa cosa e su Relovie ha corretto la configurazione (Blocket, Elgiganten, MediaMarkt, Facebook Marketplace emersi dai dati). Stessa filosofia: la lista configurata riflette il brief, quella scoperta il mercato.

---

## 2. Gap — cosa hanno loro, con giudizio su cosa copiare

Ordinati per rapporto valore/sforzo per noi.

### 2.1 `Claude-SearchBot` e `Claude-User` mancano dal nostro audit crawler — ALTO valore, sforzo minimo

Gli 8 bot verificati da Semrush includono `Claude-SearchBot` (search crawler: bloccarlo esclude da Claude search) e `Claude-User` (fetcher on-demand). Il nostro [`crawler-access-audit.ts`](../../src/lib/services/crawler-access-audit.ts) ha GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Perplexity-User, ClaudeBot, Google-Extended, ccbot — **ma non i due bot Claude search/fetch**. Nota: abbiamo ritirato Claude come _motore di monitoraggio_ per costo, ma la visibilità del cliente su Claude search resta un fatto del mercato — l'audit deve verificarli comunque. Da aggiungere con la loro classificazione (search / fetcher).

### 2.2 Tassonomia delle fonti Missing / Shared / Strong / Unique — ALTO valore, sforzo medio

La parte "più utile" del loro Competitor Research (§6.2). Noi abbiamo già tutti i dati per calcolarla: domini citati per risposta (`cited_urls`) e menzioni competitor per risposta (`competitor_mentions`) in `monitoring_results`. Oggi [`citation-sources`](../features/citation-sources.md) mostra la classifica dei domini ma non incrocia _per chi_ il dominio viene citato. Le quattro classi trasformerebbero la lista in un piano d'azione: Missing = target di outreach, Strong/Unique = posizioni da difendere. È la versione sistematica del "piano PR scritto dai motori" che già vendiamo come output 05.

### 2.3 Sentiment separato branded / non-branded — ALTO valore, sforzo basso

Vedi §1.3: loro lo fanno, noi no. I prompt hanno già la categoria ([`prompts`](../features/prompts.md)) e la distinzione branded/discovery è già emersa nei report Relovie. Aggiungere il filtro non-branded alla pagina [`sentiment`](../features/sentiment.md) e al report HTML allineerebbe la metrica alla lettura che già ne diamo a voce. Attenzione al prerequisito: la correzione C4 (categorie prompt non popolate — 51/61 `awareness` su Relovie) va chiusa prima, o il filtro non ha su cosa filtrare.

### 2.4 Misurare a livello di topic, non di prompt — MEDIO valore, sforzo alto

Loro rifiutano di misurare il singolo prompt ("troppo specifico e unico") e aggregano per topic semantico. Noi misuriamo per prompt, ed è parte del perché il valore giornaliero oscilla di ±20 punti su campioni piccoli. Abbiamo già i pezzi (`response_embeddings`, [`response-clustering.ts`](../../src/lib/services/response-clustering.ts), Topic Finder) ma le _metriche_ non sono aggregate per topic. Un layer "citation rate per topic" ridurrebbe il rumore e renderebbe leggibili le tendenze con meno scansioni. Da valutare dopo C2 (throughput).

### 2.5 Due check tecnici assenti dall'audit — BASSO sforzo, valore concreto

Verificato: [`technical-seo-audit.ts`](../../src/lib/services/technical-seo-audit.ts) non ha né il check sulla **lunghezza dello slug** (finding Semrush: 17–40 caratteri battono costantemente gli estremi) né un check di **SSR / dipendenza da JS** (siti JS-heavy problematici per i crawler AI). Entrambi deterministici, entrambi aggiungibili al set esistente di 44 controlli.

### 2.6 Posizione: semantica per piattaforma — da documentare, non da implementare

Il loro dettaglio §6.5 (su AI Mode l'area risposta È posizione 1; su ChatGPT le citazioni sono ordinate) è un promemoria che "posizione" non è un concetto uniforme fra piattaforme. La nostra `mention_position` è la frase della risposta — coerente fra i nostri 3 motori, quindi va bene così, ma il glossario dovrebbe dire esplicitamente che non è confrontabile con la "position" di Semrush.

### 2.7 SoV pesata per posizione — da valutare

Il loro Brand Performance pesa la SoV anche per posizione nella risposta. Il nostro [`share-of-voice.ts`](../../src/lib/services/share-of-voice.ts) pesa per `mention_count` e traccia la posizione media separatamente. La versione separata è più spiegabile a un cliente ("quota" e "quanto presto" come numeri distinti); la loro comprime tutto in un numero. Non un gap netto — una scelta diversa. Se mai la adottiamo, come metrica aggiuntiva, non in sostituzione.

### Cosa NON copiare

- **Asse favorable vs general** al posto di positivo/neutro/negativo: il nostro terzo stato (negativo, con zero-negativi come certificazione) è un argomento commerciale che loro hanno rinunciato ad avere nel toolkit consumer.
- **Prompt sintetici da clickstream**: è il loro fossato (317M prompt), irraggiungibile e non necessario al nostro modello — vedi §3.
- **Brand extraction via AI**: il nostro matching a confini di parola ([`competitor-identity.ts`](../../src/lib/services/competitor-identity.ts)) è meno potente ma deterministico e spiegabile; loro stessi ammettono debolezza sui brand piccoli — che sono esattamente i nostri clienti. Su questo segmento il nostro approccio con alias espliciti è _più_ affidabile, non meno.

---

## 3. Differenza di natura — l'argomento di vendita

I due strumenti non misurano la stessa cosa con qualità diverse: misurano **cose diverse**.

|                      | Semrush                                        | AEO Pulse                                                |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Materia prima        | Clickstream + prompt sintetici, 317M+          | Prompt del cliente, eseguiti davvero via API             |
| Domande              | Quelle che il mercato fa (distribuzione reale) | Quelle che il cliente vuole vincere (controllo)          |
| Risposta grezza      | Visibile (pannello _Answers for_)              | Archiviata integralmente, per riga                       |
| Sentiment            | Black box dichiarata (§4.3)                    | Modello noto, aspetti espliciti, risultato ispezionabile |
| Ripetibilità         | Campionamento loro, cadenza loro               | Stessi prompt, stessa cadenza, delta verificabile        |
| Brand piccoli/locali | Debolezza ammessa                              | Il nostro caso d'uso primario                            |
| Sottocartelle        | Non supportate                                 | Non applicabile (misuriamo il brand, non il dominio)     |
| Costo                | $99/mese+ (senza trial)                        | Deployment interno unmetered                             |

La frase da usare: **Semrush è il telescopio, AEO Pulse è il microscopio.** Semrush dice dove sta il mercato — distribuzioni, benchmark di settore, topic volume — su un campione che non controlli. AEO Pulse esegue _le tue_ domande sui _tuoi_ motori, conserva ogni risposta parola per parola, e rimisura le stesse domande dopo l'intervento. Il loro punto dichiarato più debole (estrazione sui brand piccoli, §3) è il nostro segmento; il nostro limite dichiarato (nessuna distribuzione di mercato: non sappiamo _quali_ domande fa la gente, solo cosa rispondono i motori a quelle che monitoriamo) è il loro punto forte. Per un'agenzia i due sono complementari, non alternativi — e il loro Index pubblico (gratuito) è utilizzabile come benchmark di settore accanto ai nostri numeri puntuali.

Un dato loro da riutilizzare in vendita: _45% dei marketing leader non riesce a misurare la visibilità AI del brand; solo il 9% ha strumenti completi_ (§10). È la dimensione del problema, certificata dal concorrente più grande.

---

## 4. Follow-up proposti (non implementati)

| #   | Intervento                                                      | File                                | Sforzo       | Prerequisito                     |
| --- | --------------------------------------------------------------- | ----------------------------------- | ------------ | -------------------------------- |
| 1   | Aggiungere `Claude-SearchBot` + `Claude-User` all'audit crawler | `crawler-access-audit.ts`           | ~1h con test | —                                |
| 2   | Tassonomia fonti Missing/Shared/Strong/Unique                   | `citation-sources` + servizio nuovo | ~1g          | —                                |
| 3   | Filtro branded/non-branded sul sentiment                        | `sentiment` page + report HTML      | ~½g          | correzione C4 (categorie prompt) |
| 4   | Check slug-length (17–40) e SSR nell'audit tecnico              | `technical-seo-audit.ts`            | ~½g          | —                                |
| 5   | Metriche aggregate per topic                                    | nuovo layer su embeddings           | ~1 settimana | C2 (throughput)                  |
| 6   | Nota di non-confrontabilità di `mention_position` nel glossario | `src/content/docs/*`                | ~15min       | —                                |
