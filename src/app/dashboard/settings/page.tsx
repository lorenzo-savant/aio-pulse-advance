'use client'

import { useState, useEffect } from 'react'
import { User, Key, Bell, Save, Loader2, Trash2, Globe } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLocale, useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { localeLabels, type Locale } from '@/i18n/config'

type Provider = 'openai' | 'gemini' | 'perplexity' | 'anthropic'

interface ApiKey {
  id: string
  provider: Provider
  label: string
  is_active: boolean
  created_at: string
  hasKey?: boolean
}

const PROVIDER_INFO: Record<
  Provider,
  { label: string; color: string; placeholder: string; docs: string }
> = {
  openai: {
    label: 'ChatGPT (OpenAI)',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    placeholder: 'sk-...',
    docs: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    label: 'Gemini',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    placeholder: 'AIzaSy...',
    docs: 'https://aistudio.google.com/app/apikey',
  },
  perplexity: {
    label: 'Perplexity',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    placeholder: 'pplx-...',
    docs: 'https://www.perplexity.ai/settings/api',
  },
  anthropic: {
    label: 'Claude (Anthropic)',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    placeholder: 'sk-ant-...',
    docs: 'https://console.anthropic.com/settings/keys',
  },
}

function ApiKeysSection() {
  const t = useTranslations('settings.api_keys')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Provider | null>(null)
  const [newKeys, setNewKeys] = useState<Record<Provider, string>>({
    openai: '',
    gemini: '',
    perplexity: '',
    anthropic: '',
  })
  const { confirm, ConfirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/keys')
      if (!res.ok) throw new Error('load failed')
      const json = await res.json()
      setKeys(json.data || [])
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }

  const getExistingKey = (provider: Provider) => keys.find((k) => k.provider === provider)

  const handleSave = async (provider: Provider) => {
    const key = newKeys[provider]
    if (!key.trim()) {
      toast.error(t('enter_key'))
      return
    }

    setSaving(provider)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: key.trim(),
          label: `${PROVIDER_INFO[provider].label} API Key`,
        }),
      })
      if (!res.ok) throw new Error('save failed')

      toast.success(t('saved', { name: PROVIDER_INFO[provider].label }))
      setNewKeys((prev) => ({ ...prev, [provider]: '' }))
      await loadKeys()
    } catch {
      toast.error(t('save_failed'))
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (provider: Provider) => {
    const existing = getExistingKey(provider)
    if (!existing) return

    const confirmed = await confirm({
      title: t('remove_confirm', { name: PROVIDER_INFO[provider].label }),
      description: t('remove_confirm_desc'),
      confirmLabel: t('remove'),
      destructive: true,
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/keys?id=${encodeURIComponent(existing.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('delete failed')
      toast.success(t('removed'))
      await loadKeys()
    } catch {
      toast.error(t('save_failed'))
    }
  }

  const handleToggle = async (provider: Provider) => {
    const existing = getExistingKey(provider)
    if (!existing) return

    try {
      const res = await fetch('/api/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id, isActive: !existing.is_active }),
      })
      if (!res.ok) throw new Error('toggle failed')
      await loadKeys()
    } catch {
      toast.error(t('save_failed'))
    }
  }

  return (
    <>
      <Card className="border border-input bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
              <Key className="h-5 w-5 text-muted-foreground" />
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
              const existing = getExistingKey(provider)
              const info = PROVIDER_INFO[provider]
              const isSaving = saving === provider

              return (
                <div key={provider} className="bg-secondaryrow rounded-xl border border-input p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn('rounded-lg border px-2 py-1 text-xs font-bold', info.color)}
                      >
                        {info.label}
                      </span>
                      {existing && (
                        <Badge variant={existing.is_active ? 'success' : 'default'}>
                          {existing.is_active ? t('active') : t('inactive')}
                        </Badge>
                      )}
                    </div>
                    {existing && (
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(provider)}>
                        {existing.is_active ? t('disable') : t('enable')}
                      </Button>
                    )}
                  </div>

                  {existing ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-input px-3 py-2 font-mono text-sm text-muted-foreground">
                        •••••••••••••••••••••••••••••• (stored encrypted)
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(provider)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="placeholder-text-muted-ui flex-1 rounded-xl border border-input bg-input px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    {t('get_key', { name: info.label })} →
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <ConfirmDialog />
    </>
  )
}

function ProfileSection() {
  const t = useTranslations('settings.profile')
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
      toast.success(t('save_button') + ' (dev mode)')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-input bg-card p-6">
      <div className="mb-6">
        <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
          <User className="h-5 w-5 text-muted-foreground" />
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('email')}
          </label>
          <input
            type="email"
            disabled
            className="w-full rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground"
            value={profile.email || ''}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('full_name')}
          </label>
          <input
            type="text"
            className="placeholder-text-muted-ui w-full rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            placeholder={t('full_name_placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <Button loading={loading} onClick={handleSave}>
          <Save className="h-4 w-4" />
          {t('save_button')}
        </Button>
      </div>
    </Card>
  )
}

function NotificationsSection() {
  const t = useTranslations('settings.notifications')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Card className="border border-input bg-card p-6">
      <div className="mb-6">
        <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('alert_email')}
          </label>
          <input
            type="email"
            className="placeholder-text-muted-ui w-full rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            placeholder={t('alert_email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t('alert_email_helper')}</p>
        </div>

        <Button loading={saving}>
          <Save className="h-4 w-4" />
          {t('save_button')}
        </Button>
      </div>
    </Card>
  )
}

function InterfaceLanguageSection() {
  const t = useTranslations('settings.interface_language')
  const currentLocale = useLocale() as Locale

  return (
    <Card className="border border-input bg-card p-6">
      <div className="mb-6">
        <h2 className="text-text-secondary-ui flex items-center gap-2 text-lg font-bold">
          <Globe className="h-5 w-5 text-muted-foreground" />
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('current')}:</span>
          <span className="text-sm font-bold text-foreground">{localeLabels[currentLocale]}</span>
        </div>
        <LanguageSwitcher />
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  const t = useTranslations('settings')

  return (
    <div className="animate-in space-y-8 bg-background">
      <SectionHelp section="settings" />
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <ProfileSection />
        <InterfaceLanguageSection />
        <ApiKeysSection />
        <NotificationsSection />
      </div>
    </div>
  )
}
