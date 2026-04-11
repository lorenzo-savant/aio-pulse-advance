'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const Sidebar = dynamic(() => import('@/components/layout/Sidebar').then((m) => m.Sidebar), {
  loading: () => <div className="w-[300px] animate-pulse bg-card" />,
  ssr: false,
})

const TopBar = dynamic(() => import('@/components/layout/TopBar').then((m) => m.TopBar), {
  loading: () => <div className="h-[72px] animate-pulse rounded-xl bg-card" />,
  ssr: false,
})

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardInitializer({ children }: DashboardLayoutProps) {
  const supabase = createSupabaseBrowserClient()
  const setUserId = useAppStore((s) => s.setUserId)
  const loadScanHistory = useAppStore((s) => s.loadScanHistory)

  useEffect(() => {
    const init = async () => {
      let userId: string | null = null

      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
        }
      }

      if (userId) {
        setUserId(userId)
        await loadScanHistory()
      }
    }

    init()
  }, [setUserId, loadScanHistory])

  return <>{children}</>
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardInitializer>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-hidden lg:pl-[300px]">
          <div className="px-4 pt-2 md:px-8 xl:px-10">
            <TopBar />
          </div>
          <main className="flex-1 overflow-y-auto px-4 pb-8 pt-1 md:px-8 xl:px-10">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </DashboardInitializer>
  )
}
