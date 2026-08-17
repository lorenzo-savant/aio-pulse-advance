// PATH: src/content/docs/it.ts
//
// Documentazione in-app in italiano. Rispecchia docs/features/ (fonte di verità
// sul comportamento delle funzionalità) e NAV_SECTIONS (fonte di verità su cosa
// è raggiungibile). Gli id di gruppo e di sezione devono restare identici a
// en.ts e sv.ts: sono ancore di deep-link e permettono di cambiare lingua
// restando sulla stessa sezione.

import type { DocContent } from './types'

export const docsIt: DocContent = [
  {
    id: 'getting-started',
    group: 'Per iniziare',
    icon: 'start',
    sections: [
      {
        id: 'what-is-aeo-pulse',
        title: "Cos'è AEO Pulse?",
        content: `AEO Pulse è una piattaforma di visibilità nella ricerca AI. Monitora come appare il tuo brand quando le persone chiedono agli assistenti AI di prodotti e servizi del tuo settore.

La SEO tradizionale misura la tua posizione su Google. AEO Pulse misura una cosa diversa: se gli assistenti AI nominano il tuo brand quando qualcuno chiede "quale marketplace dell'usato conviene?" oppure "qual è il miglior studio contabile a Falun?"

Conta perché una quota crescente della ricerca d'acquisto avviene dentro un assistente AI invece che in una pagina di risultati. Se l'assistente non ti nomina, sei invisibile a quella domanda — e a differenza di un ranking Google non esiste una pagina dove vederti in posizione 11.

La piattaforma risponde a quattro domande:

• Visibilità — quanto spesso e quanto in evidenza appari nelle risposte AI.
• Confronto — se i motori preferiscono i tuoi competitor, e di quanto.
• Accuratezza — cosa dicono davvero di te i motori, e se è vero.
• Azione — cosa cambiare, in ordine di priorità, e cosa dovrebbe muovere.`,
      },
      {
        id: 'key-concepts',
        title: 'Concetti chiave',
        content: `Impara questi otto termini e il resto del prodotto si legge da sé.

• AVI (AI Visibility Index) — punteggio composito 0-100. Il numero da guardare ogni giorno.
• GEO Score — composito 0-100 con voto in lettera (A-F) che misura quanto sei costruito per essere citato. L'AVI è il risultato; il GEO Score è la capacità che sta dietro.
• Citation rate — quota di risposte monitorate che nominano il brand. Menzioni ÷ risposte totali × 100.
• Posizione della menzione — in quale frase appari per la prima volta. La frase 1 è la migliore; più tardi significa che il lettore può non arrivarci.
• Sentiment — il tono di una risposta su di te: positivo, neutro o negativo, con punteggio da -1.0 a +1.0.
• Motore — una piattaforma AI: ChatGPT, Gemini o Perplexity.
• Prompt — una domanda che inviamo ai motori al posto tuo, in rappresentanza di una vera domanda di un cliente.
• Snapshot — l'aggregato giornaliero dei risultati di monitoraggio. Ogni grafico trend del prodotto legge gli snapshot, non le risposte grezze.

Due distinzioni causano quasi tutta la confusione, quindi vale dirle chiaramente:

• Nominato non è citato. Una menzione è il motore che dice il tuo nome. Una citazione è il motore che linka il tuo dominio come fonte. Le menzioni sono portata; le citazioni sono fiducia.
• Copertura non è peso. "In quante risposte appari" e "quale quota di tutte le menzioni di brand è tua" sono misure diverse, e un competitor può batterti su una perdendo malamente sull'altra.`,
      },
      {
        id: 'quick-start',
        title: 'Avvio rapido',
        content: `Cinque passi da un account vuoto a dati reali.

Passo 1 — Aggiungi il brand. Configurazione → Brand. Nome, dominio, alias, competitor, settore, locale, colore.

Passo 2 — Crea i prompt. Configurazione → Prompt, poi "Generate (AI)" per espandere brand e settore in domande pronte, oppure scrivili a mano. Punta a 30-50 prompt distribuiti fra intento locale, nazionale e di categoria.

Passo 3 — Lancia il primo controllo. Monitoraggio → Monitoraggio Live. Puoi anche lasciar fare allo scheduler: il monitoraggio gira automaticamente tre volte al giorno.

Passo 4 — Leggi il risultato. La Panoramica dà i numeri di riferimento. Analisi → Citazioni, Sentiment e Competitor li scompongono.

Passo 5 — Agisci. Ottimizza → Consulente strategico per la narrativa ordinata, Raccomandazioni per la lista persistente, Site Audit per cosa correggere sul sito.

Se preferisci essere guidato nei passi 1-3, usa Configurazione → Inizia Qui: è lo stesso lavoro in un wizard, e finisce lanciando la prima scansione.`,
      },
      {
        id: 'first-brand-setup',
        title: 'Il primo brand, campo per campo',
        content: `Ogni campo del brand alimenta qualcosa di specifico. Impostarli bene all'inizio evita di rimisurare dopo.

• Nome brand — il nome ufficiale come dovrebbe apparire nelle risposte. Usato per il match esatto.
• Dominio — il sito principale. Serve a rilevare quando un motore ti cita come fonte invece di solo nominarti.
• Alias — grafie alternative, spaziature e varianti con e senza accenti. Fondamentale fuori dall'inglese, dove i motori variano maiuscole e diacritici liberamente. Un alias mancante si legge come una menzione mancante.
• Competitor — i rivali reali, da 3 a 5. Guidano ogni pannello comparativo del prodotto.
• Settore / preset — classificazione di settore. Guida la generazione dei prompt e le regole di raccomandazione.
• Locale — la lingua del tuo mercato. Un brand svedese ha bisogno di prompt in svedese per apparire nelle risposte in svedese; sbagliarlo significa misurare il mercato sbagliato.
• Descrizione — un paragrafo breve su cosa fai. Usato come contesto per valutare sentiment e accuratezza.
• Colore brand — usato nei grafici e nei report PDF esportati.

Il campo che più spesso va corretto in seguito è Competitor. I motori ti confrontano con chi ritengono siano i tuoi concorrenti, non con la lista che hai configurato — e Analisi → Competitor riporta i rivali scoperti fuori dalla tua configurazione. Quando la lista scoperta contraddice quella configurata, fidati della prima e aggiorna la configurazione.`,
      },
    ],
  },

  {
    id: 'overview',
    group: 'Panoramica',
    icon: 'overview',
    sections: [
      {
        id: 'dashboard-page',
        title: 'La dashboard',
        content: `La pagina di arrivo dopo il login. Prende un numero di riferimento da ogni superficie di Analisi così vedi in un colpo d'occhio se qualcosa si è mosso, e da lì entri nella pagina che possiede il dettaglio.

Di proposito non possiede alcun dato proprio. Ogni numero qui viene dallo stesso posto che legge la pagina dedicata. Se un numero qui non coincide con la sua pagina, fidati della pagina.

Ogni card carica in modo indipendente, quindi una fonte lenta o non disponibile degrada una card e non l'intera schermata. Durante un'esecuzione di monitoraggio una card può mostrare i dati nuovi mentre quella accanto mostra ancora i precedenti — ricarica per allinearle.`,
      },
      {
        id: 'reading-kpis',
        title: 'Leggere i numeri di riferimento',
        content: `Quattro numeri portano quasi tutto il significato, e ciascuno ha una lettura sbagliata comune da evitare.

• AVI — la tua visibilità oggi. Leggi il periodo, non il giorno: con circa 30 risposte al giorno e motori non deterministici, un singolo giorno che oscilla di 20 punti è rumore normale, non un crollo.
• GEO Score con il voto in lettera — la tua capacità. Un voto basso accanto a un AVI sano significa che stai performando sopra la tua struttura: è una buona notizia, perché la struttura è la parte ricostruibile.
• Citation rate — quanto spesso vieni nominato. Un citation rate che sale con sentiment piatto significa più portata, non più preferenza.
• Ripartizione sentiment — positivo / neutro / negativo. Zero negativi è protezione, non vittoria. Una quota neutra alta significa che vieni elencato fra le alternative invece che raccomandato, e il prossimo obiettivo è passare da nominato a raccomandato.

L'unica cosa che nessun numero singolo dice è se i motori ti descrivono correttamente. Quello sta in Analisi → Sentiment e nel testo stesso delle risposte.`,
      },
    ],
  },

  {
    id: 'setup',
    group: '1 · Configurazione',
    icon: 'setup',
    sections: [
      {
        id: 'onboarding-wizard',
        title: 'Inizia Qui — il wizard guidato',
        content: `Un wizard in quattro passi che porta un account nuovo da vuoto a una scansione in corso senza uscire dalla pagina: benvenuto e lingua interfaccia, brand, prompt, lancio.

Non puoi saltare avanti su un passo incompleto — il passo brand richiede un brand valido, il passo prompt almeno un prompt — ma puoi tornare su qualsiasi passo già completato.

Due cose da sapere. Il wizard non riprende dopo un ricaricamento della pagina: le righe già create restano, quindi se ricarichi dopo il passo brand troverai il brand ad attenderti in Configurazione → Brand. E la lingua scelta al passo 1 è quella dell'interfaccia, non la lingua di mercato del brand: si impostano separatamente, ed è il locale del brand a determinare la lingua dei prompt.`,
      },
      {
        id: 'brands-aliases',
        title: 'Brand e rilevamento alias',
        content: `Il rilevamento è esatto e sui confini di parola, per scelta. Il matcher cerca parole intere e non sottostringhe, perché il match su sottostringa produceva falsi positivi reali: "Acast" corrispondeva ad "Acasting", due aziende senza alcun rapporto.

È questa precisione a rendere gli alias così importanti. Ogni grafia che un motore potrebbe usare va elencata, altrimenti la menzione non viene contata:

• Varianti di maiuscole e spaziatura — "Ekonomirådgivarna", "Ekonomi Rådgivarna", "ekonomi radgivarna".
• Forme senza accenti, che i motori producono continuamente per nomi nordici e romanzi.
• Abbreviazioni e forma con ragione sociale, se compaiono nel mercato.

Un citation rate incredibilmente basso è molto più spesso un problema di alias che di visibilità. Controlla il testo delle risposte in Analisi → Citazioni prima di concludere di essere assente.`,
      },
      {
        id: 'competitors-setup',
        title: 'Configurazione dei competitor',
        content: `I competitor che configuri definiscono ogni pannello comparativo: share of voice, tassi di confronto, analisi dei gap.

Configura da 3 a 5 rivali reali — quelli con cui un cliente ti confronterebbe davvero, non quelli della tua categoria sulla carta. Questa distinzione ha conseguenze pratiche: un brand posizionato come una cosa ma che opera come un'altra finisce misurato contro il mercato sbagliato, e ogni confronto nel prodotto eredita quell'errore.

Aggiungere un competitor non ricostruisce la storia. La sua serie parte dal giorno in cui l'hai aggiunto, quindi un rivale appena configurato sembra comparire dal nulla. Aggiungili presto.

Analisi → Competitor riporta le entità scoperte: brand che i motori nominano e che non hai mai configurato. Tratta quella lista come la correzione alla tua configurazione.`,
      },
      {
        id: 'prompts',
        title: 'Prompt — cosa chiedere',
        content: `Un prompt è una domanda di un cliente a cui vuoi essere la risposta. I prompt buoni sono specifici, nella lingua del tuo mercato, e formulati come una persona scrive davvero.

Scrivi per intento, non per parole chiave:

• Intento di categoria — "quali piattaforme vendono elettronica usata in Svezia?"
• Intento locale — "miglior studio contabile a Falun".
• Intento di confronto — "X o Y per una piccola impresa?"
• Intento di problema — "come verifico le condizioni di un telefono usato prima di comprarlo?"

Evita prompt che nominano solo il tuo brand. "Relovie è buono?" ti nominerà ogni volta e non insegna nulla: gonfia il tuo mention rate e nasconde se appari quando il cliente non ti conosce già.

30-50 prompt sono un portafoglio funzionante. Sotto i 20 i numeri giornalieri diventano troppo rumorosi da leggere.`,
      },
      {
        id: 'prompt-generator',
        title: "Generare prompt con l'AI",
        content: `Configurazione → Prompt → "Generate (AI)" espande nome del brand, preset di settore e località opzionale in 20-30 prompt concreti.

Lavora su preset di settore con template localizzati per bucket di intento, riempiendo combinatoriamente i placeholder — brand, competitor, categoria, ruolo, località, anno. L'output è un portafoglio di partenza, non finito: leggilo, cancella ciò che non corrisponde a come parlano i tuoi clienti, e aggiungi le domande che solo tu sai che fanno.

Lo stesso motore gira dentro il wizard Inizia Qui, quindi i prompt creati là e qui sono identici per natura.`,
      },
    ],
  },

  {
    id: 'monitor',
    group: '2 · Monitoraggio',
    icon: 'monitor',
    sections: [
      {
        id: 'how-monitoring-works',
        title: 'Come funziona il monitoraggio',
        content: `Ogni prompt viene inviato a ogni motore selezionato come domanda nuova, senza memoria delle esecuzioni precedenti e senza alcun indizio che si stia misurando un brand. La risposta viene poi analizzata per quattro cose: se sei stato nominato, in che punto della risposta, con che tono, e quali fonti sono state citate.

I risultati finiscono in due livelli, e sapere quale legge un grafico spiega quasi tutte le contraddizioni apparenti:

• Risposte grezze — una riga per prompt per motore per esecuzione, con il testo completo. È ciò che leggono gli export CSV.
• Snapshot giornalieri — una riga aggregata per motore, categoria e lingua al giorno. È ciò che legge ogni grafico trend.

Poiché i due livelli aggregano diversamente, un CSV esportato e un trend a schermo sullo stesso periodo possono divergere leggermente. È il confine di aggregazione, non un errore di uno dei due.

I motori non sono deterministici. Lo stesso prompt può restituire una risposta diversa un'ora dopo: per questo una singola esecuzione è evidenza debole e un periodo è evidenza forte.`,
      },
      {
        id: 'supported-engines',
        title: 'Motori supportati',
        content: `Vengono monitorati tre motori, e si comportano in modo abbastanza diverso perché i numeri per motore contino più della media.

• ChatGPT — di norma il mention rate più alto. Premia confronti strutturati, liste e schemi decisionali.
• Perplexity — di norma la posizione di menzione più precoce, perché è costruito attorno al citare fonti nel corpo della risposta. Premia contenuti densi di fatti con link nel testo.
• Gemini — di norma il mention rate più basso, e il più sensibile ai segnali di autorevolezza: chi ha scritto, quando, ed è marcato in modo leggibile dalle macchine.
Claude è stato ritirato per costo: pesava il 65% della spesa provider per il 10% delle esecuzioni, e su un brand da 427 risultati ne ha prodotti 4 utilizzabili. Le misurazioni storiche restano nel database e negli export grezzi, ma non viene più chiamato e non appare più nelle scomposizioni per motore né nei report al cliente.

Se un motore resta molto indietro mentre gli altri sono sani, la causa è di solito strutturale e non un problema di visibilità in generale. Un gap su Gemini in particolare indica autore, date e schema markup mancanti — vedi Ottimizza → Site Audit.`,
      },
      {
        id: 'schedules',
        title: 'Cosa gira, e quando',
        content: `Il monitoraggio gira automaticamente tre volte al giorno; il resto del lavoro in background ha una propria pianificazione. Tutti gli orari sono UTC.

• Monitoraggio — 06:00, 12:00 e 18:00, ogni giorno.
• Consegna report — ogni 6 ore, inviando le schedulazioni scadute.
• Sincronizzazione GSC — 03:00 ogni giorno.
• Sincronizzazione dati esterni — 04:00 ogni giorno.
• Bridge AEO snippet — 07:00 ogni giorno.
• Review settimanale — lunedì 07:00.
• Email digest — lunedì 08:00.
• Refresh parole chiave — lunedì 06:00.
• Analisi GEO — lunedì 05:00.

Un primo passaggio completo si conclude di norma entro 24 ore dalla creazione di un brand. Puoi sempre lanciare un'esecuzione manuale da Monitoraggio → Monitoraggio Live invece di aspettare.`,
      },
      {
        id: 'workflows',
        title: 'Workflow — il lavoro in background è girato?',
        content: `Workflow è il registro di esecuzione dei job in background. Quando un numero sembra vecchio, è questa la pagina che dice se il job che lo produce è girato, ha fallito, o non è mai partito.

Controllala prima di indagare sui dati: un pannello vuoto altrove nel prodotto è molto spesso un job che non è girato, non un brand senza nulla da riportare. I due casi sono identici in ogni punto tranne qui.`,
      },
      {
        id: 'alerts',
        title: 'Avvisi e webhook',
        content: `Le regole di avviso ti notificano quando qualcosa si muove senza che tu stia guardando. Trigger tipici sono un calo di visibilità, un competitor che ti supera, un problema di accuratezza, o una citazione che scompare.

La consegna è via email o webhook. I destinatari vivono con la regola stessa, non nelle Impostazioni — è cambiato, e le Impostazioni non hanno più un campo email per gli avvisi.

Un webhook riceve un payload JSON che identifica il brand, la regola scattata, il valore osservato rispetto alla soglia, e un timestamp. Puntalo su ciò che già usi per le notifiche operative.

Gli avvisi dicono che qualcosa è cambiato. Non dicono perché: per quello ci sono le superfici di Analisi.`,
      },
    ],
  },

  {
    id: 'insights',
    group: '3 · Analisi',
    icon: 'insights',
    sections: [
      {
        id: 'geo-score',
        title: 'GEO Score e i suoi cinque pilastri',
        content: `Un composito 0-100 con voto in lettera, che misura quanto sei costruito per essere trovato e citato dai motori generativi. È una media pesata di cinque pilastri:

• Citazioni — 30%. I motori linkano il tuo dominio come fonte, non solo il tuo nome? Quasi sempre il pilastro più debole e sempre quello con più leva.
• Presenza — 25%. Quanto spesso vieni nominato.
• Autorevolezza — 20%. Quanto spesso vieni attivamente raccomandato invece che elencato.
• Posizione — 15%. Quanto presto appari nella risposta.
• Fiducia — 10%. Il sentiment, riscalato su 0-100.

Leggi il voto come punto di partenza, non come sentenza. Una D con un AVI sano significa che i risultati sono avanti alla struttura — e i due pilastri più deboli, Citazioni e Posizione, sono esattamente i due che rispondono più rapidamente al lavoro sul sito.

I pilastri hanno bisogno di dati di monitoraggio. Un brand senza esecuzioni non restituisce punteggio e mostra uno stato vuoto esplicativo invece di uno zero.`,
      },
      {
        id: 'citations-rate',
        title: 'Citazioni — il tasso nel tempo',
        content: `Il citation rate è la quota di risposte che ti nominano, in grafico nel tempo come trend su tutti i motori più la scomposizione per motore, con i tassi dei competitor sullo stesso asse.

Questa pagina risponde a quanto spesso. Fonti Citazioni risponde a da chi. Leggono campi diversi e non coincideranno.

I due pannelli di AI-readiness in questa pagina — accesso crawler e citation capture — sono qui di proposito: un citation rate vicino a zero è quasi sempre un problema di accesso crawler, e la risposta va accanto al sintomo.

I tassi dei competitor coprono solo i competitor che hai configurato. Un rivale che i motori nominano ma che non hai elencato non appare affatto qui.`,
      },
      {
        id: 'citation-sources',
        title: 'Fonti Citazioni — quali domini vengono citati',
        content: `La lista ordinata dei domini che i motori citano rispondendo ai tuoi prompt, incluso il tuo.

Essere il dominio più citato del proprio mercato è una posizione forte, ed è compatibile con un pilastro Citazioni debole nel GEO Score: la classifica ti confronta con gli altri, il pilastro misura quanto spesso una citazione accompagna una menzione. Puoi guidare il confronto e allo stesso tempo non convertire in link la maggior parte delle menzioni.

Il mix delle fonti è già un risultato. Siti commerciali dominanti significa che i motori attingono da dove avviene l'acquisto; forum e community presenti significa che l'opinione degli utenti sta modellando la tua descrizione; media di informazione assenti significa che la copertura stampa non arriva ai motori.`,
      },
      {
        id: 'sentiment',
        title: 'Sentiment, aspetti, fonti e temi',
        content: `Quattro viste di cosa dicono di te i motori.

• Sentiment medio — la ripartizione positivo / neutro / negativo del periodo.
• Aspetti — sentiment risolto per argomento (prezzo, servizio, qualità) invece che per risposta, così "buono in generale ma debole sul prezzo" resta visibile invece di essere annullato dalla media.
• Sentiment per fonte — la stessa ripartizione raggruppata per dominio citato dal motore. È ciò che mostra se un tono negativo risale a una singola pagina di terzi.
• Temi — cluster semantici del testo delle risposte, così le narrative ricorrenti emergono senza che nessuno legga centinaia di risposte.

C'è anche un analizzatore manuale: incolli un testo qualsiasi e ottieni la stessa classificazione. È volutamente stateless — niente viene salvato e nessun punteggio ne è influenzato.

Le etichette degli aspetti vengono dal modello e non da una lista fissa, quindi derivano su periodi lunghi e non sono affidabili come categorie permanenti di un grafico.`,
      },
      {
        id: 'brand-overview-gsc',
        title: 'Panoramica brand — il ponte con Search Console',
        content: `La vista di performance per singolo brand, e l'unico punto del prodotto che mostra i dati Google Search Console. È quindi il posto dove puoi chiedere se l'esposizione AI sta generando ricerca brandizzata o mangiando silenziosamente i tuoi click organici.

Due pannelli non esistono altrove:

• Striking distance — query posizionate appena sotto la soglia, dove una piccola correzione di contenuto si converte direttamente in traffico.
• Cannibalizzazione — più tuoi URL in competizione per una stessa query, che si dividono l'autorevolezza.

Entrambi richiedono una proprietà Search Console collegata. Senza, si presentano vuoti, e la causa è un'integrazione mancante e non una performance mancante.`,
      },
      {
        id: 'aeo-snippets',
        title: 'AEO Snippets',
        content: `Coppie domanda-risposta pronte, derivate da ciò che le persone chiedono davvero, formattate perché un motore possa riprenderle come risposta diretta.

Il punto è l'estraibilità. Un motore che cita la tua risposta testualmente è la citazione più forte che puoi ottenere, e dipende dal fatto che la risposta sia la prima cosa nel blocco, autosufficiente, e marcata in modo leggibile dalle macchine.

Gli snippet si esportano anche come schema markup per le tue pagine, alimentando il segnale di dati strutturati misurato nel Site Audit.`,
      },
      {
        id: 'keywords',
        title: 'Tracciamento parole chiave',
        content: `Le parole che ricorrono nelle risposte in cui vieni nominato, tracciate nel tempo e correlate alle menzioni.

Leggilo come vocabolario, non come una lista di keyword SEO. Ciò che il linguaggio dice è in quale conversazione sei: parole d'acquisto significano che stai emergendo nelle decisioni di acquisto, e parole di categoria che non corrispondono al tuo posizionamento significano che i motori ti hanno archiviato sotto la cosa sbagliata.

Nomi di competitor in alto nella lista è normale e utile: conferma con chi vieni davvero confrontato.`,
      },
      {
        id: 'competitor-sov',
        title: 'Competitor — share of voice e rivali scoperti',
        content: `Due misure su una pagina, e confonderle è il modo più facile di fraintendere il prodotto.

• Share of voice — su tutte le menzioni di brand nelle risposte, quale quota è tua. Questo è il peso.
• Tasso di co-menzione — in quale quota di risposte ogni competitor appare accanto a te. Questa è la copertura.

Un competitor può apparire in più risposte di te pur avendo una share of voice molto più bassa, perché tu vieni nominato più spesso e più presto nelle risposte in cui compari. Entrambi i numeri sono corretti: misurano cose diverse. La copertura è portata, il peso è prominenza.

Le entità scoperte sono brand che i motori nominano e che non sono nella tua configurazione. Quella lista è il modo in cui un set competitivo sbagliato viene trovato e corretto.

L'analisi competitor è l'unica azione a pagamento qui: chiama un modello e salva il risultato. La share of voice è calcolata su dati che hai già e non costa nulla.`,
      },
      {
        id: 'snapshots',
        title: 'Snapshot — il livello di aggregazione',
        content: `Gli snapshot trasformano le risposte grezze nella serie giornaliera che legge ogni grafico trend: una riga per motore, categoria e lingua al giorno, con il tuo citation rate e quello di ciascun competitor configurato per quella fetta.

Questo livello è portante. Se un trend sembra sbagliato, controlla qui prima di sospettare il grafico.

Ricalcolare un giorno è sicuro e ripetibile. Un giorno senza esecuzioni di monitoraggio non produce alcuna riga invece di una riga a zero — quindi un buco in un grafico significa nessun dato, non un calo a nulla.`,
      },
      {
        id: 'ai-funnel',
        title: 'AI Funnel — la narrativa pronta per il cliente',
        content: `La superficie da presentazione. Dove le altre pagine di Analisi possiedono una metrica ciascuna, questa le dispone in un imbuto percorribile dall'alto al basso in riunione.

• Alto — visibilità e share of voice: il numero che apre la conversazione.
• Medio — risposte AI reali, testuali, con il tuo brand evidenziato. È lo stadio che convince: le percentuali sono astratte, un motore che descrive la tua azienda con le sue parole no.
• Basso — crescita della ricerca brandizzata, verdetto AI-assist, e freschezza delle citazioni per le pagine che i motori davvero riprendono.

Tre export: un executive summary costruito su quattro domande (dove appariamo, quanto accuratamente veniamo descritti, stiamo vincendo o perdendo, gli obiettivi di business stanno migliorando), un deck cliente a livelli, e un trend a sei mesi.

Lo stadio basso richiede i dati Search Console. Senza, la parte più rilevante per il cliente si presenta vuota.`,
      },
      {
        id: 'reports',
        title: 'Report e consegna schedulata',
        content: `Due cose distinte in una pagina: esportare adesso e schedulare la consegna.

L'export immediato produce CSV, JSON o PDF per un brand e un intervallo di date opzionale. Il PDF porta il branding white-label — colore, logo e nome cliente — quindi può andare a un cliente senza modifiche.

La consegna schedulata invia un report ogni giorno, settimana o mese a un massimo di 20 destinatari. La schedulazione registra quando ha inviato l'ultima volta, quante volte, e l'ultimo errore, così una schedulazione che sta fallendo in silenzio è diagnosticabile dalla lista.

Due avvertenze. Nulla ti avvisa quando una schedulazione fallisce: l'errore è registrato, non annunciato. E gli export leggono le risposte grezze invece degli snapshot giornalieri, quindi un CSV esportato può divergere leggermente da un trend a schermo sullo stesso periodo.`,
      },
      {
        id: 'scan-history',
        title: 'Cronologia scansioni',
        content: `Il registro delle analisi singole lanciate da Audit Contenuti e Ottimizzatore Contenuti su un testo incollato o un URL. Non è la cronologia del monitoraggio programmato del brand: quella sta in Monitoraggio e nei trend degli snapshot.

Le voci portano un punteggio, la sorgente, se l'input era testo o URL, motore e modello usati, e un timestamp, con ricerca, filtri ed export CSV o JSON.

Due limiti da sapere: la lista tiene le 50 voci più recenti, e "svuota cronologia" svuota la vista senza cancellare nulla sul server — ricarica e le voci tornano.`,
      },
    ],
  },

  {
    id: 'optimize',
    group: '4 · Ottimizza',
    icon: 'optimize',
    sections: [
      {
        id: 'strategy-advisor',
        title: 'Consulente strategico',
        content: `Sintetizza tutto ciò che l'Analisi misura in una narrativa ordinata per priorità, ancorata ai dati live del tuo brand invece che a consigli generici.

Usalo quando vuoi l'argomentazione — perché questa azione prima di quella, e cosa dovrebbe muovere. Usa Raccomandazioni quando vuoi la lista persistente su cui lavorare.

Dove un'azione porta un guadagno di punti atteso, quella cifra è una stima del modello ancorata ai pesi del GEO Score. È solida per decidere l'ordine del lavoro. Non è una garanzia, e non va mai presentata a un cliente come tale.`,
      },
      {
        id: 'recommendations',
        title: 'Raccomandazioni',
        content: `La lista azioni persistente. Le raccomandazioni generate sono salvate con la finestra di dati da cui provengono, così puoi sempre vedere cosa è stato consigliato, quando, e su quale base.

Ciascuna porta una priorità alta, media o bassa, più una motivazione e azioni concrete. La priorità è assegnata dal modello, quindi due generazioni sugli stessi dati possono ordinare la stessa azione diversamente — trattala come indicazione e non come classifica stabile.

Generare di nuovo non sostituisce il set precedente: lo aggiunge alla storia. Nulla fonde o supera, quindi la lista cresce e le voci vecchie restano visibili come registro.

La review settimanale confronta ciò che è stato raccomandato con ciò che si è effettivamente mosso.`,
      },
      {
        id: 'content-audit',
        title: 'Audit Contenuti — un URL qualsiasi, due audit',
        content: `Un audit di prontezza completo su un singolo URL. Due audit indipendenti girano sullo stesso indirizzo: un'analisi di contenuto su quanto la pagina è citabile, e un audit tecnico deterministico.

L'audit tecnico controlla il trasporto (HTTPS, contenuto misto, dimensione della risposta, time to first byte), l'indicizzazione (title, meta description, robots, canonical, hreflang), i Core Web Vitals, e la citabilità AI.

Due di quei controlli esistono specificamente per i motori AI e non per la SEO classica: se le tabelle di confronto sono estraibili, perché i motori le riprendono testualmente, e se la pagina porta un segnale di ultimo aggiornamento, perché i motori penalizzano contenuti senza indicatore di freschezza.

I due audit producono punteggi separati e nulla li riconcilia, quindi puoi vedere un punteggio di contenuto alto accanto a uno tecnico basso. Correggi prima i fallimenti tecnici: sono quelli che bloccano tutto il resto.

I Core Web Vitals qui sono misurazioni di laboratorio da un singolo fetch. Non coincideranno con i dati di campo che un cliente cita da Search Console.`,
      },
      {
        id: 'content-optimizer',
        title: 'Ottimizzatore Contenuti e i cinque segnali di citazione',
        content: `Lo strumento di drill-down. Incolli un testo o punti a un URL, scegli provider, modello e motore target, e ottieni una scomposizione modificabile del perché il contenuto ottiene quel punteggio: classificazione dell'intento, scomposizione per motore, densità delle parole chiave, e suggerimenti espandibili.

La card Citation Quality è la parte importante, ed è deterministica — euristiche pure su HTML e testo, nessuna chiamata a modello, quindi lo stesso input dà sempre lo stesso punteggio. Misura cinque segnali con aumento di citazione osservato:

• Chiarezza e sintesi — +33%.
• Segnali E-E-A-T, cioè autore visibile, credenziali e date — +30%.
• Formato domanda-risposta — +25%.
• Struttura in sezioni — +23%.
• Dati strutturati — +22%.

Le euristiche secondarie di forma vengono dalla ricerca sui featured snippet: livello di lettura basso, densità di alt-text, liste di almeno 8 elementi, tabelle di almeno 5 righe e 7 colonne, almeno 10 link in uscita. La forma di contenuto che vince i featured snippet di Google vince anche le citazioni AI.

Nota che i due punteggi in questa pagina si comportano diversamente: l'analisi complessiva viene da un modello e varia fra esecuzioni sullo stesso input, mentre Citation Quality no. Se un numero cambia senza che tu abbia cambiato nulla, era quello basato sul modello.

Le percentuali sono correlazioni di uno studio ampio, non promesse causali per una singola pagina. Usale per dare priorità, non per garantire.`,
      },
      {
        id: 'site-audit',
        title: "Site Audit — il mio brand è pronto per l'AI?",
        content: `Il controllo di prontezza consolidato per un brand, in cinque pannelli ordinati per dipendenza. Correggi le voci rosse in alto prima di ottimizzare quelle sotto.

• Fondamenta — HTTPS, llms.txt, sitemap. Se questi falliscono, il resto non conta.
• Accesso crawler AI — il tuo robots.txt letto dal punto di vista di GPTBot, ClaudeBot, PerplexityBot, Google-Extended e gli altri. Bloccarli è l'unico errore che rende inutile ogni altro sforzo.
• Citation capture — se i tuoi dati di monitoraggio esistenti mostrano il dominio effettivamente citato.
• Topic Finder — i tuoi gap di citazione raggruppati in opportunità di contenuto ordinate.
• Citation Quality — la tua homepage valutata sui cinque segnali sopra.

L'ultimo pannello parte solo quando clicchi Score, perché scarica il sito live e lanciarlo a ogni visita colpirebbe il tuo server in silenzio.

Valuta specificamente la homepage. Se il contenuto citabile vive su sottopagine, analizzale singolarmente in Audit Contenuti.

Non c'è un singolo numero "AI-ready" qui: cinque pannelli, cinque verdetti. La cosa più vicina a un composito è il GEO Score, che legge input diversi e non coinciderà pannello per pannello.`,
      },
      {
        id: 'content-generator',
        title: 'Generatore Contenuti',
        content: `Redige articoli in Markdown costruiti sugli stessi cinque segnali di citazione che l'Ottimizzatore misura, poi valuta il proprio output con lo stesso scorer. Questo chiude il ciclo: la piattaforma misura cosa viene citato e genera contenuto modellato per esserlo, con un'unica definizione di qualità in entrambe le direzioni.

Scegli un bucket di intento e una lunghezza. Il contesto del brand è assemblato dal record del brand invece di essere riscritto.

Poiché valuta sé stesso con le euristiche per cui ha ottimizzato, un punteggio alto significa "modellato come lo scorer premia", non "verificato come citabile". Solo il monitoraggio può confermare il secondo, settimane dopo.

L'output è una bozza. Non c'è verifica dei fatti né imposizione di voce del brand oltre al prompt: modifica prima di pubblicare.

La generazione è limitata a 5 al minuto per utente: generosa per una persona, volutamente ostile a un loop.`,
      },
      {
        id: 'engine-info',
        title: 'Info Motori — stato dei provider',
        content: `La bacheca di stato dei provider AI. Risponde alla domanda che blocca tutto il resto quando qualcosa va storto: il monitoraggio sta fallendo per i nostri dati o perché una chiave provider è morta?

La disponibilità è riportata in quattro stati invece di due, perché una chiave con saldo esaurito si autentica perfettamente e poi rifiuta ogni richiesta a pagamento:

• Configurata — la chiave è presente.
• Disponibile — si autentica e ha credito.
• Credito esaurito — si autentica ma il saldo è finito. Inutilizzabile.
• Credito sconosciuto — configurata e raggiungibile, ma nessuna chiamata a pagamento l'ha ancora confermata.

Credito sconosciuto è lo stato onesto per una chiave appena aggiunta. La piattaforma non dichiara funzionante una chiave prima che una chiamata reale lo dimostri.

Nonostante il nome della route, questa pagina non è il monitoraggio. Non esegue prompt e non tocca i tuoi dati.`,
      },
    ],
  },

  {
    id: 'account',
    group: '5 · Account',
    icon: 'account',
    sections: [
      {
        id: 'settings',
        title: 'Impostazioni',
        content: `Quattro card: il tuo profilo, le tue chiavi API dei provider AI, le preferenze di notifica, e la lingua dell'interfaccia — English, Italiano o Svenska.

Le chiavi provider sono cifrate a riposo con AES-256-GCM e mostrate sempre mascherate. Una volta salvata, una chiave non può essere riletta, solo sostituita. Le chiavi possono essere disabilitate senza essere eliminate, che è ciò che serve quando un provider si comporta male: spegnila, tieni la riga, riattivala dopo senza reincollare il segreto.

Nulla valida una chiave al salvataggio. Un errore di battitura emerge dopo come provider non disponibile in Info Motori, o come esecuzioni che ricadono sul provider successivo.

La lingua dell'interfaccia è separata dalla lingua di mercato di un brand. Cambiarla qui non cambia in quale lingua vengono poste le tue domande.`,
      },
      {
        id: 'roles-sharing',
        title: 'Ruoli e brand condivisi',
        content: `I dati del brand sono condivisi per brand, e l'accesso ha tre livelli: viewer, editor e owner, in ordine crescente di permesso.

I viewer leggono. Gli editor modificano la configurazione e lanciano azioni che spendono denaro o inviano dati all'esterno — generare un articolo, creare una schedulazione di report. Gli owner inoltre possiedono il record del brand.

La regola da interiorizzare: i dati di un brand appartengono al brand, non a chi ha creato una riga. Un editor che scrive e un viewer che legge guardano gli stessi dati, e il registro di chi ha creato qualcosa è provenienza, non permesso.

Le azioni con effetto verso l'esterno o a pagamento sono vincolate al livello editor proprio perché costano denaro o inviano dati del brand a terzi.`,
      },
    ],
  },

  {
    id: 'not-enabled',
    group: 'Non attivo qui',
    icon: 'disabled',
    sections: [
      {
        id: 'commercial-layer',
        title: 'Fatturazione, Crediti e Costi API',
        content: `Questo deployment gira in modalità unlimited. L'intero livello commerciale è volutamente disattivato:

• Ogni query è permessa a costo zero e non consuma saldo.
• Il ledger dei crediti è disabilitato.
• Il checkout Stripe non è collegato.

Le tre pagine esistono ancora e ognuna spiega il proprio stato, così un bookmark vecchio rende qualcosa di sensato invece di un checkout rotto. Nessuna appare nella navigazione.

Nulla è stato rimosso: l'aggregazione dei costi funziona ancora dietro le quinte e la spesa dei provider resta visibile nei log operativi. Riattivare il livello è una modifica di configurazione, non una riscrittura.

Se ti serve il costo per funzionalità, l'archivio interno sotto docs/features dichiara il profilo di costo di ogni superficie. Senza un contatore esposto nel prodotto, quell'archivio è il modello di costo.`,
      },
    ],
  },

  {
    id: 'glossary',
    group: 'Glossario',
    icon: 'glossary',
    sections: [
      {
        id: 'glossary-terms',
        title: 'Termini e definizioni',
        content: `• AEO — Answer Engine Optimization. Strutturare il contenuto perché i motori possano estrarlo come risposta diretta.
• GEO — Generative Engine Optimization. La strategia più ampia per essere visibili nelle risposte generate: profondità, autorevolezza, dati strutturati, citazioni.
• AVI — AI Visibility Index. Composito 0-100; il numero di riferimento quotidiano.
• GEO Score — composito 0-100 con voto in lettera che misura quanto sei costruito per essere citato. L'AVI è il risultato, il GEO Score la capacità.
• Citation rate — quota di risposte monitorate che nominano il brand. Menzioni ÷ risposte totali × 100.
• Menzione — un motore che dice il tuo nome. Portata.
• Citazione — un motore che linka il tuo dominio come fonte. Fiducia.
• Posizione della menzione — la frase in cui appari per la prima volta. Più bassa è meglio.
• Share of voice — la tua quota di tutte le menzioni di brand. Peso.
• Tasso di co-menzione — la quota di risposte in cui un competitor appare accanto a te. Copertura.
• Sentiment — tono verso il tuo brand, da -1.0 a +1.0.
• Aspetto — un argomento specifico dentro una risposta su cui il sentiment viene risolto, come prezzo o servizio.
• Allucinazione — un motore che afferma come fatto qualcosa di falso su di te: date sbagliate, prodotti inventati, premi fabbricati.
• Motore — una piattaforma AI: ChatGPT, Gemini o Perplexity.
• Prompt — una domanda che inviamo ai motori in rappresentanza di una domanda di un cliente.
• Snapshot — l'aggregato giornaliero dei risultati di monitoraggio. Ciò che legge ogni grafico trend.
• Alias — una grafia alternativa del tuo brand che il rilevamento deve conoscere.
• Entità scoperta — un brand che i motori nominano e che non hai configurato come competitor.
• Answer-first — scrivere in modo che la prima frase contenga la risposta, perché i motori saltano le introduzioni.
• E-E-A-T — i segnali visibili di chi sta dietro al contenuto e di quando è stato scritto.
• Schema / JSON-LD — marcatura leggibile dalle macchine che dice ai motori cosa contiene una pagina.
• llms.txt — un file che presenta il tuo brand direttamente ai motori AI.
• Striking distance — una query posizionata appena sotto la soglia di visibilità, dove una piccola correzione si converte in traffico.
• Cannibalizzazione — più tuoi URL in competizione per una query, che si dividono l'autorevolezza.
• Ruolo — viewer, editor o owner; cosa una persona può fare con un brand.`,
      },
    ],
  },
]
