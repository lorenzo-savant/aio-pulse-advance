// PATH: src/app/dashboard/credits/page.tsx
// Internal deployment: the credit ledger is disabled (AIO_MODE=unlimited), so
// there is no balance to manage or purchase. Placeholder to avoid a broken UI.

'use client'

import { Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'

export default function CreditsPage() {
  const t = useTranslations('credits')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHelp section="credits" />
      <Card>
        <div className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="bg-brand/10 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Coins className="h-7 w-7 text-brand" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">{t('disabled_title')}</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('disabled_body')}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
