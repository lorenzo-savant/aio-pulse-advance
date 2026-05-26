'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Download, Activity } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface AuditLog {
  id: string
  action: string
  actorId: string
  actorType: 'user' | 'api_key' | 'system'
  resourceType: string
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

const ACTION_ICONS: Record<string, string> = {
  'auth.login': '🔐',
  'auth.logout': '🚪',
  'org.created': '🏢',
  'org.member.added': '👤',
  'org.member.removed': '👤',
  'workspace.created': '📁',
  'workspace.member.added': '👥',
  'workspace.member.removed': '👥',
  'workspace.member.role.changed': '🔄',
  'brand.created': '🏷️',
  'brand.updated': '✏️',
  'brand.deleted': '🗑️',
  'api_key.created': '🔑',
  'api_key.revoked': '🚫',
  'api_key.used': '📡',
  'billing.plan.changed': '💳',
  'billing.payment.succeeded': '✅',
  'billing.payment.failed': '❌',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [page, actionFilter, resourceTypeFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String((page - 1) * 50),
      })

      if (actionFilter) params.set('action', actionFilter)
      if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)

      const res = await fetch(`/api/audit-logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(data)
      setHasMore(data.length === 50)
    } catch (err) {
      console.error('Error fetching audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)

      const res = await fetch(`/api/audit-logs/export?${params}`)
      if (!res.ok) throw new Error('Failed to export')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting:', err)
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      log.action.toLowerCase().includes(search) ||
      log.actorId.toLowerCase().includes(search) ||
      log.resourceType.toLowerCase().includes(search) ||
      (log.resourceId && log.resourceId.toLowerCase().includes(search))
    )
  })

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort()
  const uniqueResourceTypes = [...new Set(logs.map((l) => l.resourceType))].sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable record of all organization actions
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-input bg-input py-2 pl-10 pr-3 text-sm"
                placeholder="Search actions, actors..."
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-input bg-input px-3 py-2 text-sm"
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <select
              value={resourceTypeFilter}
              onChange={(e) => {
                setResourceTypeFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-input bg-input px-3 py-2 text-sm"
            >
              <option value="">All Resources</option>
              {uniqueResourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-input px-3 py-2 text-sm"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-input px-3 py-2 text-sm"
                placeholder="To"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Activity className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No audit logs found</p>
            <p className="mt-1 text-xs">Actions will appear here as they occur</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardBody className="flex items-start gap-4">
                <div className="flex-shrink-0 text-2xl">{ACTION_ICONS[log.action] ?? '📋'}</div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {log.action}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {log.actorType === 'api_key'
                        ? '🔑 API Key'
                        : log.actorType === 'system'
                          ? '⚙️ System'
                          : '👤 User'}
                    </span>
                  </div>

                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Resource:</span>{' '}
                    <span className="font-medium">
                      {log.resourceType}
                      {log.resourceId && ` (${log.resourceId.slice(0, 8)}...)`}
                    </span>
                  </div>

                  {log.ipAddress && (
                    <div className="mt-1 text-xs text-muted-foreground">IP: {log.ipAddress}</div>
                  )}

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        View metadata
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-medium">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
