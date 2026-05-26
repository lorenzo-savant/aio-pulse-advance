import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Globe, CheckCircle, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sub-Processors — AIO Pulse Trust Center',
  description: 'Complete list of third-party sub-processors used by AIO Pulse.',
}

const subProcessors = [
  {
    name: 'Supabase',
    purpose: 'Primary database (PostgreSQL), authentication, and file storage',
    location: 'EU (Frankfurt, Germany)',
    type: 'Infrastructure',
    dpa: 'Yes',
    website: 'https://supabase.com',
  },
  {
    name: 'Vercel',
    purpose: 'Application hosting, edge network, and serverless functions',
    location: 'EU (Frankfurt, Germany)',
    type: 'Infrastructure',
    dpa: 'Yes',
    website: 'https://vercel.com',
  },
  {
    name: 'Stripe',
    purpose: 'Payment processing, subscription management, and invoicing',
    location: 'US / EU (Ireland)',
    type: 'Payments',
    dpa: 'Yes',
    website: 'https://stripe.com',
  },
  {
    name: 'Sentry',
    purpose: 'Error monitoring, performance tracking, and crash reporting',
    location: 'US',
    type: 'Monitoring',
    dpa: 'Yes',
    website: 'https://sentry.io',
  },
  {
    name: 'OpenAI',
    purpose: 'LLM queries for AI visibility analysis (ChatGPT engine)',
    location: 'US',
    type: 'AI Provider',
    dpa: 'Yes',
    website: 'https://openai.com',
  },
  {
    name: 'Anthropic',
    purpose: 'LLM queries for AI visibility analysis (Claude engine)',
    location: 'US',
    type: 'AI Provider',
    dpa: 'Yes',
    website: 'https://anthropic.com',
  },
  {
    name: 'Google AI',
    purpose: 'LLM queries for AI visibility analysis (Gemini engine)',
    location: 'US / EU',
    type: 'AI Provider',
    dpa: 'Yes',
    website: 'https://ai.google',
  },
  {
    name: 'Perplexity AI',
    purpose: 'LLM queries for AI visibility analysis (Perplexity engine)',
    location: 'US',
    type: 'AI Provider',
    dpa: 'Yes',
    website: 'https://perplexity.ai',
  },
  {
    name: 'Upstash',
    purpose: 'Redis caching, rate limiting, and queue management',
    location: 'EU (Frankfurt, Germany)',
    type: 'Infrastructure',
    dpa: 'Yes',
    website: 'https://upstash.com',
  },
  {
    name: 'Resend',
    purpose: 'Transactional email delivery (alerts, notifications, onboarding)',
    location: 'US',
    type: 'Communication',
    dpa: 'Yes',
    website: 'https://resend.com',
  },
]

export default function SubProcessorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <Link
            href="/trust"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trust Center
          </Link>
          <h1 className="text-3xl font-bold">Sub-Processors</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            AIO Pulse engages the following third-party sub-processors to deliver our service. All
            sub-processors are bound by Data Processing Agreements (DPAs) that comply with GDPR
            Article 28.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Provider</th>
                <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                <th className="px-4 py-3 text-left font-semibold">Data Location</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">DPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subProcessors.map((sp) => (
                <tr key={sp.name} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{sp.name}</div>
                    <a
                      href={sp.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      {sp.website.replace('https://', '')}
                    </a>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">{sp.purpose}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {sp.location}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {sp.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Signed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Sub-Processor Change Policy</h2>
          <p className="text-sm text-muted-foreground">
            We will notify customers at least 30 days before adding or replacing any sub-processor.
            Customers have the right to object to new sub-processors on legitimate data protection
            grounds. This list is updated quarterly and reviewed as part of our annual security
            audit.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: May 2026
          </div>
        </div>
      </div>
    </div>
  )
}
