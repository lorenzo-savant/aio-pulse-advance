// PATH: src/app/docs/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Rocket,
  LayoutDashboard,
  Building2,
  MessageSquare,
  Target,
  Globe,
  BarChart3,
  Bell,
  FileDown,
  BookOpen,
  X,
  ChevronRight,
  ArrowUp,
  ArrowLeft,
  Menu,
  LineChart,
  Gauge,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  Crown,
  Activity,
  Users,
  CreditCard,
  Code,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/Reveal'
import { Ornament } from '@/components/Ornament'
import { SiteHeader } from '@/components/SiteHeader'

interface DocSection {
  id: string
  title: string
  content: string
}

interface DocGroup {
  group: string
  icon: React.ElementType
  sections: DocSection[]
}

const DOCS: DocGroup[] = [
  {
    group: 'Getting Started',
    icon: Rocket,
    sections: [
      {
        id: 'what-is-aio-pulse',
        title: 'What is AEO Pulse?',
        content: `AEO Pulse is an AI Search Visibility Platform. It monitors how your brand appears when people query AI assistants like ChatGPT, Gemini, Perplexity, Claude, and Google AI Overviews about products and services in your industry.

Traditional SEO tracks your position on Google. AEO Pulse tracks something different: whether AI assistants recommend your brand when users ask "What's the best accounting firm in Falun?" or "Which CRM should I use for a startup?"

This matters because more people now use AI assistants instead of search engines to find services. If the AI doesn't mention your brand, you're invisible to that traffic.

AEO Pulse delivers four core insights:

• Visibility — your AVI score (0-100) tells you how often and how prominently you appear across AI responses.

• Comparison — competitive benchmarking shows whether AI engines prefer your competitors over you.

• Accuracy — sentiment + hallucination detection reveals what AI engines actually say about your brand.

• Action — recommendations and an AI-optimized content pipeline tell you exactly what to fix.`,
      },
      {
        id: 'key-concepts',
        title: 'Key Concepts',
        content: `AVI (AI Visibility Index) — A proprietary 0-100 composite score combining six weighted metrics (citation rate, mention frequency, recommendation rate, sentiment, position, hallucination index). The single metric you'll watch every day.

Citation Rate — Percentage of AI responses that mention your brand by name or domain. (Mentions ÷ Total responses) × 100.

Visibility Score — A 0-100 metric measuring how prominently you appear when mentioned. Considers position, mention count, and surrounding context.

Mention Position — Where your brand appears in an AI response. #1 = first brand mentioned (best). Higher numbers = mentioned later in the response.

Sentiment Score — Numerical tone from -1.0 (very negative) to +1.0 (very positive) of how AI engines speak about your brand.

Hallucination — A false claim an AI makes about your brand presented as fact (wrong founding year, fabricated awards, mistaken services).

Engine — A specific AI search platform: ChatGPT, Gemini, Perplexity, Claude, Google AI Overviews.

Prompt — A question sent to AI engines on your behalf to check for brand mentions. Simulates real customer queries.

AEO — Answer Engine Optimization. Optimizing snippets and structured data so AI engines extract your content as direct answers.

GEO — Generative Engine Optimization. Broader strategy to improve visibility in AI-generated answers (content depth, authority, structured data, citations).`,
      },
      {
        id: 'quick-start',
        title: 'Quick Start Guide',
        content: `Five steps to a working monitoring setup.

Step 1 — Add Your Brand
Dashboard → Brands → Add Brand. Enter brand name, domain, aliases, 3-5 main competitors, industry, and a brand color used in charts.

Step 2 — Generate or Write Prompts
Use Dashboard → Tools → Prompt Generator for AI-suggested queries, or Dashboard → Prompts → Add Prompt to write your own. Aim for 30-50 prompts split across Local, National, and Industry categories.

Step 3 — Wait for the First Scan
Scans run automatically three times a day (06:00 / 12:00 / 18:00 UTC). Your first full pass typically completes within 24 hours of brand creation.

Step 4 — Review Your AVI
Dashboard → Overview shows the four headline KPIs. Dashboard → Citations breaks them down per engine and competitor. Dashboard → Analytics gives you trend and sentiment charts.

Step 5 — Set Up Alerts and Recommendations
Dashboard → Alerts → Create Rule for email/webhook notifications on visibility drops, hallucinations, or competitor leads. Dashboard → Recommendations gives you the prioritized fix list.`,
      },
      {
        id: 'first-brand-setup',
        title: 'Your First Brand Setup',
        content: `Each brand field has a specific purpose in scoring.

Brand Name — The official name as it should appear in AI responses. Used for exact-match detection. Example: "Ekonomirådgivarna".

Domain — Your primary website. Used to detect when an AI engine cites your site directly. Example: "ekonomiradgivarna.se".

Aliases — Alternative spellings, abbreviations, or variants. Crucial for non-English brands where AI engines often vary capitalization or accents. Comma-separated. Example: "Ekonomirådgivarna, ekonomi radgivarna, Ekonomi Rådgivarna".

Competitors — Your 3-5 main competitors. Drives the Competitive Intelligence reports. Comma-separated. Example: "Fortnox, Björn Lundén, Wint".

Industry / Preset — Sector classification. Drives prompt generation, recommendation rules, and sentiment baselines. Examples: "Accounting & Financial Advisory", "Casting & Talent", "Marketing & Advertising", "SaaS".

Locale — Primary market language. Determines the language of generated prompts and how engine responses are interpreted (Swedish brand needs Swedish prompts to surface in Swedish AI responses).

Description — Short paragraph describing what you do. Used as context by the analyzer when scoring sentiment and detecting hallucinations.

Brand Color — Used in dashboard charts and exported PDF reports for instant brand recognition.`,
      },
      {
        id: 'credits-and-plans',
        title: 'Credits, Plans, and What Costs What',
        content: `AEO Pulse uses a credit system to make AI engine usage transparent.

How credits are consumed:

• Each prompt × engine combination consumes 1 monitoring credit per scan.

• Analysis (sentiment, hallucination detection) consumes additional analyzer credits — billed by model class (Haiku/Flash = light, Sonnet/Pro = heavy).

• Content generation, recommendation evaluation, and on-demand site audits each consume their own credit pool.

Plans:

• Pro — $49/month. Single workspace, 1 brand, daily scans, all engines, email alerts.

• Business — $199/month. Up to 3 brands, multiple workspaces, webhook alerts, custom report scheduling, API access.

• Agency — $499/month. Unlimited brands, white-label PDF reports, dedicated account manager, priority support, full API + SSO.

Annual billing includes a 20% discount. Top-up credit packs available at any tier. 14-day money-back guarantee on all paid plans.`,
      },
    ],
  },
  {
    group: 'Dashboard',
    icon: LayoutDashboard,
    sections: [
      {
        id: 'overview-page',
        title: 'Overview Page',
        content: `Dashboard → Overview is your daily starting point. Four headline metric cards sit at the top, followed by the AVI trend chart, the per-engine breakdown, and a competitor snapshot.

The four headline cards:

• Citation Rate — The percentage of analyzed AI responses that mention your brand. The most important single number.

• Scans Analyzed — Total prompt × engine combinations evaluated. More scans = more reliable data; aim for 1,000+ before drawing conclusions.

• Average Visibility — 0-100 score showing how prominently you appear when mentioned. A high citation rate with low visibility means you're buried deep in the response.

• Average Position — Where you typically appear in the response (#1 = first brand named). Below #3 means competitors are getting most of the attention.

Below the headline cards you'll find the Citation Rate Trend chart (rolling 30 / 60 / 90 days), the per-engine breakdown bars, and a competitor snapshot pulled from Citations.`,
      },
      {
        id: 'reading-kpis',
        title: 'Reading Your KPIs',
        content: `How to interpret each headline number.

Citation Rate bands:

• 0% — No AI engine mentions you. Start AEO + content authority work immediately.

• 1-10% — Early stage. AI is starting to pick you up; double down on what's working.

• 10-30% — Growing presence. Optimization strategy is producing results.

• 30-50% — Strong. You're recognized as a relevant player in your space.

• 50%+ — Dominant. You're a top recommendation across AI engines.

Visibility Score bands:

• 0-20 — Not visible. Brand either not mentioned or buried at the end of responses.

• 20-50 — Emerging. Mentioned occasionally but not prominently.

• 50-80 — Visible. Regularly mentioned in a meaningful position.

• 80-100 — Highly visible. Featured prominently, often first.

Sentiment bands:

• -1.0 to -0.3 — Negative. AI says unfavorable things. Investigate online reputation, address complaints.

• -0.3 to 0.3 — Neutral. AI mentions you factually without preference. Create more differentiating content.

• 0.3 to 1.0 — Positive. AI actively recommends you. Maintain.`,
      },
      {
        id: 'trend-chart',
        title: 'Understanding the Trend Chart',
        content: `The Citation Rate Trend chart shows how your visibility changes over time. Two lines: solid = Citation Rate, dashed = Visibility Score.

Upward trend — AEO strategy is working. Keep producing authoritative content, structured data, and citation-worthy assets.

Flat line — Stuck. Try: refreshing FAQ pages with explicit facts, adding schema.org markup, or building citations on industry sources AI engines reference.

Downward trend — Losing ground. Likely causes: competitors improved their content, AI training data refresh, or new negative content about your brand surfacing.

Rising citation rate + rising visibility = ideal (more mentions, better positioning).

Rising citation rate + flat visibility = mentioned more often, but still buried. Work on prominence (first-mention triggers, comparison content).

Flat citation + falling visibility = competitors are stealing attention in your existing mentions.`,
      },
      {
        id: 'navigation',
        title: 'Dashboard Navigation',
        content: `The sidebar groups screens by job-to-be-done.

Monitor — Overview, Citations, Snapshots, Monitoring scheduler.

Optimize — AEO Snippets, GEO Score, Site Audit, Recommendations, Content Generator.

Compare — Competitor benchmarking, Citation Sources, AI Funnel.

Health — Sentiment, Brand Health Monitor, Alerts.

Reports — Snapshots, Scheduled reports, Exports.

Team — Workspaces, Members, Audit logs, API keys.

Settings — Billing, Credits, Cost Monitor, Org settings.

The breadcrumb at the top of each page tells you exactly where you are in the hierarchy.`,
      },
    ],
  },
  {
    group: 'Brand Management',
    icon: Building2,
    sections: [
      {
        id: 'managing-brands',
        title: 'Managing Your Brands',
        content: `Dashboard → Brands lists every brand you monitor. Each card shows current Citation Rate, AVI score, monitoring status, and last scan time.

Click any brand to open its detail view: per-engine analytics, citation trend, competitor comparison, prompts list, and alert rules — all scoped to that brand.

Edit a brand at any time — changes apply to the next scan cycle. Renaming a brand does NOT lose historical data; everything stays linked by internal brand ID.

If you manage multiple brands (agencies), each brand is fully isolated: separate prompts, separate metrics, separate competitor sets, separate alert rules. You can switch the active brand via the dropdown in the top-left of any brand-scoped page.`,
      },
      {
        id: 'aliases',
        title: 'Brand Aliases & Detection',
        content: `AI engines vary wildly in how they spell or refer to your brand, especially across languages. The aliases list catches all these variants.

What to include in aliases:

• Capitalization variants — "Acasting", "acasting", "ACasting"

• Punctuation and accent variants — "Bjorn Lunden" for "Björn Lundén"

• Common abbreviations — "ER" for "Ekonomirådgivarna"

• Localized versions — Swedish/English/Italian spellings of the same brand

• Domain variants — "brand.com", "brand.se", "www.brand.com"

The detection engine matches case-insensitively against the brand name + every alias. A hit on any alias counts as a brand mention.

Avoid generic words that produce false positives. If your brand is "Pulse" don't add "pulse" alone as an alias — every AI response about heart rate would count.`,
      },
      {
        id: 'competitors',
        title: 'Competitor Tracking',
        content: `Add 3-5 main competitors per brand. Each competitor is tracked the same way as your brand: mention count, citation rate, position, sentiment.

The horizontal bar chart on Dashboard → Citations compares your brand against every competitor. Sorted from highest to lowest citation rate. Your bar uses your brand color; each competitor gets its own.

A competitor with a higher rate means AI engines prefer recommending them. The gap is your optimization target.

To close a gap:

• Study the competitor's content depth on relevant queries

• Check their structured data (schema.org markup, FAQ pages)

• Audit their citation sources — what authoritative sites link to them?

• Identify their AEO snippets — are they answering specific questions you ignore?

Dashboard → Citation Sources surfaces the sites AI engines cite when discussing your industry, including which competitors get cited from which sources.`,
      },
    ],
  },
  {
    group: 'Prompt Monitoring',
    icon: MessageSquare,
    sections: [
      {
        id: 'what-are-prompts',
        title: 'What Are Prompts?',
        content: `Prompts are the questions AEO Pulse sends to AI engines on your behalf. They simulate what real customers might ask an AI assistant.

If a customer looking for an accountant in Falun asks ChatGPT "What's the best accounting firm in Falun?", AEO Pulse sends the same question to ChatGPT, Gemini, Perplexity, and Claude, then analyzes whether your brand appears in each response.

The quality of your monitoring depends entirely on the prompts you create. Good prompts reflect real customer queries. The more prompts you have, the more comprehensive your coverage — aim for 30-50 prompts per brand.`,
      },
      {
        id: 'creating-prompts',
        title: 'Creating Effective Prompts',
        content: `Cover three intent categories — Local, National, Industry — and three intent types — informational, commercial, comparison.

Local prompts (geo-specific):

• "Best accounting firm in Falun"

• "Top rated bookkeeper near Dalarna"

• "Affordable accounting services Falun"

National prompts (broader):

• "Best accounting firm in Sweden"

• "How to choose an accounting firm"

• "Accounting firm comparison Sweden"

Industry / professional:

• "Best accounting software for small businesses"

• "Fortnox vs Björn Lundén"

• "Starting a business — financial advisor needed"

Best practices:

• Write in the language your customers actually use. Swedish customers ask in Swedish.

• Mix informational ("what is", "how to") with commercial ("best", "recommend", "top").

• Include head-to-head competitor prompts — these reveal direct positioning.

• Refresh prompts quarterly to track changing customer language and new trends.`,
      },
      {
        id: 'prompt-generator',
        title: 'AI Prompt Generator',
        content: `Dashboard → Tools → Prompt Generator drafts prompts for you based on your brand description, industry preset, locale, and competitor list.

How it works:

• Reads your brand profile (industry preset, locale, description, competitors)

• Generates a mix of Local / National / Industry prompts in the brand's locale

• Tags each suggestion with intent (informational / commercial / comparison) and quality score

• You review, edit, and bulk-add the ones that fit

This is the fastest way to bootstrap a brand from zero — 30-50 high-quality starter prompts in 60 seconds.

The generator uses your preset (e.g., "casting-talent", "marketing-advertising", "saas") to tailor the prompt style. Wrong preset = generic prompts that miss real customer intent — double-check this in Brand → Edit before generating.`,
      },
      {
        id: 'prompt-categories',
        title: 'Prompt Categories',
        content: `Each prompt belongs to a category that drives reporting and recommendations.

Local — City or region-specific. Critical for businesses with a physical location. Reveals visibility in geo-intent queries.

National — Country-wide queries. Important for brands serving the entire market. Tests visibility against national competitors.

Industry — Sector-specific, geography-agnostic. Tests whether AI engines recognize your brand as a player in your industry overall.

A healthy split for a local business: 40% Local, 30% National, 30% Industry. For a national SaaS: 60% Industry, 30% National, 10% Local.

You can also tag prompts with a custom topic (e.g., "Pricing", "Reviews", "Integrations") for finer segmentation in Analytics.`,
      },
      {
        id: 'monitoring-frequency',
        title: 'Monitoring Frequency',
        content: `Scans run automatically on a schedule.

Daily (default) — Each prompt × engine combination is checked once every 24 hours.

Weekly — Lower-priority prompts can be set to weekly to save credits.

Manual recalculate — Citations page → "Recalculate" forces immediate aggregation of all scans run since the last recalc. Use after editing prompts or adding competitors.

The platform runs three monitoring batches per day at 06:00, 12:00, 18:00 UTC. Each batch processes a subset of prompts — full coverage is achieved within 1-3 days depending on prompt count.

You never trigger scans manually for credits; the scheduler handles it.`,
      },
    ],
  },
  {
    group: 'Citation Tracking',
    icon: Target,
    sections: [
      {
        id: 'citation-rate',
        title: 'Citation Rate Page',
        content: `Dashboard → Citations is the core monitoring view. The large number at the top is your overall Citation Rate.

Formula: Citation Rate = (Responses mentioning your brand ÷ Total responses) × 100

Example: 50 prompts × 4 engines = 200 scans. If your brand appears in 30 responses, citation rate = 15%.

Below the headline you'll see total responses analyzed, total mentions detected, and the recalc button.

The page is the single source of truth for the AVI components — every other metric (visibility, position, sentiment) is computed on top of these scan results.`,
      },
      {
        id: 'competitor-benchmarking-citations',
        title: 'Citation Benchmarking',
        content: `The horizontal bar chart compares your brand against each tracked competitor.

How to read it:

• Bars sorted from highest to lowest citation rate

• Your brand uses your brand color; competitors get distinct hues

• The longer the bar, the more often AI engines mention that brand

A competitor with double your rate means AI engines mention them in twice as many responses for the same prompts. Not necessarily because they're better — usually because their online content, structured data, and authority signals are stronger.

To close the gap:

• Run Dashboard → Citation Sources to see what sites are cited

• Run Dashboard → Site Audit to identify your structural gaps

• Use Dashboard → Recommendations to get the prioritized action list`,
      },
      {
        id: 'engine-comparison',
        title: 'Per-Engine Breakdown',
        content: `The Engine Breakdown panel shows citation rate per AI platform. Each engine weighs ranking factors differently:

ChatGPT — Strong general-web brands win. Favors brands frequently cited in articles, reviews, third-party comparisons.

Gemini — Reflects Google search authority. Brands with strong Google Business Profiles and traditional SEO often outperform here.

Perplexity — Cites sources visibly. Brands with strong presence on authoritative sites (industry publications, Wikipedia, government registries) win.

Claude — Values factual accuracy and recent information. Cautious about specific recommendations; rewards well-structured, fact-dense content.

If you're weak on a specific engine, study what that engine values and build accordingly.`,
      },
      {
        id: 'citation-sources',
        title: 'Citation Sources',
        content: `Dashboard → Citation Sources shows the websites AI engines cite when discussing your industry.

The view answers:

• Which sources do AI engines trust as authorities in your space?

• Which sources cite your competitors but not you?

• What's the freshness of cited content (last updated)?

• Which engines cite which sources?

Use this to plan a backlink and PR strategy: pitch the sources that already cite your competitors. Industry publications, government registries, Wikipedia, review sites — any source that shows up here is a foothold an AI engine already trusts.`,
      },
    ],
  },
  {
    group: 'AI Engines',
    icon: Globe,
    sections: [
      {
        id: 'how-monitoring-works',
        title: 'How Engine Monitoring Works',
        content: `Each prompt × engine combination follows a two-step process.

Step 1 — Query Execution
The prompt is sent to the real AI engine (ChatGPT web with search, Gemini Advanced, Perplexity Sonar, Claude web). Response text is captured in full.

Step 2 — Response Analysis
A dedicated analyzer model reads the response and extracts:

• Brand mention detection (your brand + every alias)

• First-mention position (which brand is named first)

• Mention count and visibility scoring

• Sentiment analysis (-1.0 to +1.0)

• Competitor detection (per competitor in your list)

• Hallucination flagging (false claims about your brand)

Every result is stored as a Monitoring Result row and rolled up into the daily Snapshot. The Snapshot drives every aggregate metric you see on the dashboard.`,
      },
      {
        id: 'supported-engines',
        title: 'Supported Engines & Models',
        content: `AEO Pulse calls real AI engines with web search enabled — not memory-only responses.

Query engines (where your prompts go):

• ChatGPT — OpenAI web_search_preview enabled, GPT-4o response model

• Gemini — Google Gemini 2.5 Flash with web grounding

• Perplexity — Sonar online model (always uses live web search)

• Claude — Anthropic web_search_20250305 tool, Sonnet 4.6 response model

• Google AI Overviews — captured via SERP scraping when the overview appears

Analyzer models (used to interpret each response):

• Haiku 4.5 — Default analyzer. Fast, cheap, accurate for sentiment and mention detection.

• Sonnet 4.6 — Used for hallucination detection and nuanced sentiment edge cases.

• Gemini Flash — Alternative analyzer for cost optimization.

Engine web-search fidelity is locale-aware: Swedish prompts trigger Swedish search results in every engine where supported.`,
      },
      {
        id: 'engine-quirks',
        title: 'Engine Quirks to Know',
        content: `Each engine has biases that affect what shows up in your monitoring.

ChatGPT bias toward Wikipedia, large publishers, and Reddit. If you're a small brand without significant third-party coverage, ChatGPT will under-recommend you regardless of how good your own site is.

Gemini bias toward Google Business Profiles and structured Google data. Verified GBP listings with reviews dramatically improve Gemini citation rate for local queries.

Perplexity bias toward freshness and explicit citations. Older content gets demoted even if accurate. Schema.org markup and clearly attributed sources help.

Claude bias toward caution. For "recommend the best X" prompts, Claude often refuses to recommend specific brands. Your citation rate may look artificially low on Claude even when other engines mention you.

This is why the per-engine breakdown matters — focus on the engines where you have the most leverage.`,
      },
    ],
  },
  {
    group: 'Analytics',
    icon: BarChart3,
    sections: [
      {
        id: 'analytics-dashboard',
        title: 'Analytics Dashboard',
        content: `Dashboard → Analytics offers deeper segmentation than the Overview page.

Charts available:

• Citation Rate & Visibility Trend — Dual-line chart over 30/60/90 days

• Engine Performance — Horizontal bar comparing citation rate per engine

• Sentiment Distribution — Pie chart of positive/neutral/negative responses

• Citation Rate by Category — Bar chart per prompt category (Local/National/Industry)

• Sentiment by Engine — Which engines speak most positively about your brand

• Position Heatmap — Frequency of each mention position (#1, #2, #3...) per engine

• Hallucination Trend — Detected hallucinations over time, by severity

Use date range filters at the top to compare any two periods. Export any chart to PNG, CSV, or include in scheduled PDF reports.`,
      },
      {
        id: 'sentiment-analysis',
        title: 'Sentiment Analysis',
        content: `Sentiment measures the tone of what AI engines say about your brand.

Positive — The AI recommends, highlights strengths, uses favorable language: "highly recommended", "excellent service", "industry leader".

Neutral — Factual mention without strong opinion. Listed alongside competitors without preference.

Negative — Warns against, mentions weaknesses, uses unfavorable language: "limited services", "customer complaints", "better alternatives exist".

What to do:

• Negative — Investigate online reputation. Address public complaints. Update website content to counter narratives.

• Neutral — Create more differentiating content. Give AI engines specific reasons to recommend you over competitors.

• Positive — Maintain. Continue monitoring for changes.

Dashboard → Sentiment Heatmap visualizes sentiment per engine per prompt category — quickly spot where you're loved and where you're not.`,
      },
      {
        id: 'hallucination-detection',
        title: 'Hallucination Detection',
        content: `AI hallucination = the AI states false information about your brand as fact. This can mislead customers and damage your reputation.

Common hallucination patterns:

• Wrong founding year or company history

• Attributed services or products you don't actually offer

• Incorrect pricing, locations, or contact information

• Fabricated awards, certifications, or partnerships

• Confusion with similarly-named brands

AEO Pulse flags potential hallucinations with three severity levels:

• Low — Minor factual discrepancy, possibly outdated. Update your website.

• Medium — Significant error that could mislead customers. Update structured data urgently.

• High — Completely fabricated claim with reputation impact. Report to the AI platform, update all online sources immediately.

How to reduce hallucinations: maintain a comprehensive About page with explicit facts. Publish a detailed FAQ. Add schema.org structured data (Organization, FAQPage, Product). Keep your Google Business Profile current. Add disambiguation language if you share a name with another brand.`,
      },
      {
        id: 'avi-formula',
        title: 'AVI Formula — The Six Components',
        content: `AI Visibility Index is a weighted composite of six metrics, computed daily.

Citation Rate (weight 20%) — Percentage of responses mentioning your brand. The base of the pyramid.

Mention Frequency (weight 20%) — Average mentions per response. Once-and-done vs. mentioned multiple times.

Recommendation Rate (weight 20%) — Percentage of mentions where the AI actively recommends you (vs. neutral listing).

Sentiment Score (weight 15%) — Average sentiment score scaled to 0-100.

Position Average (weight 15%) — Inverted position rank: #1 = 100, #5 = 60, #10+ = 0.

Hallucination Index (weight 10%) — Inverted: fewer hallucinations = higher score. 0 hallucinations = 100.

Total AVI = sum of weighted components. Range 0-100.

Why these weights:

• Citation, Mention Frequency, Recommendation are the action drivers (60% combined)

• Sentiment and Position are the quality drivers (30% combined)

• Hallucination is the trust check (10%) — small weight, big alert when triggered`,
      },
      {
        id: 'health-score',
        title: 'Brand Health Composite',
        content: `Health Score is a simpler 0-100 composite for non-power users who want one number.

How it's calculated:

• Visibility — 50% (combines citation rate + visibility score)

• Sentiment — 30% (average sentiment scaled to 0-100)

• Accuracy — 20% (inverted hallucination index)

Score bands:

• 80-100 — Excellent. Strong visibility, positive sentiment, accurate information.

• 60-80 — Good. Decent presence with room for improvement.

• 40-60 — Fair. Moderate visibility or mixed sentiment. Focus on content improvement.

• 0-40 — Poor. Low visibility, negative sentiment, or high hallucination rate. Immediate action needed.

The difference between AVI and Health Score: AVI is the analyst metric (six components, fine-grained), Health is the dashboard metric (three components, glanceable).`,
      },
    ],
  },
  {
    group: 'AEO Snippets',
    icon: LineChart,
    sections: [
      {
        id: 'what-is-aeo',
        title: 'What is AEO?',
        content: `Answer Engine Optimization (AEO) is the practice of structuring content so AI engines extract direct answers from it.

Traditional SEO ranks pages. AEO targets snippets — the actual sentences AI engines quote, summarize, or paraphrase in their responses.

A page that ranks #1 on Google may still lose to a competitor at #5 in AI responses if the competitor has cleaner, more extractable Q&A content with explicit schema markup.

AEO works through three signals:

• Structured Q&A — Clear question/answer pairs in your content (FAQ pages, HowTo guides)

• Schema markup — JSON-LD describing the questions, answers, organization, products

• Authoritative attribution — Citations to recognized sources backing your claims`,
      },
      {
        id: 'snippet-engine',
        title: 'AEO Snippet Engine',
        content: `Dashboard → AEO Snippets tracks question/answer snippets across AI engines.

For each tracked snippet, you see:

• Coverage — Percentage of AI engines that cite your answer for the matching question

• Position — Where your answer appears in the response (lead, middle, fallback)

• Competitors — Which competitors get cited for the same question

• Source page — The URL on your site the answer is extracted from

Add new tracked questions manually, or let the engine auto-discover them by scanning your sitemap for FAQ content.

The Gap Analysis tab shows questions where competitors are cited but you're not — your highest-leverage content opportunities.`,
      },
      {
        id: 'schema-export',
        title: 'Schema JSON-LD Export',
        content: `For each tracked snippet, AEO Pulse generates the schema.org JSON-LD markup to add to your page.

Supported schema types:

• FAQPage — Q&A blocks

• HowTo — Step-by-step guides

• Article — News, blog posts, guides

• Organization — Brand identity

• Product — Items with price, rating, availability

Click "Export Schema" on any snippet to download the JSON-LD ready to drop into your site's <script type="application/ld+json"> block.

Re-validate your schema with Google's Rich Results Test after deployment — AEO Pulse runs its own validator but Google's is the source of truth for some engines.`,
      },
    ],
  },
  {
    group: 'GEO Score',
    icon: Gauge,
    sections: [
      {
        id: 'what-is-geo',
        title: 'What is GEO Score?',
        content: `Generative Engine Optimization (GEO) Score is a 0-100 page-level diagnostic that predicts how well a given URL will perform in AI search.

GEO complements AEO: AEO targets specific snippets, GEO scores the overall page.

A page with a high GEO score is structured, authoritative, and AI-readable. AI engines find it easy to summarize, cite, and recommend.

Run a GEO scan on any URL via Dashboard → GEO Score → Add URL. The scan completes in 30-60 seconds and produces a detailed breakdown of the five scoring pillars.`,
      },
      {
        id: 'geo-pillars',
        title: 'The Five GEO Pillars',
        content: `Structure (weight 25%) — Heading hierarchy (H1 → H6), semantic HTML, table of contents, internal anchors. AI engines navigate well-structured pages faster.

Authority (weight 25%) — Outbound citations to recognized sources, author bio, organization schema, publish/update dates. Signals trustworthiness.

Clarity (weight 20%) — Reading level, sentence length, paragraph density, question/answer presence. AI engines summarize clear writing more accurately.

Schema (weight 15%) — JSON-LD presence and completeness (FAQPage, Article, Organization, Product where relevant).

Freshness (weight 15%) — Last-modified date, content recency signals, version history. AI engines prefer recent content for time-sensitive queries.

Total GEO = sum of weighted pillar scores. Each pillar reports its own score so you know exactly where to invest.`,
      },
      {
        id: 'geo-fixing',
        title: 'Fixing GEO Issues',
        content: `Every GEO scan ends with a prioritized fix list.

Fix order by impact:

Step 1 — Critical structural issues
Missing H1, broken heading hierarchy, no semantic landmarks. Fix first — affects every other pillar.

Step 2 — Schema gaps
Add FAQPage, Article, Organization JSON-LD. Quick wins, big AI-readability impact.

Step 3 — Authority signals
Add author bio, citations to industry sources, publish/update dates visible to crawlers.

Step 4 — Clarity polish
Break up long paragraphs, add Q&A blocks, simplify dense sections.

Step 5 — Freshness signals
Add "Last updated" labels, ensure sitemap reflects real dates, refresh stale content.

Re-scan after fixes to verify the score moved.`,
      },
    ],
  },
  {
    group: 'Site Audit',
    icon: ShieldCheck,
    sections: [
      {
        id: 'site-audit-overview',
        title: 'Site Audit Overview',
        content: `Dashboard → Site Audit crawls your entire website and reports technical issues that impact both traditional SEO and AI search visibility.

The audit covers:

• Crawlability — robots.txt directives, sitemap presence and freshness, AI-specific bot allowlist (GPTBot, ClaudeBot, PerplexityBot, etc.)

• Technical SEO — broken links, redirect chains, page speed, mobile usability, HTTPS

• Structured data — schema.org validation across the site, missing required fields, deprecated types

• Content — duplicate content, thin pages, missing meta descriptions, orphan pages

• AI-readability — heading structure, semantic HTML, accessibility metadata

Each issue gets a severity rating (Critical / High / Medium / Low) and a recommended fix.`,
      },
      {
        id: 'bot-crawlability',
        title: 'AI Bot Crawlability',
        content: `AI engines have their own crawlers. If you block them, you become invisible to AI search.

Bots to allow in robots.txt:

• GPTBot — OpenAI / ChatGPT

• OAI-SearchBot — OpenAI search index

• ClaudeBot — Anthropic / Claude

• PerplexityBot — Perplexity

• Google-Extended — Google AI training

• CCBot — Common Crawl (used by multiple engines as training data)

• Bytespider — TikTok / Bytedance AI

A common mistake: blocking all unknown bots to prevent scraping. This also blocks every AI engine. The Site Audit checks your robots.txt against this list and flags blocks.

A safer pattern: allow all known AI bots explicitly, rate-limit or block scrapers via your firewall/WAF instead of robots.txt.`,
      },
      {
        id: 'schema-validator',
        title: 'Schema Validator',
        content: `Dashboard → Site Audit → Schema Validator checks every page for valid JSON-LD structured data.

Reports:

• Type coverage — Which schema types are present (Organization, FAQPage, Product, Article)

• Required field gaps — Missing fields per type (e.g., FAQPage with no acceptedAnswer)

• Deprecated types — Using outdated schema vocabulary

• Conflicting markup — Multiple Organization schemas on the same page, duplicate Article markup, etc.

Click any issue to see the offending JSON-LD block highlighted, with a recommended fix.

Export validated schema bundles per URL to share with your dev team.`,
      },
    ],
  },
  {
    group: 'Recommendations',
    icon: Lightbulb,
    sections: [
      {
        id: 'how-recommendations-work',
        title: 'How Recommendations Work',
        content: `Dashboard → Recommendations is your prioritized action list. The engine analyzes your monitoring data, GEO scores, and site audit results to generate concrete fixes.

Each recommendation has:

• Type — Content, Technical, Schema, Authority, or Reputation

• Impact — Estimated AVI lift if completed (e.g., "+4 AVI")

• Effort — Quick / Medium / Long

• Status — Open / In Progress / Done

• Linked evidence — The exact monitoring results or audit findings that triggered the recommendation

The list is sorted by Impact ÷ Effort — the highest-leverage actions first.`,
      },
      {
        id: 'recommendation-rules',
        title: 'Recommendation Rules',
        content: `Recommendations fire based on detection rules. Examples:

• Citation rate < 10% on commercial prompts → "Build comparison content"

• Sentiment trending negative for 7 days → "Audit reputation, address negative sources"

• GEO score < 60 on top traffic page → "Restructure page for AEO"

• Competitor cited on Wikipedia but you're not → "Audit Wikipedia presence"

• Hallucination detected with Medium+ severity → "Update About page facts"

• AI bot blocked in robots.txt → "Allow GPTBot/ClaudeBot/PerplexityBot"

You can customize rule thresholds per workspace in Settings → Recommendation Rules.`,
      },
      {
        id: 'action-plans',
        title: 'Action Plans',
        content: `Group recommendations into Action Plans to coordinate work across a team.

Create a plan from any subset of recommendations. Assign owners, due dates, and link external tickets (Linear, Jira, GitHub).

Status updates flow back: when a recommendation transitions Open → Done, the linked monitoring metric is re-evaluated on the next scan. If the metric moves, you'll see the lift attributed to that plan.

Export plans to PDF for client/stakeholder reports.`,
      },
    ],
  },
  {
    group: 'Content Generator',
    icon: Sparkles,
    sections: [
      {
        id: 'content-generator-overview',
        title: 'AI Content Generator',
        content: `Dashboard → Content Generator drafts articles optimized for AI search visibility — not just human readers.

Inputs:

• Target query (the AI prompt you want to win)

• Brand voice and tone preset

• Length (short / medium / long-form)

• Required schema (FAQPage, HowTo, Article)

• Target competitors to outrank

The generator drafts the article with:

• AEO-optimized snippet blocks (Q&A pairs ready to be cited)

• Embedded schema.org JSON-LD

• Authority signals (citation placeholders for industry sources)

• Clear heading hierarchy and table of contents

Every draft is editable in the built-in editor before export to Markdown, HTML, or WordPress.`,
      },
      {
        id: 'optimization-signals',
        title: 'Optimization Signals',
        content: `The Content Generator scores each draft against the same signals the GEO Score uses.

Real-time signal panel shows:

• Structure score — Heading hierarchy, list usage, anchor links

• Clarity score — Reading level, sentence variety, paragraph density

• Schema completeness — Required JSON-LD fields filled

• AEO coverage — Number of Q&A snippets, depth per answer

• Authority — Citation placeholders, expert quotes, data references

Aim for 80+ across all signals before publishing. The editor highlights low-scoring sections so you can fix them before export.`,
      },
      {
        id: 'whitelabel-pdf',
        title: 'White-label PDF Reports',
        content: `Generated content can be exported as a branded PDF for client delivery (Agency plan).

Customize per workspace:

• Logo + color palette

• Cover page layout

• Footer attribution

• Page numbers and table of contents

Use cases:

• Send an AEO content audit + recommendation deck to a client

• Bundle a Site Audit + Recommendation Plan as a quarterly review

• Deliver a competitor benchmark report as a sales asset

PDFs are generated on demand and stored in Dashboard → Reports for 90 days.`,
      },
    ],
  },
  {
    group: 'Competitor Benchmarking',
    icon: Crown,
    sections: [
      {
        id: 'competitor-overview',
        title: 'Competitor Benchmarking',
        content: `Dashboard → Competitor compares you against up to 3 (or unlimited on Agency) competitors across every monitoring dimension.

The dashboard shows:

• AVI gap — Their AVI minus yours, per engine

• Share of voice — Percentage of mentions per brand across all monitored prompts

• Citation source overlap — Sites that cite both you and them vs. sites that cite only them

• Sentiment differential — Per-engine sentiment delta

• Position differential — Average position delta per engine

• Hallucination comparison — Whose brand suffers more AI misinformation`,
      },
      {
        id: 'competitor-gap-analysis',
        title: 'Gap Analysis',
        content: `The Gap Analysis tab surfaces specific opportunities.

Prompts they win on — Queries where they're cited and you're not. Highest-leverage content gaps.

Sources they exploit — Citation sources that cite them but not you. Direct pitch list for outreach.

Engines they dominate — Engines where their margin is largest. Tells you which engine bias to study.

Schema they have, you don't — Differences in structured data coverage between your sites.

Each gap row has a "Convert to Recommendation" button — adds the opportunity to your recommendation queue with the prefilled action.`,
      },
      {
        id: 'serp-tracking',
        title: 'SERP & AI Overview Tracking',
        content: `Dashboard → Competitor → SERP Tracker tracks Google AI Overviews alongside traditional results.

For every tracked query, you see:

• Whether an AI Overview appears

• Which brands are cited in the Overview

• Position of cited links within the Overview

• Comparison to organic SERP position

This is the only place where AI search and traditional search converge on Google — and AI Overviews increasingly drive the bulk of zero-click queries.`,
      },
    ],
  },
  {
    group: 'Alerts & Notifications',
    icon: Bell,
    sections: [
      {
        id: 'setting-up-alerts',
        title: 'Setting Up Alerts',
        content: `Dashboard → Alerts → Create Rule configures a notification trigger.

Each rule has:

• Alert Type — What change triggers it (see below)

• Brand scope — Single brand or all brands in the workspace

• Channels — Email, Slack webhook, generic webhook, in-app

• Threshold — Sensitivity (drop > 10%, sentiment < -0.3, etc.)

• Frequency — Real-time, daily digest, weekly summary

Rules evaluate after every monitoring scan. Toggle a rule on/off via the switch without losing its configuration.`,
      },
      {
        id: 'alert-types',
        title: 'Alert Types',
        content: `Alert types available:

New Mention — Your brand is mentioned by an engine for the first time on a specific prompt. Positive signal.

Mention Lost — Previous mention disappeared. Needs immediate attention.

Sentiment Drop — Sentiment dropped significantly. Investigate reputation.

Sentiment Spike — Sentiment rose significantly. Worth understanding what worked.

Competitor Ahead — A specific competitor passed you on citation rate.

Visibility Change — Visibility score moved by more than threshold.

Hallucination Detected — Medium or High severity hallucination flagged.

Citation Rate Change — Daily citation rate shifted > 10% vs. previous day.

GEO Score Drop — Tracked URL's GEO score fell below threshold.

Budget Alert — Credit consumption crossed a configured percentage of plan.`,
      },
      {
        id: 'webhook-format',
        title: 'Webhook Payload Format',
        content: `Webhook alerts POST a JSON body to your endpoint.

Payload structure:

• event — Alert type identifier (e.g., "mention.lost")

• brand_id — Affected brand UUID

• workspace_id — Workspace UUID

• triggered_at — ISO 8601 timestamp

• metric — Object with before/after values and delta

• evidence — Array of monitoring result IDs that triggered the alert

• link — Deep link to the relevant dashboard view

Webhooks include an X-AIOPulse-Signature header for HMAC verification. Validate this against your workspace secret before processing.`,
      },
    ],
  },
  {
    group: 'Reports & Exports',
    icon: FileDown,
    sections: [
      {
        id: 'csv-export',
        title: 'CSV Export',
        content: `Export raw monitoring data as CSV from any page with an "Export CSV" button.

Standard columns:

• Timestamp — When the scan ran

• Engine — Which AI engine

• Prompt — The query sent

• Response excerpt — First 500 chars of the AI response

• Brand mentioned (Yes/No)

• Visibility score (0-100)

• Position — Where your brand appeared

• Sentiment score (-1.0 to +1.0)

• Competitor mentions — Comma-separated list

• Hallucination flags — Severity if any

Open in Excel, Google Sheets, or pipe into your own BI tool.`,
      },
      {
        id: 'pdf-reports',
        title: 'PDF Reports',
        content: `Click "Export PDF" on Overview, Analytics, or Citations for a stakeholder-ready report.

The PDF includes:

• Executive summary with headline AVI and key trends

• Citation rate trend chart (selected period)

• Engine performance breakdown

• Competitor comparison with rankings

• Sentiment and hallucination summary

• Top 5 recommendations with estimated impact

Reports use your brand color and (on Agency plan) your white-label theme.`,
      },
      {
        id: 'scheduled-reports',
        title: 'Scheduled Reports',
        content: `Dashboard → Reports → Schedule sets up recurring report delivery.

Configure per schedule:

• Frequency — Daily, Weekly, Monthly

• Recipients — Email addresses (no account required)

• Format — PDF, CSV, JSON, or all three

• Content — Choose which sections to include

• Date range — Rolling 7 / 30 / 90 days

Scheduled reports are generated at the configured cadence and emailed with download links. JSON delivery is also available via webhook for BI pipelines.`,
      },
      {
        id: 'obsidian-export',
        title: 'Obsidian Export',
        content: `Power users running personal knowledge management can export brand data to Obsidian vault format.

Dashboard → Settings → Integrations → Obsidian Export generates:

• One Markdown note per brand with frontmatter (AVI, citation rate, sentiment, last scan)

• One note per competitor with bidirectional links to the parent brand

• One note per monitored prompt with embedded scan history

• Tags by industry, locale, engine, severity

Drop the export folder into your vault and the graph builds itself. Useful for agency strategists who want to cross-link client knowledge.`,
      },
    ],
  },
  {
    group: 'Workspaces & Teams',
    icon: Users,
    sections: [
      {
        id: 'workspaces-overview',
        title: 'Workspaces',
        content: `A workspace is the container for brands, prompts, monitoring data, and team members. Most users have one workspace. Agencies have one per client (or one per market).

Each workspace has its own:

• Brands and prompts

• Alert rules

• Team members and roles

• API keys

• Billing scope (workspaces roll up to the organization for billing)

Switch workspaces via the dropdown in the top-left of the dashboard.`,
      },
      {
        id: 'rbac-roles',
        title: 'Roles & Permissions',
        content: `Four workspace roles, granular permission matrix:

Owner — Full control. Can delete the workspace, manage billing, invite/remove members at any role.

Admin — Manage brands, prompts, alerts, recommendations. Invite editors/viewers. Cannot delete workspace or change billing.

Editor — Create and edit brands, prompts, alerts. Cannot manage team members.

Viewer — Read-only access to dashboards, reports, and exports. Cannot trigger scans or change configuration.

Organization-level roles (above workspace level):

• Org Owner — Full control across all workspaces

• Org Admin — Manage workspaces but not billing

• Org Billing — Manage billing only, no workspace access

• Org Member — Belongs to the org without org-wide rights

Permissions are enforced at the database level via Postgres Row-Level Security, not just in the UI.`,
      },
      {
        id: 'inviting-members',
        title: 'Inviting Team Members',
        content: `Dashboard → Org → Members → Invite.

Step 1 — Enter Email
Provide the email and select role (Owner / Admin / Editor / Viewer).

Step 2 — Send Invitation
Invitee receives an email with a signed acceptance link valid for 7 days.

Step 3 — Acceptance
Invitee clicks the link → creates an account (or signs in) → joins the workspace at the assigned role.

Step 4 — Audit
The invitation, acceptance, and any subsequent role changes are recorded in the immutable Audit Log.

Revoke pending invitations at any time. Remove active members instantly — their session is invalidated within 30 seconds.`,
      },
      {
        id: 'audit-logs',
        title: 'Audit Logs',
        content: `Dashboard → Org → Audit Logs shows every critical action across the organization.

Logged events:

• Authentication (sign in, sign out, failed attempts)

• Member invitations and role changes

• Brand creation, edit, deletion

• Prompt batch operations

• API key creation/revocation

• Billing changes

• Export operations

• Setting changes

Logs are immutable (append-only, enforced via RLS) and exportable to CSV for compliance reviews (SOC 2, GDPR Art. 30 records of processing).`,
      },
    ],
  },
  {
    group: 'Billing & Credits',
    icon: CreditCard,
    sections: [
      {
        id: 'billing-overview',
        title: 'Billing Overview',
        content: `Dashboard → Billing shows your current plan, next billing date, and a credit usage summary.

Plans:

• Pro — $49/month. 1 brand, single workspace.

• Business — $199/month. 3 brands, multi-workspace, API access.

• Agency — $499/month. Unlimited brands, white-label, dedicated AM.

Annual billing is 20% off. Switch plans mid-cycle — proration applied automatically.

All paid plans include a 14-day money-back guarantee from first charge.`,
      },
      {
        id: 'credit-system',
        title: 'How Credits Work',
        content: `Every action that calls an AI provider consumes credits. Transparent and predictable.

Credit categories:

• Monitoring credits — Each prompt × engine scan

• Analysis credits — Each sentiment / hallucination check (lighter models = fewer credits)

• Content credits — Each generated article or section

• Audit credits — Each Site Audit / GEO Score scan

Per-model pricing example:

• Haiku 4.5 analyzer = 1 credit

• Sonnet 4.6 analyzer = 3 credits

• Gemini Flash analyzer = 1 credit

• Opus analyzer (deep mode) = 8 credits

Each plan includes a monthly credit allowance. Top-up packs are available at any time for spillover usage.`,
      },
      {
        id: 'cost-monitor',
        title: 'Cost Monitor',
        content: `Dashboard → Cost Monitor tracks credit burn in real time.

The view shows:

• Credits consumed this month, broken down by category

• Burn rate (credits/day) vs. plan allowance

• Projected month-end consumption

• Per-brand cost attribution

• Per-model cost breakdown

Set a budget alert in Settings → Cost Alerts to get notified at 50/75/90/100% of monthly allowance. Useful for agencies billing clients per workspace.`,
      },
    ],
  },
  {
    group: 'API & Integrations',
    icon: Code,
    sections: [
      {
        id: 'public-api',
        title: 'Public REST API',
        content: `Dashboard → Org → API Keys creates and manages API keys. Available on Business and Agency plans.

Base URL: https://api.aio-pulse.com/v1

Authentication: Bearer token in the Authorization header.

Available endpoints:

• GET /brands — List brands

• POST /brands — Create brand

• GET /brands/{id}/snapshot — Daily snapshot

• GET /prompts — List prompts

• POST /scan — Trigger on-demand scan (consumes credits)

• GET /citations — Citation results with filters

• GET /recommendations — Open recommendations

• POST /webhooks — Register webhook endpoint

All endpoints return JSON. Rate limited to 60 requests/minute per key on Business, 300/minute on Agency.`,
      },
      {
        id: 'webhooks',
        title: 'Webhooks',
        content: `Register a webhook URL to receive event notifications.

Event types emitted:

• scan.completed — A monitoring scan finished

• mention.new — New brand mention detected

• mention.lost — Previous mention disappeared

• sentiment.drop — Sentiment fell below configured threshold

• hallucination.detected — Hallucination flagged

• recommendation.created — New recommendation generated

• report.ready — Scheduled report delivered

Every webhook POST includes X-AIOPulse-Signature for HMAC-SHA256 verification. Validate this against your workspace secret to prevent spoofing.`,
      },
      {
        id: 'gsc-sync',
        title: 'Google Search Console Sync',
        content: `Connect GSC to enrich monitoring with traditional search data.

Dashboard → Settings → Integrations → Google Search Console → Connect.

Once connected, AEO Pulse pulls:

• Branded search queries — Map AI mentions to GSC branded search volume

• Striking distance keywords — Pages ranking 4-10 that could be promoted

• Cannibalization detection — Multiple pages competing for the same query

• Position trends — Correlate GSC position with AI citation rate

The cross-source view answers: "When my GSC position improves, does my AI citation rate follow?" Usually yes, but the lag and engine variation matter — this is where you learn the gap.`,
      },
      {
        id: 'agentic-journey',
        title: 'Agentic Journey Map',
        content: `Dashboard → Tools → Agentic Journey maps how an AI agent (Perplexity, ChatGPT with browsing) navigates from a query to a citation of your brand.

For a given prompt, the map shows:

• The query the agent sent

• Sites the agent visited

• Sentences extracted from each site

• How those sentences were combined into the final response

• Where (if anywhere) your brand was mentioned

This is the most diagnostic view in the platform — you literally watch the agent fail or succeed to cite you. Use it to reverse-engineer competitor wins.`,
      },
      {
        id: 'knowledge-graph',
        title: 'Knowledge Graph Sync',
        content: `Dashboard → Tools → Knowledge Graph checks how your brand appears in machine-readable knowledge sources.

Sources checked:

• Google Knowledge Graph

• Wikidata entity

• Wikipedia article presence and quality

• OpenStreetMap (for local businesses)

• Industry registries (where supported)

For each source, the view reports presence, last update, and key attributes. Gaps here often correlate with low citation rate — AI engines lean heavily on knowledge graphs for factual queries.

Recommendations from this view focus on entity verification, Wikidata edits, and Wikipedia article quality improvement.`,
      },
    ],
  },
  {
    group: 'Glossary',
    icon: BookOpen,
    sections: [
      {
        id: 'glossary',
        title: 'Terms & Definitions',
        content: `AEO (Answer Engine Optimization) — Practice of structuring content (Q&A, schema markup) so AI engines extract direct answers. The AI equivalent of traditional SEO.

GEO (Generative Engine Optimization) — Broader strategies to improve visibility in AI-generated responses: content depth, authority, structured data, citation strategy.

AVI (AI Visibility Index) — Proprietary 0-100 composite score combining six weighted metrics. The primary KPI in AEO Pulse.

Citation Rate — Percentage of monitored AI responses that mention your brand. Formula: (Mentions ÷ Total Responses) × 100.

Visibility Score — 0-100 metric measuring how prominently your brand appears in AI responses. Considers position, mention count, and context.

Mention Position — Where your brand appears in an AI response. #1 = first mentioned (best). Higher numbers = mentioned later.

Sentiment — Tone of AI responses about your brand: Positive (recommends), Neutral (factual), Negative (warns/criticizes).

Sentiment Score — Numerical value from -1.0 (extremely negative) through 0.0 (neutral) to +1.0 (extremely positive).

Hallucination — AI stating false information about your brand as fact. Wrong dates, fabricated products, incorrect locations, fake awards.

Engine — An AI search platform: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic), Google AI Overviews.

Prompt — A question sent to AI engines to check for brand mentions. Simulates real customer queries.

Snippet — A specific Q&A block extractable by AI engines. AEO targets snippet visibility per prompt.

Schema (JSON-LD) — Structured data markup (schema.org vocabulary) embedded in HTML pages. Tells AI engines what your content is about.

Monitoring Result — A single data point: one prompt sent to one engine, fully analyzed.

Snapshot — Daily aggregation of all monitoring results for a brand. Drives every aggregate metric.

Health Score — Composite 0-100 combining Visibility (50%), Sentiment (30%), Accuracy (20%).

GEO Score — Page-level 0-100 diagnostic predicting AI search performance for a given URL.

Workspace — Container for brands, prompts, team members. Multi-tenancy unit.

Credit — Internal accounting unit for AI provider usage. Each scan / analysis / generation consumes credits from your plan allowance.`,
      },
    ],
  },
]

