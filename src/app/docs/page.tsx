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
  Zap,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

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
        title: 'What is AIO Pulse?',
        content: `AIO Pulse is an AI Search Visibility Platform. It monitors how your brand appears when people ask AI assistants like ChatGPT, Google Gemini, Perplexity, and Claude about products and services in your industry.

Traditional SEO tracks your position on Google search results. AIO Pulse tracks something different: whether AI assistants recommend your brand when users ask questions like "What's the best accounting firm in Falun?" or "Which software should I use for bookkeeping?"

This matters because a growing number of people use AI assistants instead of Google to find services and products. If the AI doesn't mention your brand, you're invisible to these users.

AIO Pulse gives you three critical insights:

• Are you being mentioned? — Your Citation Rate shows the percentage of AI responses that include your brand name.

• How do you compare to competitors? — Competitor Benchmarking shows whether AI engines prefer your competitors over you.

• Is the information accurate? — Sentiment and Hallucination Detection reveals whether AI engines say positive, negative, or false things about your brand.`,
      },
      {
        id: 'key-concepts',
        title: 'Key Concepts',
        content: `Before diving in, here are the core terms you'll see throughout AIO Pulse:

Citation Rate — The percentage of AI responses that mention your brand. If you monitor 50 prompts and your brand appears in 10 responses, your citation rate is 20%. This is the most important metric in AIO Pulse.

Visibility Score — A 0–100 score measuring how prominently your brand appears. A score of 100 means your brand is featured first and prominently. A score of 0 means no mention at all.

Mention Position — Where your brand appears in the AI response. Position #1 means you are the first brand mentioned — this is the best possible position.

Sentiment — Whether the AI speaks positively, negatively, or neutrally about your brand. Ranges from −1.0 (very negative) to +1.0 (very positive).

Hallucination — When an AI makes false claims about your brand as if they were fact. AIO Pulse detects and flags these automatically.

Engine — An AI search platform such as ChatGPT, Gemini, Perplexity, or Claude. Each engine may respond differently about your brand.

Prompt — A question or query sent to AI engines to check if your brand is mentioned. These simulate what real customers would ask.`,
      },
      {
        id: 'quick-start',
        title: 'Quick Start Guide',
        content: `Follow these five steps to get up and running:

Step 1 — Add Your Brand
Go to Dashboard → Brands → Add Brand. Enter your brand name, website domain, and your main competitors.

Step 2 — Create Prompts
Go to Dashboard → Prompts → Add Prompt. Write questions that potential customers might ask AI assistants. Think about local queries ("Best accountant in Falun"), comparison queries ("Ekonomirådgivarna vs Fortnox"), and industry queries ("How to choose an accounting firm").

Step 3 — Wait for First Scan
Your first scan runs automatically within 24 hours. Each scan sends your prompts to multiple AI engines and analyzes the responses.

Step 4 — Review Results
Check the Dashboard for your Citation Rate and the Citations page for detailed trend analysis. Compare your visibility against competitors.

Step 5 — Set Up Alerts
Go to Alerts to configure email notifications for important changes — new mentions, lost visibility, or competitors gaining ground.`,
      },
      {
        id: 'first-brand-setup',
        title: 'Your First Brand Setup',
        content: `When adding a brand, you'll fill in these fields:

Brand Name — Your official brand name as it should appear in AI responses. Example: "Ekonomirådgivarna"

Domain — Your website address. Used to detect when AI engines cite your website. Example: "ekonomiradgivarna.se"

Aliases — Other ways people might spell or refer to your brand, separated by commas. The system checks for all of these when analyzing AI responses. Example: "Ekonomirådgivarna, ekonomiradgivarna, Ekonomi Rådgivarna"

Competitors — Your 3–5 main competitors, separated by commas. AIO Pulse tracks how often they are mentioned compared to you. Example: "Fortnox, Björn Lundén, Wint"

Industry — Your business sector. Used for generating relevant monitoring prompts. Example: "Accounting & Financial Advisory"

Description — A brief description of what your company does. Provides context for AI analysis.

Color — A brand color used in charts and reports. Pick your primary brand color for easy identification.`,
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
        content: `The Dashboard Overview is your daily starting point. It shows four key metric cards at the top:

Citation Rate — The most important number. This is the percentage of AI responses that mention your brand.
• 0% — No AI mentions your brand. Action needed.
• 1–10% — Early stage. AI is starting to notice you.
• 10–30% — Growing presence. Your content strategy is working.
• 30–50% — Strong presence. You're a recognized player.
• 50%+ — Dominant. You're a top recommendation.

Scans Analyzed — Total number of prompt × engine combinations that have been analyzed. More scans means more reliable data.

Avg Visibility — How prominently you appear when mentioned, scored 0–100. A high citation rate with low visibility means you're mentioned but buried deep in the response.

Avg Position — Your average position when mentioned. #1 means you're typically the first brand named — the best position. #5 or higher means you're mentioned late in the response.

Below the cards you'll find a Citation Rate Trend chart showing changes over time, an Engine Citation Rate breakdown showing per-platform performance, and a Competitor Snapshot for quick comparison.`,
      },
      {
        id: 'reading-kpis',
        title: 'Reading Your KPIs',
        content: `Here's how to interpret each key metric:

Citation Rate interpretation:
• 0% — Not visible. No AI engine mentions your brand. Start AEO work immediately.
• 1–10% — Early stage. AI engines are beginning to pick up your brand.
• 10–30% — Growing. Your content and optimization strategy is gaining traction.
• 30–50% — Strong. You are recognized as a relevant player in your market.
• 50%+ — Dominant. AI engines regularly recommend you as a top choice.

Visibility Score interpretation:
• 0–20 — Not visible. Brand not mentioned or buried very deep in responses.
• 20–50 — Emerging. Mentioned occasionally but not prominently.
• 50–80 — Visible. Regularly mentioned with reasonable prominence.
• 80–100 — Highly visible. Featured prominently, often the first brand mentioned.

Sentiment interpretation:
• −1.0 to −0.3 — Negative. The AI says unfavorable things about your brand.
• −0.3 to 0.3 — Neutral. The AI mentions you without strong opinion.
• 0.3 to 1.0 — Positive. The AI recommends or speaks favorably about you.`,
      },
      {
        id: 'trend-chart',
        title: 'Understanding the Trend Chart',
        content: `The Citation Rate Trend chart shows how your visibility changes over time.

Upward trend — Your AEO strategy is working. Keep building quality content, improving structured data, and strengthening your online presence.

Flat line — No progress. Consider updating your website content, adding FAQ pages with clear factual information, or creating more authoritative content in your industry.

Downward trend — You're losing visibility. This could mean competitors have improved their content, AI training data has changed, or there's new negative information about your brand online.

The dashed line on the chart shows your Visibility Score for comparison. A rising citation rate with stable visibility means more mentions at the same prominence level. A rising citation rate with rising visibility means both more mentions and better positioning — the ideal scenario.`,
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
        content: `Go to Dashboard → Brands to see all your monitored brands. Each brand card shows the brand name, domain, and current status.

Click any brand card to see detailed analytics, citation trends, and competitor comparison for that specific brand.

To edit a brand, click on it and then click the "Edit" button. You can update any field at any time — changes take effect on the next monitoring scan.

If you manage multiple brands (for example, if you're an agency managing clients), each brand is tracked independently with its own prompts, metrics, and competitor set.`,
      },
      {
        id: 'competitors',
        title: 'Understanding Competitors',
        content: `When you add competitors to your brand, AIO Pulse tracks how often each competitor appears in AI responses to your monitored prompts.

This creates a competitive benchmark. For example:
• Your brand: 5% citation rate
• Fortnox: 54% citation rate
• Björn Lundén: 8% citation rate
• Wint: 0% citation rate

This tells you that Fortnox is mentioned in 54% of relevant AI queries while your brand appears in only 5%. Fortnox is approximately 10× more visible than you in AI search. This gap is your optimization target.

To improve, study what Fortnox does differently: their website content, structured data, authority signals, and online presence. Then adapt your strategy accordingly.`,
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
        content: `Prompts are the questions AIO Pulse sends to AI engines on your behalf. They simulate what real customers might ask an AI assistant.

For example, if a potential customer looking for an accountant in Falun asks ChatGPT "What's the best accounting firm in Falun?", AIO Pulse sends this exact question to ChatGPT, Gemini, and Perplexity, then analyzes whether your brand appears in each response.

The quality of your monitoring depends entirely on the prompts you create. Good prompts reflect real customer queries. The more prompts you have, the more comprehensive your coverage — aim for 30–50 prompts per brand.`,
      },
      {
        id: 'creating-prompts',
        title: 'Creating Effective Prompts',
        content: `When creating prompts, think about the different ways potential customers search for your type of service.

Local prompts — Target geographic searches:
• "Best accounting firm in Falun"
• "Accountant near Dalarna recommendation"
• "Top rated bookkeeper in Falun"
• "Affordable accounting services Falun"

National prompts — Target broader searches:
• "Best accounting firm in Sweden"
• "How to choose an accounting firm"
• "Top accounting companies in Sweden"
• "Accounting firm comparison Sweden"

Industry prompts — Target professional or commercial intent:
• "Best accounting software for small businesses"
• "Fortnox vs Björn Lundén"
• "How much does an accountant cost in Sweden"
• "Starting a business — financial advisor needed"

Tips for better prompts:
• Write in the language your customers use — Swedish prompts for Swedish customers, English for international reach.
• Mix informational intent ("what is", "how to") with commercial intent ("best", "recommend", "top").
• Include prompts that mention competitors by name — these reveal head-to-head positioning.
• Update prompts periodically to reflect changing customer language and new trends.`,
      },
      {
        id: 'prompt-categories',
        title: 'Prompt Categories',
        content: `Each prompt belongs to a category that helps organize your monitoring:

Local — City or region-specific queries. These are crucial for businesses with a physical location. They reveal how visible you are when someone searches for services in your area.

National — Country-wide queries. Important for brands that serve customers across the entire country. These prompts test your visibility against national competitors.

Industry — Sector-specific professional queries. These test whether AI engines recognize your brand as a player in your industry, regardless of location.

A healthy prompt set includes a mix of all three categories. For a local business like an accounting firm in Falun, a suggested split would be 40% Local, 30% National, and 30% Industry prompts.`,
      },
      {
        id: 'monitoring-frequency',
        title: 'Monitoring Frequency',
        content: `AIO Pulse checks your prompts on a regular schedule:

Daily — The default setting. Prompts are checked once every 24 hours. Recommended for active monitoring.

Weekly — Prompts are checked once every 7 days. Suitable for low-priority or very broad queries.

The system runs three monitoring batches per day at 06:00, 12:00, and 18:00 UTC. In each batch, a subset of prompts is processed. All your prompts will be covered within a few days depending on the total count.

You don't need to do anything to trigger scans — they run automatically. After each scan, you can click "Recalculate" on the Citations page to update your aggregated metrics.`,
      },
    ],
  },
  {
    group: 'Citation Tracking',
    icon: Target,
    sections: [
      {
        id: 'citation-rate',
        title: 'Citation Rate',
        content: `The Citations page is the core of AIO Pulse. It answers the fundamental question: how often does AI mention your brand?

The Citation Rate formula is simple:
Citation Rate = (Responses mentioning your brand ÷ Total responses) × 100

For example: You have 50 prompts monitored across 3 engines, giving you 150 total scans. If your brand is mentioned in 30 of those responses, your citation rate is 20%.

The large number at the top of the page shows your current overall citation rate. Below it, you'll see how many responses were analyzed and how many contained mentions of your brand.`,
      },
      {
        id: 'competitor-benchmarking',
        title: 'Competitor Benchmarking',
        content: `The horizontal bar chart on the Citations page compares your brand against each competitor.

How to read it:
• Bars are sorted from highest to lowest citation rate.
• Your brand appears in your brand color (purple by default).
• Each competitor has its own color for easy identification.
• The longer the bar, the more often that brand is mentioned.
• Your goal is to have the longest bar.

A competitor with a higher rate means AI engines prefer recommending them over you for the queries you're monitoring. This doesn't necessarily mean they're a better company — it means their online content, structured data, and authority signals are stronger in the eyes of AI systems.

To close the gap, focus on creating authoritative, well-structured content that directly addresses the queries in your prompt list.`,
      },
      {
        id: 'engine-comparison',
        title: 'Engine Comparison',
        content: `The Engine Breakdown shows your citation rate for each AI platform separately.

Why this matters: You might perform well on Gemini but poorly on ChatGPT, or vice versa. Each engine has different biases:

ChatGPT (OpenAI) — Tends to recommend brands with strong general web presence, frequently cited in articles and reviews.

Gemini (Google) — May reflect Google search rankings and prioritize brands with strong Google Business Profiles.

Perplexity — Focuses on cited, verifiable sources. Brands with strong presence on authoritative websites perform better.

Claude (Anthropic) — Values factual accuracy and recent information. Tends to be more cautious about specific recommendations.

If you're weak on a specific engine, focus your content strategy on the signals that engine values most.`,
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
        content: `AIO Pulse uses a two-step process for each prompt on each engine:

Step 1 — Query Simulation
Your prompt is sent to the AI engine (or a simulation of how that engine would respond), and the full text response is captured.

Step 2 — Response Analysis
An AI analyzer examines each captured response and extracts:
• Brand mention detection — Is your brand named in the response?
• Mention position — Where in the response does your brand first appear?
• Mention count — How many times is your brand mentioned?
• Visibility scoring — How prominent is the mention?
• Sentiment analysis — Is the tone positive, negative, or neutral?
• Competitor detection — Which of your competitors also appear?
• Hallucination flagging — Are there any false claims about your brand?

All results are stored and aggregated into your Citation Rate and other dashboard metrics.

The monitoring runs automatically three times per day. You never need to trigger it manually — just check your dashboard for updated results.`,
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
        content: `The Analytics page provides deeper insights with multiple chart types:

Citation Rate & Visibility Trend — A dual-line chart showing both your citation rate and visibility score over time. Rising lines mean improving performance.

Engine Performance — A horizontal bar chart comparing your citation rate across all AI engines at a glance.

Sentiment Distribution — A pie chart showing the proportion of positive, neutral, and negative AI responses about your brand.

Citation Rate by Category — A bar chart revealing how different prompt categories (Local, National, Industry) perform. You might discover that local queries produce much higher citation rates than national ones.

Sentiment by Engine — Shows which AI engines speak most positively about your brand, helping you understand where your reputation is strongest.`,
      },
      {
        id: 'sentiment-analysis',
        title: 'Sentiment Analysis',
        content: `Sentiment measures the tone of what AI engines say about your brand.

Positive sentiment means the AI recommends your brand, highlights your strengths, or uses favorable language such as "highly recommended," "excellent service," or "industry leader."

Neutral sentiment means the AI mentions your brand factually without strong opinion — listing you alongside competitors without preference.

Negative sentiment means the AI warns against your brand, mentions weaknesses, or uses unfavorable language such as "limited services," "customer complaints," or "better alternatives exist."

What to do:
• If sentiment is negative — Review your online reputation. Address customer complaints publicly. Update website content to counter negative narratives.
• If sentiment is neutral — Create more differentiating content. Give AI engines specific reasons to recommend you.
• If sentiment is positive — Maintain your current approach. Continue monitoring for changes.`,
      },
      {
        id: 'hallucination-detection',
        title: 'Hallucination Detection',
        content: `AI hallucination occurs when an AI engine states false information about your brand as if it were fact. This can mislead potential customers.

Examples of hallucinations:
• Claiming your company was founded in the wrong year
• Attributing services or products you don't actually offer
• Stating incorrect pricing or location information
• Fabricating awards, certifications, or partnerships
• Mixing up your brand with a competitor

AIO Pulse flags potential hallucinations with three severity levels:

Low — Minor factual discrepancy, possibly outdated information. Monitor and update your website.

Medium — Significant factual error that could mislead customers. Update your structured data urgently.

High — Completely fabricated claim that could damage your reputation. Report to the AI platform and update all online sources immediately.

How to reduce hallucinations: Maintain a comprehensive "About" page with explicit, clear facts. Add FAQ pages. Implement schema.org structured data on your website. Keep your Google Business Profile accurate and up to date.`,
      },
      {
        id: 'health-score',
        title: 'Health Score',
        content: `The Health Score is a single 0–100 number that combines your three most important metrics into one easy-to-read indicator.

How it's calculated:
• Visibility contributes 50% — How often and how prominently you appear
• Sentiment contributes 30% — How positively AI engines speak about you
• Accuracy contributes 20% — How free from hallucinations your mentions are

Score interpretation:
• 80–100 — Excellent. Strong visibility, positive sentiment, accurate information.
• 60–80 — Good. Decent presence with room for improvement in one or more areas.
• 40–60 — Fair. Moderate visibility or mixed sentiment. Focus on content improvement.
• 0–40 — Poor. Low visibility, negative sentiment, or high hallucination rate. Immediate action needed.`,
      },
    ],
  },
  {
    group: 'Alerts',
    icon: Bell,
    sections: [
      {
        id: 'setting-up-alerts',
        title: 'Setting Up Alerts',
        content: `Go to Dashboard → Alerts and click "Create Alert Rule" to set up notifications.

You'll configure:
• Alert Type — What kind of change should trigger the alert (see Alert Types below).
• Channels — How you want to be notified: Email, Webhook, or both.
• Email — The email address where alerts should be sent.
• Threshold — How sensitive the trigger should be (depends on alert type).

Once saved, alerts are evaluated automatically after every monitoring scan. When conditions are met, you receive a notification immediately.

You can toggle alerts on and off using the switch next to each rule without deleting them. This is useful when you want to temporarily silence notifications.`,
      },
      {
        id: 'alert-types',
        title: 'Alert Types',
        content: `AIO Pulse offers these alert types:

New Mention — Triggered when your brand is mentioned by an AI engine for the first time on a specific prompt. This is a positive signal — your optimization work is producing results.

Mention Lost — Triggered when your brand was previously mentioned in a response but no longer appears. This needs immediate attention — you're losing visibility.

Sentiment Drop — Triggered when the sentiment score drops significantly. The AI may have encountered negative information about your brand.

Competitor Ahead — Triggered when a specific competitor is cited more prominently than your brand. You're losing competitive positioning.

Visibility Change — Triggered when your visibility score changes dramatically in either direction.

Hallucination Detected — Triggered when an AI makes potentially false claims about your brand. This is urgent — misinformation may be reaching your potential customers.

Citation Rate Change — Triggered when your daily citation rate shifts by more than 10% compared to the previous day.`,
      },
    ],
  },
  {
    group: 'Reports',
    icon: FileDown,
    sections: [
      {
        id: 'csv-export',
        title: 'CSV Export',
        content: `Click the "Export CSV" button on the Citations or Brand Detail page to download your monitoring data as a spreadsheet.

The CSV file contains one row per monitoring result with these columns:
• Date and time of the scan
• AI engine used (ChatGPT, Gemini, Perplexity)
• Prompt text that was sent
• Whether your brand was mentioned (yes/no)
• Visibility score (0–100)
• Sentiment (positive, neutral, negative)
• Competitor mentions detected

Open the CSV file in Excel or Google Sheets for custom analysis, pivot tables, or charts.`,
      },
      {
        id: 'pdf-reports',
        title: 'PDF Reports',
        content: `Click "Export PDF" to generate a professionally formatted report suitable for sending to clients, stakeholders, or management.

The PDF report includes:
• Executive summary with key metrics and trends
• Citation rate trend chart
• Engine performance breakdown
• Competitor comparison with rankings
• Sentiment overview
• Recommendations for improvement

PDF reports use your brand color and the AIO Pulse branding for a polished, professional appearance.`,
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
        content: `AEO (Answer Engine Optimization) — The practice of optimizing your brand's content and online presence to be recommended by AI search engines. The AI equivalent of traditional SEO.

GEO (Generative Engine Optimization) — Broader strategies to improve visibility in AI-generated responses, including structured data, authoritative content, and citation building.

Citation Rate — The percentage of monitored AI responses that mention your brand. Formula: (Mentions ÷ Total Responses) × 100. The primary KPI in AIO Pulse.

Visibility Score — A 0–100 metric measuring how prominently your brand appears in AI responses. Considers mention position, frequency, and context.

Mention Position — Where your brand appears in an AI response. #1 means first mentioned (best). Higher numbers mean mentioned later.

Sentiment — The tone of AI responses about your brand: Positive (recommends), Neutral (factual), or Negative (warns or criticizes).

Sentiment Score — A numerical value from −1.0 (extremely negative) through 0.0 (neutral) to +1.0 (extremely positive).

Hallucination — When an AI states false information about your brand as fact. May include wrong dates, fabricated products, incorrect locations, or fake awards.

Engine — An AI search platform: ChatGPT (OpenAI), Gemini (Google), Perplexity, or Claude (Anthropic).

Prompt — A question sent to AI engines to check for brand mentions. Simulates real customer queries.

Monitoring Result — A single data point: one prompt sent to one engine, with full analysis of the response.

Snapshot — A daily aggregation of all monitoring results for a brand, calculating overall citation rate, competitor rates, and other metrics.

Health Score — A composite 0–100 score combining Visibility (50%), Sentiment (30%), and Accuracy (20%).`,
      },
    ],
  },
]

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
      if (prefersDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

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
          <ul key={i} className="mb-4 ml-1 space-y-2">
            {items.map((item, j) => (
              <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-nav-text">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500/60" />
                <span>{item.replace(/^•\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )
      }

      if (paragraph.trim().match(/^Step \d/)) {
        const lines = paragraph.split('\n').filter(Boolean)
        return (
          <div key={i} className="mb-4 space-y-3">
            {lines.map((line, j) => {
              const match = line.match(/^(Step \d+)\s*[—–-]\s*(.+)/)
              if (match) {
                return (
                  <div key={j} className="flex gap-3">
                    <span className="text-brand mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500/15 text-xs font-bold">
                      {match[1]?.replace('Step ', '')}
                    </span>
                    <p className="text-[15px] leading-relaxed text-nav-text">{match[2]}</p>
                  </div>
                )
              }
              return (
                <p key={j} className="text-[15px] leading-relaxed text-nav-text">
                  {line}
                </p>
              )
            })}
          </div>
        )
      }

      if (paragraph.includes(' — ') && !paragraph.startsWith('•')) {
        const lines = paragraph.split('\n').filter(Boolean)
        const isDefinitionBlock = lines.filter((l) => l.includes(' — ')).length >= 2

        if (isDefinitionBlock) {
          return (
            <div key={i} className="mb-5 space-y-3">
              {lines.map((line, j) => {
                const dashIndex = line.indexOf(' — ')
                if (dashIndex > -1) {
                  const term = line.slice(0, dashIndex).trim()
                  const def = line.slice(dashIndex + 3).trim()
                  return (
                    <div key={j}>
                      <span className="text-brand inline-block rounded bg-surface-input px-1.5 py-0.5 text-sm font-semibold">
                        {term}
                      </span>
                      <span className="ml-2 text-[15px] leading-relaxed text-nav-text">{def}</span>
                    </div>
                  )
                }
                return (
                  <p key={j} className="text-[15px] leading-relaxed text-nav-text">
                    {line}
                  </p>
                )
              })}
            </div>
          )
        }
      }

      return (
        <p key={i} className="mb-4 text-[15px] leading-relaxed text-text-secondary-surface">
          {paragraph}
        </p>
      )
    })
  }

  return (
    <div className="min-h-screen bg-page-bg transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-nav-border bg-nav-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-nav-text-hover">AIO Pulse</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-2 text-nav-text lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link
              className="text-nav-text transition-colors hover:text-brand-600"
              href="/#features"
            >
              Features
            </Link>
            <Link className="text-nav-text transition-colors hover:text-brand-600" href="/#stats">
              Stats
            </Link>
            <Link className="text-brand-600" href="/docs">
              Docs
            </Link>
            <Link
              className="text-nav-text transition-colors hover:text-brand-600"
              href="/dashboard"
            >
              Dashboard
            </Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              className="rounded-lg px-4 py-2 text-sm font-medium text-nav-text transition-colors hover:text-brand-600"
              href="/auth/login"
            >
              Sign in
            </Link>
            <Link
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 hover:shadow-brand-500/30 active:scale-95"
              href="/dashboard"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {mobileNavOpen && (
        <div className="border-b border-nav-border bg-nav-bg px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-nav-text"
              href="/#features"
            >
              Features
            </Link>
            <Link onClick={() => setMobileNavOpen(false)} className="text-nav-text" href="/#stats">
              Stats
            </Link>
            <Link onClick={() => setMobileNavOpen(false)} className="text-brand-600" href="/docs">
              Docs
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-nav-text"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-nav-text"
              href="/auth/login"
            >
              Sign in
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="font-medium text-brand-600"
              href="/dashboard"
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Back Link & Title */}
        <div className="mb-8">
          <Link
            href="/"
            className="hover:text-brand mb-4 inline-flex items-center gap-1 text-sm text-text-muted-surface"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-text-on-surface">Documentation</h1>
          <p className="mt-1 text-text-muted-surface">
            Everything you need to know about using AIO Pulse.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-3 h-4 w-4 text-text-muted-surface" />
          <input
            type="text"
            className="w-full rounded-xl border border-surface-input-border bg-surface-input py-3 pl-11 pr-10 text-sm text-text-on-surface placeholder-text-muted-surface outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 rounded p-0.5 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searchQuery && (
            <p className="mt-2 text-xs text-text-muted-surface">
              {totalSections} result{totalSections !== 1 ? 's' : ''} found
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
                    <group.icon className="h-4 w-4 text-nav-text" />
                    <p className="text-xs font-bold uppercase tracking-wider text-nav-text">
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
                            ? 'bg-nav-active-bg font-medium text-nav-active-text'
                            : 'text-nav-text hover:bg-page-bg-alt hover:text-nav-text-hover',
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
                  <p className="mb-2 flex items-center gap-1 text-xs text-text-muted-surface">
                    <span>{group.group}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-text-muted-surface">{section.title}</span>
                  </p>

                  {/* Title */}
                  <h2 className="mb-6 text-2xl font-bold text-text-on-surface">{section.title}</h2>

                  {/* Content */}
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {renderContent(section.content)}
                  </div>

                  {/* Divider */}
                  <div className="mt-16 border-t border-surface-input-border" />
                </section>
              )),
            )}

            {/* No results */}
            {totalSections === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="mb-4 h-10 w-10 text-text-secondary-surface" />
                <p className="text-lg font-bold text-nav-text-hover">No results found</p>
                <p className="mt-1 text-sm text-nav-text">
                  Try a different search term or{' '}
                  <button onClick={() => setSearchQuery('')} className="text-brand hover:underline">
                    clear the search
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
            className="fixed bottom-6 right-6 z-50 rounded-full border border-surface-input-border bg-surface-input p-3 shadow-lg transition-all hover:border-brand-500/30 hover:bg-brand-500/10"
          >
            <ArrowUp className="h-4 w-4 text-nav-text" />
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-nav-border bg-page-bg py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-nav-text">
          <p>&copy; {new Date().getFullYear()} AIO Pulse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
