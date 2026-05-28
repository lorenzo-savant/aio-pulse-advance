'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Zap, ChevronDown, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AnimatedStats } from '@/components/AnimatedStats'
import { Ornament } from '@/components/Ornament'
import { Reveal } from '@/components/Reveal'
import { AioLogo } from '@/components/brand/Logo'
import { SiteHeader } from '@/components/SiteHeader'
import {
  HeroIllustration,
  AviGaugeIllustration,
  MultiEngineIllustration,
  CompetitiveIllustration,
  ContentOptIllustration,
  AeoSnippetCapability,
  CitationCapability,
  BrandHealthCapability,
  TravelIcon,
  EcommerceIcon,
  FinanceIcon,
  HealthcareIcon,
  AutomotiveIcon,
  EducationIcon,
  RealEstateIcon,
  LegalIcon,
  SaasIcon,
  CryptoIcon,
} from '@/components/brand/BrandIllustrations'

type FeatureIllu = React.ComponentType<{ className?: string }>

type FeatureItem = {
  key: 'avi' | 'multi_engine' | 'competitive' | 'content_opt'
  Illustration: FeatureIllu
  link: string
}

type CapabilityItem = {
  key: 'aeo' | 'citation' | 'health'
  Illustration: FeatureIllu
}

type IndustryItem = {
  key:
    | 'travel'
    | 'ecommerce'
    | 'finance'
    | 'healthcare'
    | 'automotive'
    | 'education'
    | 'real_estate'
    | 'legal'
    | 'saas'
    | 'crypto'
  Icon: FeatureIllu
}

const FEATURE_ITEMS: FeatureItem[] = [
  { key: 'avi', Illustration: AviGaugeIllustration, link: '/dashboard/analytics' },
  { key: 'multi_engine', Illustration: MultiEngineIllustration, link: '/dashboard/monitoring' },
  { key: 'competitive', Illustration: CompetitiveIllustration, link: '/dashboard/competitor' },
  { key: 'content_opt', Illustration: ContentOptIllustration, link: '/dashboard/optimizer' },
]

const CAPABILITY_ITEMS: CapabilityItem[] = [
  { key: 'aeo', Illustration: AeoSnippetCapability },
  { key: 'citation', Illustration: CitationCapability },
  { key: 'health', Illustration: BrandHealthCapability },
]

const INDUSTRY_ITEMS: IndustryItem[] = [
  { key: 'travel', Icon: TravelIcon },
  { key: 'ecommerce', Icon: EcommerceIcon },
  { key: 'finance', Icon: FinanceIcon },
  { key: 'healthcare', Icon: HealthcareIcon },
  { key: 'automotive', Icon: AutomotiveIcon },
  { key: 'education', Icon: EducationIcon },
  { key: 'real_estate', Icon: RealEstateIcon },
  { key: 'legal', Icon: LegalIcon },
  { key: 'saas', Icon: SaasIcon },
  { key: 'crypto', Icon: CryptoIcon },
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
    <div className={cn('q-faq-row', isOpen && 'is-open')} onClick={onToggle}>
      <div className="q-faq-row__head">
        <h3 className="q-faq-row__q">{question}</h3>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180',
          )}
        />
      </div>
      <p className="q-faq-row__a">{answer}</p>
    </div>
  )
}

function FeatureBlock({
  item,
  reversed,
  title,
  description,
  openLabel,
}: {
  item: FeatureItem
  reversed: boolean
  title: string
  description: string
  openLabel: string
}) {
  const Illustration = item.Illustration
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-8 md:flex-row',
        reversed && 'md:flex-row-reverse',
      )}
    >
      <Reveal
        direction={reversed ? 'right' : 'left'}
        className={cn('flex-1', reversed ? 'md:pl-10' : 'md:pr-10')}
      >
        <h3 className="q-h3 mb-4">{title}</h3>
        <p className="q-body text-muted-foreground">{description}</p>
        <Link
          className="q-btn--link mt-4 inline-flex items-center gap-1 text-accent"
          href={item.link}
        >
          {openLabel}
        </Link>
      </Reveal>
      <Reveal direction={reversed ? 'left' : 'right'} delay={2} className="flex-1">
        <Illustration className="mx-auto w-full max-w-[500px]" />
      </Reveal>
    </div>
  )
}

