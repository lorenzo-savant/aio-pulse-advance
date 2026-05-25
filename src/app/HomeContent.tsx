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
import { useMounted } from '@/lib/hooks/use-mounted'
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
    accentClass: 'text-accent',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/20',
  },
  {
    icon: BarChart3,
    title: 'Competitor Analysis',
    description:
      'Benchmark your visibility against up to 3 competitors across all major AI search engines.',
    accentClass: 'text-success',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/20',
  },
  {
    icon: Globe,
    title: 'Engine Monitor',
    description:
      'Real-time surveillance of ChatGPT, Gemini, Perplexity, and Claude indexing patterns.',
    accentClass: 'text-purple-500',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
  },
  {
    icon: Zap,
    title: 'Analytics Dashboard',
    description:
      'Cross-platform metrics showing AI search vs. traditional search visibility convergence.',
    accentClass: 'text-warning',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/20',
  },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const isDark = theme === 'dark'

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="text-muted-foreground hover:text-accent"
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Gradient orbs */}
      <div className="bg-accent/20 pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />

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
            <Link className="transition-colors hover:text-accent" href="#stats">
              Stats
            </Link>
            <Link className="transition-colors hover:text-accent" href="/docs">
              Docs
            </Link>
            <Link className="transition-colors hover:text-accent" href="/dashboard">
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
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

      {/* Hero */}
      <section className="relative z-10 px-6 pb-24 pt-32 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="border-accent/30 bg-accent/10 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent">
            <Sparkles className="h-3 w-3" />
            AI Search Visibility Platform
          </div>

          <h1 className="balance mb-6 text-5xl font-black tracking-tight text-foreground md:text-7xl">
            Dominate Every <span className="text-gradient">AI Search</span> Engine
          </h1>

          <p className="pretty mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Monitor, optimize, and dominate your visibility across ChatGPT, Gemini, Perplexity, and
            Claude — with enterprise-grade AIO, AEO, and GEO intelligence.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="shadow-accent/25 hover:shadow-accent/30 hover:bg-accent-hover flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 text-base font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
              href="/dashboard"
            >
              <Zap className="h-5 w-5" />
              Launch Dashboard
            </Link>
            <Link
              className="hover:border-accent/30 flex items-center gap-2 rounded-2xl border border-border bg-card px-8 py-4 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted"
              href="/docs"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 border-y border-border bg-background px-6 py-16" id="stats">
        <AnimatedStats />
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-24" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black tracking-tight text-foreground">
              Everything you need to win <span className="text-gradient">AI search</span>
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              A complete platform for monitoring and optimizing your digital presence across all
              generative AI search engines.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-lg',
                  feature.borderClass,
                )}
              >
                <div
                  className={cn(
                    'mb-6 flex h-12 w-12 items-center justify-center rounded-xl border',
                    feature.bgClass,
                    feature.borderClass,
                  )}
                >
                  <feature.icon className={cn('h-6 w-6', feature.accentClass)} />
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{feature.description}</p>

                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors group-hover:text-accent">
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
        <div className="border-accent/20 bg-accent/5 mx-auto max-w-3xl rounded-3xl border p-12 text-center">
          <h2 className="mb-4 text-4xl font-black tracking-tight text-foreground">
            Ready to dominate AI search?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Start your free audit today — no credit card required.
          </p>
          <Link
            className="shadow-accent/25 hover:bg-accent-hover inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
            href="/dashboard"
          >
            <Shield className="h-5 w-5" />
            Open Platform
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {['No credit card', 'Instant access', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-background px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link className="transition-colors hover:text-accent" href="#">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-accent" href="#">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
