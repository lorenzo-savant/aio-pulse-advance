'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import MemberList from '@/components/workspace/MemberList'
import InviteMemberModal from '@/components/workspace/InviteMemberModal'

interface Member {
  id: string
  userId: string
  email: string | null
  role: string
  joinedAt: string
  invitedBy: string | null
}

export default function WorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.id as string

  const [workspace, setWorkspace] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [canManageMembers, setCanManageMembers] = useState(false)

  useEffect(() => {
    fetchWorkspaceData()
  }, [workspaceId])

  const fetchWorkspaceData = async () => {
    try {
      const [workspaceRes, membersRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}`),
        fetch(`/api/workspaces/${workspaceId}/members`),
      ])

      if (!workspaceRes.ok || !membersRes.ok) {
        throw new Error('Failed to fetch workspace data')
      }

      const workspaceData = await workspaceRes.json()
      const membersData = await membersRes.json()

      setWorkspace(workspaceData)
      setMembers(membersData)
      setCanManageMembers(true)
    } catch (error) {
      console.error('Error fetching workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!res.ok) throw new Error('Failed to update role')

      await fetchWorkspaceData()
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to remove member')

      await fetchWorkspaceData()
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading workspace...</div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Workspace not found</h2>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">Manage workspace members and settings</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" />
              Members ({members.length})
            </h2>
            <p className="text-sm text-muted-foreground">People with access to this workspace</p>
          </div>
          {canManageMembers && (
            <Button onClick={() => setShowInviteModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardBody>
          <MemberList
            members={members}
            currentUserId=""
            canManageMembers={canManageMembers}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
          />
        </CardBody>
      </Card>

      {showInviteModal && (
        <InviteMemberModal
          workspaceId={workspaceId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={fetchWorkspaceData}
        />
      )}
    </div>
  )
}
