import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Cloud, Eye, Database, FileText, Key, Users, Server, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security Practices — AIO Pulse Trust Center',
  description: 'Detailed security practices and controls implemented by AIO Pulse.',
}

const practices = [
  {
    icon: Lock,
    title: 'Encryption at Rest',
    status: 'Active',
    detail: 'All data stored in Supabase Postgres is encrypted at rest using AES-256 encryption. This is managed by Supabase infrastructure and applies to all database tables, including customer data, audit logs, and configuration.',
  },
  {
    icon: Cloud,
    title: 'Encryption in Transit',
    status: 'Active',
    detail: 'All communications between clients and AIO Pulse are encrypted using TLS 1.3 via Vercel\'s edge network. HSTS is enforced. No data is transmitted over unencrypted channels.',
  },
  {
    icon: Key,
    title: 'API Key Security',
    status: 'Active',
    detail: 'API keys are stored as bcrypt hashes (never plaintext). Keys are scoped with granular permissions (read/write per resource). Keys can be revoked instantly and have optional expiration dates. Key prefixes are visible for identification; full keys are shown only once at creation.',
  },
  {
    icon: Shield,
    title: 'Row-Level Security (RLS)',
    status: 'Active',
    detail: 'Postgres RLS policies ensure that users can only access data belonging to their organization/workspace. RLS is enforced at the database level, providing defense-in-depth even if application-layer controls fail.',
  },
  {
    icon: Users,
    title: 'Role-Based Access Control (RBAC)',
    status: 'Active',
    detail: 'Four workspace roles (owner, admin, editor, viewer) with granular permission matrix. Organization-level roles (owner, admin, billing, member) control org-wide settings. Permissions are checked on every API request.',
  },
  {
    icon: Eye,
    title: 'Audit Logging',
    status: 'Active',
    detail: 'All critical actions are logged to an immutable, append-only audit trail. Audit logs cannot be modified or deleted by users (enforced via RLS). Logs are exportable in CSV format for compliance reviews.',
  },
  {
    icon: Database,
    title: 'Backups & Recovery',
    status: 'Active',
    detail: 'Supabase performs daily automated backups with 7-day retention on free plans and 30-day retention on paid plans. Point-in-time recovery is available. Backup integrity is verified quarterly.',
  },
  {
    icon: Server,
    title: 'Infrastructure Security',
    status: 'Active',
    detail: 'Hosted on Vercel\'s global edge network with automatic DDoS protection. Server-side code runs in isolated serverless functions. No persistent servers to manage or patch.',
  },
  {
    icon: FileText,
    title: 'Vulnerability Management',
    status: 'Active',
    detail: 'Dependencies are scanned via npm audit on every CI run. Critical vulnerabilities are patched within 24 hours. Internal security audit completed March 2026 (score: 85/100). External penetration test planned Q4 2026.',
  },
]

export default function SecurityPage() {
  return (
    <div className='min-h-screen bg-background'>
      <section className='border-b border-border bg-card'>
        <div className='mx-auto max-w-5xl px-6 py-12'>
          <Link href='/trust' className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6'>
            <ArrowLeft className='h-4 w-4' />
            Back to Trust Center
          </Link>
          <h1 className='text-3xl font-bold'>Security Practices</h1>
          <p className='mt-3 text-muted-foreground max-w-2xl'>
            A detailed overview of the security controls and practices implemented across AIO Pulse.
            Our security posture is reviewed quarterly and audited annually.
          </p>
        </div>
      </section>

      <div className='mx-auto max-w-5xl px-6 py-12 space-y-6'>
        {practices.map((p) => (
          <div
            key={p.title}
            className='rounded-xl border border-border bg-card p-6'
          >
            <div className='flex items-start gap-4'>
              <div className='p-2 bg-primary/10 rounded-lg'>
                <p.icon className='h-5 w-5 text-primary' />
              </div>
              <div className='flex-1'>
                <div className='flex items-center gap-3 mb-2'>
                  <h2 className='text-lg font-semibold'>{p.title}</h2>
                  <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400'>
                    <CheckCircle className='h-3 w-3' />
                    {p.status}
                  </span>
                </div>
                <p className='text-sm text-muted-foreground'>{p.detail}</p>
              </div>
            </div>
          </div>
        ))}

        <div className='rounded-xl border border-border bg-card p-6 mt-8'>
          <h2 className='text-lg font-semibold mb-3'>Security Score & Audit History</h2>
          <div className='space-y-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Internal Audit (March 2026)</span>
              <span className='font-medium'>85/100</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>External Penetration Test</span>
              <span className='font-medium text-yellow-600'>Planned Q4 2026</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Dependency Scanning</span>
              <span className='font-medium text-green-600'>Continuous (CI/CD)</span>
            </div>
          </div>
        </div>

        <div className='rounded-xl border border-border bg-card p-6'>
          <h2 className='text-lg font-semibold mb-3'>Responsible Disclosure</h2>
          <p className='text-sm text-muted-foreground'>
            If you discover a security vulnerability in AIO Pulse, please report it responsibly to{' '}
            <a href='mailto:security@aio-pulse.com' className='text-primary underline'>
              security@aio-pulse.com
            </a>
            . We commit to acknowledging your report within 48 hours and providing a resolution timeline within 7 days.
          </p>
        </div>
      </div>
    </div>
  )
}
