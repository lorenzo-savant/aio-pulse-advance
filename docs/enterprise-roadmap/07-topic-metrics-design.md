# Metriche aggregate per topic — design (Task 5) — 2026-08-19

Istruttoria sul follow-up **#5** dello studio Semrush
([`semrush-vs-aeo-pulse.md §2.4`](../research/semrush-vs-aeo-pulse.md)):
_"Loro rifiutano di misurare il singolo prompt e aggregano per topic semantico.
Noi misuriamo per prompt, ed è parte del perché il valore giornaliero oscilla."_

**Solo design. Nessun codice, nessuna migrazione, nessun dato toccato.**
Il doc risponde alle sei domande poste nel handoff e chiude con una
raccomandazione secca.

**Metodo**: numeri letti dal database di produzione il 19 agosto 2026 con una
query di sola lettura, e riferimenti `file:riga` al codice di questo repo.
Dove non ho verificato, lo dico.

---

## 0. 📍 I numeri veri, prima di ogni ragionamento

| Grandezza | Valore reale (2026-08-19) |
|---|---|
| Brand | 5 |
| Prompt (tutti attivi) | 206 |
| `monitoring_results` | 2 612 |
| Righe ultimi 7 giorni | 378 → **~54/giorno su tutti i brand, ~11/giorno per brand** |
| Righe ultimi 30 giorni | 1 332 |
| `citation_snapshots` | 3 800 |
| `response_embeddings` | **271** → copre il **10,4%** delle risposte |

Due di questi numeri decidono quasi tutto il design.

**~11 risposte al giorno per brand.** Spalmate su 8 topic fanno 1,4 risposte per
topic al giorno: un topic-day è, nella maggior parte dei casi, vuoto o composto
da una sola risposta. Qualsiasi metrica *giornaliera* per topic sarebbe rumore
peggiore di quello che vuole curare.

**Gli embedding delle risposte coprono il 10% delle righe.** Non è un dettaglio
implementativo: è ciò che rende inutilizzabile il percorso "riusa
`response_embeddings`" come base delle metriche. Un topic costruito su un decimo
delle risposte produce numeri che sembrano completi e non lo sono.

---

## 1. Assegnazione prompt → topic: clusterizzare i prompt, non le risposte

**Decisione: clusterizzare i PROMPT.** Come Semrush, e per tre ragioni nostre.

1. **Copertura.** I prompt sono 206 e li abbiamo tutti, per intero, sempre. Le
   risposte sono 2 612 con embedding su 271. Clusterizzare le risposte
   significherebbe costruire la metrica sul 10% dei dati o pagare un backfill
   prima ancora di sapere se la metrica serve.
2. **Stabilità.** Il prompt è fisso; la risposta cambia a ogni scansione. Se il
   topic è una proprietà della risposta, la stessa domanda può cadere in topic
   diversi da un giorno all'altro — e allora il trend per topic misura la
   deriva del clustering, non il mercato.
3. **Costo.** 206 prompt × ~30 token ≈ 6 200 token con
   `text-embedding-3-small` ([`semantic.ts:18`](../../src/lib/services/semantic.ts))
   a ~$0,02/1M token: **circa 0,0001 $ una tantum**, più qualche centesimo di
   millesimo per ogni prompt nuovo. Il costo non è un argomento in nessuna
   direzione.

`response-clustering.ts` resta dov'è e per quello che fa oggi ("quali temi i
motori associano al brand" — [`/api/themes`](../../src/app/api/themes/route.ts)):
è clustering di *risposte*, cioè una domanda diversa. Il suo algoritmo — greedy
centroid, O(N²), puro e testato — è riusabile così com'è su 206 vettori.

**Attenzione a una cosa nel riuso**: `MAX_EMBED_PER_REQUEST = 80`
([`themes/route.ts:17`](../../src/app/api/themes/route.ts)) tronca l'embedding
per richiesta. Su 206 prompt servono 3 passate o un limite diverso per questo
percorso. Da decidere in implementazione, non ora.

---

## 2. Stabilità dei topic nel tempo: congelati alla creazione, versionati

Il rischio vero di questa feature non è il costo né la matematica: è che un
topic cambi composizione fra due settimane e il grafico mostri un salto che
nessun fatto del mondo ha causato. È esattamente l'incidente che
`recalc-health-scores.mjs` ha dovuto riparare a mano.

**Decisione: i topic sono un artefatto versionato, non un calcolo al volo.**

- Il clustering gira **su richiesta**, non a ogni cron.
- Il risultato è una **versione**: `topic_version` (numero incrementale per
  brand) con il set di topic e l'assegnazione prompt → topic.
- Le metriche sono sempre calcolate **dentro una versione**. Un grafico non
  attraversa mai due versioni senza dirlo.
- Un prompt nuovo entra nella versione corrente per **similarità al centroide**
  esistente, senza ricalcolare i cluster. Se la sua similarità massima è sotto
  soglia, entra in un topic `unassigned` visibile — non viene forzato nel topic
  meno peggio.
- Il riclustering è un'azione **esplicita dell'operatore**, che crea la versione
  N+1. Le serie precedenti restano leggibili sulla versione N.

Senza questa regola la feature è peggiore di non averla: sostituisce un rumore
che si vede (oscillazione giornaliera) con un rumore che non si vede
(ricomposizione dei bucket).

---

## 3. Persistenza: tabella nuova, writer unico, bucket settimanale

Regola 1 del repo (additive-only) e regola 3 (un solo writer per tabella di
snapshot). `citation_snapshots` non si tocca.

**Tre tabelle nuove, tutte additive:**

