'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Shield, Zap, Sparkles, ChevronDown, CheckCircle2 } from 'lucide-react'
import { useOnScreen } from '@/lib/hooks/use-scroll-reveal'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AnimatedStats } from '@/components/AnimatedStats'
import { LottieAnimation } from '@/components/LottieAnimation'

const features = [
  {
    title: 'AI Visibility Index (AVI)',
    description:
      'Our proprietary 0-100 score measures how often and how prominently your brand appears across ChatGPT, Gemini, Perplexity, and Claude. Combines citation frequency, sentiment analysis, position ranking, and hallucination detection into a single actionable metric.',
    img: '/images/feature-visibility-agent.svg',
    link: '/dashboard/analytics',
  },
  {
    title: 'Multi-Engine Monitoring',
    description:
      'Daily automated scans across ChatGPT, Google Gemini, Perplexity AI, Claude, and Google AI Overviews. Track citation rate, mention frequency, recommendation rate, and answer position per engine — all in a unified dashboard.',
    img: '/images/feature-auto-topics.svg',
    link: '/dashboard/monitoring',
  },
  {
    title: 'Competitive Intelligence',
    description:
      "Benchmark your AVI against up to 3 competitors side-by-side. Compare share of voice per engine, identify citation sources they use that you don't, and get actionable recommendations to close the gap.",
    img: '/images/feature-real-world-output.svg',
    link: '/dashboard/competitor',
  },
  {
    title: 'Content Optimization Suite',
    description:
      'AEO snippet tracking with schema JSON-LD export, GEO score diagnostics with 5 weighted pillars, AI article generator optimized for citation signals, and URL/text analysis with engine-specific recommendations.',
    img: '/images/feature-measure-compare.svg',
    link: '/dashboard/optimizer',
  },
]

const capabilities = [
  {
    title: 'AEO Snippet Engine',
    description:
      'Track question/answer snippets across all AI engines, identify coverage gaps vs. competitors, and export schema-compliant JSON-LD markup to boost answer engine visibility.',
    img: '/images/agent-mention-builder.svg',
  },
  {
    title: 'Citation Analyzer',
    description:
      "Deep citation quality scoring on 5 pillars, freshness tracking, per-engine format analysis, and citation source discovery to expand your brand's AI reference footprint.",
    img: '/images/agent-ugc.svg',
  },
  {
    title: 'Brand Health Monitor',
    description:
      'Real-time health scores with sentiment tracking across engines, keyword correlation, homonym/brand confusion detection, and automated alerting for mention loss or sentiment drops.',
    img: '/images/agent-content-optimizer.svg',
  },
]

const industries = [
  { label: 'Travel', img: '/images/industry-travel.svg' },
  { label: 'Ecommerce', img: '/images/industry-ecommerce.svg' },
  { label: 'Finance', img: '/images/industry-finance.svg' },
  { label: 'Healthcare', img: '/images/industry-healthcare.svg' },
  { label: 'Automotive', img: '/images/industry-automotive.svg' },
  { label: 'Education', img: '/images/industry-education.svg' },
  { label: 'Real Estate', img: '/images/industry-realestate.svg' },
  { label: 'Legal', img: '/images/industry-legal.svg' },
  { label: 'SaaS', img: '/images/industry-saas.svg' },
  { label: 'Crypto', img: '/images/industry-crypto.svg' },
]

