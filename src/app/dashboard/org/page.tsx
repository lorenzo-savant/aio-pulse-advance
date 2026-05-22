'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, Key, Activity, Settings, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Badge } from '@/components/ui/Badge'

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  role: string
  memberCount: number
  workspaceCount: number
}

interface Workspace {
  id: string
  name: string
  slug: string
  memberCount: number
}

export default function OrganizationDashboardPage() {
  const router = useRouter()
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrganizationData()
  }, [])

  const fetchOrganizationData = async () => {
    try {
      const res = await fetch('/api/organizations/current')
      if (!res.ok) throw new Error('Failed to fetch organization')

      const data = await res.json()
      setOrg(data.org)
      setWorkspaces(data.workspaces)
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading organization...</div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">No Organization Found</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            You need to be part of an organization to access this feature.
          </p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHelp section="org" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            Organization settings and workspace management
          </p>
        </div>
        <Badge variant={org.plan === 'free' ? 'outline' : 'default'}>
          {org.plan.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold">{org.memberCount}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Workspaces</p>
                <p className="text-2xl font-bold">{org.workspaceCount}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-2xl font-bold capitalize">{org.plan}</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <h2 className="text-lg font-semibold">Workspaces</h2>
            <p className="text-sm text-muted-foreground">Manage your organization's workspaces</p>
          </div>
          <Button onClick={() => router.push('/dashboard/workspaces/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </Button>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 transition-colors"
                onClick={() => router.push(`/dashboard/workspaces/${workspace.id}`)}
              >
                <div>
                  <h3 className="font-medium">{workspace.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>
            ))}

            {workspaces.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p className="text-sm">No workspaces yet</p>
                <p className="mt-1 text-xs">Create your first workspace to get started</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Key className="h-5 w-5" />
              API Keys
            </h2>
            <p className="text-sm text-muted-foreground">Manage API keys for your organization</p>
          </CardHeader>
          <CardBody>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard/org/api-keys')}
            >
              Manage API Keys
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Settings className="h-5 w-5" />
              Settings
            </h2>
            <p className="text-sm text-muted-foreground">Organization configuration</p>
          </CardHeader>
          <CardBody>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard/org/settings')}
            >
              Organization Settings
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
