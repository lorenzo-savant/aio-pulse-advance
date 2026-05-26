'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { BrandLanguage } from '@/types'

// Industries are loaded from /api/industries (sourced from INDUSTRY_PRESETS
// in lib/services/prompt-generator.ts) so this dropdown stays in sync with
// the 26 canonical verticals plus their en/it/sv localised labels.
interface IndustryOption {
  id: string
  name: { en: string; it: string; sv: string }
}

const LANGUAGES: Array<{ value: BrandLanguage; label: string }> = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'sv', label: '🇸🇪 Svenska' },
]

type LegalIdType = '' | 'vat' | 'orgnr' | 'fiscal_code' | 'ein' | 'other'

interface BrandEditForm {
  name: string
  domain: string
  description: string
  industry: string
  aliases: string
  competitors: string
  language: BrandLanguage
  color: string
  // LLMO identity — same shape as the create wizard but flat strings to
  // keep the edit form simple. sameAs stays a newline-separated textarea
  // because URLs are too long for a comma-separated input.
  sameAs: string
  disambiguation: string
  citationFormat: string
  // Legal identifier (VAT/orgnr/fiscal_code/EIN). Maps to Schema.org
  // vatID or taxID — strongest LLMO entity-resolution signal.
  legalId: string
  legalIdType: LegalIdType
}

