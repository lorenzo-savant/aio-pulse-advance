'use client'

import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Copy, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string | null
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

const ALL_SCOPES = [
  { value: 'read:brands', label: 'Read Brands', description: 'View brand data' },
  { value: 'write:brands', label: 'Write Brands', description: 'Create/edit/delete brands' },
  { value: 'read:prompts', label: 'Read Prompts', description: 'View prompts' },
  { value: 'write:prompts', label: 'Write Prompts', description: 'Create/edit/delete prompts' },
  { value: 'read:analytics', label: 'Read Analytics', description: 'View analytics data' },
  { value: 'read:audit', label: 'Read Audit Logs', description: 'View audit logs' },
  { value: 'manage:api_keys', label: 'Manage API Keys', description: 'Create/revoke API keys' },
  { value: 'manage:billing', label: 'Manage Billing', description: 'View/update billing' },
  { value: 'manage:members', label: 'Manage Members', description: 'Invite/remove members' },
]

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [showFullKey, setShowFullKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys')
      if (!res.ok) throw new Error('Failed to fetch keys')
      const data = await res.json()
      setKeys(data.data ?? [])
    } catch (err) {
      console.error('Error fetching keys:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setError(null)
    if (!newKeyName.trim()) {
      setError('Key name is required')
      return
    }
    if (selectedScopes.length === 0) {
      setError('Select at least one scope')
      return
    }

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          scopes: selectedScopes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate key')
      }

      const data = await res.json()
      setGeneratedKey(data.fullKey)
      setShowFullKey(false)
      setNewKeyName('')
      setSelectedScopes([])
      await fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/keys?id=${keyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke key')
      await fetchKeys()
    } catch (err) {
      console.error('Error revoking key:', err)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading API keys...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage scoped API keys for programmatic access
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Key
        </Button>
      </div>

      <div className="space-y-3">
        {keys.map((key) => (
          <Card key={key.id}>
            <CardBody className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{key.name}</h3>
                  <p className="font-mono text-sm text-muted-foreground">
                    {key.keyPrefix ?? 'aipulse_****'}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {key.scopes.slice(0, 3).map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                    {key.scopes.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{key.scopes.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="text-right">
                  <div>Last used</div>
                  <div className="font-medium text-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                {key.revokedAt ? (
                  <Badge variant="outline" className="text-destructive">
                    Revoked
                  </Badge>
                ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                  <Badge variant="outline" className="text-destructive">
                    Expired
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600">
                    Active
                  </Badge>
                )}
                {!key.revokedAt && (
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}

        {keys.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <Key className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No API keys yet</p>
            <p className="mt-1 text-xs">Generate your first API key to get started</p>
          </div>
        )}
      </div>

      {showGenerateModal && !generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="bg-background/80 absolute inset-0 backdrop-blur-sm"
            onClick={() => setShowGenerateModal(false)}
          />
          <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-semibold">Generate API Key</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowGenerateModal(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                  placeholder="e.g., Production Integration"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Scopes</label>
                <div className="space-y-2">
                  {ALL_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg p-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">{scope.label}</div>
                        <div className="text-xs text-muted-foreground">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleGenerate} className="flex-1">
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-background/80 absolute inset-0 backdrop-blur-sm" />
          <div className="relative mx-4 w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CheckCircle className="h-5 w-5 text-green-500" />
                API Key Generated
              </h2>
            </div>

            <div className="space-y-4 p-4">
              <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-sm text-destructive">
                  Copy this key now. It will <strong>never be shown again</strong>.
                </p>
              </div>

              <div className="relative">
                <div className="break-all rounded-lg border border-input bg-input px-3 py-3 font-mono text-sm">
                  {showFullKey ? generatedKey : '••••••••••••••••••••••••••••••••'}
                </div>
                <div className="absolute right-2 top-2 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowFullKey(!showFullKey)}>
                    {showFullKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedKey)}>
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => {
                  setGeneratedKey(null)
                  setShowGenerateModal(false)
                }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
