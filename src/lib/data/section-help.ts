// PATH: src/lib/data/section-help.ts
//
// Localized "how to read this section" help content, rendered by
// <SectionHelp section="…"> as a collapsible panel. The goal: a colleague who
// doesn't know the metrics gets CONTEXT + an explanatory TABLE of every data
// point (what it means, how it's measured, how to read it) — in their language.
//
// Every section MUST exist in all three locales (en/it/sv) with the same number
// of metric rows — enforced by section-help.test.ts. Keep entries factual and
// tied to how each metric is actually computed in the app.

export type HelpLocale = 'en' | 'it' | 'sv'

export interface HelpMetric {
  /** Metric / data point name, as shown in the UI. */
  metric: string
  /** What it means in plain language. */
  meaning: string
  /** How it is computed from the underlying data. */
  howMeasured: string
  /** Typical range and how to read it (good vs. needs attention). */
  range: string
}

export interface HelpContent {
  /** One sentence: what this section is. */
  whatItIs: string
  /** Why it matters for the brand. */
  why: string
  /** What data feeds this view. */
  inputs: string
  /** What you get out and how to act on it. */
  outputs: string
  /** Per-metric clarification table. */
  metrics: HelpMetric[]
}

export type LocalizedHelp = Record<HelpLocale, HelpContent>

