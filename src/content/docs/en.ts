// PATH: src/content/docs/en.ts
//
// English in-app documentation. Mirrors docs/features/ (the source of truth for
// feature behaviour) and NAV_SECTIONS (the source of truth for what is
// reachable). When a feature changes, update the archive file first, then this
// content, then it.ts and sv.ts — the three locale files must keep identical
// group ids and section ids.

import type { DocContent } from './types'

export const docsEn: DocContent = [
  {
    id: 'getting-started',
    group: 'Getting Started',
    icon: 'start',
    sections: [
      {
        id: 'what-is-aeo-pulse',
        title: 'What is AEO Pulse?',
        content: `AEO Pulse is an AI search visibility platform. It monitors how your brand appears when people ask AI assistants about products and services in your industry.

Traditional SEO tracks your position on Google. AEO Pulse tracks something different: whether AI assistants name your brand when someone asks "which second-hand marketplace should I use?" or "what's the best accounting firm in Falun?"

This matters because a growing share of buying research now happens in an AI assistant instead of a search results page. If the assistant does not mention you, you are invisible to that demand — and unlike a Google ranking, there is no results page where you can see yourself at position 11.

The platform answers four questions:

• Visibility — how often and how prominently you appear across AI answers.
• Comparison — whether the engines prefer your competitors, and by how much.
• Accuracy — what the engines actually say about you, and whether it is true.
• Action — what to change, in priority order, and what it should move.`,
      },
      {
        id: 'key-concepts',
        title: 'Key concepts',
        content: `Learn these eight terms and the rest of the product reads itself.

• AVI (AI Visibility Index) — a 0-100 composite score. The single number to watch day to day.
• GEO Score — a 0-100 composite with a letter grade (A-F) measuring how well you are built to be cited. AVI is the result; GEO Score is the capability behind it.
• Citation rate — the share of monitored answers that name your brand. Mentions ÷ total responses × 100.
• Mention position — which sentence you first appear in. Sentence 1 is best; later means the reader may never reach you.
• Sentiment — the tone of an answer about you: positive, neutral or negative, scored -1.0 to +1.0.
• Engine — one AI platform: ChatGPT, Gemini or Perplexity.
• Prompt — a question we send to the engines on your behalf, standing in for a real customer question.
• Snapshot — the daily aggregate of a day's monitoring results. Every trend chart in the product reads snapshots, not raw responses.

Two distinctions cause most confusion, so they are worth stating plainly:

• Mentioned is not cited. A mention is the engine saying your name. A citation is the engine linking your domain as the source. Mentions are reach; citations are trust.
• Coverage is not weight. "In how many answers do you appear at all" and "what share of all brand mentions are yours" are different measurements, and a competitor can beat you on one while losing badly on the other.`,
      },
      {
        id: 'quick-start',
        title: 'Quick start',
        content: `Five steps from an empty account to real data.

Step 1 — Add your brand. Setup → Brands. Name, domain, aliases, competitors, industry, locale, brand colour.

Step 2 — Create prompts. Setup → Prompts, then "Generate (AI)" to expand your brand and industry into ready questions, or write your own. Aim for 30-50 prompts spread across local, national and category intent.

Step 3 — Run the first check. Monitor → Live Monitoring. You can also let the schedule pick it up: monitoring runs automatically three times a day.

Step 4 — Read the result. Overview gives you the headline numbers. Insights → Citations, Sentiment and Competitor break them down.

Step 5 — Act. Optimize → Strategy Advisor for the ranked narrative, Recommendations for the persistent list, Site Audit for what to fix on the site itself.

If you would rather be walked through steps 1-3, use Setup → Start Here. It is the same work in a guided wizard and it ends by launching your first scan.`,
      },
      {
        id: 'first-brand-setup',
        title: 'Your first brand, field by field',
        content: `Every brand field feeds something specific. Getting these right at the start saves re-measuring later.

• Brand name — the official name as it should appear in answers. Used for exact-match detection.
• Domain — your primary site. Used to detect when an engine cites you as a source rather than just naming you.
• Aliases — alternative spellings, spacings and accent variants. Critical outside English, where engines vary capitalisation and diacritics freely. A missing alias reads as a missing mention.
• Competitors — your real rivals, 3-5 of them. Drives every comparative panel in the product.
• Industry / preset — sector classification. Drives prompt generation and the recommendation rules.
• Locale — your market language. A Swedish brand needs Swedish prompts to appear in Swedish answers; setting this wrong measures the wrong market.
• Description — a short paragraph on what you do. Used as context when scoring sentiment and checking accuracy.
• Brand colour — used in charts and in exported PDF reports.

The field that most often needs correcting later is Competitors. The engines will compare you to whoever they think you compete with, not to the list you configured — and Insights → Competitor reports the rivals it discovered outside your configuration. When that discovered list disagrees with your configured one, trust the discovered list and update the configuration.`,
      },
    ],
  },

  {
    id: 'overview',
    group: 'Overview',
    icon: 'overview',
    sections: [
      {
        id: 'dashboard-page',
        title: 'The dashboard',
        content: `The landing page after login. It pulls one headline number from each Insights surface so you can see in a glance whether anything moved, then click into the surface that owns the detail.

It deliberately owns no data of its own. Every number here comes from the same place the dedicated page reads. If a number here disagrees with its own page, trust the page.

Each card loads independently, so a slow or failing source degrades one card rather than the whole screen. During a monitoring run one card can show new data while its neighbour still shows the previous value — refresh to settle them.`,
      },
      {
        id: 'reading-kpis',
        title: 'Reading the headline numbers',
        content: `Four numbers carry most of the meaning, and each has a common misreading worth avoiding.

• AVI — your visibility today. Read the period, not the day: with roughly 30 answers a day and engines that are not deterministic, a single day swinging 20 points is normal noise, not a collapse.
• GEO Score with its letter grade — your capability. A low grade next to a healthy AVI means you are performing above your structure, which is good news: structure is the part you can rebuild.
• Citation rate — how often you are named. Rising citation rate with flat sentiment means more reach, not more preference.
• Sentiment split — positive / neutral / negative. Zero negatives is protection, not victory. A large neutral share means you are being listed among alternatives rather than recommended, and the next goal is moving from mentioned to recommended.

The one thing no single number tells you is whether the engines describe you correctly. That lives in Insights → Sentiment and in the response text itself.`,
      },
    ],
  },

  {
    id: 'setup',
    group: '1 · Setup',
    icon: 'setup',
    sections: [
      {
        id: 'onboarding-wizard',
        title: 'Start Here — the guided wizard',
        content: `A four-step wizard that takes a new account from empty to a running scan without leaving the page: welcome and interface language, brand, prompts, launch.

You cannot skip forward past an incomplete step — the brand step needs a valid brand, the prompts step needs at least one prompt — but you can go back to anything already completed.

Two things to know. The wizard does not resume across a page reload: rows already created persist, so if you reload after the brand step you will find the brand waiting for you under Setup → Brands. And the language you pick in step 1 is the interface language, not the brand's market language — those are set separately, and the brand's locale is what determines prompt language.`,
      },
      {
        id: 'brands-aliases',
        title: 'Brands and alias detection',
        content: `Detection is exact and word-bounded, by design. The matcher looks for whole words, not substrings, because substring matching produced real false positives — "Acast" matching "Acasting", two unrelated companies.

That precision is why aliases matter so much. Every spelling an engine might use needs to be listed, or the mention is not counted:

• Case and spacing variants — "Ekonomirådgivarna", "Ekonomi Rådgivarna", "ekonomi radgivarna".
• Accent-stripped forms, which engines produce constantly for Nordic and Romance names.
• Abbreviations and the legal-entity form if either appears in the market.

A citation rate that looks impossibly low is an alias problem far more often than a visibility problem. Check the response text on Insights → Citations before concluding you are absent.`,
      },
      {
        id: 'competitors-setup',
        title: 'Competitor configuration',
        content: `The competitors you configure define every comparative panel: share of voice, benchmark rates, gap analysis.

Configure 3-5 real rivals — the ones a customer would actually weigh you against, not the ones in your category on paper. This distinction has practical consequences: a brand positioned as one thing but operating as another ends up measured against the wrong market, and every comparison in the product inherits that error.

Adding a competitor does not backfill history. Its series starts the day you added it, so a newly configured rival appears to come from nowhere. Add them early.

Insights → Competitor reports discovered entities — brands the engines mention that you never configured. Treat that list as the correction to your configuration.`,
      },
      {
        id: 'prompts',
        title: 'Prompts — what to ask',
        content: `A prompt is a customer question you want to be the answer to. Good prompts are specific, in your market language, and phrased the way a person actually types.

Write for intent, not for keywords:

• Category intent — "which platforms sell second-hand electronics in Sweden?"
• Local intent — "best accounting firm in Falun".
• Comparison intent — "X or Y for a small business?"
• Problem intent — "how do I check the condition of a used phone before buying?"

Avoid prompts that name only your brand. "Is Relovie good?" will mention you every time and teaches you nothing; it inflates your mention rate and hides whether you appear when the customer does not already know you.

30-50 prompts is a working portfolio. Fewer than 20 and daily numbers become too noisy to read.`,
      },
      {
        id: 'prompt-generator',
        title: 'Generating prompts with AI',
        content: `Setup → Prompts → "Generate (AI)" expands your brand name, industry preset and optional location into 20-30 concrete prompts.

It works from industry presets with localised templates per intent bucket, filling placeholders — brand, competitor, category, role, location, year — combinatorially. The output is a starting portfolio, not a finished one: read it, delete what does not match how your customers speak, and add the questions only you know they ask.

The same engine runs inside the Start Here wizard, so prompts created there and here are identical in kind.`,
      },
    ],
  },

  {
    id: 'monitor',
    group: '2 · Monitor',
    icon: 'monitor',
    sections: [
      {
        id: 'how-monitoring-works',
        title: 'How monitoring works',
        content: `Each prompt is sent to each selected engine as a fresh question, with no memory of previous runs and no hint that a brand is being measured. The answer is then analysed for four things: whether you were named, where in the answer, in what tone, and which sources were cited.

The results go into two layers, and knowing which one a chart reads explains most apparent contradictions:

• Raw responses — one row per prompt per engine per run, with the full answer text. This is what CSV exports read.
• Daily snapshots — one aggregated row per engine, category and language per day. This is what every trend chart reads.

Because the two layers aggregate differently, an exported CSV and an on-screen trend for the same period can disagree slightly. That is the aggregation boundary, not an error in either.

Engines are not deterministic. The same prompt can return a different answer an hour later, which is why a single run is weak evidence and a period is strong evidence.`,
      },
      {
        id: 'supported-engines',
        title: 'Supported engines',
        content: `Three engines are monitored, and they behave differently enough that per-engine numbers matter more than the average.

• ChatGPT — typically the strongest mention rate. Rewards structured comparisons, lists and decision frameworks.
• Perplexity — typically the earliest mention position, because it is built around citing sources in the body of the answer. Rewards fact-dense content with inline links.
• Gemini — typically the weakest mention rate, and the most sensitive to authority signals: who wrote this, when, and is it marked up machine-readably.
Claude was retired on cost: it accounted for 65% of provider spend for 10% of the runs, and on a 427-result brand it produced 4 usable results. Its historical measurements stay in the database and in the raw export, but it is no longer called and no longer appears in per-engine breakdowns or client reports.

If one engine lags badly while the others are healthy, the cause is usually structural rather than a visibility problem in general. A Gemini gap in particular points at missing authorship, dates and schema markup — see Optimize → Site Audit.`,
      },
      {
        id: 'schedules',
        title: 'What runs, and when',
        content: `Monitoring runs automatically three times a day; the rest of the platform's background work runs on its own schedule. All times are UTC.

• Monitoring — 06:00, 12:00 and 18:00, every day.
• Report delivery — every 6 hours, sending any schedule that has come due.
• GSC sync — 03:00 daily.
• External data sync — 04:00 daily.
• AEO snippet bridge — 07:00 daily.
• Weekly review — Mondays 07:00.
• Digest email — Mondays 08:00.
• Keyword refresh — Mondays 06:00.
• GEO analysis — Mondays 05:00.

A first full pass usually completes within 24 hours of creating a brand. You can always trigger a run manually from Monitor → Live Monitoring rather than waiting.`,
      },
      {
        id: 'workflows',
        title: 'Workflows — did the background work run?',
        content: `Workflows is the execution log for background jobs. When a number looks stale, this is the page that tells you whether the job that produces it ran, failed, or never started.

Check it before investigating data: an empty panel elsewhere in the product is very often a job that did not run rather than a brand with nothing to report. The two look identical everywhere except here.`,
      },
      {
        id: 'alerts',
        title: 'Alerts and webhooks',
        content: `Alert rules notify you when something moves without you looking. Typical triggers are a visibility drop, a competitor overtaking you, an accuracy problem, or a citation disappearing.

Delivery is by email or webhook. Recipients live with the rule itself, not in Settings — that changed, and Settings no longer holds an alert email field.

A webhook receives a JSON payload identifying the brand, the rule that fired, the observed value against the threshold, and a timestamp. Point it at whatever you already use for operational notifications.

Alerts tell you something changed. They do not tell you why — that is what the Insights surfaces are for.`,
      },
    ],
  },

  {
    id: 'insights',
    group: '3 · Insights',
    icon: 'insights',
    sections: [
      {
        id: 'geo-score',
        title: 'GEO Score and its five pillars',
        content: `A 0-100 composite with a letter grade, measuring how well you are built to be found and cited by generative engines. It is a weighted average of five pillars:

• Citations — 30%. Do the engines link your domain as a source, not just name you? Almost always the weakest pillar and always the highest-leverage one.
• Presence — 25%. How often you are mentioned at all.
• Authority — 20%. How often you are actively recommended rather than listed.
• Position — 15%. How early in the answer you appear.
• Trust — 10%. Sentiment, rescaled to 0-100.

Read the grade as a starting point, not a verdict. A D with a healthy AVI means the results are ahead of the structure — and the two lowest-weighted-by-score pillars, Citations and Position, are precisely the two that respond fastest to work on the site.

The pillars need monitoring data. A brand with no runs returns no score and an explanatory empty state rather than a zero.`,
      },
      {
        id: 'fan-out',
        title: 'Query Fan-out — what the engines actually search',
        content: `When a question depends on what is true right now, an engine does not answer from memory. It turns your question into one to three real web searches and synthesises what it finds. Those search strings — not your prompt — are what you compete for.

They are rarely the same thing. A real measurement from 19 August 2026: the prompt "Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?" made Gemini search "basta sajter begagnad elektronik sverige" and "kop begagnad elektronik garanti sverige". The accents are gone, the year is gone, one question became two searches, and a concept the prompt never contained — warranty — was added.

The practical consequence: a page tuned to the wording of your prompt is tuned to a string nobody searched. The Drift column measures that distance, so a high number tells you where the page and the search have come apart.

What the page shows:

• Coverage — how many runs carried a fan-out at all. Two numbers are kept apart on purpose: not captured means we could not see the searches, and answered without searching means the engine used model memory instead of the live web. Treating the first as zero searches would be a lie about the engine.
• Searches per run — how far one question expands. Typically one to three.
• The ranking — every search string, how often it ran, on which engines, how often you were mentioned and cited when it ran, and which of your prompts triggered it.

The ranking puts volume first and then the weakest mention rate, so the searches the engines run constantly and where you are absent sit at the top. That is the work list.

One honest limit: Perplexity does not expose the searches it runs. Its answers are measured normally everywhere else in the product, but it cannot contribute here, and its runs are counted as not captured rather than as zero.

Capture began on 19 August 2026. Runs from before that date have no fan-out and cannot be recovered.`,
      },
      {
        id: 'citations-rate',
        title: 'Citations — the rate over time',
        content: `Citation rate is the share of answers that name you, charted over time as an all-engines trend plus a per-engine breakdown, with your competitors' rates on the same axis.

This page answers how often. Citation Sources answers by whom. They read different fields and will not match.

The two AI-readiness panels on this page — crawler access and citation capture — are here on purpose: a citation rate near zero is most often a crawler-access problem, and the answer belongs next to the symptom.

Competitor rates only cover competitors you configured. A rival the engines mention but you never listed does not appear here at all.`,
      },
      {
        id: 'citation-sources',
        title: 'Citation Sources — which domains get cited',
        content: `The ranked list of domains the engines cite when answering your prompts, including your own.

Being the most-cited domain in your market is a strong position, and it is compatible with a weak Citations pillar in the GEO Score: the ranking compares you to others, the pillar measures how often a citation accompanies a mention. You can lead the comparison while still failing to convert most mentions into links.

The source mix is itself a finding. Commercial sites dominating means the engines are drawing on places where buying happens; forums and communities appearing means user opinion is shaping your description; news media being absent means press coverage is not reaching the engines.`,
      },
      {
        id: 'sentiment',
        title: 'Sentiment, aspects, sources and themes',
        content: `Four views of what the engines say about you.

• Average sentiment — the positive / neutral / negative split for the period.
• Aspects — sentiment resolved per topic (price, service, quality) rather than per answer, so "good overall but weak on price" stays visible instead of averaging away.
• Sentiment by source — the same split grouped by the domain the engine cited. This is what shows whether a negative tone traces back to a single third-party page.
• Themes — semantic clusters of the answer text, so recurring narratives surface without anyone reading hundreds of answers.

There is also a manual analyser: paste any text and get the same classification. It is deliberately stateless — nothing is saved and no score is affected.

Aspect labels come from the model, not a fixed list, so they drift over long periods and are not safe as permanent chart categories.`,
      },
      {
        id: 'brand-overview-gsc',
        title: 'Brand Overview — the Search Console bridge',
        content: `The per-brand performance view, and the only place in the product showing Google Search Console data. That makes it where you can ask whether AI exposure is driving branded search or quietly eating your organic clicks.

Two panels exist nowhere else:

• Striking distance — queries ranking just below the fold, where a small content fix converts directly into traffic.
• Cannibalisation — several of your URLs competing for one query and splitting the authority between them.

Both need a connected Search Console property. Without one they render empty, and the cause is a missing integration rather than missing performance.`,
      },
      {
        id: 'aeo-snippets',
        title: 'AEO Snippets',
        content: `Answer-ready question-and-answer pairs derived from what people actually ask, formatted so an engine can lift them as a direct answer.

The point is extractability. An engine quoting your answer verbatim is the strongest citation you can get, and it depends on the answer being the first thing in the block, self-contained, and marked up machine-readably.

Snippets also export as schema markup for your own pages, which feeds the structured-data signal measured in Site Audit.`,
      },
      {
        id: 'keywords',
        title: 'Keyword tracking',
        content: `The words that recur in answers where you are mentioned, tracked over time and correlated with mentions.

Read it as vocabulary, not as an SEO keyword list. What the language tells you is what conversation you are in: purchase words mean you are surfacing in buying decisions, and category words that do not match your positioning mean the engines have you filed under the wrong thing.

Competitor names appearing high in the list is normal and useful — it confirms who you are actually being compared against.`,
      },
      {
        id: 'competitor-sov',
        title: 'Competitor — share of voice and discovered rivals',
        content: `Two measurements on one page, and confusing them is the single easiest way to misread the product.

• Share of voice — of all brand mentions across the answers, what share is yours. This is weight.
• Co-mention rate — in what share of answers each competitor appears alongside you. This is coverage.

A competitor can appear in more answers than you while holding a much smaller share of voice, because you are named more often and earlier within the answers you do appear in. Both numbers are correct; they measure different things. Coverage is reach, weight is prominence.

Discovered entities are brands the engines mention that are not in your configuration. That list is how a wrong competitive set gets found and fixed.

Competitor analysis is the one billed action here: it calls a model and stores the result. Share of voice is computed from data you already have and costs nothing.`,
      },
      {
        id: 'snapshots',
        title: 'Snapshots — the aggregation layer',
        content: `Snapshots turn raw answers into the daily series every trend chart reads: one row per engine, category and language per day, holding your citation rate and each configured competitor's rate for that slice.

This layer is load-bearing. If a trend looks wrong, check here before suspecting the chart.

Recomputing a day is safe and repeatable. A day with no monitoring runs produces no row at all rather than a zero — so a gap in a chart means no data, not a drop to nothing.`,
      },
      {
        id: 'ai-funnel',
        title: 'AI Funnel — the client-ready narrative',
        content: `The presentation surface. Where the other Insights pages each own one metric, this arranges them into a funnel you can walk top to bottom in a meeting.

• Top — visibility and share of voice: the number that opens the conversation.
• Middle — real AI responses, verbatim, with your brand highlighted. This is the stage that persuades: percentages are abstract, an engine describing your company in its own words is not.
• Bottom — branded search growth, the AI-assist verdict, and citation freshness for the pages the engines actually pull.

Three exports: an executive summary built on four questions (where do we appear, how accurately are we described, are we winning or losing, are business objectives improving), a tiered client deck, and a six-month trend.

The bottom stage needs Search Console data. Without it the most client-relevant part of the funnel renders empty.`,
      },
      {
        id: 'reports',
        title: 'Reports and scheduled delivery',
        content: `Two separate things on one page: exporting now, and scheduling delivery.

Export now produces CSV, JSON or PDF for a brand and an optional date range. The PDF carries white-label branding — your colour, logo and client name — so it can go to a client without editing.

Scheduled delivery emails a report daily, weekly or monthly to up to 20 recipients. The schedule records when it last sent, how many times, and the last error, so a schedule that has been quietly failing is diagnosable from the list.

Two cautions. Nothing alerts you when a schedule fails — the error is recorded, not announced. And exports read raw responses rather than daily snapshots, so an exported CSV can differ slightly from an on-screen trend for the same period.`,
      },
      {
        id: 'scan-history',
        title: 'Scan History',
        content: `The log of one-off analyses you ran from Content Audit and Content Optimizer against a pasted text or a URL. It is not the history of scheduled brand monitoring — that lives in Monitor and in the snapshot trends.

Entries carry a score, the source, whether the input was text or a URL, the engine and model used, and a timestamp, with search, filtering and CSV or JSON export.

Two limits worth knowing: the list holds the 50 most recent entries, and "clear history" empties the view without deleting anything on the server — reload and the entries return.`,
      },
    ],
  },

  {
    id: 'optimize',
    group: '4 · Optimize',
    icon: 'optimize',
    sections: [
      {
        id: 'strategy-advisor',
        title: 'Strategy Advisor',
        content: `Synthesises everything measured in Insights into a prioritised narrative, grounded in your live brand data rather than in generic advice.

Use it when you want the argument — why this action before that one, and what it should move. Use Recommendations when you want the persistent list to work through.

Where an action carries an expected point gain, that figure is a model estimate anchored to the GEO Score weights. It is sound for deciding order of work. It is not a guarantee, and it should never be presented to a client as one.`,
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        content: `The persistent action list. Generated recommendations are stored with the data window they came from, so you can always see what was advised, when, and on what basis.

Each carries a priority of high, medium or low, plus a rationale and concrete actions. The priority is assigned by the model, so two generations over the same data can order the same action differently — treat it as guidance rather than a stable ranking.

Generating again does not replace the previous set; it adds to the history. Nothing merges or supersedes, so the list grows and older entries stay visible as a record.

The weekly review pairs what was recommended against what actually moved.`,
      },
      {
        id: 'content-audit',
        title: 'Content Audit — any URL, two audits',
        content: `A full readiness audit of a single URL. Two independent audits run against the same address: a content analysis of how citable the page is, and a deterministic technical audit.

The technical audit checks transport (HTTPS, mixed content, response size, time to first byte), indexing (title, meta description, robots, canonical, hreflang), Core Web Vitals, and AI citability.

Two of those checks exist specifically for AI engines rather than classic SEO: whether comparison tables are extractable, because engines lift them verbatim, and whether the page carries a last-updated signal, because engines down-weight content with no freshness marker.

The two audits produce separate scores and nothing reconciles them, so you can see a strong content score next to a weak technical one. Fix the technical failures first — they gate everything else.

Core Web Vitals here are lab measurements from a single fetch. They will not match field data a client quotes from Search Console.`,
      },
      {
        id: 'content-optimizer',
        title: 'Content Optimizer and the five citation signals',
        content: `The drill-down tool. Paste text or point at a URL, choose provider, model and target engine, and get an editable breakdown of why the content scores what it scores: intent classification, per-engine breakdown, keyword density, and expandable suggestions.

Its Citation Quality card is the important part, and it is deterministic — pure heuristics over the HTML and text, no model call, so the same input always gives the same score. It measures five signals with observed citation lift:

• Clarity and summarisation — +33%.
• E-E-A-T signals, meaning visible authorship, credentials and dates — +30%.
• Question-and-answer format — +25%.
• Section structure — +23%.
• Structured data — +22%.

Secondary shape heuristics come from featured-snippet research: low reading level, alt-text density, lists of at least 8 items, tables of at least 5 rows and 7 columns, at least 10 outbound links. The content shape that wins Google featured snippets also wins AI citations.

Note that the two scores on this page behave differently: the overall analysis comes from a model and varies between runs on identical input, while Citation Quality does not. If a number changes when you changed nothing, it was the model-based one.

The percentages are correlations from a large study, not causal promises for one page. Use them to prioritise, not to guarantee.`,
      },
      {
        id: 'site-audit',
        title: 'Site Audit — is my brand AI-ready?',
        content: `The consolidated readiness check for a brand, in five panels ordered by dependency. Fix red items at the top before optimising anything below.

• Foundations — HTTPS, llms.txt, sitemap. If these fail nothing else matters.
• AI crawler access — your robots.txt read from the perspective of GPTBot, ClaudeBot, PerplexityBot, Google-Extended and the rest. Blocking them is the one mistake that makes every other effort pointless.
• Citation capture — whether your existing monitoring data shows the domain actually being cited.
• Topic Finder — your citation gaps clustered into ranked content opportunities.
• Citation Quality — your homepage scored against the five signals above.

The last panel runs only when you click Score, because it fetches your live site and firing that on every page view would hit your server silently.

It scores your homepage specifically. If your citable content lives on subpages, audit those individually in Content Audit.

There is no single "AI-ready" number here — five panels, five verdicts. The closest thing to a composite is the GEO Score, which reads different inputs and will not match panel by panel.`,
      },
      {
        id: 'content-generator',
        title: 'Content Generator',
        content: `Drafts Markdown articles built against the same five citation signals the Optimizer measures, then scores its own output with the same scorer. That closes the loop: the platform measures what gets cited and generates content shaped for it, using one definition of quality in both directions.

You choose an intent bucket and a length. Brand context is assembled from your brand record rather than retyped.

Because it scores itself with the heuristics it optimised for, a high score means "shaped the way the scorer rewards", not "verified as citable". Only monitoring can confirm the latter, weeks later.

Output is a draft. There is no fact-checking and no brand-voice enforcement beyond the prompt — edit before publishing.

Generation is rate-limited to 5 per minute per user: generous for a person, deliberately hostile to a loop.`,
      },
      {
        id: 'engine-info',
        title: 'Engine Info — provider status',
        content: `The status board for the AI providers. It answers the question that blocks everything else when it goes wrong: is monitoring failing because of our data, or because a provider key is dead?

Availability is reported in four states rather than two, because a key with an exhausted balance authenticates perfectly and then refuses every billed request:

• Configured — a key is present.
• Available — it authenticates and has credit.
• Out of credit — it authenticates but the balance is gone. Unusable.
• Credit unknown — configured and reachable, but no billed call has confirmed it yet.

Credit unknown is the honest state for a freshly added key. The platform will not claim a key works before a real call has proved it.

Despite the route name, this page is not monitoring. It runs no prompts and touches none of your data.`,
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
        title: 'Settings',
        content: `Four cards: your profile, your AI provider API keys, notification preferences, and the interface language — English, Italiano or Svenska.

Provider keys are encrypted at rest with AES-256-GCM and only ever shown masked. Once saved, a key cannot be read back, only replaced. Keys can be disabled without being deleted, which is what you want when a provider misbehaves: switch it off, keep the row, re-enable later without re-pasting the secret.

Nothing validates a key when you save it. A typo surfaces later as an unavailable provider in Engine Info, or as runs falling through to the next provider.

The interface language is separate from a brand's market language. Changing it here does not change which language your prompts are asked in.`,
      },
      {
        id: 'roles-sharing',
        title: 'Roles and shared brands',
        content: `Brand data is shared per brand, and access comes in three levels: viewer, editor and owner, in increasing order of permission.

Viewers read. Editors change configuration and trigger actions that spend money or send data outward — generating an article, creating a report schedule. Owners additionally own the brand record.

The rule to internalise: a brand's data belongs to the brand, not to whoever happened to create a row. An editor writing and a viewer reading are looking at the same data, and the record of who created something is provenance, not permission.

Actions with an outward or billed effect are gated at editor level specifically because they either cost money or send brand data to third parties.`,
      },
    ],
  },

  {
    id: 'not-enabled',
    group: 'Not enabled here',
    icon: 'disabled',
    sections: [
      {
        id: 'commercial-layer',
        title: 'Billing, Credits and API Costs',
        content: `This deployment runs in unlimited mode. The whole commercial layer is intentionally switched off:

• Every query is allowed at no cost and consumes no balance.
• The credit ledger is disabled.
• Stripe checkout is not connected.

The three pages still exist and each explains its state, so an old bookmark renders something meaningful rather than a broken checkout. None of them appear in the navigation.

Nothing was removed — the cost aggregation still works behind the scenes and provider spend remains visible in the operational logs. Re-enabling the layer is a configuration change, not a rebuild.

If you need per-feature cost, the internal feature archive under docs/features states the cost profile of every surface. With no meter exposed in the product, that archive is the cost model.`,
      },
    ],
  },

  {
    id: 'glossary',
    group: 'Glossary',
    icon: 'glossary',
    sections: [
      {
        id: 'glossary-terms',
        title: 'Terms and definitions',
        content: `• AEO — Answer Engine Optimization. Structuring content so engines can extract it as a direct answer.
• GEO — Generative Engine Optimization. The broader strategy for being visible in generated answers: depth, authority, structured data, citations.
• AVI — AI Visibility Index. A 0-100 composite; the day-to-day headline number.
• GEO Score — a 0-100 composite with a letter grade measuring how well you are built to be cited. AVI is the result, GEO Score the capability.
• Citation rate — share of monitored answers naming your brand. Mentions ÷ total responses × 100.
• Mention — an engine saying your name. Reach.
• Citation — an engine linking your domain as a source. Trust.
• Mention position — the sentence where you first appear. Lower is better.
• Share of voice — your share of all brand mentions. Weight.
• Co-mention rate — the share of answers a competitor appears in alongside you. Coverage.
• Sentiment — tone toward your brand, scored -1.0 to +1.0.
• Aspect — a specific topic within an answer that sentiment is resolved against, such as price or service.
• Hallucination — an engine stating something false about you as fact: wrong dates, invented products, fabricated awards.
• Engine — one AI platform: ChatGPT, Gemini or Perplexity.
• Prompt — a question we send to the engines standing in for a customer question.
• Snapshot — the daily aggregate of monitoring results. What every trend chart reads.
• Alias — an alternative spelling of your brand that detection must know about.
• Discovered entity — a brand the engines mention that you never configured as a competitor.
• Answer-first — writing so the first sentence contains the answer, because engines skip introductions.
• E-E-A-T — the visible signals of who stands behind the content and when it was written.
• Schema / JSON-LD — machine-readable markup telling engines what a page contains.
• llms.txt — a file presenting your brand to AI engines directly.
• Striking distance — a query ranking just below the visibility threshold, where a small fix converts to traffic.
• Cannibalisation — several of your URLs competing for one query and splitting authority.
• Role — viewer, editor or owner; what a person may do with a brand.`,
      },
    ],
  },
]
