'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Shield, Filter, RefreshCw, Search, Calendar, User, Key } from 'lucide-react'

interface AuditLog {
  id: string
  organizationId: string
  workspaceId: string | null
  actorId: string
  actorType: 'user' | 'api_key' | 'system'
  actorApiKeyId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  'auth.': 'blue',
  'org.': 'purple',
  'workspace.': 'indigo',
  'brand.': 'green',
  'api_key.': 'orange',
  'billing.': 'red',
  'data.': 'yellow',
  'settings.': 'gray',
  'sso.': 'pink',
}

function getActionColor(action: string): string {
  for (const [prefix, color] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix)) return color
  }
  return 'gray'
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    actorId: '',
    from: '',
    to: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const orgId = localStorage.getItem('currentOrganizationId')
    if (orgId) setOrganizationId(orgId)
  }, [])

  useEffect(() => {
    if (!organizationId) return
    fetchLogs()
  }, [organizationId])

  const fetchLogs = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ organizationId })
      if (filters.action) params.set('action', filters.action)
      if (filters.resourceType) params.set('resourceType', filters.resourceType)
      if (filters.actorId) params.set('actorId', filters.actorId)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)

      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAction = (action: string) => action.replace(/\./g, ' › ')

  const formatMetadata = (metadata: Record<string, unknown>) => {
    const entries = Object.entries(metadata)
    if (entries.length === 0) return null
    return entries.map(([key, value]) => (
      <span key={key} className="text-xs text-muted-foreground">
        {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
      </span>
    ))
  }

  if (!organizationId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          No organization selected. Please select an organization first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Compliance trail for all organization actions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Action</label>
                <input
                  type="text"
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  placeholder="e.g. auth.login"
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Resource Type</label>
                <input
                  type="text"
                  value={filters.resourceType}
                  onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                  placeholder="e.g. brand"
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Actor ID</label>
                <input
                  type="text"
                  value={filters.actorId}
                  onChange={(e) => setFilters({ ...filters, actorId: e.target.value })}
                  placeholder="User or API key ID"
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                    className="w-full rounded-lg border border-input bg-input px-2 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                    className="w-full rounded-lg border border-input bg-input px-2 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Audit Trail</h2>
            <Badge variant="outline">{logs.length} entries</Badge>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No audit logs found</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="hover:bg-accent/5 rounded-lg border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={getActionColor(log.action) as any}>
                          {formatAction(log.action)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.actorType === 'api_key' ? (
                            <>
                              <Key className="mr-1 inline h-3 w-3" />
                              API Key
                            </>
                          ) : log.actorType === 'system' ? (
                            <>
                              <Shield className="mr-1 inline h-3 w-3" />
                              System
                            </>
                          ) : (
                            <>
                              <User className="mr-1 inline h-3 w-3" />
                              User
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">{log.resourceType}</span>
                        {log.resourceId && (
                          <span className="ml-1 text-xs">({log.resourceId.slice(0, 8)}...)</span>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {formatMetadata(log.metadata)}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                      {log.ipAddress && (
                        <p className="mt-1 text-xs text-muted-foreground">{log.ipAddress}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
