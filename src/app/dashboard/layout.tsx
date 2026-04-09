'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const Sidebar = dynamic(() => import('@/components/layout/Sidebar').then((m) => m.Sidebar), {
  loading: () => <div className="w-64 animate-pulse bg-nav-bg" />,
  ssr: false,
})

const TopBar = dynamic(() => import('@/components/layout/TopBar').then((m) => m.TopBar), {
  loading: () => <div className="h-16 animate-pulse bg-nav-bg" />,
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

        <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </DashboardInitializer>
  )
}
