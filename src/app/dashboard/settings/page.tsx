'use client'

import { useState, useEffect } from 'react'
import { User, Key, Bell, Shield, Save, Loader2, Eye, EyeOff, Check, X, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

type Provider = 'groq' | 'cerebras' | 'openrouter' | 'gemini'

interface ApiKey {
  id: string
  provider: Provider
  label: string
  is_active: boolean
  created_at: string
  encrypted_key?: string
}

const PROVIDER_INFO: Record<
  Provider,
  { label: string; color: string; placeholder: string; docs: string }
> = {
  groq: {
    label: 'Groq',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    placeholder: 'gsk_...',
    docs: 'https://console.groq.com',
  },
  cerebras: {
    label: 'Cerebras',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    placeholder: 'csk_...',
    docs: 'https://cloud.cerebras.ai',
  },
  openrouter: {
    label: 'OpenRouter',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    placeholder: 'sk-or-v1-...',
    docs: 'https://openrouter.ai/keys',
  },
  gemini: {
    label: 'Gemini',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    placeholder: 'AIzaSy...',
    docs: 'https://aistudio.google.com/app/apikey',
  },
}

function ApiKeysSection() {
  const supabase = createSupabaseBrowserClient()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Provider | null>(null)
  const [showKey, setShowKey] = useState<Provider | null>(null)
  const [newKeys, setNewKeys] = useState<Record<Provider, string>>({
    groq: '',
    cerebras: '',
    openrouter: '',
    gemini: '',
  })
  const { confirm, ConfirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    setLoading(true)
    try {
      if (!supabase) {
        setKeys([])
        return
      }
      const { data, error } = await supabase.from('user_api_keys').select('*')
      if (error) throw error
      setKeys(data || [])
    } catch (err) {
      console.error('Failed to load API keys:', err)
    } finally {
      setLoading(false)
    }
  }

  const getExistingKey = (provider: Provider) => keys.find((k) => k.provider === provider)

  const handleSave = async (provider: Provider) => {
    const key = newKeys[provider]
    if (!key.trim()) {
      toast.error('Please enter an API key')
      return
    }

    if (!supabase) {
      toast.success(`${PROVIDER_INFO[provider].label} API key saved (dev mode)`)
      return
    }

    setSaving(provider)
    try {
      const existing = getExistingKey(provider)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = {
        user_id: user?.id || 'dev-user',
        provider,
        encrypted_key: key.trim(),
        label: `${PROVIDER_INFO[provider].label} API Key`,
        is_active: true,
      }

      if (existing) {
        const { error } = await supabase
          .from('user_api_keys')
          .update({ encrypted_key: key.trim(), updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_api_keys').insert(payload)
        if (error) throw error
      }

      toast.success(`${PROVIDER_INFO[provider].label} API key saved`)
      setNewKeys((prev) => ({ ...prev, [provider]: '' }))
      await loadKeys()
    } catch (err) {
      toast.error('Failed to save API key')
      console.error(err)
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (provider: Provider) => {
    const existing = getExistingKey(provider)
    if (!existing) return

    const confirmed = await confirm({
      title: `Remove ${PROVIDER_INFO[provider].label} API key?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!confirmed) return

    if (!supabase) {
      toast.success('API key removed (dev mode)')
      return
    }

    try {
      const { error } = await supabase.from('user_api_keys').delete().eq('id', existing.id)
      if (error) throw error
      toast.success('API key removed')
      await loadKeys()
    } catch (err) {
      toast.error('Failed to delete API key')
    }
  }

  const handleToggle = async (provider: Provider) => {
    const existing = getExistingKey(provider)
    if (!existing) return

    if (!supabase) {
      toast.success('API key toggled (dev mode)')
      return
    }

    try {
      const { error } = await supabase
        .from('user_api_keys')
        .update({ is_active: !existing.is_active })
        .eq('id', existing.id)
      if (error) throw error
      await loadKeys()
    } catch (err) {
      toast.error('Failed to update API key')
    }
  }

  return (
    <Card className="border border-surface-input-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
            <Key className="text-text-muted-ui h-5 w-5" />
            API Keys
          </h2>
          <p className="text-text-muted-ui mt-1 text-sm">
            Configure your AI provider API keys. Keys are stored securely.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
            const existing = getExistingKey(provider)
            const info = PROVIDER_INFO[provider]
            const isSaving = saving === provider
            const isShowing = showKey === provider

            return (
              <div
                key={provider}
                className="rounded-xl border border-surface-input-border bg-surface-row p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn('rounded-lg border px-2 py-1 text-xs font-bold', info.color)}
                    >
                      {info.label}
                    </span>
                    {existing && (
                      <Badge variant={existing.is_active ? 'success' : 'default'}>
                        {existing.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </div>
                  {existing && (
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(provider)}>
                      {existing.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>

                {existing ? (
                  <div className="flex items-center gap-2">
                    <div className="text-text-primary-ui flex-1 rounded-lg bg-surface-input px-3 py-2 font-mono text-sm">
                      {isShowing ? existing.encrypted_key : '••••••••••••••••••••••••••••••'}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowKey(isShowing ? null : provider)}
                    >
                      {isShowing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(provider)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="text-text-primary-ui placeholder-text-muted-ui flex-1 rounded-xl border border-surface-input-border bg-surface-input px-4 py-2 text-sm outline-none focus:border-brand-500"
                      placeholder={info.placeholder}
                      value={newKeys[provider]}
                      onChange={(e) =>
                        setNewKeys((prev) => ({ ...prev, [provider]: e.target.value }))
                      }
                    />
                    <Button loading={isSaving} onClick={() => handleSave(provider)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <a
                  href={info.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-brand-400 hover:underline"
                >
                  Get {info.label} API key →
                </a>
              </div>
            )
          })}
        </div>
      )}
    </Card>
    <ConfirmDialog />
  )
}

function ProfileSection() {
  const supabase = createSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<{
    email?: string
    full_name?: string
    avatar_url?: string
  }>({})
  const [name, setName] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    if (!supabase) {
      setProfile({ email: 'dev@local', full_name: 'Dev User' })
      setName('Dev User')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setProfile({ email: user.email, full_name: user.user_metadata?.full_name })
      setName(user.user_metadata?.full_name || '')
    }
  }

  const handleSave = async () => {
    if (!supabase) {
      toast.success('Profile updated (dev mode)')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name },
      })
      if (error) throw error
      toast.success('Profile updated')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-surface-input-border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
          <User className="text-text-muted-ui h-5 w-5" />
          Profile
        </h2>
        <p className="text-text-muted-ui mt-1 text-sm">Manage your account information.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-text-muted-ui mb-2 block text-xs font-bold uppercase tracking-widest">
            Email
          </label>
          <input
            type="email"
            disabled
            className="text-text-primary-ui w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-2.5 text-sm"
            value={profile.email || ''}
          />
        </div>

        <div>
          <label className="text-text-muted-ui mb-2 block text-xs font-bold uppercase tracking-widest">
            Full Name
          </label>
          <input
            type="text"
            className="text-text-primary-ui placeholder-text-muted-ui w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-brand-500"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <Button loading={loading} onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </Card>
  )
}

function NotificationsSection() {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Card className="border border-surface-input-border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
          <Bell className="text-text-muted-ui h-5 w-5" />
          Notifications
        </h2>
        <p className="text-text-muted-ui mt-1 text-sm">Configure how you receive alerts.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-text-muted-ui mb-2 block text-xs font-bold uppercase tracking-widest">
            Alert Email
          </label>
          <input
            type="email"
            className="text-text-primary-ui placeholder-text-muted-ui w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-brand-500"
            placeholder="alerts@yourdomain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-text-muted-ui mt-2 text-xs">
            Alerts will be sent via Resend when triggered.
          </p>
        </div>

        <Button loading={saving}>
          <Save className="h-4 w-4" />
          Save Preferences
        </Button>
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <div className="animate-in space-y-8 bg-page-bg">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-surface-400">Manage your account, API keys, and preferences.</p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <ProfileSection />
        <ApiKeysSection />
        <NotificationsSection />
      </div>
    </div>
  )
}