export function HomeContent() {
  const t = useTranslations('home')
  const tHeader = useTranslations('site_header')
  const tFooter = useTranslations('site_footer')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqItems = t.raw('faq.items') as { q: string; a: string }[]
  const ctaChecks = t.raw('cta.checks') as string[]

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

      <div className="bg-accent/10 pointer-events-none absolute left-1/2 top-[-200px] h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="bg-success/10 pointer-events-none absolute bottom-1/4 left-0 h-[500px] w-[500px] -translate-x-1/3 rounded-full blur-3xl" />

      <div className="pointer-events-none absolute right-[-100px] top-[-50px] z-0 h-[400px] w-[400px] opacity-30">
        <Ornament variant="orbit" />
      </div>

      <div className="pointer-events-none absolute bottom-[200px] left-[-60px] z-0 h-[250px] w-[250px] opacity-25">
        <Ornament variant="blob" />
      </div>

      <SiteHeader
        navItems={[
          { label: tHeader('nav.features'), href: '#features' },
          { label: tHeader('nav.capabilities'), href: '#capabilities' },
          { label: tHeader('nav.industries'), href: '#industries' },
          { label: tHeader('nav.faq'), href: '#faq' },
          { label: tHeader('nav.docs'), href: '/docs' },
          { label: tHeader('nav.dashboard'), href: '/dashboard' },
        ]}
      />

      <section className="relative z-10 px-6 pb-16 pt-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-12 md:flex-row">
            <div className="flex-1 text-center md:text-left">
              <Reveal direction="up" delay={1}>
                <span className="q-pill q-pill--live mb-6 text-xs font-bold uppercase tracking-widest">
                  <span className="q-pill__dot" />
                  {t('hero.pill')}
                </span>
              </Reveal>

              <Reveal
                as="h1"
                direction="up"
                delay={2}
                className="balance mb-4 text-5xl font-black tracking-tight text-foreground md:text-7xl"
              >
                {t('hero.title_a')} <span className="text-gradient">{t('hero.title_b')}</span>
              </Reveal>

              <Reveal
                as="p"
                direction="up"
                delay={3}
                className="pretty mx-auto mb-8 max-w-xl text-lg text-muted-foreground md:mx-0"
              >
                {t('hero.subtitle')}
              </Reveal>

              <Reveal
                direction="up"
                delay={4}
                className="flex flex-col items-center gap-4 sm:flex-row md:justify-start"
              >
                <Link
                  className="shadow-accent/25 hover:shadow-accent/30 hover:bg-accent-hover flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 text-base font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
                  href="/dashboard"
                >
                  <Zap className="h-5 w-5" />
                  {t('hero.cta_demo')}
                </Link>
                <Link
                  className="hover:border-accent/30 flex items-center gap-2 rounded-2xl border border-border bg-card px-8 py-4 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted"
                  href="/auth/login"
                >
                  {t('hero.cta_login')}
                </Link>
              </Reveal>
            </div>

            <Reveal direction="scale" delay={5} className="flex-1">
              <div className="relative">
                <HeroIllustration className="mx-auto w-full max-w-[600px]" />

                <div className="animate-float absolute -left-2 top-4 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  {t('hero.label_avi')}
                </div>
                <div className="animate-float-delayed absolute -right-2 top-12 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  {t('hero.label_multi_engine')}
                </div>
                <div className="animate-float-delayed absolute -left-4 bottom-16 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  {t('hero.label_competitor')}
                </div>
                <div className="animate-float absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg">
                  {t('hero.label_aeo_geo')}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 py-16" id="stats">
        <AnimatedStats />
      </section>

      <section className="relative z-10 px-6 pb-24 pt-20" id="features">
        <div className="mx-auto max-w-7xl">
          <Reveal direction="up" className="mb-20 text-center">
            <h2 className="q-h2 mb-4">{t('features.title')}</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              {t('features.subtitle')}
            </p>
          </Reveal>

          <div className="space-y-24">
            {FEATURE_ITEMS.map((item, i) => (
              <FeatureBlock
                key={item.key}
                item={item}
                reversed={i % 2 === 1}
                title={t(`features.items.${item.key}.title`)}
                description={t(`features.items.${item.key}.description`)}
                openLabel={t('features.open_dashboard')}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative z-10 border-y border-border bg-background px-6 py-24"
        id="capabilities"
      >
        <div className="mx-auto max-w-7xl">
          <Reveal direction="up" className="mb-16 text-center">
            <h2 className="q-h2 mb-4">{t('capabilities.title')}</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              {t('capabilities.subtitle')}
            </p>
          </Reveal>

          <Reveal stagger className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {CAPABILITY_ITEMS.map((item) => {
              const Illustration = item.Illustration
              return (
                <div
                  key={item.key}
                  className="group flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <Illustration className="mb-6 h-44 w-auto max-w-[200px]" />
                  <h3 className="q-h6 mb-3">{t(`capabilities.items.${item.key}.title`)}</h3>
                  <p className="q-body text-sm text-muted-foreground">
                    {t(`capabilities.items.${item.key}.description`)}
                  </p>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      <section className="relative z-10 px-6 py-24" id="industries">
        <div className="mx-auto max-w-7xl">
          <Reveal direction="up" className="mb-16 text-center">
            <h2 className="q-h2 mb-4">{t('industries.title')}</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">
              {t('industries.subtitle')}
            </p>
          </Reveal>

          <Reveal stagger className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {INDUSTRY_ITEMS.map((industry) => {
              const Icon = industry.Icon
              return (
                <div key={industry.key} className="q-industry-card group">
                  <Icon className="q-industry-card__icon" />
                  <h3 className="q-industry-card__title">
                    {t(`industries.labels.${industry.key}`)}
                  </h3>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      <section className="relative z-10 border-y border-border bg-background px-6 py-24" id="faq">
        <div className="mx-auto max-w-5xl">
          <Reveal direction="up" className="mb-16 text-center">
            <h2 className="q-h2 mb-4">{t('faq.title')}</h2>
            <p className="q-lead mx-auto max-w-2xl text-muted-foreground">{t('faq.subtitle')}</p>
          </Reveal>

          <div className="grid grid-cols-1 gap-x-16 md:grid-cols-2">
            <Reveal stagger className="space-y-0">
              {faqItems.slice(0, 5).map((faq, i) => (
                <FAQItem
                  key={i}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </Reveal>
            <Reveal stagger className="space-y-0">
              {faqItems.slice(5).map((faq, i) => (
                <FAQItem
                  key={i + 5}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFaq === i + 5}
                  onToggle={() => setOpenFaq(openFaq === i + 5 ? null : i + 5)}
                />
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-24 pt-20">
        <Reveal
          direction="scale"
          className="border-accent/20 bg-accent/5 relative mx-auto max-w-3xl overflow-hidden rounded-3xl border p-12 text-center"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 opacity-30">
            <Ornament variant="burst" />
          </div>

          <h2 className="mb-4 text-4xl font-black tracking-tight text-foreground">
            {t('cta.title')}
          </h2>
          <p className="mb-8 text-muted-foreground">{t('cta.subtitle')}</p>
          <Link
            className="shadow-accent/25 hover:bg-accent-hover inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 font-bold text-accent-foreground shadow-xl transition-all active:scale-95"
            href="/dashboard"
          >
            <Zap className="h-5 w-5" />
            {t('cta.button')}
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {ctaChecks.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {item}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <footer className="q-footer relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <div className="mb-4">
                <AioLogo size={36} textClassName="text-white" />
              </div>
              <p className="q-footer-claim mb-6 max-w-xs">{tFooter('claim')}</p>
              <div className="flex items-center gap-4">
                {(['twitter', 'linkedin', 'youtube'] as const).map((social) => (
                  <Link
                    key={social}
                    className="text-sm text-white/60 transition-colors hover:text-accent"
                    href="#"
                  >
                    {tFooter(`socials.${social}`)}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                {tFooter('product.title')}
              </h4>
              <ul className="space-y-3">
                {(['features', 'pricing', 'api', 'integrations', 'changelog'] as const).map(
                  (item) => (
                    <li key={item}>
                      <Link
                        className="text-sm text-white/80 transition-colors hover:text-accent"
                        href="#"
                      >
                        {tFooter(`product.${item}`)}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                {tFooter('resources.title')}
              </h4>
              <ul className="space-y-3">
                {(['documentation', 'blog', 'help', 'community', 'status'] as const).map((item) => (
                  <li key={item}>
                    <Link
                      className="text-sm text-white/80 transition-colors hover:text-accent"
                      href="#"
                    >
                      {tFooter(`resources.${item}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
                {tFooter('company.title')}
              </h4>
              <ul className="space-y-3">
                {(['about', 'careers', 'privacy', 'terms', 'contact'] as const).map((item) => (
                  <li key={item}>
                    <Link
                      className="text-sm text-white/80 transition-colors hover:text-accent"
                      href="#"
                    >
                      {tFooter(`company.${item}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center md:text-left">
            <p className="q-footer-copy">
              &copy; {new Date().getFullYear()} {APP_NAME}. {tFooter('rights_reserved')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
