'use client'

import { useState } from 'react'
import { MoreHorizontal, Shield, UserMinus, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Member {
  id: string
  userId: string
  email: string | null
  role: string
  joinedAt: string
  invitedBy: string | null
}

interface MemberListProps {
  members: Member[]
  currentUserId: string
  canManageMembers: boolean
  onRoleChange: (userId: string, newRole: string) => Promise<void>
  onRemove: (userId: string) => Promise<void>
}

const ROLE_BADGE_VARIANTS: Record<
  string,
  'default' | 'outline' | 'danger' | 'success' | 'warning' | 'info' | 'purple' | 'brand'
> = {
  owner: 'default',
  admin: 'info',
  editor: 'outline',
  viewer: 'outline',
}

export default function MemberList({
  members,
  currentUserId,
  canManageMembers,
  onRoleChange,
  onRemove,
}: MemberListProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)

  const handleRoleChange = async (userId: string, newRole: string) => {
    await onRoleChange(userId, newRole)
    setActionMenuOpen(null)
  }

  const handleRemove = async (userId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      await onRemove(userId)
      setActionMenuOpen(null)
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Joined
              </th>
              {canManageMembers && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {member.role === 'owner' && (
                      <Crown className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{member.email || 'Unknown User'}</div>
                      {member.userId === currentUserId && (
                        <div className="text-xs text-muted-foreground">You</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_BADGE_VARIANTS[member.role] ?? 'outline'}>
                    <Shield className="mr-1 h-3 w-3" />
                    {member.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManageMembers && member.userId !== currentUserId && (
                    <div className="relative inline-block">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActionMenuOpen(actionMenuOpen === member.id ? null : member.id)
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {actionMenuOpen === member.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActionMenuOpen(null)}
                          />
                          <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-popover py-1 shadow-lg">
                            <div className="border-b border-border px-3 py-2">
                              <div className="text-xs font-semibold text-muted-foreground">
                                Change Role
                              </div>
                            </div>
                            {['viewer', 'editor', 'admin'].map((role) => (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(member.userId, role)}
                                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                              >
                                {role === member.role && '✓ '}
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </button>
                            ))}
                            <div className="mt-1 border-t border-border pt-1">
                              <button
                                onClick={() => handleRemove(member.userId)}
                                className="hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition-colors"
                              >
                                <UserMinus className="h-4 w-4" />
                                Remove Member
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <Shield className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="text-sm">No members yet</p>
          {canManageMembers && <p className="mt-1 text-xs">Invite team members to collaborate</p>}
        </div>
      )}
    </div>
  )
}
