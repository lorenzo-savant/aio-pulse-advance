import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, Shield } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Reveal } from '@/components/Reveal'
import { Ornament } from '@/components/Ornament'
import { SiteHeader } from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'GDPR Rights — AEO Pulse Trust Center',
  description: 'Your rights under GDPR and how to exercise them with AEO Pulse.',
}

export default async function GdprPage() {
  const t = await getTranslations('trust_pages')
  const tHeader = await getTranslations('site_header')
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <SiteHeader
        navItems={[
          { label: tHeader('nav.features'), href: '/#features' },
          { label: tHeader('nav.docs'), href: '/docs' },
          { label: tHeader('nav.trust'), href: '/trust', active: true },
        ]}
      />
      <div className="pointer-events-none absolute -right-24 top-16 h-[260px] w-[260px] opacity-20">
        <Ornament variant="orbit" />
      </div>
      <section className="relative border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <Link
            href="/trust"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back_to_trust')}
          </Link>
          <Reveal as="h1" direction="up" delay={1} className="text-3xl font-bold">
            {t('gdpr.title')}
          </Reveal>
          <Reveal as="p" direction="up" delay={2} className="mt-3 max-w-2xl text-muted-foreground">
            {t('gdpr.subtitle')}
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
        {/* Rights */}
        <section>
          <h2 className="mb-6 text-2xl font-bold">Your Rights</h2>
          <div className="space-y-4">
            {[
              {
                article: 'Article 15',
                title: 'Right of Access',
                description:
                  'You have the right to know what personal data we process about you, why we process it, who we share it with, and how long we keep it.',
                howTo:
                  'Go to Settings → Data → Export my data. You will receive a ZIP file containing all your personal data in JSON and CSV format.',
              },
              {
                article: 'Article 16',
                title: 'Right to Rectification',
                description:
                  'You have the right to correct inaccurate or incomplete personal data.',
                howTo:
                  'Update your profile information directly in Settings → Account. For data corrections, contact support.',
              },
              {
                article: 'Article 17',
                title: 'Right to Erasure (Right to be Forgotten)',
                description:
                  'You have the right to request deletion of your personal data when it is no longer necessary for the purpose it was collected.',
                howTo:
                  'Go to Settings → Data → Delete my account. Your data will be scheduled for deletion in 30 days (grace period). You can cancel this request within the grace period.',
              },
              {
                article: 'Article 20',
                title: 'Right to Data Portability',
                description:
                  'You have the right to receive your personal data in a structured, commonly used, machine-readable format and transfer it to another controller.',
                howTo:
                  'Use the Export feature (Settings → Data) to download all your data in JSON and CSV format.',
              },
              {
                article: 'Article 21',
                title: 'Right to Object',
                description:
                  'You have the right to object to processing of your personal data based on legitimate interests or direct marketing.',
                howTo:
                  'Contact us at dpo@aio-pulse.com with your objection. We will respond within 30 days.',
              },
              {
                article: 'Article 7',
                title: 'Right to Withdraw Consent',
                description:
                  'If we process your data based on consent, you can withdraw it at any time.',
                howTo: 'Manage your consent preferences in Settings → Privacy.',
              },
            ].map((right) => (
              <div key={right.article} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {right.article}
                      </span>
                      <h3 className="text-lg font-semibold">{right.title}</h3>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{right.description}</p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <span className="font-medium">How to exercise:</span> {right.howTo}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data Retention */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-xl font-bold">Data Retention</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Account data</span>
              <span className="font-medium">Until account deletion + 30 days</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Audit logs</span>
              <span className="font-medium">24 months (anonymized after deletion)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Monitoring results</span>
              <span className="font-medium">Until brand/workspace deletion</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Backups</span>
              <span className="font-medium">7 days (free) / 30 days (paid)</span>
            </div>
          </div>
        </section>

        {/* DPO Contact */}
        <section className="rounded-xl border border-border bg-card p-6 text-center">
          <Mail className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h2 className="mb-2 text-xl font-bold">Data Protection Officer</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            For any questions about your GDPR rights or our data practices, contact our DPO:
          </p>
          <a
            href="mailto:dpo@aio-pulse.com"
            className="inline-flex items-center gap-2 text-primary underline"
          >
            dpo@aio-pulse.com
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            We respond to all data subject requests within 30 days as required by GDPR.
          </p>
        </section>
      </div>
    </div>
  )
}
