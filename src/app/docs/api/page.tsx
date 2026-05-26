'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import { ChevronRight, Copy, Check, Lock, AlertCircle, List, Clock } from 'lucide-react'

interface ApiEndpoint {
  method: string
  path: string
  description: string
  auth: boolean
  pagination?: boolean
  query?: string
  body?: Record<string, string>
}

interface ApiCategory {
  category: string
  endpoints: ApiEndpoint[]
}

const API_ENDPOINTS: ApiCategory[] = [
  {
    category: 'Authentication',
    endpoints: [
      {
        method: 'GET',
        path: '/api/auth/me',
        description: 'Get current user info',
        auth: true,
      },
    ],
  },
  {
    category: 'Brands',
    endpoints: [
      {
        method: 'GET',
        path: '/api/brands',
        description: 'List all brands for the authenticated user',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/brands',
        description: 'Create a new brand',
        auth: true,
        body: { name: 'string', domain: 'string?' },
      },
      {
        method: 'GET',
        path: '/api/brands/:id',
        description: 'Get brand details',
        auth: true,
      },
      {
        method: 'PATCH',
        path: '/api/brands/:id',
        description: 'Update brand',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/brands/:id',
        description: 'Delete brand',
        auth: true,
      },
    ],
  },
  {
    category: 'Prompts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/prompts',
        description: 'List prompts with optional brand filter',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&page=1&limit=20',
      },
      {
        method: 'POST',
        path: '/api/prompts',
        description: 'Create a new prompt',
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
        description: 'Delete a prompt',
        auth: true,
      },
    ],
  },
  {
    category: 'Monitoring',
    endpoints: [
      {
        method: 'GET',
        path: '/api/monitoring',
        description: 'List monitoring results',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&engine=chatgpt&page=1&limit=50',
      },
      {
        method: 'POST',
        path: '/api/monitoring',
        description: 'Run monitoring for a prompt',
        auth: true,
        body: { prompt_id: 'uuid', engines: 'array?' },
      },
    ],
  },
  {
    category: 'Scans',
    endpoints: [
      {
        method: 'GET',
        path: '/api/scans',
        description: 'List scan history',
        auth: true,
        pagination: true,
        query: '?brand_id=uuid&page=1&limit=20',
      },
      {
        method: 'POST',
        path: '/api/scans',
        description: 'Save a scan to history',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/scans?id=uuid',
        description: 'Delete a scan',
        auth: true,
      },
    ],
  },
  {
    category: 'Team',
    endpoints: [
      {
        method: 'GET',
        path: '/api/team?brand_id=uuid',
        description: 'List team members for a brand',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/team',
        description: 'Invite a team member',
        auth: true,
        body: { brand_id: 'uuid', email: 'string', role: 'editor | viewer' },
      },
      {
        method: 'DELETE',
        path: '/api/team?member_id=uuid',
        description: 'Remove a team member',
        auth: true,
      },
    ],
  },
  {
    category: 'Alerts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/alerts',
        description: 'List alerts',
        auth: true,
        pagination: true,
      },
      {
        method: 'POST',
        path: '/api/alerts',
        description: 'Create an alert rule',
        auth: true,
      },
      {
        method: 'PATCH',
        path: '/api/alerts?id=uuid',
        description: 'Update an alert',
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/alerts?id=uuid',
        description: 'Delete an alert',
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
        <h1 className="text-3xl font-black tracking-tight text-white">API Documentation</h1>
        <p className="mt-2 text-gray-400">
          Complete reference for the AIO Pulse API. All endpoints require authentication.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <Lock className="text-brand-400 h-5 w-5" />
          Authentication
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>All API endpoints require authentication. Use one of the following methods:</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2 text-gray-500">// Bearer token</p>
            <p>Authorization: Bearer YOUR_ACCESS_TOKEN</p>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2 text-gray-500">// Cookie (automatic with browser)</p>
            <p>Cookie: sb-access-token=...</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <List className="text-brand-400 h-5 w-5" />
          Pagination
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>List endpoints support pagination with the following query parameters:</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2">?page=1&amp;limit=20</p>
            <p className="text-gray-500">// page: 1-indexed, limit: 1-100 (default 20)</p>
          </div>
          <p>Response includes pagination info:</p>
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
          Error Responses
        </h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>All errors follow a consistent format:</p>
          <div className="rounded-lg bg-gray-900/50 p-4 font-mono text-xs">
            <p className="mb-2 text-red-400">400 - Bad Request</p>
            <p className="mb-2 text-red-400">401 - Unauthorized</p>
            <p className="mb-2 text-red-400">403 - Forbidden</p>
            <p className="mb-2 text-red-400">404 - Not Found</p>
            <p className="mb-2 text-red-400">422 - Validation Error</p>
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
              <span className="font-medium text-white">{category.category}</span>
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
                    <p className="mt-2 text-sm text-gray-400">{endpoint.description}</p>
                    {endpoint.query && (
                      <div className="mt-2">
                        <code className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">
                          {endpoint.query}
                        </code>
                      </div>
                    )}
                    {endpoint.pagination && (
                      <div className="mt-2">
                        <Badge variant="info">Pagination</Badge>
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
          Rate Limits
        </h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p>API requests are rate limited:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong className="text-gray-300">100 requests</strong> per minute per user
            </li>
            <li>
              <strong className="text-gray-300">1000 requests</strong> per hour per user
            </li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Rate limit headers are included in all responses: X-RateLimit-Limit,
            X-RateLimit-Remaining, X-RateLimit-Reset
          </p>
        </div>
      </Card>
    </div>
  )
}
