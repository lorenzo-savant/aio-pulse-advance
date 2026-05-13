import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getRolePermissions,
  hasPermission,
  checkPermission,
  getUserRole,
  logAudit,
  isWorkspaceOwner,
  canManageMembers,
  canEditBrand,
  canViewBrand,
  canViewAudit,
  type Permission,
  type Role,
} from '@/lib/services/workspace-auth'

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => null),
}))

describe('workspace-auth permissions', () => {
  describe('getRolePermissions', () => {
    it('returns all permissions for owner', () => {
      const perms = getRolePermissions('owner')
      expect(perms).toContain('manage_members')
      expect(perms).toContain('view_audit')
      expect(perms).toContain('edit_brand')
      expect(perms).toContain('view_brand')
    })

    it('returns permissions for admin', () => {
      const perms = getRolePermissions('admin')
      expect(perms).toContain('manage_members')
      expect(perms).toContain('view_audit')
      expect(perms).toContain('edit_brand')
      expect(perms).toContain('view_brand')
    })

    it('returns limited permissions for editor', () => {
      const perms = getRolePermissions('editor')
      expect(perms).toContain('edit_brand')
      expect(perms).toContain('view_brand')
      expect(perms).not.toContain('manage_members')
      expect(perms).not.toContain('view_audit')
    })

    it('returns view_only permission for viewer', () => {
      const perms = getRolePermissions('viewer')
      expect(perms).toContain('view_brand')
      expect(perms).not.toContain('manage_members')
      expect(perms).not.toContain('view_audit')
      expect(perms).not.toContain('edit_brand')
    })
  })

  describe('hasPermission', () => {
    it('returns true when role has permission', () => {
      expect(hasPermission('owner', 'manage_members')).toBe(true)
      expect(hasPermission('admin', 'manage_members')).toBe(true)
      expect(hasPermission('editor', 'edit_brand')).toBe(true)
      expect(hasPermission('viewer', 'view_brand')).toBe(true)
    })

    it('returns false when role lacks permission', () => {
      expect(hasPermission('viewer', 'manage_members')).toBe(false)
      expect(hasPermission('viewer', 'view_audit')).toBe(false)
      expect(hasPermission('viewer', 'edit_brand')).toBe(false)
      expect(hasPermission('editor', 'manage_members')).toBe(false)
    })

    it('returns false for unknown role', () => {
      expect(hasPermission('unknown_role' as Role, 'view_brand')).toBe(false)
    })
  })

  describe('checkPermission', () => {
    it('returns false when supabase not configured', async () => {
      const result = await checkPermission('user-1', 'ws-1', 'view_brand')
      expect(result).toBe(false)
    })
  })

  describe('getUserRole', () => {
    it('returns null when supabase not configured', async () => {
      const result = await getUserRole('user-1', 'ws-1')
      expect(result).toBe(null)
    })
  })

  describe('logAudit', () => {
    it('does not throw when supabase not configured', async () => {
      // logAudit is intentionally never-throws (audit is observability, not a gate).
      // It returns void regardless of DB availability.
      await expect(
        logAudit({
          organizationId: 'org-1',
          workspaceId: 'ws-1',
          actorId: 'user-1',
          action: 'brand.created',
          resourceType: 'brand',
          resourceId: 'brand-1',
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('authorization helpers', () => {
    it('isWorkspaceOwner returns false when supabase not configured', async () => {
      const result = await isWorkspaceOwner('user-1', 'ws-1')
      expect(result).toBe(false)
    })

    it('canManageMembers returns false when supabase not configured', async () => {
      const result = await canManageMembers('user-1', 'ws-1')
      expect(result).toBe(false)
    })

    it('canEditBrand returns false when supabase not configured', async () => {
      const result = await canEditBrand('user-1', 'ws-1')
      expect(result).toBe(false)
    })

    it('canViewBrand returns false when supabase not configured', async () => {
      const result = await canViewBrand('user-1', 'ws-1')
      expect(result).toBe(false)
    })

    it('canViewAudit returns false when supabase not configured', async () => {
      const result = await canViewAudit('user-1', 'ws-1')
      expect(result).toBe(false)
    })
  })
})

describe('permission matrix integrity', () => {
  const allRoles: Role[] = ['owner', 'admin', 'editor', 'viewer']

  it('every role has at least view_brand permission', () => {
    for (const role of allRoles) {
      const perms = getRolePermissions(role)
      expect(perms).toContain('view_brand')
    }
  })

  it('no role has more permissions than owner', () => {
    const ownerPerms = getRolePermissions('owner')
    for (const role of allRoles) {
      const perms = getRolePermissions(role)
      for (const perm of perms) {
        expect(ownerPerms).toContain(perm)
      }
    }
  })

  it('permissions are ordered by access level (viewer < editor < admin <= owner)', () => {
    const viewerPerms = getRolePermissions('viewer')
    const editorPerms = getRolePermissions('editor')
    const adminPerms = getRolePermissions('admin')
    const ownerPerms = getRolePermissions('owner')

    expect(viewerPerms.length).toBeLessThan(editorPerms.length)
    expect(editorPerms.length).toBeLessThan(adminPerms.length)
    // T07: owner has manage_billing exclusively (admin cannot change billing).
    expect(adminPerms.length).toBeLessThanOrEqual(ownerPerms.length)
  })

  it('only owner can manage_billing', () => {
    expect(getRolePermissions('owner')).toContain('manage_billing')
    expect(getRolePermissions('admin')).not.toContain('manage_billing')
    expect(getRolePermissions('editor')).not.toContain('manage_billing')
    expect(getRolePermissions('viewer')).not.toContain('manage_billing')
  })
})
