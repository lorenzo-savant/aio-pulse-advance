import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, FileText, Download, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Data Processing Agreement — AIO Pulse Trust Center',
  description: 'Download the Data Processing Agreement (DPA) for AIO Pulse.',
}

export default function DpaPage() {
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
          <h1 className="text-3xl font-bold">Data Processing Agreement</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            This Data Processing Agreement (DPA) governs the processing of personal data by AIO
            Pulse on behalf of its customers, in compliance with the EU General Data Protection
            Regulation (GDPR).
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
        {/* Download */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="bg-primary/10 rounded-lg p-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">DPA Template</h2>
              <p className="text-sm text-muted-foreground">
                Based on EU Standard Contractual Clauses (SCCs)
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </section>

        {/* DPA Summary */}
        <section>
          <h2 className="mb-4 text-xl font-bold">DPA Summary</h2>
          <div className="space-y-4">
            {[
              {
                title: 'Parties',
                content:
                  'Data Controller: the customer (you). Data Processor: AIO Pulse (operated by Acasting S.r.l.).',
              },
              {
                title: 'Scope',
                content:
                  'This DPA applies to all personal data processed by AIO Pulse on behalf of the customer in connection with the use of the AIO Pulse SaaS platform.',
              },
              {
                title: 'Legal Basis',
                content:
                  'Processing is governed by EU Standard Contractual Clauses (SCCs) as adopted by the European Commission (Decision 2021/914).',
              },
              {
                title: 'Data Categories',
                content:
                  'Account information (name, email), brand data (names, domains, competitors), monitoring results (AI engine responses), audit logs, and usage analytics.',
              },
              {
                title: 'Data Subject Rights',
                content:
                  'AIO Pulse will assist the customer in responding to data subject requests (access, rectification, erasure, portability) within 30 days.',
              },
              {
                title: 'Sub-Processors',
                content:
                  'AIO Pulse engages sub-processors as listed in the Sub-Processors page. Customers will be notified 30 days before any new sub-processor is engaged.',
              },
              {
                title: 'Security Measures',
                content:
                  'AIO Pulse implements technical and organizational measures as described in the Security Practices page, including encryption, RLS, RBAC, and audit logging.',
              },
              {
                title: 'Data Breach Notification',
                content:
                  'AIO Pulse will notify the customer without undue delay (within 72 hours) upon becoming aware of a personal data breach.',
              },
              {
                title: 'Data Return/Deletion',
                content:
                  'Upon termination, AIO Pulse will return or delete all personal data within 30 days, unless EU or Member State law requires retention.',
              },
              {
                title: 'Audits',
                content:
                  'Customers may request audit reports annually. AIO Pulse will provide relevant security certifications and audit results upon request.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.content}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Compliance Badges */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Compliance Framework</h2>
          <div className="flex flex-wrap gap-3">
            {[
              'GDPR Compliant',
              'EU SCCs',
              'CCPA Ready',
              'Data Residency: EU',
              'Annual Security Audit',
            ].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
              >
                <CheckCircle className="h-3 w-3" />
                {badge}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
