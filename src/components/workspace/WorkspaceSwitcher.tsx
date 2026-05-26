'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Check, ChevronDown, Plus, Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Workspace {
  id: string
  name: string
  slug: string
  organizationId: string
  organizationName: string
  role: string
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string
  userId: string
}

export default function WorkspaceSwitcher({ currentWorkspaceId, userId }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetchWorkspaces()
    // fetchWorkspaces redefined per render — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`/api/workspaces?userId=${userId}`)
      if (!res.ok) throw new Error('Failed to fetch workspaces')
      const data = await res.json()
      setWorkspaces(data)
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (workspaceId: string) => {
    document.cookie = `workspace_id=${workspaceId}; path=/; max-age=31536000`
    setIsOpen(false)
    router.refresh()
  }

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!currentWorkspace) {
    return null
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-2 px-3 py-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Building2 className="h-4 w-4 flex-shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium">{currentWorkspace.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {currentWorkspace.organizationName}
          </div>
        </div>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover py-2 shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Workspaces
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleSelect(workspace.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  {workspace.id === currentWorkspaceId && (
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{workspace.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {workspace.organizationName} · {workspace.role}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-2 border-t border-border px-3 pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => {
                  router.push('/dashboard/workspaces/new')
                  setIsOpen(false)
                }}
              >
                <Plus className="h-4 w-4" />
                Create Workspace
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => {
                  router.push('/dashboard/org')
                  setIsOpen(false)
                }}
              >
                <Users className="h-4 w-4" />
                Organization Settings
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
