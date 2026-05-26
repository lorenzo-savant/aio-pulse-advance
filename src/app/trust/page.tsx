import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Shield,
  Database,
  Cloud,
  Eye,
  Lock,
  FileText,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Trust Center — AIO Pulse',
  description: 'Security, compliance, and data protection information for AIO Pulse.',
  openGraph: {
    title: 'Trust Center — AIO Pulse',
    description: 'Security, compliance, and data protection information.',
    type: 'website',
  },
}

const complianceStatus = [
  { name: 'GDPR', status: 'compliant', detail: 'DPA, data export/deletion, RoPA' },
  { name: 'CCPA', status: 'compliant', detail: 'Right to know, delete, opt-out' },
  { name: 'SOC 2', status: 'planned', detail: 'Planned Q4 2026' },
  { name: 'ISO 27001', status: 'planned', detail: 'Under consideration' },
]

const securityPractices = [
  {
    icon: Lock,
    title: 'Encryption at Rest',
    description: 'All data encrypted AES-256 via Supabase Postgres default encryption.',
  },
  {
    icon: Cloud,
    title: 'Encryption in Transit',
    description: 'HTTPS/TLS 1.3 enforced via Vercel edge network.',
  },
  {
    icon: Shield,
    title: 'Access Control',
    description: 'Row-Level Security (RLS) on Postgres + RBAC application layer.',
  },
  {
    icon: Eye,
    title: 'Audit Logs',
    description: 'Immutable, append-only audit trail for all critical actions. Exportable.',
  },
  {
    icon: Database,
    title: 'Backups',
    description: 'Supabase daily snapshots. 7-day retention standard, 30-day on paid plans.',
  },
  {
    icon: FileText,
    title: 'Vulnerability Disclosure',
    description: 'Responsible disclosure via security@aio-pulse.com.',
  },
]

export default function TrustCenterPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="text-3xl font-bold md:text-4xl">Trust Center</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            AIO Pulse is built with security and compliance at its core. Here you will find
            everything you need to evaluate our security posture.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-12">
        {/* Compliance Status */}
        <section>
          <h2 className="mb-6 text-2xl font-bold">Compliance Status</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {complianceStatus.map((c) => (
              <div
                key={c.name}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
              >
                {c.status === 'compliant' ? (
                  <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-yellow-500" />
                )}
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.detail}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === 'compliant'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {c.status === 'compliant' ? 'Compliant' : 'Planned'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Security Practices */}
        <section>
          <h2 className="mb-6 text-2xl font-bold">Security Practices</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {securityPractices.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                <p.icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="mb-1 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Full security details:{' '}
            <Link href="/trust/security" className="text-primary underline">
              Security Practices →
            </Link>
          </p>
        </section>

        {/* Sub-Processors */}
        <section>
          <h2 className="mb-4 text-2xl font-bold">Sub-Processors</h2>
          <p className="mb-4 text-muted-foreground">
            We work with trusted third-party providers to deliver our service. All sub-processors
            are bound by Data Processing Agreements (DPAs).
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Provider</th>
                  <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                  <th className="px-4 py-3 text-left font-semibold">Data Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  {
                    name: 'Supabase',
                    purpose: 'Database, Auth, Storage',
                    location: 'EU (Frankfurt)',
                  },
                  { name: 'Vercel', purpose: 'Hosting & Edge Network', location: 'EU (Frankfurt)' },
                  { name: 'Stripe', purpose: 'Payment Processing', location: 'US / EU' },
                  { name: 'Sentry', purpose: 'Error Monitoring', location: 'US' },
                  { name: 'OpenAI', purpose: 'LLM Queries (ChatGPT)', location: 'US' },
                  { name: 'Anthropic', purpose: 'LLM Queries (Claude)', location: 'US' },
                  { name: 'Google AI', purpose: 'LLM Queries (Gemini)', location: 'US / EU' },
                  { name: 'Perplexity', purpose: 'LLM Queries', location: 'US' },
                  { name: 'Upstash', purpose: 'Redis & Rate Limiting', location: 'EU (Frankfurt)' },
                ].map((sp) => (
                  <tr key={sp.name} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{sp.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sp.purpose}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Full list with details:{' '}
            <Link href="/trust/sub-processors" className="text-primary underline">
              View all sub-processors →
            </Link>
          </p>
        </section>

        {/* DPA */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-2 text-xl font-bold">Data Processing Agreement (DPA)</h2>
          <p className="mb-4 text-muted-foreground">
            Our DPA is based on the EU Standard Contractual Clauses (SCCs) and covers all data
            processing activities. Available for download below.
          </p>
          <div className="flex gap-3">
            <Link
              href="/trust/dpa"
              className="hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <FileText className="h-4 w-4" />
              Download DPA
            </Link>
          </div>
        </section>

        {/* GDPR Rights */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-2 text-xl font-bold">Your GDPR Rights</h2>
          <p className="mb-4 text-muted-foreground">
            Under GDPR, you have the right to access, export, and delete your personal data. You can
            exercise these rights directly from your dashboard settings.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { right: 'Right of Access (Art. 15)', desc: 'Know what data we hold about you' },
              {
                right: 'Right to Portability (Art. 20)',
                desc: 'Export your data in a machine-readable format',
              },
              {
                right: 'Right to Erasure (Art. 17)',
                desc: 'Request deletion of your personal data',
              },
              {
                right: 'Right to Rectification (Art. 16)',
                desc: 'Correct inaccurate personal data',
              },
            ].map((r) => (
              <div key={r.right} className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <div className="text-sm font-medium">{r.right}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Learn more:{' '}
            <Link href="/trust/gdpr" className="text-primary underline">
              GDPR Rights →
            </Link>
          </p>
        </section>

        {/* Contact */}
        <section className="py-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Contact</h2>
          <p className="text-muted-foreground">
            Security inquiries:{' '}
            <a href="mailto:security@aio-pulse.com" className="text-primary underline">
              security@aio-pulse.com
            </a>
          </p>
          <p className="mt-1 text-muted-foreground">
            Data Protection Officer:{' '}
            <a href="mailto:dpo@aio-pulse.com" className="text-primary underline">
              dpo@aio-pulse.com
            </a>
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Internal audit completed March 2026 (85/100). External penetration test planned Q4 2026.
          </p>
        </section>
      </div>
    </div>
  )
}