export const SECTION_HELP: Record<string, LocalizedHelp> = {
  'geo-score': {
    en: {
      whatItIs:
        'A 0–100 scorecard of how well your brand is optimized to be surfaced and cited by generative AI engines (ChatGPT, Gemini, Perplexity, Claude).',
      why: 'It turns dozens of monitoring signals into one diagnostic number with a letter grade, and tells you which lever moves it the most.',
      inputs:
        'The latest brand health row for the selected period: citation, mention and recommendation rates, average sentiment, average answer position, and hallucination rate.',
      outputs:
        'A composite score + grade (A–F), the five weighted pillars with their point contribution, and prioritized recommendations (biggest score upside first).',
      metrics: [
        {
          metric: 'Citation Rate (30%)',
          meaning: 'Share of AI answers that cite your domain as a source.',
          howMeasured:
            'Responses with ≥1 citation to your domain ÷ total responses, in the period.',
          range: '0–100%. The heaviest pillar — citations build both visibility and trust.',
        },
        {
          metric: 'Brand Presence (25%)',
          meaning: 'Share of answers that mention your brand at all.',
          howMeasured: 'Responses mentioning the brand ÷ total responses.',
          range: '0–100%. The foundation: if you are never named, nothing else helps.',
        },
        {
          metric: 'Recommendation Authority (20%)',
          meaning: 'Share of answers that actively recommend you.',
          howMeasured: 'Responses recommending the brand ÷ total responses.',
          range: '0–100%. Being recommended converts better than being merely mentioned.',
        },
        {
          metric: 'Answer Position (15%)',
          meaning: 'How early your brand appears inside the answer.',
          howMeasured:
            'Average mention rank, normalized (rank 1 → 100, rank 5+ → 0; never positioned → neutral 50).',
          range: '0–100. Higher = you appear sooner, where users actually read.',
        },
        {
          metric: 'Trust & Accuracy (10%)',
          meaning: 'Tone of mentions and absence of factual errors.',
          howMeasured:
            'Blend of average sentiment (−1..1 mapped to 0–100) and (100 − hallucination rate%).',
          range: '0–100. Negative tone or hallucinations cap every other pillar.',
        },
        {
          metric: 'GEO Score',
          meaning: 'The single composite number with a letter grade.',
          howMeasured:
            'Weighted sum of the present pillars; pillars with no data are excluded and the remaining weights re-normalized.',
          range: '0–100. A ≥85, B ≥70, C ≥55, D ≥40, F <40.',
        },
      ],
    },
    it: {
      whatItIs:
        'Una pagella 0–100 di quanto il tuo brand è ottimizzato per essere mostrato e citato dai motori AI generativi (ChatGPT, Gemini, Perplexity, Claude).',
      why: 'Trasforma decine di segnali di monitoraggio in un unico numero diagnostico con voto in lettere, e indica quale leva lo muove di più.',
      inputs:
        "L'ultima riga di salute del brand per il periodo selezionato: tassi di citazione, menzione e raccomandazione, sentiment medio, posizione media nella risposta e tasso di allucinazioni.",
      outputs:
        'Un punteggio composito + voto (A–F), i cinque pilastri pesati con il loro contributo in punti, e raccomandazioni prioritarie (prima quelle con più margine).',
      metrics: [
        {
          metric: 'Tasso di citazione (30%)',
          meaning: 'Quota di risposte AI che citano il tuo dominio come fonte.',
          howMeasured: 'Risposte con ≥1 citazione al tuo dominio ÷ risposte totali, nel periodo.',
          range: '0–100%. Il pilastro più pesante: le citazioni creano visibilità e fiducia.',
        },
        {
          metric: 'Presenza del brand (25%)',
          meaning: 'Quota di risposte che menzionano il brand.',
          howMeasured: 'Risposte che menzionano il brand ÷ risposte totali.',
          range: '0–100%. La base: se non vieni nominato, il resto non aiuta.',
        },
        {
          metric: 'Autorità di raccomandazione (20%)',
          meaning: 'Quota di risposte che ti raccomandano attivamente.',
          howMeasured: 'Risposte che raccomandano il brand ÷ risposte totali.',
          range: '0–100%. Essere raccomandati converte più che essere solo menzionati.',
        },
        {
          metric: 'Posizione nella risposta (15%)',
          meaning: 'Quanto presto appare il brand nella risposta.',
          howMeasured:
            'Rango medio di menzione, normalizzato (rango 1 → 100, rango 5+ → 0; mai posizionato → 50 neutro).',
          range: "0–100. Più alto = appari prima, dove l'utente legge davvero.",
        },
        {
          metric: 'Affidabilità e accuratezza (10%)',
          meaning: 'Tono delle menzioni e assenza di errori fattuali.',
          howMeasured:
            'Combinazione di sentiment medio (−1..1 mappato su 0–100) e (100 − % allucinazioni).',
          range: '0–100. Tono negativo o allucinazioni limitano ogni altro pilastro.',
        },
        {
          metric: 'GEO Score',
          meaning: 'Il numero composito unico con voto in lettere.',
          howMeasured:
            'Somma pesata dei pilastri presenti; i pilastri senza dati sono esclusi e i pesi rimanenti rinormalizzati.',
          range: '0–100. A ≥85, B ≥70, C ≥55, D ≥40, F <40.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Ett 0–100-betyg på hur väl ditt varumärke är optimerat för att synas och citeras av generativa AI-motorer (ChatGPT, Gemini, Perplexity, Claude).',
      why: 'Det omvandlar dussintals övervakningssignaler till ett enda diagnostiskt tal med bokstavsbetyg, och visar vilken spak som påverkar mest.',
      inputs:
        'Senaste raden med varumärkeshälsa för vald period: andel citeringar, omnämnanden och rekommendationer, snittsentiment, snittposition i svaret och andel hallucinationer.',
      outputs:
        'En sammansatt poäng + betyg (A–F), de fem viktade pelarna med sitt poängbidrag, och prioriterade rekommendationer (störst potential först).',
      metrics: [
        {
          metric: 'Citeringsgrad (30%)',
          meaning: 'Andel AI-svar som anger din domän som källa.',
          howMeasured: 'Svar med ≥1 citering till din domän ÷ totala svar, i perioden.',
          range: '0–100%. Den tyngsta pelaren — citeringar ger både synlighet och förtroende.',
        },
        {
          metric: 'Varumärkesnärvaro (25%)',
          meaning: 'Andel svar som överhuvudtaget nämner varumärket.',
          howMeasured: 'Svar som nämner varumärket ÷ totala svar.',
          range: '0–100%. Grunden: nämns du aldrig hjälper inget annat.',
        },
        {
          metric: 'Rekommendationsauktoritet (20%)',
          meaning: 'Andel svar som aktivt rekommenderar dig.',
          howMeasured: 'Svar som rekommenderar varumärket ÷ totala svar.',
          range: '0–100%. Att rekommenderas konverterar bättre än att bara nämnas.',
        },
        {
          metric: 'Position i svaret (15%)',
          meaning: 'Hur tidigt varumärket dyker upp i svaret.',
          howMeasured:
            'Genomsnittlig omnämnanderang, normaliserad (rang 1 → 100, rang 5+ → 0; aldrig placerad → neutral 50).',
          range: '0–100. Högre = du syns tidigare, där användaren faktiskt läser.',
        },
        {
          metric: 'Förtroende och korrekthet (10%)',
          meaning: 'Tonen i omnämnanden och frånvaro av faktafel.',
          howMeasured:
            'Blandning av snittsentiment (−1..1 mappat till 0–100) och (100 − hallucinationsandel%).',
          range: '0–100. Negativ ton eller hallucinationer begränsar alla andra pelare.',
        },
        {
          metric: 'GEO Score',
          meaning: 'Det enda sammansatta talet med bokstavsbetyg.',
          howMeasured:
            'Viktad summa av närvarande pelare; pelare utan data exkluderas och kvarvarande vikter normaliseras om.',
          range: '0–100. A ≥85, B ≥70, C ≥55, D ≥40, F <40.',
        },
      ],
    },
  },

  sentiment: {
    en: {
      whatItIs:
        'How AI engines feel about your brand when they mention it — overall tone, per-topic breakdown, recurring themes, and factual-accuracy flags.',
      why: 'Visibility without trust backfires: a brand that is mentioned but described negatively or inaccurately loses customers. This is the "quality" side of being cited.',
      inputs:
        'The sentiment label and score on each monitoring response that mentions your brand, plus aspect tags and hallucination flags.',
      outputs:
        'The sentiment mix (positive/neutral/negative), an average score, sentiment per aspect (ABSA), clustered themes, and a hallucination count to correct.',
      metrics: [
        {
          metric: 'Sentiment mix',
          meaning: 'How many mentions are positive, neutral, or negative.',
          howMeasured:
            'Each brand-mentioning response is classified by a trilingual sentiment model.',
          range: 'Counts. Aim to grow the positive share and shrink the negative over time.',
        },
        {
          metric: 'Average sentiment score',
          meaning: 'The overall tone expressed as one number.',
          howMeasured: 'Mean of per-response scores from −1 (very negative) to +1 (very positive).',
          range: '−1..+1. >0 healthy, near 0 mixed, <0 needs attention.',
        },
        {
          metric: 'Aspect breakdown (ABSA)',
          meaning: 'Tone split by topic — price, support, quality, etc.',
          howMeasured: 'Sentiment grouped by the aspect detected in each sentence.',
          range: 'Net = positive − negative per aspect; negative aspects are your fix-list.',
        },
        {
          metric: 'Themes',
          meaning: 'Recurring topics AI associates with your brand.',
          howMeasured: 'Response texts are embedded and clustered; each cluster is labeled.',
          range: 'Share % of mentions per theme; watch large negative-leaning themes.',
        },
        {
          metric: 'Hallucination count',
          meaning: 'Answers that state something factually wrong about you.',
          howMeasured: 'Responses flagged as containing inaccuracies about the brand.',
          range: 'Lower is better; each one is a correction opportunity (site/3rd-party facts).',
        },
      ],
    },
    it: {
      whatItIs:
        'Come i motori AI percepiscono il tuo brand quando lo menzionano — tono generale, dettaglio per argomento, temi ricorrenti e segnalazioni di accuratezza fattuale.',
      why: 'Visibilità senza fiducia è controproducente: un brand menzionato ma descritto in modo negativo o impreciso perde clienti. È il lato "qualità" dell\'essere citati.',
      inputs:
        "L'etichetta e il punteggio di sentiment su ogni risposta di monitoraggio che menziona il brand, più i tag di aspetto e i flag di allucinazione.",
      outputs:
        'Il mix di sentiment (positivo/neutro/negativo), un punteggio medio, il sentiment per aspetto (ABSA), i temi raggruppati e un conteggio di allucinazioni da correggere.',
      metrics: [
        {
          metric: 'Mix di sentiment',
          meaning: 'Quante menzioni sono positive, neutre o negative.',
          howMeasured:
            'Ogni risposta che menziona il brand è classificata da un modello trilingue.',
          range: 'Conteggi. Obiettivo: far crescere il positivo e ridurre il negativo nel tempo.',
        },
        {
          metric: 'Punteggio di sentiment medio',
          meaning: 'Il tono complessivo espresso in un numero.',
          howMeasured:
            'Media dei punteggi per risposta, da −1 (molto negativo) a +1 (molto positivo).',
          range: '−1..+1. >0 sano, vicino a 0 misto, <0 da attenzionare.',
        },
        {
          metric: 'Dettaglio per aspetto (ABSA)',
          meaning: 'Tono diviso per argomento — prezzo, assistenza, qualità, ecc.',
          howMeasured: "Sentiment raggruppato per l'aspetto rilevato in ogni frase.",
          range:
            'Netto = positivo − negativo per aspetto; gli aspetti negativi sono la lista interventi.',
        },
        {
          metric: 'Temi',
          meaning: "Argomenti ricorrenti che l'AI associa al tuo brand.",
          howMeasured:
            'I testi delle risposte vengono incorporati e raggruppati; ogni cluster è etichettato.',
          range:
            '% sul totale di menzioni per tema; attenzione ai grandi temi a tendenza negativa.',
        },
        {
          metric: 'Conteggio allucinazioni',
          meaning: 'Risposte che affermano qualcosa di fattualmente errato su di te.',
          howMeasured: 'Risposte segnalate come contenenti imprecisioni sul brand.',
          range:
            "Più basso è meglio; ognuna è un'occasione di correzione (fonti sito/terze parti).",
        },
      ],
    },
    sv: {
      whatItIs:
        'Hur AI-motorer uppfattar ditt varumärke när de nämner det — övergripande ton, uppdelning per ämne, återkommande teman och flaggor för faktakorrekthet.',
      why: 'Synlighet utan förtroende slår tillbaka: ett varumärke som nämns men beskrivs negativt eller felaktigt tappar kunder. Det är "kvalitetssidan" av att bli citerad.',
      inputs:
        'Sentimentetiketten och poängen på varje övervakningssvar som nämner varumärket, plus aspekttaggar och hallucinationsflaggor.',
      outputs:
        'Sentimentmixen (positiv/neutral/negativ), en snittpoäng, sentiment per aspekt (ABSA), grupperade teman och ett hallucinationsantal att korrigera.',
      metrics: [
        {
          metric: 'Sentimentmix',
          meaning: 'Hur många omnämnanden som är positiva, neutrala eller negativa.',
          howMeasured: 'Varje svar som nämner varumärket klassificeras av en trespråkig modell.',
          range: 'Antal. Mål: öka den positiva andelen och minska den negativa över tid.',
        },
        {
          metric: 'Genomsnittlig sentimentpoäng',
          meaning: 'Den övergripande tonen uttryckt som ett tal.',
          howMeasured:
            'Medel av poäng per svar, från −1 (mycket negativ) till +1 (mycket positiv).',
          range: '−1..+1. >0 sunt, nära 0 blandat, <0 kräver åtgärd.',
        },
        {
          metric: 'Aspektuppdelning (ABSA)',
          meaning: 'Ton uppdelad per ämne — pris, support, kvalitet osv.',
          howMeasured: 'Sentiment grupperat efter aspekten som upptäckts i varje mening.',
          range: 'Netto = positivt − negativt per aspekt; negativa aspekter är din åtgärdslista.',
        },
        {
          metric: 'Teman',
          meaning: 'Återkommande ämnen som AI förknippar med ditt varumärke.',
          howMeasured: 'Svarstexter bäddas in och grupperas; varje kluster får en etikett.',
          range: 'Andel % av omnämnanden per tema; håll koll på stora teman med negativ lutning.',
        },
        {
          metric: 'Hallucinationsantal',
          meaning: 'Svar som påstår något faktiskt felaktigt om dig.',
          howMeasured: 'Svar som flaggats för att innehålla felaktigheter om varumärket.',
          range: 'Lägre är bättre; varje är en chans till korrigering (fakta på sajt/tredje part).',
        },
      ],
    },
  },

  monitoring: {
    en: {
      whatItIs:
        'The live engine — it sends each of your prompts to all four AI engines, captures the answers, and extracts whether you are mentioned, where, with what tone, and which sources are cited.',
      why: 'This is the raw signal everything else is built on. Every score, trend and recommendation traces back to these monitoring runs.',
      inputs:
        'Your active prompts and the engines you have enabled (ChatGPT, Gemini, Perplexity, Claude). Each run consumes credits.',
      outputs:
        'One result per prompt × engine: brand mentioned (yes/no), position in the answer, a visibility score, sentiment, cited sources, and any detected hallucinations.',
      metrics: [
        {
          metric: 'Scan / result',
          meaning: 'One AI answer to one prompt on one engine.',
          howMeasured: 'A prompt is sent to an engine; its full response is stored and analyzed.',
          range: 'More scans = more reliable rates (aim for ≥30 in the period).',
        },
        {
          metric: 'Brand mentioned',
          meaning: 'Whether the answer names your brand.',
          howMeasured: 'Whole-word match of the brand name + aliases in the response text.',
          range: 'Yes/No per result; the % across results is your mention rate.',
        },
        {
          metric: 'Position',
          meaning: 'Where your brand appears in the answer.',
          howMeasured: 'Sentence index of the first mention (1 = opening, higher = later).',
          range: 'Lower is better — early mentions get read.',
        },
        {
          metric: 'Visibility score',
          meaning: 'How prominently you feature in the answer.',
          howMeasured: 'Combines mention, position and prominence into 0–100 per result.',
          range: '0–100. <60 = weak presence on that engine.',
        },
        {
          metric: 'Citations',
          meaning: 'Sources the engine linked, and whether yours is among them.',
          howMeasured: 'URLs extracted from the response; your domain flagged when present.',
          range: 'Count per answer; your-domain citations feed the GEO Citation pillar.',
        },
        {
          metric: 'Hallucination',
          meaning: 'A factual error about your brand in the answer.',
          howMeasured: 'Response checked for claims that contradict known brand facts.',
          range: 'Flag per result; investigate and correct the underlying source.',
        },
      ],
    },
    it: {
      whatItIs:
        'Il motore live — invia ognuno dei tuoi prompt a tutti e quattro i motori AI, cattura le risposte ed estrae se sei menzionato, dove, con che tono e quali fonti vengono citate.',
      why: 'È il segnale grezzo su cui si basa tutto il resto. Ogni punteggio, trend e raccomandazione deriva da queste esecuzioni di monitoraggio.',
      inputs:
        'I tuoi prompt attivi e i motori abilitati (ChatGPT, Gemini, Perplexity, Claude). Ogni esecuzione consuma crediti.',
      outputs:
        'Un risultato per prompt × motore: brand menzionato (sì/no), posizione nella risposta, un punteggio di visibilità, sentiment, fonti citate ed eventuali allucinazioni.',
      metrics: [
        {
          metric: 'Scansione / risultato',
          meaning: 'Una risposta AI a un prompt su un motore.',
          howMeasured:
            'Un prompt viene inviato a un motore; la risposta completa è salvata e analizzata.',
          range: 'Più scansioni = tassi più affidabili (obiettivo ≥30 nel periodo).',
        },
        {
          metric: 'Brand menzionato',
          meaning: 'Se la risposta nomina il tuo brand.',
          howMeasured: 'Match a parola intera del nome brand + alias nel testo della risposta.',
          range: 'Sì/No per risultato; la % sui risultati è il tasso di menzione.',
        },
        {
          metric: 'Posizione',
          meaning: 'Dove appare il brand nella risposta.',
          howMeasured:
            'Indice della frase della prima menzione (1 = apertura, più alto = più tardi).',
          range: 'Più basso è meglio — le menzioni iniziali vengono lette.',
        },
        {
          metric: 'Punteggio di visibilità',
          meaning: 'Quanto risalti nella risposta.',
          howMeasured: 'Combina menzione, posizione e prominenza in 0–100 per risultato.',
          range: '0–100. <60 = presenza debole su quel motore.',
        },
        {
          metric: 'Citazioni',
          meaning: 'Le fonti collegate dal motore, e se la tua è tra esse.',
          howMeasured: 'URL estratti dalla risposta; il tuo dominio segnalato se presente.',
          range:
            'Conteggio per risposta; le citazioni al tuo dominio alimentano il pilastro Citazioni del GEO.',
        },
        {
          metric: 'Allucinazione',
          meaning: 'Un errore fattuale sul tuo brand nella risposta.',
          howMeasured:
            'La risposta è controllata per affermazioni che contraddicono fatti noti del brand.',
          range: 'Flag per risultato; indaga e correggi la fonte sottostante.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Den levande motorn — den skickar var och en av dina prompts till alla fyra AI-motorerna, fångar svaren och extraherar om du nämns, var, med vilken ton och vilka källor som citeras.',
      why: 'Det är den råa signalen som allt annat bygger på. Varje poäng, trend och rekommendation härleds från dessa övervakningskörningar.',
      inputs:
        'Dina aktiva prompts och de motorer du aktiverat (ChatGPT, Gemini, Perplexity, Claude). Varje körning förbrukar krediter.',
      outputs:
        'Ett resultat per prompt × motor: varumärke nämnt (ja/nej), position i svaret, en synlighetspoäng, sentiment, citerade källor och eventuella hallucinationer.',
      metrics: [
        {
          metric: 'Skanning / resultat',
          meaning: 'Ett AI-svar på en prompt på en motor.',
          howMeasured: 'En prompt skickas till en motor; hela svaret sparas och analyseras.',
          range: 'Fler skanningar = pålitligare andelar (mål ≥30 i perioden).',
        },
        {
          metric: 'Varumärke nämnt',
          meaning: 'Om svaret nämner ditt varumärke.',
          howMeasured: 'Helordsmatchning av varumärkesnamn + alias i svarstexten.',
          range: 'Ja/Nej per resultat; andelen över resultat är din omnämnandegrad.',
        },
        {
          metric: 'Position',
          meaning: 'Var varumärket dyker upp i svaret.',
          howMeasured: 'Meningsindex för första omnämnandet (1 = inledning, högre = senare).',
          range: 'Lägre är bättre — tidiga omnämnanden läses.',
        },
        {
          metric: 'Synlighetspoäng',
          meaning: 'Hur framträdande du är i svaret.',
          howMeasured: 'Kombinerar omnämnande, position och framträdande till 0–100 per resultat.',
          range: '0–100. <60 = svag närvaro på den motorn.',
        },
        {
          metric: 'Citeringar',
          meaning: 'Källor motorn länkade, och om din finns med.',
          howMeasured: 'URL:er extraheras ur svaret; din domän flaggas när den finns.',
          range: 'Antal per svar; citeringar till din domän matar GEO:s citeringspelare.',
        },
        {
          metric: 'Hallucination',
          meaning: 'Ett faktafel om ditt varumärke i svaret.',
          howMeasured: 'Svaret kontrolleras för påståenden som motsäger kända varumärkesfakta.',
          range: 'Flagga per resultat; undersök och korrigera källan.',
        },
      ],
    },
  },

  citations: {
    en: {
      whatItIs:
        'Which sources the AI engines cite when they answer about your space — and how often your own domain is among them, over time.',
      why: 'Citations are the single strongest GEO signal: an engine that links your domain treats you as a trusted source. This shows whether that is growing and who you compete with for citations.',
      inputs:
        'The cited URLs extracted from every monitoring response, grouped by domain and date.',
      outputs:
        'Your citation count and share, the top cited domains in your space, and the trend line over the selected period.',
      metrics: [
        {
          metric: 'Citation count',
          meaning: 'How many times a domain is cited as a source.',
          howMeasured: 'Citations extracted from AI responses, counted per domain in the period.',
          range: "Higher = more authoritative in the engines' eyes.",
        },
        {
          metric: 'Your citation share',
          meaning: 'Your slice of all citations in your space.',
          howMeasured: 'Your-domain citations ÷ total citations across tracked answers.',
          range: '0–100%. The number to grow — it drives the GEO Citation pillar.',
        },
        {
          metric: 'Top cited domains',
          meaning: 'The sources engines trust most in your category.',
          howMeasured: 'Domains ranked by citation count across your monitoring responses.',
          range: 'Your earn-citations target list (e.g. Wikipedia, Reddit, trade press).',
        },
        {
          metric: 'Trend',
          meaning: 'Whether your citations are rising or falling.',
          howMeasured: 'Citation count / share plotted by date over the period.',
          range: 'Up = your content is being adopted as a source; down = investigate.',
        },
      ],
    },
    it: {
      whatItIs:
        'Quali fonti citano i motori AI quando rispondono sul tuo settore — e quanto spesso il tuo dominio è tra esse, nel tempo.',
      why: 'Le citazioni sono il segnale GEO più forte: un motore che collega il tuo dominio ti tratta come fonte affidabile. Mostra se sta crescendo e con chi competi per le citazioni.',
      inputs:
        'Gli URL citati estratti da ogni risposta di monitoraggio, raggruppati per dominio e data.',
      outputs:
        'Il tuo conteggio e quota di citazioni, i domini più citati nel tuo settore e la linea di tendenza nel periodo selezionato.',
      metrics: [
        {
          metric: 'Conteggio citazioni',
          meaning: 'Quante volte un dominio è citato come fonte.',
          howMeasured: 'Citazioni estratte dalle risposte AI, contate per dominio nel periodo.',
          range: 'Più alto = più autorevole agli occhi dei motori.',
        },
        {
          metric: 'La tua quota di citazioni',
          meaning: 'La tua fetta di tutte le citazioni del settore.',
          howMeasured: 'Citazioni al tuo dominio ÷ citazioni totali nelle risposte tracciate.',
          range: '0–100%. Il numero da far crescere — guida il pilastro Citazioni del GEO.',
        },
        {
          metric: 'Domini più citati',
          meaning: 'Le fonti di cui i motori si fidano di più nella tua categoria.',
          howMeasured: 'Domini ordinati per numero di citazioni nelle tue risposte.',
          range: 'La tua lista di obiettivi (es. Wikipedia, Reddit, stampa di settore).',
        },
        {
          metric: 'Tendenza',
          meaning: 'Se le tue citazioni salgono o scendono.',
          howMeasured: 'Conteggio/quota di citazioni tracciati per data nel periodo.',
          range: 'Su = i tuoi contenuti vengono adottati come fonte; giù = indaga.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Vilka källor AI-motorerna citerar när de svarar om ditt område — och hur ofta din egen domän finns med, över tid.',
      why: 'Citeringar är den starkaste GEO-signalen: en motor som länkar din domän behandlar dig som en pålitlig källa. Det här visar om det växer och vilka du konkurrerar med om citeringar.',
      inputs:
        'De citerade URL:erna som extraherats ur varje övervakningssvar, grupperade per domän och datum.',
      outputs:
        'Ditt citeringsantal och andel, de mest citerade domänerna i ditt område och trendlinjen över vald period.',
      metrics: [
        {
          metric: 'Citeringsantal',
          meaning: 'Hur många gånger en domän citeras som källa.',
          howMeasured: 'Citeringar extraherade ur AI-svar, räknade per domän i perioden.',
          range: 'Högre = mer auktoritativ i motorernas ögon.',
        },
        {
          metric: 'Din citeringsandel',
          meaning: 'Din andel av alla citeringar i ditt område.',
          howMeasured: 'Citeringar till din domän ÷ totala citeringar i spårade svar.',
          range: '0–100%. Talet att öka — det driver GEO:s citeringspelare.',
        },
        {
          metric: 'Mest citerade domäner',
          meaning: 'Källorna motorerna litar mest på i din kategori.',
          howMeasured: 'Domäner rangordnade efter citeringsantal i dina svar.',
          range: 'Din lista att förtjäna citeringar på (t.ex. Wikipedia, Reddit, fackpress).',
        },
        {
          metric: 'Trend',
          meaning: 'Om dina citeringar ökar eller minskar.',
          howMeasured: 'Citeringsantal/andel plottat per datum över perioden.',
          range: 'Upp = ditt innehåll antas som källa; ner = undersök.',
        },
      ],
    },
  },

  analytics: {
    en: {
      whatItIs:
        'The AI Visibility Index (AVI) — one 0–100 headline number for how visible your brand is across all AI engines, with its trend and the components behind it.',
      why: 'AVI is the at-a-glance pulse you track week to week. Its diagnostic twin is the GEO Score, which breaks the same idea into weighted pillars + fixes — use AVI to watch, GEO Score to act.',
      inputs:
        'The brand health rows over the period: citation, mention and recommendation rates, sentiment, answer position, and hallucination rate, per engine.',
      outputs:
        'The current AVI, its change vs. the previous period, the component breakdown, the trend line, and per-engine visibility.',
      metrics: [
        {
          metric: 'AVI',
          meaning: 'Single 0–100 AI-visibility number.',
          howMeasured:
            'Weighted blend of citation, mention, recommendation, sentiment, position and (low) hallucination.',
          range: '0–100. Higher = more visible; track the direction more than the absolute.',
        },
        {
          metric: 'Delta (Δ)',
          meaning: 'Change since the previous period.',
          howMeasured: 'Current AVI − AVI ~7 days earlier.',
          range: 'Positive = improving, negative = slipping.',
        },
        {
          metric: 'Components',
          meaning: 'The sub-signals that build AVI.',
          howMeasured: 'Each signal normalized to 0–100 and shown separately.',
          range: 'Spot which component lifts or drags the headline number.',
        },
        {
          metric: 'Trend',
          meaning: 'AVI over time.',
          howMeasured: 'AVI plotted by date across the period.',
          range: 'A rising line is the goal; sudden drops warrant a look.',
        },
        {
          metric: 'Per-engine visibility',
          meaning: 'How visible you are on each engine.',
          howMeasured: 'AVI (or its components) computed per engine.',
          range: '0–100 each; a low engine is where to focus.',
        },
      ],
    },
    it: {
      whatItIs:
        "L'AI Visibility Index (AVI) — un unico numero 0–100 di quanto il tuo brand è visibile su tutti i motori AI, con il trend e le componenti che lo determinano.",
      why: "L'AVI è il polso a colpo d'occhio da seguire settimana per settimana. Il suo gemello diagnostico è il GEO Score, che scompone la stessa idea in pilastri pesati + azioni — usa l'AVI per osservare, il GEO Score per agire.",
      inputs:
        'Le righe di salute del brand nel periodo: tassi di citazione, menzione e raccomandazione, sentiment, posizione nella risposta e tasso di allucinazioni, per motore.',
      outputs:
        "L'AVI attuale, la sua variazione rispetto al periodo precedente, il dettaglio delle componenti, la linea di tendenza e la visibilità per motore.",
      metrics: [
        {
          metric: 'AVI',
          meaning: 'Numero unico 0–100 di visibilità AI.',
          howMeasured:
            'Combinazione pesata di citazione, menzione, raccomandazione, sentiment, posizione e (bassa) allucinazione.',
          range: '0–100. Più alto = più visibile; conta più la direzione del valore assoluto.',
        },
        {
          metric: 'Delta (Δ)',
          meaning: 'Variazione rispetto al periodo precedente.',
          howMeasured: 'AVI attuale − AVI di ~7 giorni fa.',
          range: 'Positivo = in miglioramento, negativo = in calo.',
        },
        {
          metric: 'Componenti',
          meaning: "I sotto-segnali che costruiscono l'AVI.",
          howMeasured: 'Ogni segnale normalizzato a 0–100 e mostrato a parte.',
          range: 'Individua quale componente alza o abbassa il numero.',
        },
        {
          metric: 'Tendenza',
          meaning: 'AVI nel tempo.',
          howMeasured: 'AVI tracciato per data nel periodo.',
          range: "Una linea in salita è l'obiettivo; i cali improvvisi vanno indagati.",
        },
        {
          metric: 'Visibilità per motore',
          meaning: 'Quanto sei visibile su ogni motore.',
          howMeasured: 'AVI (o le sue componenti) calcolato per motore.',
          range: '0–100 ciascuno; un motore basso è dove concentrarsi.',
        },
      ],
    },
    sv: {
      whatItIs:
        'AI Visibility Index (AVI) — ett enda 0–100-tal för hur synligt ditt varumärke är över alla AI-motorer, med trend och de komponenter som ligger bakom.',
      why: 'AVI är pulsen du följer vecka för vecka. Dess diagnostiska tvilling är GEO Score, som delar upp samma idé i viktade pelare + åtgärder — använd AVI för att bevaka, GEO Score för att agera.',
      inputs:
        'Raderna med varumärkeshälsa över perioden: andel citeringar, omnämnanden och rekommendationer, sentiment, position i svaret och hallucinationsandel, per motor.',
      outputs:
        'Aktuellt AVI, förändringen mot föregående period, komponentuppdelningen, trendlinjen och synlighet per motor.',
      metrics: [
        {
          metric: 'AVI',
          meaning: 'Ett enda 0–100-tal för AI-synlighet.',
          howMeasured:
            'Viktad blandning av citering, omnämnande, rekommendation, sentiment, position och (låg) hallucination.',
          range: '0–100. Högre = mer synlig; riktningen betyder mer än det absoluta talet.',
        },
        {
          metric: 'Delta (Δ)',
          meaning: 'Förändring sedan föregående period.',
          howMeasured: 'Aktuellt AVI − AVI för ~7 dagar sedan.',
          range: 'Positivt = förbättras, negativt = försämras.',
        },
        {
          metric: 'Komponenter',
          meaning: 'Delsignalerna som bygger AVI.',
          howMeasured: 'Varje signal normaliseras till 0–100 och visas separat.',
          range: 'Se vilken komponent som lyfter eller drar ner talet.',
        },
        {
          metric: 'Trend',
          meaning: 'AVI över tid.',
          howMeasured: 'AVI plottat per datum över perioden.',
          range: 'En stigande linje är målet; plötsliga fall bör granskas.',
        },
        {
          metric: 'Synlighet per motor',
          meaning: 'Hur synlig du är på varje motor.',
          howMeasured: 'AVI (eller dess komponenter) beräknat per motor.',
          range: '0–100 vardera; en låg motor är där du bör fokusera.',
        },
      ],
    },
  },

  recommendations: {
    en: {
      whatItIs:
        'AI-generated, prioritized actions to improve your visibility — each tied to a specific weakness in your monitoring data — plus an automatic weekly review digest.',
      why: 'It turns raw monitoring signals into a concrete to-do list, so you act on what the data shows instead of guessing.',
      inputs:
        'Your recent monitoring results, tracked keywords, competitor mentions and GEO research context, sent to the resilient LLM chain (Groq → … → OpenAI).',
      outputs:
        'Up to 8 ranked recommendations (title, priority, impact, target engines, rationale, category) and a weekly digest of what changed.',
      metrics: [
        {
          metric: 'Recommendation',
          meaning: 'A concrete action to lift visibility.',
          howMeasured:
            'The model analyzes your data + gaps and proposes a fix tied to a data point.',
          range: 'Each one cites the weakness it addresses.',
        },
        {
          metric: 'Priority',
          meaning: 'How urgent the action is.',
          howMeasured: 'Set high/medium/low by the severity of the weakness.',
          range: 'Work the high-priority items first.',
        },
        {
          metric: 'Impact',
          meaning: 'Expected effect on AI visibility.',
          howMeasured: "The model's estimate of the upside.",
          range: 'High = moves the needle most.',
        },
        {
          metric: 'Target engines',
          meaning: 'Which engines the action is for.',
          howMeasured: 'The engines showing that specific weakness.',
          range: 'Focus effort where it counts.',
        },
        {
          metric: 'Weekly review',
          meaning: 'Automatic digest of the week.',
          howMeasured: "Deterministic summary of the period's monitoring changes (no LLM).",
          range: 'Read weekly to catch shifts early.',
        },
      ],
    },
    it: {
      whatItIs:
        "Azioni prioritarie generate dall'AI per migliorare la tua visibilità — ognuna legata a una debolezza specifica nei dati di monitoraggio — più un digest settimanale automatico.",
      why: 'Trasforma i segnali grezzi di monitoraggio in una lista di cose da fare concreta, così agisci su ciò che i dati mostrano invece di andare a intuito.',
      inputs:
        'I tuoi risultati di monitoraggio recenti, le keyword tracciate, le menzioni dei competitor e il contesto di ricerca GEO, inviati alla catena LLM resiliente (Groq → … → OpenAI).',
      outputs:
        'Fino a 8 raccomandazioni ordinate (titolo, priorità, impatto, motori target, motivazione, categoria) e un digest settimanale di ciò che è cambiato.',
      metrics: [
        {
          metric: 'Raccomandazione',
          meaning: "Un'azione concreta per aumentare la visibilità.",
          howMeasured:
            'Il modello analizza i tuoi dati + lacune e propone un intervento legato a un dato.',
          range: 'Ognuna cita la debolezza che affronta.',
        },
        {
          metric: 'Priorità',
          meaning: "Quanto è urgente l'azione.",
          howMeasured: 'Impostata alta/media/bassa in base alla gravità della debolezza.',
          range: 'Parti dalle voci ad alta priorità.',
        },
        {
          metric: 'Impatto',
          meaning: 'Effetto atteso sulla visibilità AI.',
          howMeasured: 'La stima del modello sul beneficio.',
          range: "Alto = muove di più l'ago.",
        },
        {
          metric: 'Motori target',
          meaning: "Per quali motori è l'azione.",
          howMeasured: 'I motori che mostrano quella debolezza specifica.',
          range: "Concentra l'impegno dove conta.",
        },
        {
          metric: 'Weekly review',
          meaning: 'Digest automatico della settimana.',
          howMeasured:
            'Riassunto deterministico delle variazioni di monitoraggio del periodo (niente LLM).',
          range: 'Leggilo settimanalmente per cogliere i cambiamenti.',
        },
      ],
    },
    sv: {
      whatItIs:
        'AI-genererade, prioriterade åtgärder för att förbättra din synlighet — var och en kopplad till en specifik svaghet i dina övervakningsdata — plus ett automatiskt veckosammandrag.',
      why: 'Det omvandlar råa övervakningssignaler till en konkret att-göra-lista, så du agerar på det datan visar istället för att gissa.',
      inputs:
        'Dina senaste övervakningsresultat, spårade nyckelord, konkurrentomnämnanden och GEO-forskningskontext, skickat till den resilienta LLM-kedjan (Groq → … → OpenAI).',
      outputs:
        'Upp till 8 rangordnade rekommendationer (titel, prioritet, effekt, målmotorer, motivering, kategori) och ett veckosammandrag av vad som ändrats.',
      metrics: [
        {
          metric: 'Rekommendation',
          meaning: 'En konkret åtgärd för att lyfta synligheten.',
          howMeasured:
            'Modellen analyserar dina data + luckor och föreslår en åtgärd kopplad till en datapunkt.',
          range: 'Var och en anger svagheten den åtgärdar.',
        },
        {
          metric: 'Prioritet',
          meaning: 'Hur brådskande åtgärden är.',
          howMeasured: 'Sätts hög/medel/låg efter svaghetens allvar.',
          range: 'Börja med de högprioriterade.',
        },
        {
          metric: 'Effekt',
          meaning: 'Förväntad påverkan på AI-synlighet.',
          howMeasured: 'Modellens uppskattning av nyttan.',
          range: 'Hög = påverkar mest.',
        },
        {
          metric: 'Målmotorer',
          meaning: 'Vilka motorer åtgärden gäller.',
          howMeasured: 'Motorerna som visar just den svagheten.',
          range: 'Fokusera insatsen där det räknas.',
        },
        {
          metric: 'Veckogenomgång',
          meaning: 'Automatiskt veckosammandrag.',
          howMeasured:
            'Deterministisk sammanfattning av periodens övervakningsförändringar (ingen LLM).',
          range: 'Läs veckovis för att fånga skiften tidigt.',
        },
      ],
    },
  },

  competitor: {
    en: {
      whatItIs:
        'How you stack up against rivals inside AI answers — your share of the conversation, your rank, and which competitors the engines name alongside or instead of you.',
      why: "AI answers are zero-sum: if a rival is recommended for your category, that's your lost customer. This shows where you win and where to fight.",
      inputs:
        'Your brand mentions and the competitor mentions extracted from the same monitoring responses over the period.',
      outputs:
        'Share of Voice, your market position/rank, per-competitor mention counts, head-to-head wins/losses, and rivals to add to your set.',
      metrics: [
        {
          metric: 'Share of Voice',
          meaning: 'Your % of all brand mentions in your space.',
          howMeasured: "Your mentions ÷ (your + tracked competitors' mentions).",
          range: '0–100%. Higher = you own more of the conversation.',
        },
        {
          metric: 'Market position',
          meaning: 'Your rank within the tracked set.',
          howMeasured: 'Brands ordered by mentions / visibility.',
          range: '#1 is best; closing the gap to #1 is the goal.',
        },
        {
          metric: 'Competitor mentions',
          meaning: 'How often each rival appears.',
          howMeasured: 'Counted in the AI responses to your prompts.',
          range: 'Who the engines currently favor.',
        },
        {
          metric: 'Head-to-head',
          meaning: 'Queries where you beat or lose to a rival.',
          howMeasured: 'Compared on prompts where both appear.',
          range: 'Losses are your highest-leverage targets.',
        },
        {
          metric: 'Untracked rivals',
          meaning: "Competitors AI names that you don't track.",
          howMeasured: 'Mentioned brands not in your competitor set.',
          range: 'Add the recurring ones to benchmark them.',
        },
      ],
    },
    it: {
      whatItIs:
        'Come ti posizioni rispetto ai rivali nelle risposte AI — la tua quota di conversazione, il tuo rango e quali competitor i motori nominano insieme o al posto tuo.',
      why: 'Le risposte AI sono a somma zero: se un rivale viene raccomandato per la tua categoria, è un cliente perso. Questo mostra dove vinci e dove combattere.',
      inputs:
        'Le tue menzioni e le menzioni dei competitor estratte dalle stesse risposte di monitoraggio nel periodo.',
      outputs:
        'Share of Voice, la tua posizione/rango di mercato, i conteggi di menzioni per competitor, gli scontri diretti vinti/persi e i rivali da aggiungere al set.',
      metrics: [
        {
          metric: 'Share of Voice',
          meaning: 'La tua % su tutte le menzioni di brand del settore.',
          howMeasured: 'Le tue menzioni ÷ (tue + menzioni dei competitor tracciati).',
          range: '0–100%. Più alto = domini di più la conversazione.',
        },
        {
          metric: 'Posizione di mercato',
          meaning: 'Il tuo rango nel set tracciato.',
          howMeasured: 'Brand ordinati per menzioni / visibilità.',
          range: "#1 è il migliore; ridurre il gap con #1 è l'obiettivo.",
        },
        {
          metric: 'Menzioni competitor',
          meaning: 'Quanto spesso appare ogni rivale.',
          howMeasured: 'Contate nelle risposte AI ai tuoi prompt.',
          range: 'Chi i motori favoriscono ora.',
        },
        {
          metric: 'Scontro diretto',
          meaning: 'Query in cui batti o perdi contro un rivale.',
          howMeasured: 'Confronto sui prompt dove entrambi appaiono.',
          range: 'Le sconfitte sono gli obiettivi a maggior leva.',
        },
        {
          metric: 'Rivali non tracciati',
          meaning: "Competitor che l'AI nomina ma che non tracci.",
          howMeasured: 'Brand menzionati non presenti nel tuo set.',
          range: 'Aggiungi quelli ricorrenti per confrontarli.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Hur du står dig mot rivaler i AI-svar — din andel av konversationen, din placering och vilka konkurrenter motorerna nämner bredvid eller istället för dig.',
      why: 'AI-svar är nollsummespel: rekommenderas en rival för din kategori är det en förlorad kund. Det här visar var du vinner och var du ska kämpa.',
      inputs:
        'Dina omnämnanden och konkurrenternas omnämnanden som extraherats ur samma övervakningssvar under perioden.',
      outputs:
        'Share of Voice, din marknadsposition/placering, antal omnämnanden per konkurrent, head-to-head vinster/förluster och rivaler att lägga till.',
      metrics: [
        {
          metric: 'Share of Voice',
          meaning: 'Din % av alla varumärkesomnämnanden i ditt område.',
          howMeasured: 'Dina omnämnanden ÷ (dina + spårade konkurrenters omnämnanden).',
          range: '0–100%. Högre = du äger mer av konversationen.',
        },
        {
          metric: 'Marknadsposition',
          meaning: 'Din placering i den spårade gruppen.',
          howMeasured: 'Varumärken ordnade efter omnämnanden / synlighet.',
          range: '#1 är bäst; att minska gapet till #1 är målet.',
        },
        {
          metric: 'Konkurrentomnämnanden',
          meaning: 'Hur ofta varje rival dyker upp.',
          howMeasured: 'Räknade i AI-svaren på dina prompts.',
          range: 'Vem motorerna favoriserar nu.',
        },
        {
          metric: 'Head-to-head',
          meaning: 'Frågor där du slår eller förlorar mot en rival.',
          howMeasured: 'Jämfört på prompts där båda förekommer.',
          range: 'Förluster är dina mest hävstångsstarka mål.',
        },
        {
          metric: 'Ospårade rivaler',
          meaning: 'Konkurrenter AI nämner men du inte spårar.',
          howMeasured: 'Nämnda varumärken som inte finns i din grupp.',
          range: 'Lägg till de återkommande för att jämföra.',
        },
      ],
    },
  },

  keywords: {
    en: {
      whatItIs:
        'The search terms and topics that correlate with your brand being mentioned by AI — which queries surface you, and how strongly.',
      why: 'Knowing which terms "own" your mentions tells you what content to double down on and which high-value terms you are missing.',
      inputs:
        'Keywords extracted from your monitoring responses and prompts, with how often each co-occurs with your brand.',
      outputs:
        'Tracked keywords with mention counts, a correlation score, a trend, and gap keywords competitors own.',
      metrics: [
        {
          metric: 'Keyword',
          meaning: 'A tracked term / topic for your brand.',
          howMeasured: 'Extracted from AI responses + your prompt set.',
          range: 'The queries that tend to surface you.',
        },
        {
          metric: 'Mention count',
          meaning: 'How often the term co-occurs with your brand.',
          howMeasured: 'Counted across monitoring responses in the period.',
          range: 'A volume signal; needs ≥3 to be stable.',
        },
        {
          metric: 'Correlation',
          meaning: 'How strongly the term predicts your mention.',
          howMeasured: 'Statistical correlation between the term and your appearance.',
          range: '0–100%. High = you effectively own that term.',
        },
        {
          metric: 'Trend',
          meaning: 'Keyword performance over time.',
          howMeasured: 'Count / correlation plotted by date.',
          range: 'Rising = a growing topic for you.',
        },
        {
          metric: 'Gap keywords',
          meaning: "High-value terms where you're absent.",
          howMeasured: "Terms competitors get mentioned for but you don't.",
          range: 'Your content-expansion shortlist.',
        },
      ],
    },
    it: {
      whatItIs:
        "I termini di ricerca e gli argomenti che correlano con la menzione del tuo brand da parte dell'AI — quali query ti fanno emergere, e con quanta forza.",
      why: 'Sapere quali termini "possiedono" le tue menzioni ti dice su quali contenuti puntare e quali termini di valore ti mancano.',
      inputs:
        'Le keyword estratte dalle risposte di monitoraggio e dai tuoi prompt, con quanto spesso ciascuna co-occorre con il tuo brand.',
      outputs:
        'Keyword tracciate con conteggio menzioni, punteggio di correlazione, tendenza e keyword-gap che i competitor possiedono.',
      metrics: [
        {
          metric: 'Keyword',
          meaning: 'Un termine / argomento tracciato per il tuo brand.',
          howMeasured: 'Estratto dalle risposte AI + dal tuo set di prompt.',
          range: 'Le query che tendono a farti emergere.',
        },
        {
          metric: 'Conteggio menzioni',
          meaning: 'Quanto spesso il termine co-occorre col brand.',
          howMeasured: 'Contato nelle risposte di monitoraggio del periodo.',
          range: 'Segnale di volume; servono ≥3 per essere stabile.',
        },
        {
          metric: 'Correlazione',
          meaning: 'Quanto il termine predice la tua menzione.',
          howMeasured: 'Correlazione statistica tra il termine e la tua comparsa.',
          range: '0–100%. Alta = possiedi di fatto quel termine.',
        },
        {
          metric: 'Tendenza',
          meaning: 'Performance della keyword nel tempo.',
          howMeasured: 'Conteggio / correlazione tracciati per data.',
          range: 'In salita = argomento in crescita per te.',
        },
        {
          metric: 'Keyword-gap',
          meaning: 'Termini di valore in cui sei assente.',
          howMeasured: 'Termini per cui i competitor sono menzionati e tu no.',
          range: 'La tua shortlist di espansione contenuti.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Söktermerna och ämnena som korrelerar med att ditt varumärke nämns av AI — vilka frågor som lyfter fram dig, och hur starkt.',
      why: 'Att veta vilka termer som "äger" dina omnämnanden visar vilket innehåll du ska satsa på och vilka värdefulla termer du saknar.',
      inputs:
        'Nyckelord extraherade ur dina övervakningssvar och prompts, med hur ofta var och en samförekommer med ditt varumärke.',
      outputs:
        'Spårade nyckelord med omnämnandeantal, en korrelationspoäng, en trend, och gap-nyckelord som konkurrenter äger.',
      metrics: [
        {
          metric: 'Nyckelord',
          meaning: 'En spårad term / ämne för ditt varumärke.',
          howMeasured: 'Extraherat ur AI-svar + din promptuppsättning.',
          range: 'Frågorna som tenderar att lyfta fram dig.',
        },
        {
          metric: 'Omnämnandeantal',
          meaning: 'Hur ofta termen samförekommer med varumärket.',
          howMeasured: 'Räknat över övervakningssvaren i perioden.',
          range: 'En volymsignal; behöver ≥3 för att vara stabil.',
        },
        {
          metric: 'Korrelation',
          meaning: 'Hur starkt termen förutsäger ditt omnämnande.',
          howMeasured: 'Statistisk korrelation mellan termen och din förekomst.',
          range: '0–100%. Hög = du äger i praktiken den termen.',
        },
        {
          metric: 'Trend',
          meaning: 'Nyckelordets utveckling över tid.',
          howMeasured: 'Antal / korrelation plottat per datum.',
          range: 'Stigande = ett växande ämne för dig.',
        },
        {
          metric: 'Gap-nyckelord',
          meaning: 'Värdefulla termer där du saknas.',
          howMeasured: 'Termer konkurrenter nämns för men inte du.',
          range: 'Din kortlista för innehållsexpansion.',
        },
      ],
    },
  },

  overview: {
    en: {
      whatItIs:
        "Your brand's home screen — a one-glance summary of AI visibility: headline AVI, recent activity, top engines, and quick links into every detailed view.",
      why: "It's the daily starting point: see at a glance whether things are healthy and where to drill in.",
      inputs: 'The latest brand health metrics and recent monitoring activity, summarized.',
      outputs:
        'Headline AVI + grade, the key rates, recent results, and shortcuts to the detailed sections.',
      metrics: [
        {
          metric: 'Headline AVI',
          meaning: 'The single visibility number for the brand.',
          howMeasured: 'Latest AI Visibility Index (see Analytics).',
          range: '0–100; the daily pulse.',
        },
        {
          metric: 'Key rates',
          meaning: 'Citation, mention and sentiment at a glance.',
          howMeasured: 'From the latest brand health row.',
          range: 'Quick health check; drill into each section for detail.',
        },
        {
          metric: 'Recent activity',
          meaning: 'What the engines said lately.',
          howMeasured: 'The most recent monitoring results.',
          range: 'Spot new mentions or issues fast.',
        },
        {
          metric: 'Quick links',
          meaning: 'Jump to the detailed views.',
          howMeasured: 'Shortcuts to GEO Score, Sentiment, Competitor, etc.',
          range: 'Use these to investigate anything that looks off.',
        },
      ],
    },
    it: {
      whatItIs:
        "La home del tuo brand — un riepilogo a colpo d'occhio della visibilità AI: AVI in evidenza, attività recente, motori migliori e link rapidi a ogni vista di dettaglio.",
      why: "È il punto di partenza quotidiano: vedi a colpo d'occhio se tutto è in salute e dove approfondire.",
      inputs:
        "Gli ultimi metric di salute del brand e l'attività di monitoraggio recente, riassunti.",
      outputs:
        'AVI in evidenza + voto, i tassi chiave, i risultati recenti e le scorciatoie alle sezioni di dettaglio.',
      metrics: [
        {
          metric: 'AVI in evidenza',
          meaning: 'Il numero unico di visibilità del brand.',
          howMeasured: 'Ultimo AI Visibility Index (vedi Analytics).',
          range: '0–100; il polso quotidiano.',
        },
        {
          metric: 'Tassi chiave',
          meaning: "Citazione, menzione e sentiment a colpo d'occhio.",
          howMeasured: "Dall'ultima riga di salute del brand.",
          range: 'Check rapido; approfondisci in ogni sezione.',
        },
        {
          metric: 'Attività recente',
          meaning: 'Cosa hanno detto i motori di recente.',
          howMeasured: 'I risultati di monitoraggio più recenti.',
          range: 'Individua velocemente nuove menzioni o problemi.',
        },
        {
          metric: 'Link rapidi',
          meaning: 'Vai alle viste di dettaglio.',
          howMeasured: 'Scorciatoie a GEO Score, Sentiment, Competitor, ecc.',
          range: 'Usali per indagare ciò che sembra anomalo.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Ditt varumärkes startsida — en sammanfattning av AI-synligheten på ett ögonkast: AVI i fokus, senaste aktivitet, toppmotorer och snabblänkar till varje detaljvy.',
      why: 'Det är den dagliga startpunkten: se på ett ögonkast om allt är friskt och var du ska gräva djupare.',
      inputs: 'De senaste hälsomåtten och den senaste övervakningsaktiviteten, sammanfattade.',
      outputs:
        'AVI i fokus + betyg, nyckeltalen, de senaste resultaten och genvägar till detaljsektionerna.',
      metrics: [
        {
          metric: 'AVI i fokus',
          meaning: 'Varumärkets enda synlighetstal.',
          howMeasured: 'Senaste AI Visibility Index (se Analytics).',
          range: '0–100; den dagliga pulsen.',
        },
        {
          metric: 'Nyckeltal',
          meaning: 'Citering, omnämnande och sentiment på ett ögonkast.',
          howMeasured: 'Från den senaste hälsoraden.',
          range: 'Snabb hälsokoll; gräv djupare i varje sektion.',
        },
        {
          metric: 'Senaste aktivitet',
          meaning: 'Vad motorerna sagt nyligen.',
          howMeasured: 'De senaste övervakningsresultaten.',
          range: 'Upptäck nya omnämnanden eller problem snabbt.',
        },
        {
          metric: 'Snabblänkar',
          meaning: 'Hoppa till detaljvyerna.',
          howMeasured: 'Genvägar till GEO Score, Sentiment, Competitor, osv.',
          range: 'Använd dem för att undersöka något som ser fel ut.',
        },
      ],
    },
  },

  'citation-sources': {
    en: {
      whatItIs:
        'The catalog of sources the AI engines actually cite when answering about your space — ranked by how often each domain appears.',
      why: 'These are the sites the engines trust. Earning a mention or link on the top ones is the most direct way to raise your own citation rate.',
      inputs: 'Every URL cited across your monitoring responses, grouped and counted by domain.',
      outputs:
        'A ranked list of cited domains with counts, source type (e.g. Wikipedia, Reddit, news, competitor), and whether your domain appears.',
      metrics: [
        {
          metric: 'Source domain',
          meaning: 'A site the engines cite in your space.',
          howMeasured: 'Extracted from citation URLs in monitoring responses.',
          range: 'The trust set you want to be part of.',
        },
        {
          metric: 'Citation count',
          meaning: 'How often that domain is cited.',
          howMeasured: 'Occurrences across the period.',
          range: 'Higher = more influential source.',
        },
        {
          metric: 'Source type',
          meaning: 'What kind of site it is.',
          howMeasured: 'Classified (encyclopedia, community, news, brand, etc.).',
          range: 'Wikipedia & Reddit dominate ChatGPT/Perplexity citations.',
        },
        {
          metric: 'Your domain present',
          meaning: 'Whether you are among the cited sources.',
          howMeasured: 'Your domain matched in the citation set.',
          range: 'Yes is the goal; No = an earn-citations opportunity.',
        },
      ],
    },
    it: {
      whatItIs:
        'Il catalogo delle fonti che i motori AI citano realmente quando rispondono sul tuo settore — ordinate per quanto spesso ogni dominio appare.',
      why: 'Sono i siti di cui i motori si fidano. Ottenere una menzione o un link sui principali è il modo più diretto per alzare il tuo tasso di citazione.',
      inputs:
        'Ogni URL citato nelle tue risposte di monitoraggio, raggruppato e contato per dominio.',
      outputs:
        'Una lista ordinata di domini citati con conteggi, tipo di fonte (es. Wikipedia, Reddit, news, competitor) e se il tuo dominio appare.',
      metrics: [
        {
          metric: 'Dominio fonte',
          meaning: 'Un sito che i motori citano nel tuo settore.',
          howMeasured: 'Estratto dagli URL di citazione nelle risposte.',
          range: 'Il set di fiducia di cui vuoi far parte.',
        },
        {
          metric: 'Conteggio citazioni',
          meaning: 'Quanto spesso quel dominio è citato.',
          howMeasured: 'Occorrenze nel periodo.',
          range: 'Più alto = fonte più influente.',
        },
        {
          metric: 'Tipo fonte',
          meaning: 'Che tipo di sito è.',
          howMeasured: 'Classificato (enciclopedia, community, news, brand, ecc.).',
          range: 'Wikipedia e Reddit dominano le citazioni di ChatGPT/Perplexity.',
        },
        {
          metric: 'Tuo dominio presente',
          meaning: 'Se sei tra le fonti citate.',
          howMeasured: 'Il tuo dominio trovato nel set di citazioni.',
          range: "Sì è l'obiettivo; No = occasione per guadagnare citazioni.",
        },
      ],
    },
    sv: {
      whatItIs:
        'Katalogen över källor som AI-motorerna faktiskt citerar när de svarar om ditt område — rangordnade efter hur ofta varje domän förekommer.',
      why: 'Det är sajterna motorerna litar på. Att förtjäna ett omnämnande eller en länk på de främsta är det mest direkta sättet att höja din egen citeringsgrad.',
      inputs: 'Varje citerad URL i dina övervakningssvar, grupperad och räknad per domän.',
      outputs:
        'En rangordnad lista över citerade domäner med antal, källtyp (t.ex. Wikipedia, Reddit, nyheter, konkurrent) och om din domän förekommer.',
      metrics: [
        {
          metric: 'Källdomän',
          meaning: 'En sajt motorerna citerar i ditt område.',
          howMeasured: 'Extraherad ur citerings-URL:er i svaren.',
          range: 'Förtroendegruppen du vill tillhöra.',
        },
        {
          metric: 'Citeringsantal',
          meaning: 'Hur ofta den domänen citeras.',
          howMeasured: 'Förekomster under perioden.',
          range: 'Högre = mer inflytelserik källa.',
        },
        {
          metric: 'Källtyp',
          meaning: 'Vilken typ av sajt det är.',
          howMeasured: 'Klassificerad (uppslagsverk, community, nyheter, varumärke, osv.).',
          range: 'Wikipedia och Reddit dominerar ChatGPT/Perplexity-citeringar.',
        },
        {
          metric: 'Din domän med',
          meaning: 'Om du är bland de citerade källorna.',
          howMeasured: 'Din domän matchad i citeringsuppsättningen.',
          range: 'Ja är målet; Nej = chans att förtjäna citeringar.',
        },
      ],
    },
  },

  optimizer: {
    en: {
      whatItIs:
        'A content analyzer: paste text or a URL and it scores how ready that content is to be surfaced and cited by AI engines, with concrete fixes.',
      why: 'It lets you improve a page BEFORE publishing, instead of waiting for monitoring to show it underperforming.',
      inputs:
        'The text or URL you submit (and optional brand context). The content is sent to the LLM analyzer.',
      outputs:
        'A visibility score, per-engine breakdown, ranked suggestions, keyword ideas, and detected intent / tone / reading level.',
      metrics: [
        {
          metric: 'Visibility score',
          meaning: 'How AEO-ready the content is.',
          howMeasured: 'The LLM scores the content for citation / answer readiness.',
          range: '0–100. <60 = needs structural work.',
        },
        {
          metric: 'Per-engine breakdown',
          meaning: 'Readiness for each engine.',
          howMeasured: 'Score + status (optimal / needs-work / critical) per engine.',
          range: 'Shows which engine your content suits.',
        },
        {
          metric: 'Suggestions',
          meaning: 'Concrete edits to improve it.',
          howMeasured: 'LLM-generated, ordered by leverage.',
          range: 'Apply the top suggestions first.',
        },
        {
          metric: 'Keywords',
          meaning: 'Terms to target, with impact / difficulty.',
          howMeasured: 'Extracted / estimated by the model.',
          range: 'High impact + low difficulty = quick wins.',
        },
        {
          metric: 'Intent / tone / reading level',
          meaning: 'How the content reads.',
          howMeasured: 'Classified by the model.',
          range: 'Match these to your target audience.',
        },
      ],
    },
    it: {
      whatItIs:
        'Un analizzatore di contenuti: incolla testo o un URL e valuta quanto quel contenuto è pronto per essere mostrato e citato dai motori AI, con correzioni concrete.',
      why: 'Ti permette di migliorare una pagina PRIMA di pubblicarla, invece di aspettare che il monitoraggio la mostri poco performante.',
      inputs:
        "Il testo o l'URL che invii (e contesto brand opzionale). Il contenuto è inviato all'analizzatore LLM.",
      outputs:
        'Un punteggio di visibilità, dettaglio per motore, suggerimenti ordinati, idee keyword e intento / tono / livello di lettura rilevati.',
      metrics: [
        {
          metric: 'Punteggio di visibilità',
          meaning: "Quanto il contenuto è pronto per l'AEO.",
          howMeasured: "L'LLM valuta il contenuto per la prontezza a citazione / risposta.",
          range: '0–100. <60 = serve lavoro strutturale.',
        },
        {
          metric: 'Dettaglio per motore',
          meaning: 'Prontezza per ogni motore.',
          howMeasured: 'Punteggio + stato (ottimale / da-migliorare / critico) per motore.',
          range: 'Mostra a quale motore si adatta il contenuto.',
        },
        {
          metric: 'Suggerimenti',
          meaning: 'Modifiche concrete per migliorarlo.',
          howMeasured: "Generati dall'LLM, ordinati per leva.",
          range: 'Applica prima i principali.',
        },
        {
          metric: 'Keyword',
          meaning: 'Termini da targetizzare, con impatto / difficoltà.',
          howMeasured: 'Estratti / stimati dal modello.',
          range: 'Alto impatto + bassa difficoltà = vittorie rapide.',
        },
        {
          metric: 'Intento / tono / livello',
          meaning: 'Come si legge il contenuto.',
          howMeasured: 'Classificato dal modello.',
          range: 'Allineali al tuo pubblico target.',
        },
      ],
    },
    sv: {
      whatItIs:
        'En innehållsanalysator: klistra in text eller en URL och den bedömer hur redo innehållet är att synas och citeras av AI-motorer, med konkreta åtgärder.',
      why: 'Den låter dig förbättra en sida INNAN publicering, istället för att vänta på att övervakningen visar att den underpresterar.',
      inputs:
        'Texten eller URL:en du skickar (och valfri varumärkeskontext). Innehållet skickas till LLM-analysatorn.',
      outputs:
        'En synlighetspoäng, uppdelning per motor, rangordnade förslag, nyckelordsidéer och upptäckt avsikt / ton / läsnivå.',
      metrics: [
        {
          metric: 'Synlighetspoäng',
          meaning: 'Hur AEO-redo innehållet är.',
          howMeasured: 'LLM bedömer innehållet för citerings- / svarsberedskap.',
          range: '0–100. <60 = behöver strukturellt arbete.',
        },
        {
          metric: 'Uppdelning per motor',
          meaning: 'Beredskap för varje motor.',
          howMeasured: 'Poäng + status (optimal / behöver-arbete / kritisk) per motor.',
          range: 'Visar vilken motor ditt innehåll passar.',
        },
        {
          metric: 'Förslag',
          meaning: 'Konkreta ändringar för att förbättra det.',
          howMeasured: 'LLM-genererade, ordnade efter hävstång.',
          range: 'Tillämpa de översta först.',
        },
        {
          metric: 'Nyckelord',
          meaning: 'Termer att rikta in sig på, med effekt / svårighet.',
          howMeasured: 'Extraherade / uppskattade av modellen.',
          range: 'Hög effekt + låg svårighet = snabba vinster.',
        },
        {
          metric: 'Avsikt / ton / läsnivå',
          meaning: 'Hur innehållet läses.',
          howMeasured: 'Klassificerat av modellen.',
          range: 'Matcha dessa mot din målgrupp.',
        },
      ],
    },
  },

  snapshots: {
    en: {
      whatItIs:
        'Saved point-in-time captures of your brand\'s key metrics, so you can compare "then vs. now" and prove progress.',
      why: 'Monitoring is continuous; snapshots freeze a moment (e.g. before/after a campaign) so you can measure the delta cleanly.',
      inputs:
        'The current brand health + visibility metrics at the moment you (or a schedule) take the snapshot.',
      outputs: 'A dated record per snapshot, and a side-by-side comparison of any two.',
      metrics: [
        {
          metric: 'Snapshot',
          meaning: 'A frozen set of metrics at a date.',
          howMeasured: 'Captured on demand or on schedule.',
          range: 'Take one before/after any big change.',
        },
        {
          metric: 'Captured metrics',
          meaning: 'What each snapshot stores.',
          howMeasured: 'AVI, citation/mention/sentiment rates, position, etc.',
          range: 'Same fields as the live dashboard.',
        },
        {
          metric: 'Delta',
          meaning: 'Change between two snapshots.',
          howMeasured: 'Later snapshot − earlier snapshot, per metric.',
          range: 'Positive = progress; the number you report.',
        },
        {
          metric: 'Date',
          meaning: 'When the snapshot was taken.',
          howMeasured: 'Timestamp at capture.',
          range: 'Pick comparable points (e.g. month-end).',
        },
      ],
    },
    it: {
      whatItIs:
        'Catture salvate dei tuoi metric chiave in un istante, per confrontare "prima e dopo" e dimostrare i progressi.',
      why: 'Il monitoraggio è continuo; gli snapshot congelano un momento (es. prima/dopo una campagna) per misurare il delta in modo pulito.',
      inputs:
        'I metric attuali di salute e visibilità del brand nel momento in cui (tu o una pianificazione) scatti lo snapshot.',
      outputs: 'Un record datato per snapshot e il confronto fianco a fianco di due qualsiasi.',
      metrics: [
        {
          metric: 'Snapshot',
          meaning: 'Un set di metric congelato a una data.',
          howMeasured: 'Catturato su richiesta o pianificato.',
          range: 'Scattane uno prima/dopo ogni cambio importante.',
        },
        {
          metric: 'Metriche catturate',
          meaning: 'Cosa salva ogni snapshot.',
          howMeasured: 'AVI, tassi citazione/menzione/sentiment, posizione, ecc.',
          range: 'Stessi campi della dashboard live.',
        },
        {
          metric: 'Delta',
          meaning: 'Variazione tra due snapshot.',
          howMeasured: 'Snapshot successivo − precedente, per metrica.',
          range: 'Positivo = progresso; il numero da riportare.',
        },
        {
          metric: 'Data',
          meaning: 'Quando è stato scattato lo snapshot.',
          howMeasured: 'Timestamp alla cattura.',
          range: 'Scegli punti confrontabili (es. fine mese).',
        },
      ],
    },
    sv: {
      whatItIs:
        'Sparade ögonblicksbilder av varumärkets nyckeltal vid en tidpunkt, så du kan jämföra "då mot nu" och bevisa framsteg.',
      why: 'Övervakning är kontinuerlig; ögonblicksbilder fryser ett tillfälle (t.ex. före/efter en kampanj) så du kan mäta skillnaden rent.',
      inputs:
        'De aktuella hälso- och synlighetsmåtten i stunden då du (eller ett schema) tar ögonblicksbilden.',
      outputs:
        'En daterad post per ögonblicksbild, och en jämförelse sida vid sida av två valfria.',
      metrics: [
        {
          metric: 'Ögonblicksbild',
          meaning: 'En frusen uppsättning mått vid ett datum.',
          howMeasured: 'Tagen på begäran eller schemalagt.',
          range: 'Ta en före/efter varje stor förändring.',
        },
        {
          metric: 'Fångade mått',
          meaning: 'Vad varje ögonblicksbild sparar.',
          howMeasured: 'AVI, citerings-/omnämnande-/sentimentandelar, position, osv.',
          range: 'Samma fält som live-dashboarden.',
        },
        {
          metric: 'Delta',
          meaning: 'Förändring mellan två ögonblicksbilder.',
          howMeasured: 'Senare ögonblicksbild − tidigare, per mått.',
          range: 'Positivt = framsteg; talet du rapporterar.',
        },
        {
          metric: 'Datum',
          meaning: 'När ögonblicksbilden togs.',
          howMeasured: 'Tidsstämpel vid fångst.',
          range: 'Välj jämförbara punkter (t.ex. månadsslut).',
        },
      ],
    },
  },

  audit: {
    en: {
      whatItIs:
        'A technical on-page audit of a URL for AI-readiness: structure, schema, freshness, llms.txt and other signals engines use to trust and parse a page.',
      why: 'AI engines parse and cite well-structured, machine-readable pages. This finds the concrete technical gaps that keep your content from being cited.',
      inputs:
        'A URL you submit. The page is fetched (via the hardened safe-fetch) and its HTML / structure analyzed.',
      outputs:
        'An overall readiness score, per-check pass/fail with fixes, and a prioritized fix brief.',
      metrics: [
        {
          metric: 'Readiness score',
          meaning: 'Overall technical AEO health of the page.',
          howMeasured: 'Weighted across the individual checks.',
          range: '0–100. Higher = easier for engines to parse & trust.',
        },
        {
          metric: 'Schema / structured data',
          meaning: 'Machine-readable markup present.',
          howMeasured: 'schema.org / JSON-LD detected and validated.',
          range: 'Present & valid = engines describe you precisely.',
        },
        {
          metric: 'Freshness',
          meaning: 'How current the page signals it is.',
          howMeasured: 'Dates, last-modified and content recency checked.',
          range: 'Recent = preferred for time-sensitive answers.',
        },
        {
          metric: 'llms.txt',
          meaning: 'An AI-crawler guidance file.',
          howMeasured: 'Presence / validity of /llms.txt checked.',
          range: 'Present = a clean, citable machine source.',
        },
        {
          metric: 'Fix brief',
          meaning: 'The prioritized to-do from the audit.',
          howMeasured: 'Failed checks ordered by impact.',
          range: 'Work top-down to lift the score.',
        },
      ],
    },
    it: {
      whatItIs:
        "Un audit tecnico on-page di un URL per la prontezza all'AI: struttura, schema, freschezza, llms.txt e altri segnali che i motori usano per fidarsi e interpretare una pagina.",
      why: 'I motori AI interpretano e citano pagine ben strutturate e leggibili dalle macchine. Questo trova le lacune tecniche concrete che impediscono ai tuoi contenuti di essere citati.',
      inputs:
        "Un URL che invii. La pagina è scaricata (tramite il safe-fetch blindato) e ne viene analizzata l'HTML / struttura.",
      outputs:
        'Un punteggio di prontezza complessivo, esito pass/fail per controllo con correzioni e un brief di intervento prioritario.',
      metrics: [
        {
          metric: 'Punteggio di prontezza',
          meaning: 'Salute tecnica AEO complessiva della pagina.',
          howMeasured: 'Pesato sui singoli controlli.',
          range: '0–100. Più alto = più facile interpretare e fidarsi per i motori.',
        },
        {
          metric: 'Schema / dati strutturati',
          meaning: 'Markup leggibile dalle macchine presente.',
          howMeasured: 'schema.org / JSON-LD rilevato e validato.',
          range: 'Presente e valido = i motori ti descrivono con precisione.',
        },
        {
          metric: 'Freschezza',
          meaning: 'Quanto la pagina segnala di essere aggiornata.',
          howMeasured: 'Date, last-modified e attualità del contenuto controllati.',
          range: 'Recente = preferito per risposte sensibili al tempo.',
        },
        {
          metric: 'llms.txt',
          meaning: 'Un file di guida per i crawler AI.',
          howMeasured: 'Presenza / validità di /llms.txt controllata.',
          range: 'Presente = una fonte pulita e citabile dalle macchine.',
        },
        {
          metric: 'Brief di intervento',
          meaning: "La to-do prioritaria dall'audit.",
          howMeasured: 'Controlli falliti ordinati per impatto.',
          range: "Lavora dall'alto per alzare il punteggio.",
        },
      ],
    },
    sv: {
      whatItIs:
        'En teknisk on-page-granskning av en URL för AI-beredskap: struktur, schema, färskhet, llms.txt och andra signaler motorerna använder för att lita på och tolka en sida.',
      why: 'AI-motorer tolkar och citerar välstrukturerade, maskinläsbara sidor. Det här hittar de konkreta tekniska luckorna som hindrar ditt innehåll från att citeras.',
      inputs:
        'En URL du skickar. Sidan hämtas (via den härdade safe-fetch) och dess HTML / struktur analyseras.',
      outputs:
        'En övergripande beredskapspoäng, pass/fail per kontroll med åtgärder och en prioriterad åtgärdsbrief.',
      metrics: [
        {
          metric: 'Beredskapspoäng',
          meaning: 'Sidans övergripande tekniska AEO-hälsa.',
          howMeasured: 'Viktad över de enskilda kontrollerna.',
          range: '0–100. Högre = lättare för motorer att tolka och lita på.',
        },
        {
          metric: 'Schema / strukturerad data',
          meaning: 'Maskinläsbar märkning finns.',
          howMeasured: 'schema.org / JSON-LD upptäckt och validerad.',
          range: 'Finns och giltig = motorer beskriver dig exakt.',
        },
        {
          metric: 'Färskhet',
          meaning: 'Hur aktuell sidan signalerar att den är.',
          howMeasured: 'Datum, last-modified och innehållets aktualitet kontrolleras.',
          range: 'Nyligen = föredras för tidskänsliga svar.',
        },
        {
          metric: 'llms.txt',
          meaning: 'En vägledningsfil för AI-crawlers.',
          howMeasured: 'Närvaro / giltighet av /llms.txt kontrolleras.',
          range: 'Finns = en ren, citerbar maskinkälla.',
        },
        {
          metric: 'Åtgärdsbrief',
          meaning: 'Den prioriterade att-göra-listan från granskningen.',
          howMeasured: 'Misslyckade kontroller ordnade efter påverkan.',
          range: 'Arbeta uppifrån och ner för att höja poängen.',
        },
      ],
    },
  },

  prompts: {
    en: {
      whatItIs:
        'Your monitoring queries — the real questions sent to the AI engines — organized by intent bucket so you cover the whole buyer journey, not just brand-name searches.',
      why: 'You can only measure visibility for questions you actually ask. A good prompt set is the difference between a representative score and a blind spot.',
      inputs:
        'Prompts you write or generate (from an industry preset), each tagged with a language, market, intent bucket and engines.',
      outputs:
        'The active prompt list, per-bucket coverage, run frequency, and duplicate/stale warnings.',
      metrics: [
        {
          metric: 'Prompt',
          meaning: 'One query monitored across engines.',
          howMeasured: 'Authored or generated, hydrated with brand/competitor/location.',
          range: 'Aim for natural, real-user phrasing.',
        },
        {
          metric: 'Intent bucket (B1–B5)',
          meaning: 'The journey stage a prompt targets.',
          howMeasured:
            'B1 brand/competitor, B2 category, B3 problem/JTBD, B4 buyer intent, B5 compliance/risk.',
          range: 'Cover ≥3 buckets for a representative view.',
        },
        {
          metric: 'Active prompts',
          meaning: 'How many prompts are being run.',
          howMeasured: 'Count of enabled prompts for the brand.',
          range: 'Too few = blind spots; balance with credit cost.',
        },
        {
          metric: 'Run frequency',
          meaning: 'How often a prompt is checked.',
          howMeasured: 'daily / weekly / monthly per prompt.',
          range: 'High-value prompts daily, the rest weekly/monthly.',
        },
        {
          metric: 'Stale / duplicate',
          meaning: 'Prompts not run recently or near-identical.',
          howMeasured: 'Stale = not run >14 days; duplicates flagged by semantic similarity.',
          range: 'Reactivate stale, merge duplicates.',
        },
      ],
    },
    it: {
      whatItIs:
        "Le tue query di monitoraggio — le domande reali inviate ai motori AI — organizzate per intent bucket così copri tutto il percorso d'acquisto, non solo le ricerche sul nome del brand.",
      why: 'Puoi misurare la visibilità solo per le domande che fai davvero. Un buon set di prompt è la differenza tra un punteggio rappresentativo e un punto cieco.',
      inputs:
        'Prompt che scrivi o generi (da un preset di settore), ciascuno con lingua, mercato, intent bucket e motori.',
      outputs:
        'La lista dei prompt attivi, la copertura per bucket, la frequenza di esecuzione e gli avvisi di duplicati/obsoleti.',
      metrics: [
        {
          metric: 'Prompt',
          meaning: 'Una query monitorata sui motori.',
          howMeasured: 'Scritta o generata, idratata con brand/competitor/località.',
          range: 'Punta a un fraseggio naturale, da utente reale.',
        },
        {
          metric: 'Intent bucket (B1–B5)',
          meaning: 'La fase del percorso che il prompt copre.',
          howMeasured:
            "B1 brand/competitor, B2 categoria, B3 problema/JTBD, B4 intento d'acquisto, B5 compliance/rischio.",
          range: 'Copri ≥3 bucket per una vista rappresentativa.',
        },
        {
          metric: 'Prompt attivi',
          meaning: 'Quanti prompt vengono eseguiti.',
          howMeasured: 'Conteggio dei prompt abilitati per il brand.',
          range: 'Troppo pochi = punti ciechi; bilancia col costo crediti.',
        },
        {
          metric: 'Frequenza',
          meaning: 'Ogni quanto un prompt è controllato.',
          howMeasured: 'giornaliera / settimanale / mensile per prompt.',
          range: 'Prompt di valore ogni giorno, gli altri settimanale/mensile.',
        },
        {
          metric: 'Obsoleto / duplicato',
          meaning: 'Prompt non eseguiti di recente o quasi identici.',
          howMeasured:
            'Obsoleto = non eseguito da >14 giorni; duplicati segnalati per similarità semantica.',
          range: 'Riattiva gli obsoleti, unisci i duplicati.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Dina övervakningsfrågor — de riktiga frågorna som skickas till AI-motorerna — organiserade per avsiktsbucket så att du täcker hela köpresan, inte bara sökningar på varumärkesnamnet.',
      why: 'Du kan bara mäta synlighet för frågor du faktiskt ställer. En bra promptuppsättning är skillnaden mellan ett representativt betyg och en blind fläck.',
      inputs:
        'Prompts du skriver eller genererar (från en branschförinställning), var och en med språk, marknad, avsiktsbucket och motorer.',
      outputs:
        'Listan med aktiva prompts, täckning per bucket, körfrekvens och varningar för dubbletter/inaktuella.',
      metrics: [
        {
          metric: 'Prompt',
          meaning: 'En fråga som övervakas över motorerna.',
          howMeasured: 'Skriven eller genererad, ifylld med varumärke/konkurrent/plats.',
          range: 'Sikta på naturligt, verkligt användarspråk.',
        },
        {
          metric: 'Avsiktsbucket (B1–B5)',
          meaning: 'Vilket steg i resan en prompt riktar sig mot.',
          howMeasured:
            'B1 varumärke/konkurrent, B2 kategori, B3 problem/JTBD, B4 köpintention, B5 efterlevnad/risk.',
          range: 'Täck ≥3 buckets för en representativ bild.',
        },
        {
          metric: 'Aktiva prompts',
          meaning: 'Hur många prompts som körs.',
          howMeasured: 'Antal aktiverade prompts för varumärket.',
          range: 'För få = blinda fläckar; balansera mot kreditkostnad.',
        },
        {
          metric: 'Körfrekvens',
          meaning: 'Hur ofta en prompt kontrolleras.',
          howMeasured: 'dagligen / veckovis / månadsvis per prompt.',
          range: 'Värdefulla prompts dagligen, resten veckovis/månadsvis.',
        },
        {
          metric: 'Inaktuell / dubblett',
          meaning: 'Prompts som inte körts nyligen eller är nästan identiska.',
          howMeasured:
            'Inaktuell = inte körd på >14 dagar; dubbletter flaggas via semantisk likhet.',
          range: 'Återaktivera inaktuella, slå ihop dubbletter.',
        },
      ],
    },
  },

  brands: {
    en: {
      whatItIs:
        'Where you set up each brand you monitor — its name, aliases, domain, competitors, industry and market language. This config drives every other view.',
      why: "Accurate brand config is the foundation: a missing alias or wrong language means the engines' mentions of you go uncounted and your scores read low for the wrong reason.",
      inputs:
        'The details you enter per brand (name, aliases, domain, competitors, industry preset, primary language).',
      outputs:
        'A configured brand that monitoring, scoring, sentiment and competitor analysis all run against.',
      metrics: [
        {
          metric: 'Brand name + aliases',
          meaning: 'How the brand is detected in answers.',
          howMeasured: 'Whole-word match of name + every alias (incl. legal-suffix variants).',
          range: 'Add every spelling/alias or mentions get missed.',
        },
        {
          metric: 'Domain',
          meaning: 'Your site, for citation matching.',
          howMeasured: 'Used to flag when engines cite you.',
          range: 'Must be exact — it feeds the Citation pillar.',
        },
        {
          metric: 'Competitors',
          meaning: 'The rivals you benchmark against.',
          howMeasured: 'Used for Share of Voice and competitor mentions.',
          range: 'Keep this list current with who AI actually names.',
        },
        {
          metric: 'Industry preset',
          meaning: 'Drives prompt generation + context.',
          howMeasured: 'Maps to a localized template set (B1–B5).',
          range: 'Wrong preset = off-target prompts.',
        },
        {
          metric: 'Primary language / market',
          meaning: 'The locale prompts and analysis use.',
          howMeasured: 'sv / it / en — sets phrasing and market context.',
          range: 'Match your real audience, not English by default.',
        },
      ],
    },
    it: {
      whatItIs:
        'Dove configuri ogni brand che monitori — nome, alias, dominio, competitor, settore e lingua di mercato. Questa configurazione guida ogni altra vista.',
      why: 'Una configurazione accurata è la base: un alias mancante o la lingua sbagliata fa sì che le menzioni dei motori non vengano contate e i punteggi risultino bassi per il motivo sbagliato.',
      inputs:
        'I dettagli che inserisci per brand (nome, alias, dominio, competitor, preset di settore, lingua primaria).',
      outputs:
        'Un brand configurato su cui girano monitoraggio, scoring, sentiment e analisi competitor.',
      metrics: [
        {
          metric: 'Nome brand + alias',
          meaning: 'Come il brand è rilevato nelle risposte.',
          howMeasured:
            'Match a parola intera di nome + ogni alias (incl. varianti con suffisso legale).',
          range: 'Aggiungi ogni grafia/alias o le menzioni vengono perse.',
        },
        {
          metric: 'Dominio',
          meaning: 'Il tuo sito, per il match delle citazioni.',
          howMeasured: 'Usato per segnalare quando i motori ti citano.',
          range: "Dev'essere esatto — alimenta il pilastro Citazioni.",
        },
        {
          metric: 'Competitor',
          meaning: 'I rivali con cui ti confronti.',
          howMeasured: 'Usati per Share of Voice e menzioni competitor.',
          range: "Tieni la lista aggiornata con chi l'AI nomina davvero.",
        },
        {
          metric: 'Preset di settore',
          meaning: 'Guida la generazione prompt + contesto.',
          howMeasured: 'Mappa a un set di template localizzati (B1–B5).',
          range: 'Preset sbagliato = prompt fuori bersaglio.',
        },
        {
          metric: 'Lingua / mercato primario',
          meaning: 'Il locale usato da prompt e analisi.',
          howMeasured: 'sv / it / en — imposta fraseggio e contesto di mercato.',
          range: 'Allinea al pubblico reale, non inglese di default.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Där du ställer in varje varumärke du övervakar — namn, alias, domän, konkurrenter, bransch och marknadsspråk. Den här konfigurationen driver alla andra vyer.',
      why: 'Korrekt konfiguration är grunden: ett saknat alias eller fel språk gör att motorernas omnämnanden av dig inte räknas och dina betyg ser låga ut av fel anledning.',
      inputs:
        'Uppgifterna du anger per varumärke (namn, alias, domän, konkurrenter, branschförinställning, primärt språk).',
      outputs:
        'Ett konfigurerat varumärke som övervakning, poängsättning, sentiment och konkurrentanalys körs mot.',
      metrics: [
        {
          metric: 'Varumärkesnamn + alias',
          meaning: 'Hur varumärket upptäcks i svar.',
          howMeasured:
            'Helordsmatchning av namn + varje alias (inkl. varianter med juridiskt suffix).',
          range: 'Lägg till varje stavning/alias annars missas omnämnanden.',
        },
        {
          metric: 'Domän',
          meaning: 'Din sajt, för citeringsmatchning.',
          howMeasured: 'Används för att flagga när motorer citerar dig.',
          range: 'Måste vara exakt — den matar citeringspelaren.',
        },
        {
          metric: 'Konkurrenter',
          meaning: 'Rivalerna du jämför dig med.',
          howMeasured: 'Används för Share of Voice och konkurrentomnämnanden.',
          range: 'Håll listan aktuell med vilka AI faktiskt nämner.',
        },
        {
          metric: 'Branschförinställning',
          meaning: 'Driver promptgenerering + kontext.',
          howMeasured: 'Mappar till en lokaliserad malluppsättning (B1–B5).',
          range: 'Fel förinställning = prompts som missar målet.',
        },
        {
          metric: 'Primärt språk / marknad',
          meaning: 'Lokalen som prompts och analys använder.',
          howMeasured: 'sv / it / en — sätter formulering och marknadskontext.',
          range: 'Matcha din verkliga publik, inte engelska som standard.',
        },
      ],
    },
  },

  alerts: {
    en: {
      whatItIs:
        'Automatic notifications when your AI visibility moves — a score drop, a new negative mention, a competitor overtaking you, or a hallucination.',
      why: 'AI answers change constantly. Alerts mean you react to a problem in hours, not when you next happen to open the dashboard.',
      inputs:
        'Your alert rules (metric + threshold + direction) evaluated against each new monitoring run.',
      outputs:
        'Triggered alerts with the metric, the change, and a link to investigate; optionally emailed.',
      metrics: [
        {
          metric: 'Alert rule',
          meaning: 'A condition you want to be told about.',
          howMeasured: 'Metric + threshold + direction (e.g. AVI drops >5).',
          range: 'Set a few high-signal rules, not noise.',
        },
        {
          metric: 'Trigger',
          meaning: 'A rule that fired.',
          howMeasured: 'Evaluated when new monitoring data arrives.',
          range: 'Each links to the data that caused it.',
        },
        {
          metric: 'Severity',
          meaning: 'How urgent the change is.',
          howMeasured: 'Derived from the size of the breach.',
          range: 'Triage high-severity first.',
        },
        {
          metric: 'Unread count',
          meaning: "Alerts you haven't reviewed.",
          howMeasured: 'Count of un-acknowledged triggers.',
          range: 'Keep it near zero to stay on top.',
        },
      ],
    },
    it: {
      whatItIs:
        "Notifiche automatiche quando la tua visibilità AI cambia — un calo di punteggio, una nuova menzione negativa, un competitor che ti supera o un'allucinazione.",
      why: 'Le risposte AI cambiano di continuo. Gli alert ti fanno reagire a un problema in ore, non quando ti capita di riaprire la dashboard.',
      inputs:
        'Le tue regole di alert (metrica + soglia + direzione) valutate a ogni nuova esecuzione di monitoraggio.',
      outputs:
        'Alert scattati con la metrica, la variazione e un link per indagare; opzionalmente via email.',
      metrics: [
        {
          metric: 'Regola di alert',
          meaning: 'Una condizione di cui vuoi essere avvisato.',
          howMeasured: 'Metrica + soglia + direzione (es. AVI cala >5).',
          range: 'Imposta poche regole ad alto segnale, non rumore.',
        },
        {
          metric: 'Trigger',
          meaning: 'Una regola che è scattata.',
          howMeasured: "Valutata all'arrivo di nuovi dati di monitoraggio.",
          range: "Ognuno rimanda al dato che l'ha causato.",
        },
        {
          metric: 'Gravità',
          meaning: 'Quanto è urgente il cambiamento.',
          howMeasured: "Derivata dall'entità dello sforamento.",
          range: "Gestisci prima l'alta gravità.",
        },
        {
          metric: 'Non letti',
          meaning: 'Alert che non hai rivisto.',
          howMeasured: 'Conteggio dei trigger non confermati.',
          range: 'Tienilo vicino a zero per restare aggiornato.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Automatiska aviseringar när din AI-synlighet ändras — ett poängfall, ett nytt negativt omnämnande, en konkurrent som går om dig, eller en hallucination.',
      why: 'AI-svar ändras hela tiden. Aviseringar gör att du reagerar på ett problem inom timmar, inte när du råkar öppna dashboarden nästa gång.',
      inputs:
        'Dina aviseringsregler (mått + tröskel + riktning) som utvärderas mot varje ny övervakningskörning.',
      outputs:
        'Utlösta aviseringar med måttet, förändringen och en länk för att undersöka; valfritt via e-post.',
      metrics: [
        {
          metric: 'Aviseringsregel',
          meaning: 'Ett villkor du vill bli meddelad om.',
          howMeasured: 'Mått + tröskel + riktning (t.ex. AVI faller >5).',
          range: 'Sätt några få högsignalsregler, inte brus.',
        },
        {
          metric: 'Utlösare',
          meaning: 'En regel som löstes ut.',
          howMeasured: 'Utvärderas när nya övervakningsdata kommer.',
          range: 'Var och en länkar till datan som orsakade den.',
        },
        {
          metric: 'Allvarlighet',
          meaning: 'Hur brådskande förändringen är.',
          howMeasured: 'Härleds från överträdelsens storlek.',
          range: 'Hantera hög allvarlighet först.',
        },
        {
          metric: 'Olästa',
          meaning: 'Aviseringar du inte granskat.',
          howMeasured: 'Antal obekräftade utlösare.',
          range: 'Håll det nära noll för att ha koll.',
        },
      ],
    },
  },

  workflows: {
    en: {
      whatItIs:
        'Closed-loop work orders: turn a recommendation into a tracked task, do the work, then re-check the GEO Score to see if it actually moved.',
      why: 'It closes the loop between insight and result — you prove which actions worked instead of guessing, with a before/after on the score.',
      inputs:
        "A recommendation or manual task, with the brand's GEO Score captured as the baseline.",
      outputs: 'A work order with status, the baseline score, and the post-work GEO delta.',
      metrics: [
        {
          metric: 'Work order',
          meaning: 'A tracked improvement task.',
          howMeasured: 'Created from a recommendation or by hand.',
          range: 'One concrete action per order.',
        },
        {
          metric: 'Status',
          meaning: 'Where the task stands.',
          howMeasured: 'open / in-progress / done.',
          range: 'Move to done only after the work ships.',
        },
        {
          metric: 'Baseline',
          meaning: 'The GEO Score before the work.',
          howMeasured: 'Captured when the order is created.',
          range: 'The "before" you measure against.',
        },
        {
          metric: 'GEO delta',
          meaning: 'Score change after the work.',
          howMeasured: 'Re-checked GEO Score − baseline.',
          range: 'Positive = the action worked; keep doing it.',
        },
      ],
    },
    it: {
      whatItIs:
        'Work order a ciclo chiuso: trasforma una raccomandazione in un task tracciato, fai il lavoro, poi ri-controlla il GEO Score per vedere se si è davvero mosso.',
      why: 'Chiude il cerchio tra intuizione e risultato — dimostri quali azioni hanno funzionato invece di indovinare, con un prima/dopo sul punteggio.',
      inputs:
        'Una raccomandazione o un task manuale, col GEO Score del brand catturato come baseline.',
      outputs: 'Un work order con stato, il punteggio baseline e il delta GEO dopo il lavoro.',
      metrics: [
        {
          metric: 'Work order',
          meaning: 'Un task di miglioramento tracciato.',
          howMeasured: 'Creato da una raccomandazione o a mano.',
          range: "Un'azione concreta per ordine.",
        },
        {
          metric: 'Stato',
          meaning: 'A che punto è il task.',
          howMeasured: 'aperto / in corso / fatto.',
          range: 'Sposta a fatto solo dopo che il lavoro è online.',
        },
        {
          metric: 'Baseline',
          meaning: 'Il GEO Score prima del lavoro.',
          howMeasured: "Catturato alla creazione dell'ordine.",
          range: 'Il "prima" con cui ti confronti.',
        },
        {
          metric: 'Delta GEO',
          meaning: 'Variazione del punteggio dopo il lavoro.',
          howMeasured: 'GEO Score ri-controllato − baseline.',
          range: "Positivo = l'azione ha funzionato; continua.",
        },
      ],
    },
    sv: {
      whatItIs:
        'Slutna arbetsordrar: gör en rekommendation till en spårad uppgift, utför arbetet, kontrollera sedan GEO Score igen för att se om det faktiskt rörde sig.',
      why: 'Det sluter cirkeln mellan insikt och resultat — du bevisar vilka åtgärder som fungerade istället för att gissa, med ett före/efter på poängen.',
      inputs:
        'En rekommendation eller manuell uppgift, med varumärkets GEO Score fångad som baslinje.',
      outputs: 'En arbetsorder med status, baslinjepoängen och GEO-deltat efter arbetet.',
      metrics: [
        {
          metric: 'Arbetsorder',
          meaning: 'En spårad förbättringsuppgift.',
          howMeasured: 'Skapad från en rekommendation eller för hand.',
          range: 'En konkret åtgärd per order.',
        },
        {
          metric: 'Status',
          meaning: 'Var uppgiften står.',
          howMeasured: 'öppen / pågår / klar.',
          range: 'Flytta till klar först när arbetet är live.',
        },
        {
          metric: 'Baslinje',
          meaning: 'GEO Score före arbetet.',
          howMeasured: 'Fångad när ordern skapas.',
          range: 'Det "före" du mäter mot.',
        },
        {
          metric: 'GEO-delta',
          meaning: 'Poängförändring efter arbetet.',
          howMeasured: 'Omkontrollerat GEO Score − baslinje.',
          range: 'Positivt = åtgärden fungerade; fortsätt.',
        },
      ],
    },
  },

  reports: {
    en: {
      whatItIs:
        "Client-ready, white-label reports of a brand's AI visibility — the headline scores, trends and recommendations, exportable as PDF/HTML.",
      why: 'It turns the dashboard into something you can hand a client or stakeholder, branded as yours, without giving them logins.',
      inputs:
        "A brand's current scores, trends and recommendations over the chosen period; your white-label branding.",
      outputs:
        'A formatted report (PDF/HTML) with summary, GEO/AVI, engine breakdown and prioritized actions.',
      metrics: [
        {
          metric: 'Report',
          meaning: 'A snapshot document for a brand.',
          howMeasured: 'Generated from current metrics + period.',
          range: 'One per client/period.',
        },
        {
          metric: 'White-label',
          meaning: 'Your branding on the report.',
          howMeasured: 'Logo/colors applied instead of ours.',
          range: 'Set once in settings; reused everywhere.',
        },
        {
          metric: 'Sections',
          meaning: 'What the report contains.',
          howMeasured: 'Summary, scores, trend, engines, recommendations.',
          range: 'Trim to what the audience needs.',
        },
        {
          metric: 'Format',
          meaning: "How it's exported.",
          howMeasured: 'PDF (client-ready) or HTML (web).',
          range: 'PDF to send, HTML to embed.',
        },
      ],
    },
    it: {
      whatItIs:
        'Report white-label pronti per il cliente sulla visibilità AI di un brand — punteggi principali, trend e raccomandazioni, esportabili in PDF/HTML.',
      why: 'Trasforma la dashboard in qualcosa da consegnare a un cliente o stakeholder, col tuo marchio, senza dargli accessi.',
      inputs:
        'Punteggi, trend e raccomandazioni attuali di un brand nel periodo scelto; il tuo branding white-label.',
      outputs:
        'Un report formattato (PDF/HTML) con riepilogo, GEO/AVI, dettaglio motori e azioni prioritarie.',
      metrics: [
        {
          metric: 'Report',
          meaning: 'Un documento istantanea per un brand.',
          howMeasured: 'Generato dai metric attuali + periodo.',
          range: 'Uno per cliente/periodo.',
        },
        {
          metric: 'White-label',
          meaning: 'Il tuo marchio sul report.',
          howMeasured: 'Logo/colori applicati al posto dei nostri.',
          range: 'Impostato una volta nelle impostazioni; riusato ovunque.',
        },
        {
          metric: 'Sezioni',
          meaning: 'Cosa contiene il report.',
          howMeasured: 'Riepilogo, punteggi, trend, motori, raccomandazioni.',
          range: 'Riduci a ciò che serve al pubblico.',
        },
        {
          metric: 'Formato',
          meaning: 'Come viene esportato.',
          howMeasured: 'PDF (pronto cliente) o HTML (web).',
          range: 'PDF da inviare, HTML da incorporare.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Kundfärdiga white-label-rapporter om ett varumärkes AI-synlighet — huvudpoäng, trender och rekommendationer, exporterbara som PDF/HTML.',
      why: 'Det förvandlar dashboarden till något du kan lämna till en kund eller intressent, med ditt varumärke, utan att ge dem inloggningar.',
      inputs:
        'Ett varumärkes aktuella poäng, trender och rekommendationer under vald period; din white-label-branding.',
      outputs:
        'En formaterad rapport (PDF/HTML) med sammanfattning, GEO/AVI, motoruppdelning och prioriterade åtgärder.',
      metrics: [
        {
          metric: 'Rapport',
          meaning: 'Ett ögonblicksdokument för ett varumärke.',
          howMeasured: 'Genererad från aktuella mått + period.',
          range: 'En per kund/period.',
        },
        {
          metric: 'White-label',
          meaning: 'Ditt varumärke på rapporten.',
          howMeasured: 'Logo/färger tillämpas istället för våra.',
          range: 'Ställs in en gång i inställningar; återanvänds överallt.',
        },
        {
          metric: 'Sektioner',
          meaning: 'Vad rapporten innehåller.',
          howMeasured: 'Sammanfattning, poäng, trend, motorer, rekommendationer.',
          range: 'Trimma till vad publiken behöver.',
        },
        {
          metric: 'Format',
          meaning: 'Hur den exporteras.',
          howMeasured: 'PDF (kundfärdig) eller HTML (webb).',
          range: 'PDF att skicka, HTML att bädda in.',
        },
      ],
    },
  },

  history: {
    en: {
      whatItIs:
        'The full log of every monitoring scan — each AI answer captured, searchable and filterable, so you can trace any score back to the raw responses behind it.',
      why: 'When a number looks wrong, this is where you verify it: read the actual answer the engine gave, not just the aggregate.',
      inputs: 'Every monitoring result stored for the brand (engine, prompt, response, metrics).',
      outputs:
        'A filterable, dated list of scans you can open to read the full response and its extracted signals.',
      metrics: [
        {
          metric: 'Scan record',
          meaning: 'One stored AI answer.',
          howMeasured: 'Engine, prompt, full response, and extracted metrics.',
          range: 'The audit trail behind every score.',
        },
        {
          metric: 'Filters',
          meaning: 'Narrow the log.',
          howMeasured: 'By engine, date, intent, brand-mentioned, etc.',
          range: 'Use to isolate a specific issue.',
        },
        {
          metric: 'Visibility / sentiment',
          meaning: 'The signals per scan.',
          howMeasured: 'Same extraction as Monitoring.',
          range: 'Spot the outliers driving a trend.',
        },
        {
          metric: 'Export',
          meaning: 'Take the data out.',
          howMeasured: 'CSV of the filtered scans.',
          range: 'For deeper analysis or sharing.',
        },
      ],
    },
    it: {
      whatItIs:
        'Il log completo di ogni scansione di monitoraggio — ogni risposta AI catturata, ricercabile e filtrabile, così puoi risalire da qualsiasi punteggio alle risposte grezze che lo generano.',
      why: "Quando un numero sembra sbagliato, è qui che lo verifichi: leggi la risposta reale del motore, non solo l'aggregato.",
      inputs:
        'Ogni risultato di monitoraggio salvato per il brand (motore, prompt, risposta, metriche).',
      outputs:
        'Una lista datata e filtrabile di scansioni che puoi aprire per leggere la risposta completa e i suoi segnali estratti.',
      metrics: [
        {
          metric: 'Record di scansione',
          meaning: 'Una risposta AI salvata.',
          howMeasured: 'Motore, prompt, risposta completa e metriche estratte.',
          range: 'La traccia dietro ogni punteggio.',
        },
        {
          metric: 'Filtri',
          meaning: 'Restringi il log.',
          howMeasured: 'Per motore, data, intento, brand-menzionato, ecc.',
          range: 'Usali per isolare un problema specifico.',
        },
        {
          metric: 'Visibilità / sentiment',
          meaning: 'I segnali per scansione.',
          howMeasured: 'Stessa estrazione del Monitoring.',
          range: 'Individua gli outlier che guidano un trend.',
        },
        {
          metric: 'Export',
          meaning: 'Porta fuori i dati.',
          howMeasured: 'CSV delle scansioni filtrate.',
          range: 'Per analisi più approfondite o condivisione.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Den fullständiga loggen över varje övervakningsskanning — varje AI-svar fångat, sökbart och filtrerbart, så du kan spåra valfritt betyg tillbaka till de råa svaren bakom det.',
      why: 'När ett tal ser fel ut är det här du verifierar det: läs det faktiska svaret motorn gav, inte bara aggregatet.',
      inputs: 'Varje övervakningsresultat sparat för varumärket (motor, prompt, svar, mått).',
      outputs:
        'En daterad, filtrerbar lista över skanningar som du kan öppna för att läsa hela svaret och dess extraherade signaler.',
      metrics: [
        {
          metric: 'Skanningspost',
          meaning: 'Ett sparat AI-svar.',
          howMeasured: 'Motor, prompt, fullständigt svar och extraherade mått.',
          range: 'Spårningen bakom varje betyg.',
        },
        {
          metric: 'Filter',
          meaning: 'Begränsa loggen.',
          howMeasured: 'Per motor, datum, avsikt, varumärke-nämnt, osv.',
          range: 'Använd för att isolera ett specifikt problem.',
        },
        {
          metric: 'Synlighet / sentiment',
          meaning: 'Signalerna per skanning.',
          howMeasured: 'Samma extraktion som Monitoring.',
          range: 'Hitta avvikarna som driver en trend.',
        },
        {
          metric: 'Export',
          meaning: 'Ta ut datan.',
          howMeasured: 'CSV av de filtrerade skanningarna.',
          range: 'För djupare analys eller delning.',
        },
      ],
    },
  },

  credits: {
    en: {
      whatItIs:
        'Your usage wallet — credits are spent each time the platform runs a paid action (a monitoring scan, an AI analysis), and topped up by your plan or purchases.',
      why: 'Every AI engine call costs money. Credits make that cost visible and budgetable, so you can scale monitoring deliberately.',
      inputs:
        'Credit grants (plan + purchases) and credit usage (each scan/analysis), with timestamps.',
      outputs: 'Current balance, purchased vs. used, earliest expiry, and a usage ledger.',
      metrics: [
        {
          metric: 'Balance',
          meaning: 'Credits available right now.',
          howMeasured: 'Granted − used.',
          range: '≤0 pauses paid actions; top up before it hits zero.',
        },
        {
          metric: 'Purchased',
          meaning: 'Credits added via plan/purchase.',
          howMeasured: 'Sum of grants in the period.',
          range: 'Your budget ceiling.',
        },
        {
          metric: 'Used',
          meaning: 'Credits consumed.',
          howMeasured: 'Sum of per-action deductions.',
          range: 'Track against purchased to forecast.',
        },
        {
          metric: 'Earliest expiry',
          meaning: 'When the next credits lapse.',
          howMeasured: 'Soonest expiry date in the ledger.',
          range: 'Use them before they expire.',
        },
      ],
    },
    it: {
      whatItIs:
        "Il tuo portafoglio di utilizzo — i crediti vengono spesi ogni volta che la piattaforma esegue un'azione a pagamento (una scansione, un'analisi AI) e ricaricati dal piano o dagli acquisti.",
      why: 'Ogni chiamata a un motore AI costa. I crediti rendono questo costo visibile e budgetizzabile, così puoi scalare il monitoraggio in modo consapevole.',
      inputs:
        'Accrediti (piano + acquisti) e consumo crediti (ogni scansione/analisi), con timestamp.',
      outputs: 'Saldo attuale, acquistati vs usati, scadenza più vicina e un registro di utilizzo.',
      metrics: [
        {
          metric: 'Saldo',
          meaning: 'Crediti disponibili ora.',
          howMeasured: 'Accreditati − usati.',
          range: '≤0 mette in pausa le azioni a pagamento; ricarica prima dello zero.',
        },
        {
          metric: 'Acquistati',
          meaning: 'Crediti aggiunti via piano/acquisto.',
          howMeasured: 'Somma degli accrediti nel periodo.',
          range: 'Il tuo tetto di budget.',
        },
        {
          metric: 'Usati',
          meaning: 'Crediti consumati.',
          howMeasured: 'Somma dei prelievi per azione.',
          range: 'Confronta con gli acquistati per prevedere.',
        },
        {
          metric: 'Scadenza più vicina',
          meaning: 'Quando scadono i prossimi crediti.',
          howMeasured: 'Data di scadenza più vicina nel registro.',
          range: 'Usali prima che scadano.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Din användningsplånbok — krediter dras varje gång plattformen kör en betald åtgärd (en skanning, en AI-analys) och fylls på av din plan eller köp.',
      why: 'Varje AI-motoranrop kostar pengar. Krediter gör kostnaden synlig och budgeterbar, så du kan skala övervakning medvetet.',
      inputs:
        'Kredittilldelningar (plan + köp) och kreditförbrukning (varje skanning/analys), med tidsstämplar.',
      outputs: 'Aktuellt saldo, köpta vs använda, tidigaste utgång och en användningslogg.',
      metrics: [
        {
          metric: 'Saldo',
          meaning: 'Krediter tillgängliga just nu.',
          howMeasured: 'Tilldelade − använda.',
          range: '≤0 pausar betalda åtgärder; fyll på före noll.',
        },
        {
          metric: 'Köpta',
          meaning: 'Krediter tillagda via plan/köp.',
          howMeasured: 'Summan av tilldelningar i perioden.',
          range: 'Ditt budgettak.',
        },
        {
          metric: 'Använda',
          meaning: 'Förbrukade krediter.',
          howMeasured: 'Summan av avdrag per åtgärd.',
          range: 'Följ mot köpta för att prognostisera.',
        },
        {
          metric: 'Tidigaste utgång',
          meaning: 'När nästa krediter löper ut.',
          howMeasured: 'Närmaste utgångsdatum i loggen.',
          range: 'Använd dem innan de löper ut.',
        },
      ],
    },
  },

  billing: {
    en: {
      whatItIs:
        'Your subscription and payment management — current plan, what it includes, invoices, and upgrades, handled through Stripe.',
      why: 'Your plan sets your monthly credit allowance and feature access; this is where you change it as your monitoring needs grow.',
      inputs: 'Your active Stripe subscription, plan tier, and payment status.',
      outputs:
        'Current plan + status, included allowances, billing history, and upgrade/downgrade options.',
      metrics: [
        {
          metric: 'Plan',
          meaning: 'Your subscription tier.',
          howMeasured: 'Set at checkout, stored from the Stripe webhook.',
          range: 'Higher tiers = more credits/seats/features.',
        },
        {
          metric: 'Status',
          meaning: 'Subscription health.',
          howMeasured: 'active / past_due / canceled (from Stripe).',
          range: 'past_due = fix payment to avoid losing access.',
        },
        {
          metric: 'Allowance',
          meaning: 'What the plan includes.',
          howMeasured: 'Monthly credits + feature gates per tier.',
          range: 'Match the tier to your scan volume.',
        },
        {
          metric: 'Invoices',
          meaning: 'Your billing history.',
          howMeasured: 'Issued by Stripe per cycle.',
          range: 'For accounting/expensing.',
        },
      ],
    },
    it: {
      whatItIs:
        'La gestione di abbonamento e pagamenti — piano attuale, cosa include, fatture e upgrade, gestiti tramite Stripe.',
      why: "Il tuo piano definisce l'allowance mensile di crediti e l'accesso alle funzioni; qui lo cambi quando le tue esigenze di monitoraggio crescono.",
      inputs: 'Il tuo abbonamento Stripe attivo, il livello di piano e lo stato del pagamento.',
      outputs:
        'Piano + stato attuali, allowance incluse, cronologia fatturazione e opzioni di upgrade/downgrade.',
      metrics: [
        {
          metric: 'Piano',
          meaning: 'Il tuo livello di abbonamento.',
          howMeasured: 'Impostato al checkout, salvato dal webhook Stripe.',
          range: 'Livelli più alti = più crediti/posti/funzioni.',
        },
        {
          metric: 'Stato',
          meaning: "Salute dell'abbonamento.",
          howMeasured: 'attivo / scaduto / annullato (da Stripe).',
          range: "Scaduto = sistema il pagamento per non perdere l'accesso.",
        },
        {
          metric: 'Allowance',
          meaning: 'Cosa include il piano.',
          howMeasured: 'Crediti mensili + accesso funzioni per livello.',
          range: 'Allinea il livello al tuo volume di scansioni.',
        },
        {
          metric: 'Fatture',
          meaning: 'La tua cronologia di fatturazione.',
          howMeasured: 'Emesse da Stripe per ciclo.',
          range: 'Per contabilità/nota spese.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Din prenumerations- och betalningshantering — aktuell plan, vad den inkluderar, fakturor och uppgraderingar, hanterat via Stripe.',
      why: 'Din plan sätter din månatliga kredittilldelning och funktionsåtkomst; här ändrar du den när dina övervakningsbehov växer.',
      inputs: 'Din aktiva Stripe-prenumeration, plannivå och betalningsstatus.',
      outputs:
        'Aktuell plan + status, inkluderade tilldelningar, faktureringshistorik och upp-/nedgraderingsalternativ.',
      metrics: [
        {
          metric: 'Plan',
          meaning: 'Din prenumerationsnivå.',
          howMeasured: 'Satt vid utcheckning, sparad från Stripe-webhooken.',
          range: 'Högre nivåer = fler krediter/platser/funktioner.',
        },
        {
          metric: 'Status',
          meaning: 'Prenumerationens hälsa.',
          howMeasured: 'aktiv / förfallen / avbruten (från Stripe).',
          range: 'Förfallen = åtgärda betalningen för att inte tappa åtkomst.',
        },
        {
          metric: 'Tilldelning',
          meaning: 'Vad planen inkluderar.',
          howMeasured: 'Månadskrediter + funktionsgrindar per nivå.',
          range: 'Matcha nivån mot din skanningsvolym.',
        },
        {
          metric: 'Fakturor',
          meaning: 'Din faktureringshistorik.',
          howMeasured: 'Utfärdade av Stripe per cykel.',
          range: 'För bokföring/utlägg.',
        },
      ],
    },
  },

  settings: {
    en: {
      whatItIs:
        'Account and workspace configuration — your provider API keys, white-label branding, locale, and preferences.',
      why: 'A few settings here change behavior everywhere: your own API keys control which engines run, and white-label branding flows into every report.',
      inputs:
        'The values you set: encrypted API keys, branding, default language, notification preferences.',
      outputs: 'A configured workspace; keys are stored encrypted and never shown again.',
      metrics: [
        {
          metric: 'Provider API keys',
          meaning: 'Your own engine credentials.',
          howMeasured: 'Stored encrypted (AES-256-GCM); only the last 4 shown.',
          range: 'Set these to use your own quota instead of shared.',
        },
        {
          metric: 'White-label branding',
          meaning: 'Your logo/colors on reports.',
          howMeasured: 'Applied to exported reports.',
          range: 'Set once; reused everywhere.',
        },
        {
          metric: 'Locale',
          meaning: 'Your interface + advice language.',
          howMeasured: 'en / it / sv.',
          range: 'Drives the language of these help panels too.',
        },
        {
          metric: 'Preferences',
          meaning: 'Notifications and defaults.',
          howMeasured: 'Per-user toggles.',
          range: 'Tune to reduce noise.',
        },
      ],
    },
    it: {
      whatItIs:
        'Configurazione di account e workspace — le tue API key dei provider, il branding white-label, la lingua e le preferenze.',
      why: 'Poche impostazioni qui cambiano il comportamento ovunque: le tue API key controllano quali motori girano e il branding white-label confluisce in ogni report.',
      inputs:
        'I valori che imposti: API key cifrate, branding, lingua di default, preferenze di notifica.',
      outputs: 'Un workspace configurato; le key sono salvate cifrate e mai più mostrate.',
      metrics: [
        {
          metric: 'API key provider',
          meaning: 'Le tue credenziali dei motori.',
          howMeasured: 'Salvate cifrate (AES-256-GCM); mostrate solo le ultime 4.',
          range: 'Impostale per usare la tua quota invece di quella condivisa.',
        },
        {
          metric: 'Branding white-label',
          meaning: 'Il tuo logo/colori sui report.',
          howMeasured: 'Applicato ai report esportati.',
          range: 'Impostato una volta; riusato ovunque.',
        },
        {
          metric: 'Lingua',
          meaning: 'La lingua di interfaccia + consigli.',
          howMeasured: 'en / it / sv.',
          range: 'Guida anche la lingua di questi pannelli help.',
        },
        {
          metric: 'Preferenze',
          meaning: 'Notifiche e default.',
          howMeasured: 'Toggle per utente.',
          range: 'Regola per ridurre il rumore.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Konto- och arbetsytekonfiguration — dina provider-API-nycklar, white-label-branding, språk och inställningar.',
      why: 'Några inställningar här ändrar beteendet överallt: dina egna API-nycklar styr vilka motorer som körs, och white-label-branding flödar in i varje rapport.',
      inputs:
        'Värdena du sätter: krypterade API-nycklar, branding, standardspråk, aviseringsinställningar.',
      outputs: 'En konfigurerad arbetsyta; nycklar lagras krypterade och visas aldrig igen.',
      metrics: [
        {
          metric: 'Provider-API-nycklar',
          meaning: 'Dina egna motoruppgifter.',
          howMeasured: 'Lagras krypterade (AES-256-GCM); endast de sista 4 visas.',
          range: 'Sätt dessa för att använda din egen kvot istället för delad.',
        },
        {
          metric: 'White-label-branding',
          meaning: 'Din logo/färger på rapporter.',
          howMeasured: 'Tillämpas på exporterade rapporter.',
          range: 'Sätts en gång; återanvänds överallt.',
        },
        {
          metric: 'Språk',
          meaning: 'Ditt gränssnitts- + rådgivningsspråk.',
          howMeasured: 'en / it / sv.',
          range: 'Styr även språket i dessa hjälppaneler.',
        },
        {
          metric: 'Inställningar',
          meaning: 'Aviseringar och standardvärden.',
          howMeasured: 'Per-användare-växlar.',
          range: 'Justera för att minska bruset.',
        },
      ],
    },
  },

  'api-costs': {
    en: {
      whatItIs:
        'A unified view of what the platform spends on external APIs for you — AI engines, SERP providers, and your credit ledger — for the current month.',
      why: 'AI/SERP calls cost real money per request. This makes the spend visible per provider so nothing surprises you at month-end.',
      inputs: 'Logged costs per AI provider call, SERP provider usage, and credit grants/usage.',
      outputs:
        'Total spend, per-provider breakdown (calls + cost), SERP utilization vs. limits, and the credit ledger.',
      metrics: [
        {
          metric: 'Total spend',
          meaning: 'All external API cost this month.',
          howMeasured: 'Sum of AI + SERP costs in the period.',
          range: 'Watch the monthly trend, not just today.',
        },
        {
          metric: 'Per-provider cost',
          meaning: 'What each engine/provider costs.',
          howMeasured: 'Summed from logged per-call costs.',
          range: 'Spot the expensive providers.',
        },
        {
          metric: 'SERP utilization',
          meaning: 'Free-tier / cap usage.',
          howMeasured: 'Calls used ÷ provider limit.',
          range: 'Near 100% = throttle or upgrade.',
        },
        {
          metric: 'Credit ledger',
          meaning: 'Credits purchased/used/left.',
          howMeasured: 'From the credit system.',
          range: 'Cross-check against spend.',
        },
      ],
    },
    it: {
      whatItIs:
        'Una vista unificata di quanto la piattaforma spende in API esterne per te — motori AI, provider SERP e il tuo registro crediti — per il mese corrente.',
      why: 'Le chiamate AI/SERP costano denaro reale per richiesta. Questo rende la spesa visibile per provider così niente ti sorprende a fine mese.',
      inputs:
        "I costi registrati per chiamata a provider AI, l'uso dei provider SERP e gli accrediti/consumi.",
      outputs:
        'Spesa totale, dettaglio per provider (chiamate + costo), utilizzo SERP vs limiti e il registro crediti.',
      metrics: [
        {
          metric: 'Spesa totale',
          meaning: 'Tutto il costo API esterne del mese.',
          howMeasured: 'Somma dei costi AI + SERP nel periodo.',
          range: 'Guarda il trend mensile, non solo oggi.',
        },
        {
          metric: 'Costo per provider',
          meaning: 'Quanto costa ogni motore/provider.',
          howMeasured: 'Sommato dai costi per-chiamata registrati.',
          range: 'Individua i provider costosi.',
        },
        {
          metric: 'Utilizzo SERP',
          meaning: 'Uso del tier gratuito / cap.',
          howMeasured: 'Chiamate usate ÷ limite provider.',
          range: 'Vicino al 100% = limita o aggiorna.',
        },
        {
          metric: 'Registro crediti',
          meaning: 'Crediti acquistati/usati/rimasti.',
          howMeasured: 'Dal sistema crediti.',
          range: 'Confronta con la spesa.',
        },
      ],
    },
    sv: {
      whatItIs:
        'En enhetlig vy över vad plattformen spenderar på externa API:er åt dig — AI-motorer, SERP-leverantörer och din kreditlogg — för innevarande månad.',
      why: 'AI-/SERP-anrop kostar riktiga pengar per förfrågan. Det här gör utgiften synlig per leverantör så inget överraskar dig vid månadsslut.',
      inputs:
        'Loggade kostnader per AI-leverantörsanrop, SERP-leverantörsanvändning och kredittilldelningar/-användning.',
      outputs:
        'Total utgift, uppdelning per leverantör (anrop + kostnad), SERP-utnyttjande mot gränser och kreditloggen.',
      metrics: [
        {
          metric: 'Total utgift',
          meaning: 'All extern API-kostnad denna månad.',
          howMeasured: 'Summan av AI- + SERP-kostnader i perioden.',
          range: 'Bevaka månadstrenden, inte bara idag.',
        },
        {
          metric: 'Kostnad per leverantör',
          meaning: 'Vad varje motor/leverantör kostar.',
          howMeasured: 'Summerat från loggade kostnader per anrop.',
          range: 'Hitta de dyra leverantörerna.',
        },
        {
          metric: 'SERP-utnyttjande',
          meaning: 'Användning av gratisnivå / tak.',
          howMeasured: 'Använda anrop ÷ leverantörsgräns.',
          range: 'Nära 100% = strypa eller uppgradera.',
        },
        {
          metric: 'Kreditlogg',
          meaning: 'Krediter köpta/använda/kvar.',
          howMeasured: 'Från kreditsystemet.',
          range: 'Stäm av mot utgiften.',
        },
      ],
    },
  },

  'aeo-snippets': {
    en: {
      whatItIs:
        'Answer-ready snippets — concise, structured Q&A blocks generated for your brand that AI engines can lift verbatim into their answers.',
      why: 'Engines cite content that directly answers the question in a clean, liftable format. These snippets are built to be that source.',
      inputs:
        'Your brand, key topics/prompts, and the gaps found in monitoring; sent to the generator.',
      outputs: 'A library of Q&A snippets with schema markup you can publish on your site.',
      metrics: [
        {
          metric: 'Snippet',
          meaning: 'A liftable question + concise answer.',
          howMeasured: 'Generated from your topics/gaps.',
          range: 'Publish where engines crawl it.',
        },
        {
          metric: 'Schema markup',
          meaning: 'Machine-readable Q&A.',
          howMeasured: 'schema.org FAQ/QA JSON-LD attached.',
          range: 'Improves how engines parse/cite it.',
        },
        {
          metric: 'Coverage',
          meaning: 'Topics with a snippet vs. gaps.',
          howMeasured: 'Snippets ÷ target questions.',
          range: 'Fill the gaps that monitoring shows you lose.',
        },
        {
          metric: 'Status',
          meaning: 'Draft vs. published.',
          howMeasured: 'Tracked per snippet.',
          range: 'Only published snippets can earn citations.',
        },
      ],
    },
    it: {
      whatItIs:
        'Snippet pronti per le risposte — blocchi Q&A concisi e strutturati, generati per il tuo brand, che i motori AI possono inserire testualmente nelle loro risposte.',
      why: 'I motori citano contenuti che rispondono direttamente alla domanda in un formato pulito e prelevabile. Questi snippet sono fatti per essere quella fonte.',
      inputs:
        'Il tuo brand, argomenti/prompt chiave e le lacune trovate nel monitoraggio; inviati al generatore.',
      outputs: 'Una libreria di snippet Q&A con markup schema da pubblicare sul tuo sito.',
      metrics: [
        {
          metric: 'Snippet',
          meaning: 'Una domanda + risposta concisa prelevabile.',
          howMeasured: 'Generato dai tuoi argomenti/lacune.',
          range: 'Pubblicalo dove i motori lo scansionano.',
        },
        {
          metric: 'Markup schema',
          meaning: 'Q&A leggibile dalle macchine.',
          howMeasured: 'JSON-LD schema.org FAQ/QA allegato.',
          range: 'Migliora come i motori lo interpretano/citano.',
        },
        {
          metric: 'Copertura',
          meaning: 'Argomenti con snippet vs lacune.',
          howMeasured: 'Snippet ÷ domande target.',
          range: 'Colma le lacune dove il monitoraggio mostra che perdi.',
        },
        {
          metric: 'Stato',
          meaning: 'Bozza vs pubblicato.',
          howMeasured: 'Tracciato per snippet.',
          range: 'Solo gli snippet pubblicati possono guadagnare citazioni.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Svarsfärdiga snuttar — koncisa, strukturerade fråga-svar-block som genereras för ditt varumärke och som AI-motorer kan lyfta ordagrant in i sina svar.',
      why: 'Motorer citerar innehåll som direkt besvarar frågan i ett rent, lyftbart format. Dessa snuttar är byggda för att vara den källan.',
      inputs:
        'Ditt varumärke, nyckelämnen/prompts och luckorna från övervakningen; skickas till generatorn.',
      outputs: 'Ett bibliotek av fråga-svar-snuttar med schema-märkning att publicera på din sajt.',
      metrics: [
        {
          metric: 'Snutt',
          meaning: 'En lyftbar fråga + koncist svar.',
          howMeasured: 'Genererad från dina ämnen/luckor.',
          range: 'Publicera där motorer crawlar den.',
        },
        {
          metric: 'Schema-märkning',
          meaning: 'Maskinläsbar fråga-svar.',
          howMeasured: 'schema.org FAQ/QA JSON-LD bifogad.',
          range: 'Förbättrar hur motorer tolkar/citerar den.',
        },
        {
          metric: 'Täckning',
          meaning: 'Ämnen med snutt vs luckor.',
          howMeasured: 'Snuttar ÷ målfrågor.',
          range: 'Fyll luckorna där övervakningen visar att du förlorar.',
        },
        {
          metric: 'Status',
          meaning: 'Utkast vs publicerad.',
          howMeasured: 'Spåras per snutt.',
          range: 'Endast publicerade snuttar kan förtjäna citeringar.',
        },
      ],
    },
  },

  org: {
    en: {
      whatItIs:
        'Your organization — its workspaces, members and their roles, plus the audit log of who did what.',
      why: 'It controls who can see and change what. Correct roles keep client data isolated and changes accountable.',
      inputs: 'Members you invite, the role you assign each, and the workspaces you create.',
      outputs: 'The member list with roles, workspace structure, and an exportable audit trail.',
      metrics: [
        {
          metric: 'Member',
          meaning: 'A person with access.',
          howMeasured: 'Invited by email; bound on accept.',
          range: 'Remove leavers promptly.',
        },
        {
          metric: 'Role',
          meaning: 'What a member can do.',
          howMeasured: 'owner / admin / member permission matrix.',
          range: 'Grant the least role that works.',
        },
        {
          metric: 'Workspace',
          meaning: 'An isolated group of brands.',
          howMeasured: 'Brands + members scoped to it.',
          range: 'Separate clients/teams here.',
        },
        {
          metric: 'Audit log',
          meaning: 'Who did what, when.',
          howMeasured: 'Each sensitive action recorded (actor, IP, time).',
          range: 'Owner/admin only; export for compliance.',
        },
      ],
    },
    it: {
      whatItIs:
        'La tua organizzazione — i suoi workspace, i membri e i loro ruoli, più il log di audit di chi ha fatto cosa.',
      why: 'Controlla chi può vedere e modificare cosa. Ruoli corretti tengono isolati i dati dei clienti e tracciabili le modifiche.',
      inputs: 'I membri che inviti, il ruolo che assegni a ciascuno e i workspace che crei.',
      outputs:
        'La lista membri con i ruoli, la struttura dei workspace e una traccia di audit esportabile.',
      metrics: [
        {
          metric: 'Membro',
          meaning: 'Una persona con accesso.',
          howMeasured: "Invitata via email; vincolata all'accettazione.",
          range: 'Rimuovi subito chi esce.',
        },
        {
          metric: 'Ruolo',
          meaning: 'Cosa può fare un membro.',
          howMeasured: 'Matrice permessi owner / admin / member.',
          range: 'Concedi il ruolo minimo che funziona.',
        },
        {
          metric: 'Workspace',
          meaning: 'Un gruppo isolato di brand.',
          howMeasured: 'Brand + membri ad esso vincolati.',
          range: 'Separa qui clienti/team.',
        },
        {
          metric: 'Log di audit',
          meaning: 'Chi ha fatto cosa, quando.',
          howMeasured: 'Ogni azione sensibile registrata (attore, IP, ora).',
          range: 'Solo owner/admin; esporta per compliance.',
        },
      ],
    },
    sv: {
      whatItIs:
        'Din organisation — dess arbetsytor, medlemmar och deras roller, plus revisionsloggen över vem som gjorde vad.',
      why: 'Den styr vem som kan se och ändra vad. Rätt roller håller kunddata isolerad och ändringar spårbara.',
      inputs:
        'Medlemmarna du bjuder in, rollen du tilldelar var och en, och arbetsytorna du skapar.',
      outputs: 'Medlemslistan med roller, arbetsytestrukturen och ett exporterbart revisionsspår.',
      metrics: [
        {
          metric: 'Medlem',
          meaning: 'En person med åtkomst.',
          howMeasured: 'Inbjuden via e-post; bunden vid accept.',
          range: 'Ta bort de som slutar direkt.',
        },
        {
          metric: 'Roll',
          meaning: 'Vad en medlem får göra.',
          howMeasured: 'Behörighetsmatris owner / admin / member.',
          range: 'Ge den lägsta roll som fungerar.',
        },
        {
          metric: 'Arbetsyta',
          meaning: 'En isolerad grupp av varumärken.',
          howMeasured: 'Varumärken + medlemmar bundna till den.',
          range: 'Separera kunder/team här.',
        },
        {
          metric: 'Revisionslogg',
          meaning: 'Vem gjorde vad, när.',
          howMeasured: 'Varje känslig åtgärd loggad (aktör, IP, tid).',
          range: 'Endast owner/admin; exportera för efterlevnad.',
        },
      ],
    },
  },
}
