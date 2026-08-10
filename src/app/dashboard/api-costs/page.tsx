// PATH: src/app/dashboard/api-costs/page.tsx
// Internal deployment: cost metering is only informational. The page that
// existed here drilled into credits — which are disabled in unlimited mode.
// Kept as a placeholder rather than wiring a dead ledger.

'use client'

import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'

export default function ApiCostsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHelp section="api-costs" />
      <Card>
        <div className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="bg-brand/10 flex h-14 w-14 items-center justify-center rounded-2xl">
            <TrendingUp className="h-7 w-7 text-brand" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">API costs hidden</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              This deployment runs internally in unlimited mode, so credit-based cost tracking is
              not exposed here. Live provider spend remains visible in the operational logs.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