const faqs = [
  {
    q: 'What is AI Visibility Index (AVI)?',
    a: 'AVI is a proprietary 0-100 score combining 6 weighted factors: citation rate (20%), mention frequency (20%), recommendation rate (20%), sentiment score (15%), position average (15%), and hallucination index (10%). Higher scores mean better visibility across AI-generated responses.',
  },
  {
    q: 'How does multi-engine monitoring work?',
    a: 'Enter your domain and up to 3 competitors. Our engine orchestrates parallel queries to ChatGPT/SearchGPT, Google Gemini, Perplexity AI, and Claude, then aggregates results into a unified dashboard with per-engine breakdowns and trend analysis.',
  },
  {
    q: 'Which AI engines and models are supported?',
    a: 'ChatGPT (web + GPTs + SearchGPT), Google Gemini (web + Advanced), Perplexity AI, Claude (web), and Google AI Overviews. Analysis models include Gemini 2.5 Flash/Pro, GPT-4o/4o-mini, Claude Sonnet 4.5/Haiku 4.5, and Perplexity Sonar.',
  },
  {
    q: 'How often is my data refreshed?',
    a: 'Daily automated scans for all active subscriptions, with configurable alert rules for new mentions, lost mentions, sentiment drops, positive spikes, competitor lead changes, and hallucination detection.',
  },
  {
    q: 'Can I try before committing?',
    a: 'Yes — start with a free single audit that covers your domain across all supported engines. No credit card required. Full dashboards, competitor comparison, and exportable reports are included.',
  },
  {
    q: 'What is the difference between AIO, AEO, and GEO?',
    a: 'AIO (AI Optimization) optimizes content for AI model discoverability. AEO (Answer Engine Optimization) targets direct answers and featured snippets. GEO (Generative Engine Optimization) optimizes for AI-generated search results. Our platform covers all three with dedicated tools and scoring.',
  },
  {
    q: 'Do you support multi-language content?',
    a: 'Yes, we analyze visibility across 50+ languages. AI models respond differently per language — our platform tracks those variations and provides language-specific insights in your reports.',
  },
  {
    q: 'What integrations are available?',
    a: 'Google Search Console sync (branded search, striking distance keywords, cannibalization detection), public REST API v1 with webhooks, Obsidian export, and custom report scheduling with automated PDF/CSV/JSON delivery.',
  },
  {
    q: 'How is billing structured?',
    a: 'Three tiers: Pro at $49/month (individuals and small teams), Business at $199/month (teams with full features), Agency at $499/month (multi-brand agencies). Annual plans include a 20% discount. 14-day money-back guarantee on all plans.',
  },
  {
    q: 'What kind of support do you offer?',
    a: 'All plans include email support with 24-hour response. Business includes live chat, Agency includes a dedicated account manager with priority phone support. Technical documentation and API reference are available for all users.',
  },
]

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="q-faq-row" onClick={onToggle}>
      <div className="q-faq-row__head">
        <h3 className="q-faq-row__q">{question}</h3>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180',
          )}
        />
      </div>
      <p className={cn('q-faq-row__a', isOpen && '!max-h-96')}>{answer}</p>
    </div>
  )
}

function FeatureBlock({
  feature,
  reversed,
  index,
  visible,
}: {
  feature: (typeof features)[number]
  reversed: boolean
  index: number
  visible: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-8 md:flex-row',
        reversed && 'md:flex-row-reverse',
      )}
    >
      <div
        className={cn(
          'flex-1 transition-all duration-700',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          reversed ? 'md:pl-10' : 'md:pr-10',
        )}
        style={{ transitionDelay: `${index * 150}ms` }}
      >
        <h3 className="q-h3 mb-4">{feature.title}</h3>
        <p className="q-body text-muted-foreground">{feature.description}</p>
        <Link
          className="q-btn--link mt-4 inline-flex items-center gap-1 text-accent"
          href={feature.link}
        >
          Open dashboard
        </Link>
      </div>
      <div
        className={cn(
          'flex-1 transition-all duration-700',
          visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0',
        )}
        style={{ transitionDelay: `${index * 150 + 100}ms` }}
      >
        <img src={feature.img} alt={feature.title} className="h-auto w-full max-w-[500px]" />
      </div>
    </div>
  )
}

