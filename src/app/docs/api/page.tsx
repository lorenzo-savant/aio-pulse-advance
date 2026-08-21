'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import { ChevronRight, Copy, Check, Lock, AlertCircle, List, Clock } from 'lucide-react'

interface ApiEndpoint {
  method: string
  path: string
  /** Catalog slug: api_docs.ep_<slug> holds the localised description. */
  slug: string
  auth: boolean
  pagination?: boolean
  query?: string
  body?: Record<string, string>
}

interface ApiCategory {
  /** Catalog slug: api_docs.cat_<slug> holds the localised category name. */
  category: string
  endpoints: ApiEndpoint[]
}

const API_ENDPOINTS: ApiCategory[] = [
  {
    category: 'authentication',
    endpoints: [
      {
        method: 'GET',
        path: '/api/auth/me',
        slug: 'auth_me',
        auth: true,
      },
    ],
  },
  {
    category: 'brands',
    endpoints: [
      {
        method: 'GET',
        path: '/api/brands',
        slug: 'brands_list',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/brands',
        slug: 'brands_create',
        auth: true,
        body: { name: 'string', domain: 'string?' },
      },
      {
        method: 'GET',
        path: '/api/brands/:id',
        slug: 'brands_get',
        auth: true,
      },
      {
        method: 'PATCH',
        path: '/api/brands/:id',
        slug: 'brands_update',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/brands/:id',
        slug: 'brands_delete',
        auth: true,
      },
    ],
  },
  {
    category: 'prompts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/prompts',
        slug: 'prompts_list',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&page=1&limit=20',
      },
      {
        method: 'POST',
        path: '/api/prompts',
        slug: 'prompts_create',
        auth: true,
        body: {
          brand_id: 'uuid',
          text: 'string (5-500 chars)',
          engines: "['chatgpt', 'gemini', 'perplexity']",
          category: 'awareness | comparison | alternative | features | custom',
          run_frequency: 'hourly | daily | weekly',
        },
      },
      {
        method: 'DELETE',
        path: '/api/prompts?id=uuid',
        slug: 'prompts_delete',
        auth: true,
      },
    ],
  },
  {
    category: 'monitoring',
    endpoints: [
      {
        method: 'GET',
        path: '/api/monitoring',
        slug: 'monitoring_list',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&engine=chatgpt&page=1&limit=50',
      },
      {
        method: 'POST',
        path: '/api/monitoring',
        slug: 'monitoring_run',
        auth: true,
        body: { prompt_id: 'uuid', engines: 'array?' },
      },
    ],
  },
  {
    category: 'scans',
    endpoints: [
      {
        method: 'GET',
        path: '/api/scans',
        slug: 'scans_list',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&page=1&limit=20',
      },
      {
        method: 'POST',
        path: '/api/scans',
        slug: 'scans_create',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/scans?id=uuid',
        slug: 'scans_delete',
        auth: true,
      },
    ],
  },
  {
    category: 'team',
    endpoints: [
      {
        method: 'GET',
        path: '/api/team?brand_id=uuid',
        slug: 'team_list',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/team',
        slug: 'team_invite',
        auth: true,
        body: { brand_id: 'uuid', email: 'string', role: 'editor | viewer' },
      },
      {
        method: 'DELETE',
        path: '/api/team?member_id=uuid',
        slug: 'team_remove',
        auth: true,
      },
    ],
  },
  {
    category: 'alerts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/alerts',
        slug: 'alerts_list',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/alerts',
        slug: 'alerts_create',
        auth: true,
      },
      {
        method: 'PATCH',
        path: '/api/alerts?id=uuid',
        slug: 'alerts_update',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/alerts?id=uuid',
        slug: 'alerts_delete',
        auth: true,
      },
    ],
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PATCH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function ApiDocsPage() {
  const t = useTranslations('api_docs')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Brands')
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEndpoint(text)
    setTimeout(() => setCopiedEndpoint(null), 2000)
  }

  return (
    <div className="animate-in space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">{t('page_title')}</h1>
        <p className="mt-2 text-gray-400">{t('page_subtitle')}</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <Lock className="text-brand-400 h-5 w-5" />
          {t('authentication')}
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>{t('auth_intro')}</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2 text-gray-500">{t('auth_bearer_comment')}</p>
            <p>Authorization: Bearer YOUR_ACCESS_TOKEN</p>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2 text-gray-500">{t('auth_cookie_comment')}</p>
            <p>Cookie: sb-access-token=...</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <List className="text-brand-400 h-5 w-5" />
          {t('pagination')}
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>{t('pagination_intro')}</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2">?page=1&amp;limit=20</p>
            <p className="text-gray-500">{t('pagination_comment')}</p>
          </div>
          <p>{t('pagination_response')}</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p>
              {
                '{"success": true, "data": [...], "pagination": {"page": 1, "perPage": 20, "total": 100, "totalPages": 5, "hasMore": true}}'
              }
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <AlertCircle className="text-brand-400 h-5 w-5" />
          {t('errors')}
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>{t('errors_intro')}</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="text-red-400 mb-2">400 - Bad Request</p>
            <p className="text-red-400 mb-2">401 - Unauthorized</p>
            <p className="text-red-400 mb-2">403 - Forbidden</p>
            <p className="text-red-400 mb-2">404 - Not Found</p>
            <p className="text-red-400 mb-2">422 - Validation Error</p>
            <p className="text-red-400">500 - Internal Server Error</p>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p>{'{"success": false, "message": "Error description", "details": {...}}'}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {API_ENDPOINTS.map((category) => (
          <div
            key={category.category}
            className="overflow-hidden rounded-xl border border-gray-800"
          >
            <button
              className="flex w-full items-center justify-between bg-gray-900/50 px-4 py-3 text-left transition-colors hover:bg-gray-900/70"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === category.category ? null : category.category,
                )
              }
            >
              <span className="font-medium text-white">{t(`cat_${category.category}`)}</span>
              <ChevronRight
                className={cn(
                  'h-5 w-5 text-gray-500 transition-transform',
                  expandedCategory === category.category && 'rotate-90',
                )}
              />
            </button>
            {expandedCategory === category.category && (
              <div className="divide-y divide-gray-800">
                {category.endpoints.map((endpoint) => (
                  <div key={`${endpoint.method}-${endpoint.path}`} className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-bold',
                          METHOD_COLORS[endpoint.method],
                        )}
                      >
                        {endpoint.method}
                      </span>
                      <code className="flex-1 font-mono text-sm text-gray-300">
                        {endpoint.path}
                      </code>
                      <button
                        onClick={() => copyToClipboard(endpoint.path)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                      >
                        {copiedEndpoint === endpoint.path ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{t(`ep_${endpoint.slug}`)}</p>
                    {endpoint.query && (
                      <div className="mt-2">
                        <code className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">
                          {endpoint.query}
                        </code>
                      </div>
                    )}
                    {endpoint.pagination && (
                      <div className="mt-2">
                        <Badge variant="info">{t('pagination_badge')}</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <Clock className="text-brand-400 h-5 w-5" />
          {t('rate_limits')}
        </h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p>{t('rate_limits_intro')}</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              {t.rich('rate_limit_minute', {
                b: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich('rate_limit_hour', {
                b: (chunks) => <strong className="text-gray-300">{chunks}</strong>,
              })}
            </li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">{t('rate_limit_headers')}</p>
        </div>
      </Card>
    </div>
  )
}
