// PATH: src/app/dashboard/billing/page.tsx
// Internal deployment: billing (Stripe) is intentionally not connected.
// The platform runs unmetered (AIO_MODE=unlimited) and the commercial layer
// is not exposed. Kept as a small placeholder so a stale bookmark or direct
// URL renders something meaningful instead of a broken checkout flow.

'use client'

import { CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'

export default function BillingPage() {
  const t = useTranslations('billing')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHelp section="billing" />
      <Card>
        <div className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="bg-brand/10 flex h-14 w-14 items-center justify-center rounded-2xl">
            <CreditCard className="h-7 w-7 text-brand" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">{t('not_exposed_title')}</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {t('not_exposed_body')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
