'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Globe,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AnimatedStats } from '@/components/AnimatedStats'
import { Button } from '@/components/ui/Button'

const features = [
  {
    icon: Sparkles,
    title: 'Content Optimizer',
    description:
      'Deep AIO audits with intent mapping, keyword density analysis, and engine-specific recommendations.',
    accent: 'text-brand-600 dark:text-brand-400',
    bg: 'bg-brand-50 dark:bg-brand-500/10',
    border: 'border-brand-200 dark:border-brand-500/20',
  },
  {
    icon: BarChart3,
    title: 'Competitor Analysis',
    description:
      'Benchmark your visibility against up to 3 competitors across all major AI search engines.',
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
  },
  {
    icon: Globe,
    title: 'Engine Monitor',
    description:
      'Real-time surveillance of ChatGPT, Gemini, Perplexity, and Claude indexing patterns.',
    accent: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-500/20',
  },
  {
    icon: Zap,
    title: 'Analytics Dashboard',
    description:
      'Cross-platform metrics showing AI search vs. traditional search visibility convergence.',
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
  },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = theme === 'dark'

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="text-nav-text hover:text-brand-600"
    >
      {!mounted ? null : isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

export function HomeContent() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-page-bg transition-colors">
      {/* Background grid - only visible in dark mode */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Gradient orbs - only visible in dark mode */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-purple-600/10 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 border-b border-nav-border bg-nav-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-nav-text-hover">{APP_NAME}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link className="text-nav-text transition-colors hover:text-brand-600" href="#features">
              Features
            </Link>
            <Link className="text-nav-text transition-colors hover:text-brand-600" href="#stats">
              Stats
            </Link>
            <Link className="text-nav-text transition-colors hover:text-brand-600" href="/docs">
              Docs
            </Link>
            <Link
              className="text-nav-text transition-colors hover:text-brand-600"
              href="/dashboard"
            >
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
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

      {/* Hero */}
      <section className="relative z-10 px-6 pb-24 pt-32 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
            <Sparkles className="h-3 w-3" />
            AI Search Visibility Platform
          </div>

          <h1 className="balance mb-6 text-5xl font-black tracking-tight text-nav-text-hover md:text-7xl">
            Dominate Every <span className="text-gradient">AI Search</span> Engine
          </h1>

          <p className="pretty mx-auto mb-10 max-w-2xl text-lg text-nav-text">
            Monitor, optimize, and dominate your visibility across ChatGPT, Gemini, Perplexity, and
            Claude — with enterprise-grade AIO, AEO, and GEO intelligence.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-600/25 transition-all hover:bg-brand-500 hover:shadow-brand-500/30 active:scale-95"
              href="/dashboard"
            >
              <Zap className="h-5 w-5" />
              Launch Dashboard
            </Link>
            <Link
              className="flex items-center gap-2 rounded-2xl border border-nav-border bg-auth-card px-8 py-4 text-base font-semibold text-nav-text shadow-sm transition-all hover:border-brand-500/30 hover:bg-page-bg-alt"
              href="/docs"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        className="relative z-10 border-y border-nav-border bg-page-bg px-6 py-16"
        id="stats"
      >
        <AnimatedStats />
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-24" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black tracking-tight text-nav-text-hover">
              Everything you need to win <span className="text-gradient">AI search</span>
            </h2>
            <p className="mx-auto max-w-xl text-nav-text">
              A complete platform for monitoring and optimizing your digital presence across all
              generative AI search engines.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-auth-card p-8 shadow-sm transition-all hover:shadow-lg',
                  feature.border,
                )}
              >
                <div
                  className={cn(
                    'mb-6 flex h-12 w-12 items-center justify-center rounded-xl border',
                    feature.bg,
                    feature.border,
                  )}
                >
                  <feature.icon className={cn('h-6 w-6', feature.accent)} />
                </div>
                <h3 className="mb-3 text-xl font-bold text-nav-text-hover">{feature.title}</h3>
                <p className="leading-relaxed text-nav-text">{feature.description}</p>

                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-nav-text transition-colors group-hover:text-brand-600">
                  Learn more{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-brand-200 bg-brand-50 p-12 text-center dark:border-brand-500/20 dark:bg-brand-900/20">
          <h2 className="mb-4 text-4xl font-black tracking-tight text-nav-text-hover">
            Ready to dominate AI search?
          </h2>
          <p className="mb-8 text-nav-text">
            Start your free audit today — no credit card required.
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 font-bold text-white shadow-xl shadow-brand-600/25 transition-all hover:bg-brand-500 active:scale-95"
            href="/dashboard"
          >
            <Shield className="h-5 w-5" />
            Open Platform
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-nav-text">
            {['No credit card', 'Instant access', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-nav-border bg-page-bg px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-nav-text">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link className="transition-colors hover:text-brand-600" href="#">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-brand-600" href="#">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