export default function BrandEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const brandId = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BrandEditForm | null>(null)
  const [originalLanguage, setOriginalLanguage] = useState<BrandLanguage>('en')
  const [reseedOffer, setReseedOffer] = useState(false)
  const [industries, setIndustries] = useState<IndustryOption[]>([])

  // Load the 26 canonical industry presets (matches the brand-new wizard).
  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) setIndustries(j.data as IndustryOption[])
      })
      .catch(() => {
        /* fail silent — the field just stays empty */
      })
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/brands/${brandId}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Brand not found')
        }
        const b = data.data
        const lang: BrandLanguage = (b.language as BrandLanguage) || 'en'
        setForm({
          name: b.name || '',
          domain: b.domain || '',
          description: b.description || '',
          industry: b.industry || '',
          aliases: Array.isArray(b.aliases) ? b.aliases.join(', ') : '',
          competitors: Array.isArray(b.competitors) ? b.competitors.join(', ') : '',
          language: lang,
          color: b.color || '#6366f1',
          // GET /api/brands/[id] returns snake_case columns from the DB.
          sameAs: Array.isArray(b.same_as) ? b.same_as.join('\n') : '',
          disambiguation: b.disambiguation || '',
          citationFormat: b.citation_format || '',
          legalId: b.legal_id || '',
          legalIdType: (b.legal_id_type as LegalIdType) || '',
        })
        setOriginalLanguage(lang)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load brand')
        router.push('/dashboard/brands')
      } finally {
        setLoading(false)
      }
    }
    if (brandId) load()
  }, [brandId, router])

  const languageChanged = form && form.language !== originalLanguage

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          domain: form.domain || null,
          description: form.description || null,
          industry: form.industry || null,
          language: form.language,
          color: form.color,
          aliases: form.aliases
            ? form.aliases
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          competitors: form.competitors
            ? form.competitors
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          // LLMO identity — sameAs is newline-separated in the textarea;
          // split + trim + filter empty + filter non-absolute-https.
          sameAs: form.sameAs
            ? form.sameAs
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => /^https?:\/\//i.test(s))
            : [],
          disambiguation: form.disambiguation.trim() || null,
          citationFormat: form.citationFormat.trim() || null,
          legalId: form.legalId.trim() || null,
          legalIdType: form.legalIdType || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save')
      }

      toast.success('Brand updated')

      if (languageChanged) {
        setReseedOffer(true)
      } else {
        router.push(`/dashboard/brands/${brandId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReseed = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/prompts/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Re-seed failed')
      toast.success(`Re-seeded ${data.created ?? 0} prompts in the new language`)
      router.push(`/dashboard/brands/${brandId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-seed failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/brands/${brandId}`}
          aria-label="Back"
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-black text-foreground">Edit Brand</h1>
      </div>

      <Card className="p-8">
        <div className="space-y-5">
          <Field label="Brand Name" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Website Domain">
            <input
              className="input"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="example.com"
            />
          </Field>

          <Field label="Industry">
            <select
              className="input"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              <option value="">Select industry...</option>
              {industries.map((opt) => {
                const label = opt.name[form.language] || opt.name.en || opt.id
                return (
                  <option key={opt.id} value={label}>
                    {label}
                  </option>
                )
              })}
            </select>
          </Field>

          <Field label="Primary Market Language" required>
            <select
              className="input"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as BrandLanguage })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {languageChanged && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Changing language won&apos;t re-translate existing prompts. After saving,
                  you&apos;ll be offered to re-seed prompts in{' '}
                  <strong>{form.language.toUpperCase()}</strong>.
                </span>
              </div>
            )}
          </Field>

          <Field label="Description">
            <textarea
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <Field label="Brand Aliases (comma-separated)">
            <input
              className="input"
              value={form.aliases}
              onChange={(e) => setForm({ ...form, aliases: e.target.value })}
              placeholder="e.g. Acme Corp, ACME"
            />
          </Field>

          <Field label="Competitors (comma-separated)">
            <input
              className="input"
              value={form.competitors}
              onChange={(e) => setForm({ ...form, competitors: e.target.value })}
              placeholder="e.g. Zapier, Make"
            />
          </Field>

          {/* ── LLMO identity ──────────────────────────────────────────
              Same three controls as the create wizard. Most LLMO value
              for existing brands lives here — Wikipedia/Crunchbase
              anchors prevent entity confusion, disambiguation kills
              homonym hallucinations, citation format dictates how AI
              engines credit the brand. */}
          <div className="bg-secondary/30 rounded-2xl border border-dashed border-border p-4">
            <h3 className="mb-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
              LLM Optimization
            </h3>
            <p className="mb-4 text-[11px] text-muted-foreground">
              How AI engines identify and credit this brand. All three are optional but
              high-leverage — see <code className="text-foreground">docs/DECISIONS.md</code>.
            </p>

            <Field label="Verified Identities (one URL per line)">
              <textarea
                className="input font-mono text-xs"
                rows={4}
                value={form.sameAs}
                onChange={(e) => setForm({ ...form, sameAs: e.target.value })}
                placeholder={
                  'https://en.wikipedia.org/wiki/Your_Brand\nhttps://www.crunchbase.com/organization/your-brand\nhttps://www.linkedin.com/company/your-brand'
                }
              />
            </Field>

            <Field label="Disambiguation">
              <textarea
                className="input"
                rows={3}
                value={form.disambiguation}
                onChange={(e) => setForm({ ...form, disambiguation: e.target.value })}
                placeholder='e.g. "Acasting is a Swedish casting platform — NOT to be confused with Acast, the podcast hosting service."'
                maxLength={2000}
              />
            </Field>

            <Field label="Suggested Citation Format">
              <input
                className="input"
                value={form.citationFormat}
                onChange={(e) => setForm({ ...form, citationFormat: e.target.value })}
                placeholder="e.g. AcmeCorp [acme.com], 2026"
                maxLength={200}
              />
            </Field>

            {/* Legal identifier — VAT / orgnr / fiscal code / EIN.
                Maps to Schema.org vatID (vat) or taxID (everything else).
                Globally unique → strongest LLMO entity-resolution signal. */}
            <Field label="Legal Identifier (VAT / Org.nr / Codice Fiscale / EIN)">
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <select
                  className="input"
                  value={form.legalIdType}
                  onChange={(e) => setForm({ ...form, legalIdType: e.target.value as LegalIdType })}
                >
                  <option value="">Type…</option>
                  <option value="vat">VAT</option>
                  <option value="orgnr">Org.nr (SE)</option>
                  <option value="fiscal_code">Codice fiscale (IT)</option>
                  <option value="ein">EIN (US)</option>
                  <option value="other">Other</option>
                </select>
                <input
                  className="input"
                  value={form.legalId}
                  onChange={(e) => setForm({ ...form, legalId: e.target.value })}
                  placeholder="e.g. SE556677889901 / 556677-8899"
                  maxLength={64}
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Link href={`/dashboard/brands/${brandId}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </Card>

      {reseedOffer && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <h3 className="font-bold text-foreground">
                Re-seed prompts in {form.language.toUpperCase()}?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your existing prompts are still in the old language. Re-seed to generate fresh
                prompts from the template library in your new market language. Existing unique
                prompts won&apos;t be duplicated.
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleReseed} loading={saving}>
                  Re-seed prompts
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/dashboard/brands/${brandId}`)}>
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(var(--input) / 1);
          background: rgb(var(--input) / 1);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(var(--foreground));
          outline: none;
        }
        .input:focus {
          border-color: rgb(var(--primary));
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  )
}