| Tabella | Contenuto | Righe stimate |
|---|---|---|
| `prompt_topics` | versione, topic, label, centroide, assegnazione prompt→topic | 206 righe per versione |
| `topic_versions` | brand_id, version, created_at, params del clustering | ~1 riga per riclustering |
| `topic_snapshots` | la metrica aggregata | vedi sotto |

**Granularità di `topic_snapshots`: brand × topic × settimana.**
Non × giorno, e non × engine come dimensione separata.

La lezione di `citation_snapshots` è nei numeri: 3 800 righe per 5 brand perché
la chiave è engine × categoria × lingua × giorno. Applicare lo stesso
moltiplicatore ai topic darebbe 5 brand × 6 topic × 3 engine × 365 giorni ≈
**33 000 righe/anno** per una metrica che, a 1,4 risposte per topic-day, sarebbe
vuota nella maggior parte delle celle.

Con bucket settimanale e l'engine come breakdown `jsonb` dentro la riga:
5 × 6 × 52 ≈ **1 560 righe/anno**. Venti volte meno, e ogni riga contiene un
numero che significa qualcosa (~77 risposte per brand a settimana, ~13 per
topic).

Writer unico: `calculateTopicSnapshots()` in un servizio nuovo, chiamato dallo
stesso punto del cron che oggi chiama `calculateCitationSnapshots`. Nessun altro
percorso di scrittura.

---

## 4. Metriche per topic: le stesse, con il denominatore del topic

Nessuna metrica nuova. Le tre che già sappiamo spiegare, ricalcolate sulle
risposte del topic nella finestra:

| Metrica | Definizione |
|---|---|
| Mention rate | risposte del topic che nominano il brand / risposte del topic |
| Citation rate | risposte del topic che citano il dominio del brand / risposte del topic |
| Posizione media | media di `mention_position` sulle risposte del topic che nominano il brand |

Ogni riga porta **`n`, il numero di risposte del bucket**, e la UI non mostra un
valore senza mostrare `n`. È la stessa disciplina applicata al fan-out
(`captured` / `notCaptured` distinti) e alla tassonomia delle fonti
(`belowThreshold`): un numero senza il suo denominatore è una decisione presa al
buio.

Soglia proposta: sotto `n = 5` in una settimana la cella si mostra come
"insufficiente", non come una percentuale.

---

## 5. C2 (throughput) è un prerequisito? **No.**

Il handoff lo dava per probabile. I numeri dicono il contrario, ed è la
conclusione più utile di questo doc.

L'aggregazione per topic è *precisamente* lo strumento che serve quando il
throughput è basso: raggruppare 206 prompt in ~6 topic moltiplica per ~34 il
denominatore di ogni bucket. Il beneficio non dipende da `MAX_PROMPTS_PER_RUN`
([`cron/monitoring/route.ts:146`](../../src/app/api/cron/monitoring/route.ts)):
è un guadagno statistico che esiste a qualsiasi cadenza.

Quello che C2 cambia è **quanto stretta può essere la finestra**. A 11
risposte/giorno/brand la finestra utile è la settimana. Con C2 a 20 prompt per
run la finestra utile scenderebbe verso il giorno. Ma la settimana è già la
cadenza con cui questi numeri vengono letti da un cliente.

**C2 rende la feature migliore, non possibile.** Non bloccare l'una sull'altra.

---

## 6. Costo

| Voce | Stima |
|---|---|
| Embedding iniziale dei 206 prompt | ~6 200 token → **~0,0001 $** |
| Prompt nuovi | trascurabile, ordine di 10⁻⁶ $ per prompt |
| Riclustering | zero chiamate a pagamento: i vettori sono già in tabella, il clustering è JS puro |
| Scrittura snapshot | una query di aggregazione settimanale per brand |
| Storage | ~1 560 righe/anno + 206 vettori da 1536 float per versione |

Il costo monetario di questa feature è **sotto il centesimo**. Il costo vero è
il tempo di implementazione (~1 settimana come stimato) e il rischio di
versionamento della §2.

---

## 7. Cosa non ho verificato

- **Qualità dei cluster sui prompt reali.** Non ho eseguito il clustering: il
  greedy centroid su 206 prompt svedesi con soglia da tarare potrebbe produrre
  6 topic sensati o 40 microcluster. È la prima cosa da provare in
  implementazione, e se produce microcluster il resto del design non serve.
- **Se 6 topic sia il numero giusto.** L'ho usato come ordine di grandezza in
  tutti i calcoli. Va tarato sui dati, non deciso qui.
- **L'interazione con la riclassificazione delle categorie** (C4, commit
  `33c30f5`): topic e categoria sono due tassonomie parallele sugli stessi
  prompt. Se i topic funzionano, la categoria diventa ridondante per l'analisi e
  resta solo come filtro editoriale. Da decidere quando i topic esistono.

---

## Raccomandazione

**Fare — e non aspettare C2.**

Con questi tre vincoli, che non sono negoziabili perché sono ciò che separa la
feature dal peggioramento:

1. **Clusterizzare i prompt, non le risposte.** Copertura 100% invece di 10,4%,
   costo nullo, topic stabili per costruzione.
2. **Topic congelati e versionati.** Il riclustering è un'azione esplicita che
   crea una versione nuova; nessuna serie attraversa due versioni in silenzio.
3. **Bucket settimanale, `n` sempre esposto, sotto 5 non si pubblica un
   numero.** A ~11 risposte al giorno per brand la granularità giornaliera
   sarebbe teatro.

Prima riga di codice consigliata: non la tabella, ma **una prova di clustering
sui 206 prompt reali** per vedere se i topic che escono sono difendibili davanti
a un cliente. Se non lo sono, tutto il resto di questo documento è carta.