export function HomeContent() {
  const [heroVisible, setHeroVisible] = useState(false)
  const featuresRef = useRef<HTMLDivElement>(null)
  const featuresVisible = useOnScreen(featuresRef, { threshold: 0.15 })
  const agentsRef = useRef<HTMLDivElement>(null)
  const agentsVisible = useOnScreen(agentsRef, { threshold: 0.15 })
  const industriesRef = useRef<HTMLDivElement>(null)
  const industriesVisible = useOnScreen(industriesRef, { threshold: 0.15 })
  const ctaRef = useRef<HTMLDivElement>(null)
  const ctaVisible = useOnScreen(ctaRef)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    setHeroVisible(true)
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Gradient orbs */}
      <div className="bg-accent/20 pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="bg-success/10 pointer-events-none absolute bottom-1/4 left-0 h-[500px] w-[500px] -translate-x-1/3 rounded-full blur-3xl" />

      {/* Ornament: orbit animation in top-right */}
      <div className="pointer-events-none absolute right-[-100px] top-[-50px] z-0 h-[400px] w-[400px] opacity-30">
        <LottieAnimation src="/animations/qvery-orbit.json" className="h-full w-full" speed={0.6} />
      </div>

      {/* Ornament: blob mascot bottom-left */}
      <div className="pointer-events-none absolute bottom-[200px] left-[-60px] z-0 h-[250px] w-[250px] opacity-20">
        <LottieAnimation src="/animations/qvery-blob.json" className="h-full w-full" speed={0.5} />
      </div>

      {/* Header */}
      <header className="bg-background/80 relative z-10 border-b border-border backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="shadow-accent/30 flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-lg">
              <Shield className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">{APP_NAME}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link className="transition-colors hover:text-accent" href="#features">
              Features
            </Link>
            <Link className="transition-colors hover:text-accent" href="#capabilities">
              Capabilities
            </Link>
            <Link className="transition-colors hover:text-accent" href="#industries">
              Industries
            </Link>
            <Link className="transition-colors hover:text-accent" href="#faq">
              FAQ
            </Link>
            <Link className="transition-colors hover:text-accent" href="/docs">
              Docs
            </Link>
            <Link className="transition-colors hover:text-accent" href="/dashboard">
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
              href="/auth/login"
            >
              Sign in
            </Link>
            <Link
              className="shadow-accent/25 hover:bg-accent-hover flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg transition-all active:scale-95"
              href="/dashboard"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className={`relative z-10 px-6 pb-16 pt-20 ${heroVisible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-12 md:flex-row">
            {/* Left column: text */}
            <div className="flex-1 text-center md:text-left">
              <div
                className={`border-accent/30 bg-accent/10 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent transition-all duration-700 ${heroVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              >
                <Sparkles className="h-3 w-3" />
                AI Search Visibility Platform
              </div>

              <h1
                className={`balance mb-4 text-5xl font-black tracking-tight text-foreground transition-all delay-100 duration-700 md:text-7xl ${heroVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              >
                Make Your Brand <span className="text-gradient">Discoverable</span>
              </h1>

              <p
                className={`pretty mx-auto mb-8 max-w-xl text-lg text-muted-foreground transition-all delay-200 duration-700 md:mx-0 ${heroVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              >
                Measure your proprietary AI Visibility Index (AVI) across ChatGPT, Gemini,
                Perplexity, and Claude. Get actionable insights to optimize your brand's presence in
                every AI-generated response.
              </p>

              <div
                className={`flex flex-col items-center gap-4 transition-all delay-300 duration-700 sm:flex-row md:justify-start ${heroVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              >
                <Link
                  className="shadow-accent/25 hover:shadow-accent/30 hover:bg-accent-hover flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 text-base font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
                  href="/dashboard"
                >
                  <Zap className="h-5 w-5" />
                  Get a Demo
                </Link>
                <Link
                  className="hover:border-accent/30 flex items-center gap-2 rounded-2xl border border-border bg-card px-8 py-4 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted"
                  href="/auth/login"
                >
                  Log In / Sign Up
                </Link>
              </div>
            </div>

            {/* Right column: hero illustration + bubbles */}
            <div
              className={`flex-1 transition-all delay-500 duration-1000 ${heroVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
              <div className="relative">
                <img
                  src="/images/hero-illustration.svg"
                  alt="AI Pulse illustration"
                  className="h-auto w-full max-w-[600px]"
                />

                {/* Label bubbles around the illustration */}
                <div className="animate-float absolute -left-8 top-4 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  AVI Score 0-100
                </div>
                <div className="animate-float-delayed absolute -right-6 top-8 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  Multi-Engine Tracking
                </div>
                <div className="animate-float-delayed absolute -left-6 bottom-20 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  Competitor Benchmarking
                </div>
                <div className="animate-float absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  AEO &amp; GEO Insights
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GARTNER STAT + PLATFORM STATS ═══ */}
      <section className="relative z-10 border-y border-border bg-background px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-12 md:flex-row md:items-center md:justify-between">
            {/* Gartner stat */}
            <div className="text-center md:text-left">
              <p className="q-lead mb-4 max-w-lg">
                <span className="text-3xl font-black text-accent">50%</span> of traditional search
                traffic will be replaced with generative AI by 2028
              </p>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                — By Gartner
              </p>
            </div>

            {/* Platform stat cards */}
            <div className="flex flex-wrap justify-center gap-6">
              <div className="q-quote-card !max-w-[220px] items-center text-center">
                <p className="text-3xl font-black text-accent">4+</p>
                <p className="q-quote-card__text text-sm text-muted-foreground">
                  AI engines monitored
                </p>
              </div>
              <div className="q-quote-card !max-w-[220px] items-center text-center">
                <p className="text-3xl font-black text-accent">6</p>
                <p className="q-quote-card__text text-sm text-muted-foreground">
                  AVI score factors
                </p>
              </div>
              <div className="q-quote-card !max-w-[220px] items-center text-center">
                <p className="text-3xl font-black text-accent">24h</p>
                <p className="q-quote-card__text text-sm text-muted-foreground">
                  Report refresh cycle
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="relative z-10 px-6 py-16" id="stats">
        <AnimatedStats />
      </section>

      {/* ═══ CORE PLATFORM ═══ */}
      <section className="relative z-10 px-6 pb-24 pt-20" id="features" ref={featuresRef}>
        <div className="mx-auto max-w-7xl">
          <div
            className={cn(
              'mb-20 text-center transition-all duration-700',
              featuresVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
            )}
          >
            <h2 className="q-h2 mb-4">Your AI Visibility Command Center</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              From proprietary AVI scoring to competitive benchmarking — everything you need to
              measure, understand, and grow your presence across generative AI search.
            </p>
          </div>

          <div className="space-y-24">
            {features.map((feature, i) => (
              <FeatureBlock
                key={feature.title}
                feature={feature}
                reversed={i % 2 === 1}
                index={i}
                visible={featuresVisible}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CORE CAPABILITIES ═══ */}
      <section
        className="relative z-10 border-y border-border bg-background px-6 py-24"
        id="capabilities"
        ref={agentsRef}
      >
        <div className="mx-auto max-w-7xl">
          <div
            className={cn(
              'mb-16 text-center transition-all duration-700',
              agentsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
            )}
          >
            <h2 className="q-h2 mb-4">Powered by {APP_NAME}</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              Three integrated engines that work together to give you complete AI visibility
              intelligence — from citation tracking to health monitoring.
            </p>
          </div>

          <div
            className={cn('grid grid-cols-1 gap-8 md:grid-cols-3', agentsVisible && 'is-visible')}
          >
            {capabilities.map((item) => (
              <div
                key={item.title}
                className="group flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <img src={item.img} alt={item.title} className="mb-6 h-48 w-auto object-contain" />
                <h3 className="q-h6 mb-3">{item.title}</h3>
                <p className="q-body text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INDUSTRIES ═══ */}
      <section className="relative z-10 px-6 py-24" id="industries" ref={industriesRef}>
        <div className="mx-auto max-w-7xl">
          <div
            className={cn(
              'mb-16 text-center transition-all duration-700',
              industriesVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
            )}
          >
            <h2 className="q-h2 mb-4">Trusted across industries</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              From agencies optimizing multi-brand portfolios to enterprises protecting their AI
              reputation — {APP_NAME} delivers actionable visibility data for every sector.
            </p>
          </div>

          <div
            className={cn(
              'grid grid-cols-2 gap-6 md:grid-cols-5',
              industriesVisible && 'is-visible',
            )}
          >
            {industries.map((industry) => (
              <div key={industry.label} className="q-industry-card group">
                <img src={industry.img} alt={industry.label} className="q-industry-card__icon" />
                <h3 className="q-industry-card__title">{industry.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="relative z-10 border-y border-border bg-background px-6 py-24" id="faq">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="q-h2 mb-4">Frequently asked questions</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              Everything you need to know about AI visibility monitoring.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-16 md:grid-cols-2">
            <div className="space-y-0">
              {faqs.slice(0, 5).map((faq, i) => (
                <FAQItem
                  key={i}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
            <div className="space-y-0">
              {faqs.slice(5).map((faq, i) => (
                <FAQItem
                  key={i + 5}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFaq === i + 5}
                  onToggle={() => setOpenFaq(openFaq === i + 5 ? null : i + 5)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section
        ref={ctaRef}
        className={`relative z-10 px-6 pb-24 pt-20 ${ctaVisible ? 'is-visible' : ''}`}
      >
        <div className="border-accent/20 bg-accent/5 relative mx-auto max-w-3xl overflow-hidden rounded-3xl border p-12 text-center">
          {/* Ornament burst inside CTA */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 opacity-30">
            <LottieAnimation
              src="/animations/qvery-burst.json"
              className="h-full w-full"
              speed={0.5}
            />
          </div>

          <h2 className="mb-4 text-4xl font-black tracking-tight text-foreground">
            Know your AI visibility score
          </h2>
          <p className="mb-8 text-muted-foreground">
            Start your free audit today — no credit card required. Full AVI report in minutes.
          </p>
          <Link
            className="shadow-accent/25 hover:bg-accent-hover inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
            href="/dashboard"
          >
            <Shield className="h-5 w-5" />
            Measure Your AVI
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {['No credit card', 'Free audit report', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="q-footer relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-4">
            {/* Brand column */}
            <div className="md:col-span-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal">
                  <Shield className="h-5 w-5 text-ink" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">{APP_NAME}</span>
              </div>
              <p className="q-footer-claim mb-6 max-w-xs">
                Enterprise-grade AI search visibility &amp; optimization platform.
              </p>
              <div className="flex items-center gap-4">
                {['Twitter', 'LinkedIn', 'YouTube'].map((social) => (
                  <Link
                    key={social}
                    className="text-sm text-white/60 transition-colors hover:text-teal"
                    href="#"
                  >
                    {social}
                  </Link>
                ))}
              </div>
            </div>

            {/* Product links */}
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                Product
              </h4>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'API', 'Integrations', 'Changelog'].map((item) => (
                  <li key={item}>
                    <Link
                      className="text-sm text-white/80 transition-colors hover:text-teal"
                      href="#"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources links */}
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                Resources
              </h4>
              <ul className="space-y-3">
                {['Documentation', 'Blog', 'Help Center', 'Community', 'Status'].map((item) => (
                  <li key={item}>
                    <Link
                      className="text-sm text-white/80 transition-colors hover:text-teal"
                      href="#"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                Company
              </h4>
              <ul className="space-y-3">
                {['About', 'Careers', 'Privacy', 'Terms', 'Contact'].map((item) => (
                  <li key={item}>
                    <Link
                      className="text-sm text-white/80 transition-colors hover:text-teal"
                      href="#"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center md:text-left">
            <p className="q-footer-copy">
              &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