export default function DocsPage() {
  const t = useTranslations('docs_ui')
  const tHeader = useTranslations('site_header')
  const [activeSection, setActiveSection] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-10% 0px -85% 0px' },
    )

    const refs = sectionRefs.current
    Object.values(refs).forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [searchQuery])

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 600)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && sectionRefs.current[hash]) {
      setTimeout(() => {
        sectionRefs.current[hash]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [])

  const scrollToSection = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
    setMobileNavOpen(false)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredDocs = searchQuery.trim()
    ? DOCS.map((group) => ({
        ...group,
        sections: group.sections.filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.content.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      })).filter((g) => g.sections.length > 0)
    : DOCS

  const totalSections = filteredDocs.reduce((acc, g) => acc + g.sections.length, 0)

  const renderContent = (content: string) => {
    return content.split('\n\n').map((paragraph, i) => {
      if (paragraph.trim().startsWith('•')) {
        const items = paragraph.split('\n').filter((line) => line.trim().startsWith('•'))
        return (
          <ul key={i} className="mb-4 ml-1 space-y-2.5">
            {items.map((item, j) => {
              const raw = item.replace(/^•\s*/, '')
              const dashIdx = raw.indexOf(' — ')
              const term = dashIdx > -1 ? raw.slice(0, dashIdx) : null
              const def = dashIdx > -1 ? raw.slice(dashIdx + 3) : raw
              return (
                <li
                  key={j}
                  className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    {term && <strong className="font-semibold text-foreground">{term} — </strong>}
                    {def}
                  </span>
                </li>
              )
            })}
          </ul>
        )
      }

      // Step blocks: "Step N — Title\nBody text..."
      if (paragraph.trim().match(/^Step \d/)) {
        const lines = paragraph.split('\n')
        const headerLine = lines[0] ?? ''
        const bodyLines = lines.slice(1).join('\n').trim()
        const match = headerLine.match(/^(Step \d+)\s*[—–-]\s*(.+)/)
        if (match) {
          return (
            <div key={i} className="mb-5 flex gap-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-black text-accent-foreground shadow-md">
                {match[1]?.replace('Step ', '')}
              </span>
              <div className="flex-1">
                <h4 className="mb-1.5 text-base font-bold text-foreground">{match[2]}</h4>
                {bodyLines && (
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{bodyLines}</p>
                )}
              </div>
            </div>
          )
        }
      }

      // Definition blocks: 2+ lines containing "Term — Definition"
      if (paragraph.includes(' — ') && !paragraph.startsWith('•')) {
        const lines = paragraph.split('\n').filter(Boolean)
        const isDefinitionBlock = lines.filter((l) => l.includes(' — ')).length >= 2

        if (isDefinitionBlock) {
          return (
            <div key={i} className="mb-5 space-y-2.5">
              {lines.map((line, j) => {
                const dashIndex = line.indexOf(' — ')
                if (dashIndex > -1) {
                  const term = line.slice(0, dashIndex).trim()
                  const def = line.slice(dashIndex + 3).trim()
                  return (
                    <div key={j} className="text-[15px] leading-relaxed">
                      <span className="font-bold text-foreground">{term}</span>
                      <span className="mx-2 text-accent">—</span>
                      <span className="text-muted-foreground">{def}</span>
                    </div>
                  )
                }
                return (
                  <p key={j} className="text-[15px] leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                )
              })}
            </div>
          )
        }
      }

      return (
        <p key={i} className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      )
    })
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background transition-colors">
      <div className="pointer-events-none absolute -right-32 top-24 z-0 h-[280px] w-[280px] opacity-20">
        <Ornament variant="orbit" />
      </div>
      <SiteHeader
        navItems={[
          { label: tHeader('nav.features'), href: '/#features' },
          { label: tHeader('nav.capabilities'), href: '/#capabilities' },
          { label: tHeader('nav.industries'), href: '/#industries' },
          { label: tHeader('nav.docs'), href: '/docs', active: true },
          { label: tHeader('nav.dashboard'), href: '/dashboard' },
        ]}
        rightSlot={
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            aria-label="Toggle mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        }
      />

      {/* Mobile Navigation */}
      {mobileNavOpen && (
        <div className="border-b border-nav-border bg-nav-bg px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/#features"
            >
              {tHeader('nav.features')}
            </Link>
            <Link onClick={() => setMobileNavOpen(false)} className="text-accent" href="/docs">
              {tHeader('nav.docs')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/dashboard"
            >
              {tHeader('nav.dashboard')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/auth/login"
            >
              {tHeader('sign_in')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="font-medium text-accent"
              href="/dashboard"
            >
              {tHeader('get_started')}
            </Link>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Back Link & Title */}
        <Reveal direction="up" className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('back_home')}
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </Reveal>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className="focus:ring-accent/20 w-full rounded-xl border border-input bg-input py-3 pl-11 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-accent focus:ring-2"
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searchQuery && (
            <p className="mt-2 text-xs text-muted-foreground">
              {totalSections === 1
                ? t('result_singular', { count: totalSections })
                : t('result_plural', { count: totalSections })}
            </p>
          )}
        </div>

        {/* Main layout with sidebar */}
        <div className="flex gap-10">
          {/* Sidebar - Desktop */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <nav className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto pb-20 pr-4">
              {filteredDocs.map((group) => (
                <div key={group.group}>
                  <div className="mb-2 flex items-center gap-2">
                    <group.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {group.group}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {group.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          'block w-full rounded-lg px-3 py-2 text-left text-sm transition-all',
                          activeSection === section.id
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main ref={mainRef} className="min-w-0 flex-1 pb-32">
            {filteredDocs.map((group) =>
              group.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  ref={(el) => {
                    sectionRefs.current[section.id] = el
                  }}
                  className="mb-16 scroll-mt-24"
                >
                  {/* Breadcrumb */}
                  <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{group.group}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-muted-foreground">{section.title}</span>
                  </p>

                  {/* Title */}
                  <h2 className="mb-6 text-2xl font-bold text-foreground">{section.title}</h2>

                  {/* Content */}
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {renderContent(section.content)}
                  </div>

                  {/* Divider */}
                  <div className="mt-16 border-t border-input" />
                </section>
              )),
            )}

            {/* No results */}
            {totalSections === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-bold text-foreground">{t('no_results_title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('no_results_hint')}{' '}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-accent hover:underline"
                  >
                    {t('clear_search')}
                  </button>
                  .
                </p>
              </div>
            )}
          </main>
        </div>

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            aria-label={t('back_to_top')}
            className="hover:border-accent/30 hover:bg-accent/10 fixed bottom-6 right-6 z-50 rounded-full border border-input bg-input p-3 shadow-lg transition-all"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-nav-border bg-background py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AEO Pulse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
