# Fase 1 — Workspace tier + Audit log + Scoped API keys (T07-T09)

> 3-4 veckor, 20-30k EUR. **Den arkitektoniskt mest riskfyllda fasen** — inkluderar migration av befintliga data.

---

## 🎯 Fasens mål

Bygga **äkta multi-tenancy** som låter en byrå hantera 8-25 kunder i separata workspaces, och ett mid-market-team ha riktig RBAC. Dessutom: compliance-redo audit trail och API keys som inte längre är "all-or-nothing".

## ⚠️ Förutsättning

[Fase 0](01-fase-0-pulizia.md) slutförd till 100%. Utan type-safety + strukturerad logger blir Fas 1 = att skapa exponentiell skuld.

## 📋 Task-översikt

| Task | Titel | Effort | Deps |
|---|---|---|---|
| T07 | Re-introduce Organization → Workspace → Brand hierarchy | 10-15 dagar | Fase 0 |
| T08 | Audit log table + instrumentation av kritiska åtgärder | 4-6 dagar | T07 |
| T09 | Scoped API keys med permission model | 3-5 dagar | T07 |

**Totalt**: ~3-4 veckor med 1 dev på heltid.

---

## T07 — Re-introduce Organization → Workspace → Brand hierarchy

**Severity**: Architectural — blockerande för Fas 2/3
**Effort**: 10-15 dagar (migration-delen är den känsligaste)
**Dependencies**: Fas 0 komplett
**Owner**: TBD

### Kontext

Den 2026-05-12 ("CF-03 schema alignment") togs modellerna `Workspace`, `WorkspaceMember`, `AuditLog` bort från Prisma-schemat eftersom tabellerna inte fanns i Supabase. `src/lib/services/workspace-auth.ts` fortsatte anropa de obefintliga tabellerna → half-broken kod.

För Fas 1+ behöver hierarkin byggas om **den här gången med de riktiga tabellerna**.

### Target-schema (komplett design)

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Organization — top-level billing + identity boundary
// One user can own multiple orgs (rare but supported).
// All billing happens at org level. SSO config at org level.
// ─────────────────────────────────────────────────────────────────────────────
model Organization {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  ownerId         String    @map("owner_id")   // user_id of creator/owner
  
  // Billing (replaces per-user subscription)
  stripeCustomerId String?  @map("stripe_customer_id")
  stripeSubId      String?  @map("stripe_sub_id")
  plan             String   @default("free")
  status           String   @default("active")
  currentPeriodEnd DateTime? @map("current_period_end")
  
  // Branding (org-wide white-label defaults)
  logoUrl         String?  @map("logo_url")
  primaryColor    String   @default("#6366f1") @map("primary_color")
  
  // Settings
  defaultWorkspaceId String? @map("default_workspace_id")
  
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  workspaces      Workspace[]
  members         OrganizationMember[]
  auditLogs       AuditLog[]
  apiKeys         ApiKey[]
  
  @@map("organizations")
  @@index([ownerId])
  @@index([slug])
  @@index([deletedAt])
}

model OrganizationMember {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  userId          String   @map("user_id")
  role            String   @default("member")  // owner | admin | billing | member
  invitedBy       String?  @map("invited_by")
  joinedAt        DateTime @default(now()) @map("joined_at")
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, userId])
  @@map("organization_members")
  @@index([userId])
  @@index([organizationId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace — project/team boundary within org
// Agency use case: 1 workspace per client.
// Team use case: 1 workspace per project/department.
// ─────────────────────────────────────────────────────────────────────────────
model Workspace {
  id              String    @id @default(uuid())
  organizationId  String    @map("organization_id")
  name            String
  slug            String
  description     String?
  
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  organization    Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members         WorkspaceMember[]
  brands          Brand[]
  
  @@unique([organizationId, slug])
  @@map("workspaces")
  @@index([organizationId])
  @@index([deletedAt])
}

model WorkspaceMember {
  id              String   @id @default(uuid())
  workspaceId     String   @map("workspace_id")
  userId          String   @map("user_id")
  role            String   @default("viewer")  // owner | admin | editor | viewer
  invitedBy       String?  @map("invited_by")
  joinedAt        DateTime @default(now()) @map("joined_at")
  
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@unique([workspaceId, userId])
  @@map("workspace_members")
  @@index([userId])
  @@index([workspaceId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand — already exists, but workspaceId added
// Replaces userId-based scoping with workspaceId-based.
// ─────────────────────────────────────────────────────────────────────────────
model Brand {
  // ... existing fields ...
  workspaceId     String   @map("workspace_id")   // NEW — required after migration
  organizationId  String   @map("organization_id") // NEW — denormalized for query perf + RLS
  userId          String   @map("user_id")        // KEPT — points to original creator
  
  // ... existing relations ...
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([organizationId])
}

// (Continua su Prompt, ApiKey, Subscription, etc. — vedi sezione "Refactor scope" sotto)
```

### Migration av befintliga data (den riskfyllda delen)

**Strategi**: varje befintlig `User` blir 1 `Organization` + 1 default `Workspace` + alla Brands tilldelade till default-workspace.

Idempotent SQL-skript som ska köras som Prisma-migration:

```sql
-- Migration: 20260520_introduce_workspace_tier.sql
-- IDEMPOTENT: safe to run multiple times in dry-run.

BEGIN;

-- 1. Create tables (Prisma migrate dev gestisce questo, lascio per referenza)
-- CREATE TABLE organizations (...)
-- CREATE TABLE organization_members (...)
-- CREATE TABLE workspaces (...)
-- CREATE TABLE workspace_members (...)

-- 2. For each unique user_id in brands, create 1 org + 1 default workspace.
INSERT INTO organizations (id, name, slug, owner_id, plan, status, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Org-' || substr(b.user_id::text, 1, 8)) as name,
  'org-' || substr(b.user_id::text, 1, 8) as slug,
  b.user_id as owner_id,
  COALESCE(sub.plan, 'free') as plan,
  COALESCE(sub.status, 'active') as status,
  NOW() as created_at,
  NOW() as updated_at
FROM (SELECT DISTINCT user_id FROM brands WHERE deleted_at IS NULL) b
LEFT JOIN auth.users au ON au.id = b.user_id
LEFT JOIN subscriptions sub ON sub.user_id = b.user_id
ON CONFLICT (slug) DO NOTHING;

-- 3. Add owner to organization_members.
INSERT INTO organization_members (id, organization_id, user_id, role, joined_at)
SELECT gen_random_uuid(), o.id, o.owner_id, 'owner', NOW()
FROM organizations o
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Create default workspace per org.
INSERT INTO workspaces (id, organization_id, name, slug, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  o.id as organization_id,
  'Default' as name,
  'default' as slug,
  NOW() as created_at,
  NOW() as updated_at
FROM organizations o
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 5. Add owner to workspace_members.
INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
SELECT gen_random_uuid(), w.id, o.owner_id, 'owner', NOW()
FROM workspaces w
JOIN organizations o ON o.id = w.organization_id
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 6. Set default_workspace_id on org.
UPDATE organizations o
SET default_workspace_id = w.id
FROM workspaces w
WHERE w.organization_id = o.id AND w.slug = 'default' AND o.default_workspace_id IS NULL;

-- 7. Backfill workspaceId + organizationId on existing brands.
-- Add columns first (Prisma migrate handles ALTER TABLE).
UPDATE brands b
SET 
  workspace_id = (SELECT w.id FROM workspaces w JOIN organizations o ON o.id = w.organization_id WHERE o.owner_id = b.user_id AND w.slug = 'default' LIMIT 1),
  organization_id = (SELECT o.id FROM organizations o WHERE o.owner_id = b.user_id LIMIT 1)
WHERE b.workspace_id IS NULL OR b.organization_id IS NULL;

-- 8. Verify no orphan brands.
DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM brands WHERE workspace_id IS NULL OR organization_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % orphan brands without workspace/org', orphan_count;
  END IF;
END $$;

-- 9. NOW we can NOT NULL the columns.
ALTER TABLE brands ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE brands ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
```

**Workflow execution** (KRITISKT — hoppa inte över steg):

1. **Staging**: klona prod-data via Supabase dump → restore i staging → kör migration → verifiera integritet
2. **Test på staging**: ser varje befintlig användare fortfarande sina brands? Är premium subscription korrekt mappad?
3. **Backup prod**: komplett `pg_dump` före migration
4. **Maintenance mode**: appen i maintenance i 15-30 min (notifiera användare 48h i förväg via e-post)
5. **Kör migration prod**: bakom backupen
6. **Smoke test prod**: 5 riktiga användare bekräftar funktion
7. **Maintenance off**

### Refactor scope (efter migration)

Alla dessa modeller behöver få `workspaceId` (+ `organizationId` denormaliserad för query perf):

- `Brand` — redan i designen ovan
- `Prompt` — `workspaceId` tillagt, queries scoped
- `ApiKey` — flytta från `userId` till `organizationId` (keys är org-level, inte user-level)
- `Subscription` — flytta från `userId` till `organizationId`
- `TeamMember` — DEPRECATED, använd `WorkspaceMember` istället
- `BrandInvitation` — DEPRECATED, använd workspace invitation flow

`workspace-auth.ts` ska skrivas om (pekar idag på obefintliga tabeller):

```ts
// src/lib/services/workspace-auth.ts
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Database } from '@/types/supabase'

export type Permission = 'manage_members' | 'view_audit' | 'edit_brand' | 'view_brand' | 'manage_billing' | 'manage_api_keys'
export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  owner: ['manage_members', 'view_audit', 'edit_brand', 'view_brand', 'manage_billing', 'manage_api_keys'],
  admin: ['manage_members', 'view_audit', 'edit_brand', 'view_brand', 'manage_api_keys'],
  editor: ['edit_brand', 'view_brand'],
  viewer: ['view_brand'],
}

export async function checkWorkspacePermission(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<boolean> {
  const db = createServerClient<Database>()
  if (!db) return false

  const { data, error } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    logger.debug('Permission check failed', { userId, workspaceId, permission, error: error?.message })
    return false
  }

  return PERMISSION_MATRIX[data.role as Role]?.includes(permission) ?? false
}

// ... analogous for checkOrgPermission, getCurrentWorkspace, etc.
```

### Begärda UI-ändringar

- Workspace switcher i nav (Cmd+K compatible)
- `/dashboard/workspaces/[id]` route med member management
- Invite member modal (e-post + role select)
- "Move brand to different workspace" action i brand settings
- Org settings page `/dashboard/org` (endast admin): billing, members, SSO setup (Fas 2)

### Acceptance criteria T07

- [ ] Prisma-schema inkluderar Organization, OrganizationMember, Workspace, WorkspaceMember
- [ ] Idempotent migration-SQL i `prisma/migrations/<timestamp>_introduce_workspace_tier/`
- [ ] Migration körd på staging med simulerad prod-dump — verifierat 0 orphan brands
- [ ] `workspace-auth.ts` omskriven, pekar på de riktiga tabellerna
- [ ] Brand, Prompt, ApiKey, Subscription alla scoped per workspace/org
- [ ] TeamMember/BrandInvitation deprecated med data-migration → WorkspaceMember
- [ ] UI: workspace switcher live, member management fungerar
- [ ] Invitation flow: invite via e-post → klicka länk → join workspace
- [ ] Test E2E: signup → create workspace → invite member → switch workspace → see correct brands
- [ ] Test E2E: try to access brand in workspace I'm not member of → 403
- [ ] `pnpm type-check && pnpm test && pnpm test:e2e` PASS
- [ ] Dokumentation: `docs/architecture/multi-tenancy.md` med diagram + ER

### Files (hög nivå — inte uttömmande)

- `prisma/schema.prisma` (major changes)
- `prisma/migrations/<timestamp>_introduce_workspace_tier/migration.sql`
- `src/types/supabase.ts` (regenererad)
- `src/lib/services/workspace-auth.ts` (rewrite)
- `src/lib/services/organization-auth.ts` (ny)
- `src/app/api/v1/organizations/` (ny)
- `src/app/api/v1/workspaces/` (ny)
- `src/app/api/v1/workspaces/[id]/members/` (ny)
- `src/app/api/v1/workspaces/[id]/invitations/` (ny)
- `src/components/workspace/WorkspaceSwitcher.tsx` (ny)
- `src/components/workspace/MemberList.tsx` (ny)
- `src/components/workspace/InviteMemberModal.tsx` (ny)
- `src/app/dashboard/workspaces/[id]/page.tsx` (ny)
- `src/app/dashboard/org/page.tsx` (ny)
- `src/lib/services/email.ts` (utöka för invitation-e-post)
- `docs/architecture/multi-tenancy.md` (ny)

### Releasestrategi

Denna task är för stor för 1 enskild PR. Dela upp i:

- **PR 7.1**: Prisma schema additive (ingen NOT NULL på nya FK, ingen borttagning av tabeller) + types regen
- **PR 7.2**: Idempotent migration-SQL + backfill-skript testat i staging
- **PR 7.3**: `workspace-auth.ts` rewrite + nya auth-endpoints
- **PR 7.4**: UI workspace switcher + member management
- **PR 7.5**: Refactor `Brand` / `Prompt` / `ApiKey` för `workspaceId` scoping
- **PR 7.6**: Deprecate TeamMember/BrandInvitation, migrera till WorkspaceMember
- **PR 7.7**: NOT NULL enforcement + cleanup, slutligt test E2E pass

Varje PR ska kunna mergas självständigt i `main` (feature flag om nödvändigt för UI).

---

## T08 — Audit log table + instrumentation av kritiska åtgärder

**Severity**: Compliance + trust signal
**Effort**: 4-6 dagar
**Dependencies**: T07 slutförd
**Owner**: TBD

### Target-schema

```prisma
model AuditLog {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  workspaceId     String?  @map("workspace_id")   // null for org-level actions
  
  actorId         String   @map("actor_id")        // user_id who performed
  actorType       String   @default("user") @map("actor_type")  // user | api_key | system
  actorApiKeyId   String?  @map("actor_api_key_id")
  
  action          String   // e.g. 'workspace.member.added', 'brand.deleted', 'billing.plan.changed'
  resourceType    String   @map("resource_type")    // workspace | brand | api_key | subscription | etc.
  resourceId      String?  @map("resource_id")
  
  ipAddress       String?  @map("ip_address")
  userAgent       String?  @map("user_agent")
  metadata        Json     @default("{}")
  
  createdAt       DateTime @default(now()) @map("created_at")
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("audit_logs")
  @@index([organizationId, createdAt(sort: Desc)])
  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
  @@index([action])
  @@index([resourceType, resourceId])
}
```

### RLS policy (Supabase)

```sql
-- audit_logs è APPEND-ONLY. No UPDATE, no DELETE da utente.
-- Solo SELECT per membri dell'org con role admin/owner/auditor.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_no_update" ON audit_logs FOR UPDATE USING (false);
CREATE POLICY "audit_logs_no_delete" ON audit_logs FOR DELETE USING (false);

CREATE POLICY "audit_logs_select_org_admin" ON audit_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- INSERT allowed only via service_role (server-side) — no client direct insert.
-- Service role bypasses RLS by design.
```

### Åtgärder som ska loggas (minimum viable)

| Categoria | Action | Trigger |
|---|---|---|
| **Auth** | `auth.login` | login success |
| **Auth** | `auth.logout` | logout |
| **Auth** | `auth.mfa.enabled` | MFA setup (Fas 2) |
| **Auth** | `auth.password.changed` | password reset |
| **Org** | `org.created` | new org |
| **Org** | `org.deleted` | org delete |
| **Org** | `org.member.added` | invite accepted |
| **Org** | `org.member.removed` | member removed |
| **Org** | `org.member.role.changed` | role update |
| **Workspace** | `workspace.created` | new workspace |
| **Workspace** | `workspace.deleted` | workspace delete |
| **Workspace** | `workspace.member.added` | invite accepted |
| **Workspace** | `workspace.member.removed` | member removed |
| **Workspace** | `workspace.member.role.changed` | role update |
| **Brand** | `brand.created` | new brand |
| **Brand** | `brand.deleted` | brand soft delete |
| **Brand** | `brand.restored` | brand restore from soft delete |
| **Brand** | `brand.moved` | brand moved between workspaces |
| **API Key** | `api_key.created` | new key generated |
| **API Key** | `api_key.revoked` | key revoked |
| **API Key** | `api_key.used` (NOT every request — first use per key per day OK) | first use of key per day |
| **Billing** | `billing.plan.changed` | subscription upgrade/downgrade |
| **Billing** | `billing.payment.succeeded` | webhook stripe |
| **Billing** | `billing.payment.failed` | webhook stripe |
| **Data** | `data.exported` | GDPR export (Fas 2) |
| **Data** | `data.deleted` | GDPR deletion (Fas 2) |
| **Settings** | `settings.changed` | major settings update |
| **SSO** | `sso.configured` | SSO provider added (Fas 2) |

### Implementation helper

```ts
// src/lib/services/audit-log.ts
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type AuditAction =
  | 'auth.login' | 'auth.logout' | 'auth.mfa.enabled' | 'auth.password.changed'
  | 'org.created' | 'org.deleted' | 'org.member.added' | 'org.member.removed' | 'org.member.role.changed'
  | 'workspace.created' | 'workspace.deleted' | 'workspace.member.added' | 'workspace.member.removed' | 'workspace.member.role.changed'
  | 'brand.created' | 'brand.deleted' | 'brand.restored' | 'brand.moved'
  | 'api_key.created' | 'api_key.revoked' | 'api_key.used'
  | 'billing.plan.changed' | 'billing.payment.succeeded' | 'billing.payment.failed'
  | 'data.exported' | 'data.deleted'
  | 'settings.changed'
  | 'sso.configured'

export interface AuditLogInput {
  organizationId: string
  workspaceId?: string
  actorId: string
  actorType?: 'user' | 'api_key' | 'system'
  actorApiKeyId?: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const db = createServerClient()
    if (!db) {
      logger.error('Audit log failed: no DB client', { action: input.action })
      return
    }

    const { error } = await db.from('audit_logs').insert({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId ?? null,
      actor_id: input.actorId,
      actor_type: input.actorType ?? 'user',
      actor_api_key_id: input.actorApiKeyId ?? null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    })

    if (error) {
      logger.error('Audit log insert failed', { action: input.action, err: error.message })
    }
  } catch (err) {
    logger.error('Audit log unexpected error', { action: input.action, err })
  }
  // NB: audit log failure does NOT throw — non bloccare la business action.
}
```

### Export-funktionalitet

- `GET /api/v1/organizations/:orgId/audit-logs` — query med filter (action, resource_type, date range, actor)
- `GET /api/v1/organizations/:orgId/audit-logs/export?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD` — streaming CSV download

### UI

- `/dashboard/org/audit-logs` — table view med filter
- Pagination, search, export button

### Acceptance criteria T08

- [ ] Prisma-schema inkluderar `AuditLog` model
- [ ] Migration-SQL inkluderar tabell + RLS append-only
- [ ] `src/lib/services/audit-log.ts` med helper `logAudit()`
- [ ] Alla 25+ åtgärder listade ovan har `logAudit()` call
- [ ] `GET /api/v1/organizations/:orgId/audit-logs` endpoint fungerar (med filter)
- [ ] `GET /api/v1/organizations/:orgId/audit-logs/export?format=csv` endpoint
- [ ] UI `/dashboard/org/audit-logs` med tabell + filter + export
- [ ] Test: log skapad efter varje spårad åtgärd
- [ ] Test: försök till UPDATE/DELETE på audit_logs → blockerad av RLS
- [ ] Test: icke-admin-användare → 403 på audit log endpoints
- [ ] Performance: export av 10.000 records < 5s
- [ ] Retention policy dokumenterad i Trust Center (Fas 2)

### Files

- `prisma/schema.prisma` (add AuditLog)
- `prisma/migrations/<timestamp>_add_audit_logs/`
- `src/lib/services/audit-log.ts`
- `src/app/api/v1/organizations/[orgId]/audit-logs/route.ts`
- `src/app/api/v1/organizations/[orgId]/audit-logs/export/route.ts`
- `src/app/dashboard/org/audit-logs/page.tsx`
- `src/components/audit/AuditLogTable.tsx`
- Instrumentation: ~25 olika filer (1 `logAudit()` vardera)

---

## T09 — Scoped API keys med permission model

**Severity**: Security (stänger HIGH risk från SECURITY.md)
**Effort**: 3-5 dagar
**Dependencies**: T07 slutförd
**Owner**: TBD

### Issue

`ApiKey` model finns men:
- Inget `scopes`-fält — varje key = full access
- Flytta från `userId` till `organizationId` (de är org-level resource)
- SECURITY.md flaggar som HIGH risk

### Schema-uppdatering

```prisma
model ApiKey {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")  // CHANGED from userId
  createdBy       String   @map("created_by")        // user_id who created
  name            String
  
  // Key derivation
  keyPrefix       String   @map("key_prefix")        // first 8 chars, visible
  keyHash         String   @map("key_hash") @unique  // bcrypt hash of full key
  
  // Permissions
  scopes          String[] @default([])              // e.g. ['read:brands', 'write:brands', 'read:analytics']
  
  // Lifecycle
  lastUsedAt      DateTime? @map("last_used_at")
  expiresAt       DateTime? @map("expires_at")
  revokedAt       DateTime? @map("revoked_at")
  revokedBy       String?   @map("revoked_by")
  
  createdAt       DateTime  @default(now()) @map("created_at")
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("api_keys")
  @@index([organizationId])
  @@index([keyHash])
  @@index([keyPrefix])
}
```

### Scope-katalog

| Scope | Permits |
|---|---|
| `read:brands` | GET brand list, GET brand detail |
| `write:brands` | POST/PATCH/DELETE brand |
| `read:prompts` | GET prompts |
| `write:prompts` | POST/PATCH/DELETE prompts |
| `read:analytics` | GET monitoring results, AVI scores, citations |
| `write:webhooks` | Webhook delivery (incoming POST) |
| `read:audit` | GET audit logs |
| `manage:api_keys` | Create/revoke other API keys (recursive, dangerous — flag in UI) |
| `manage:billing` | Read billing, update subscription |
| `manage:members` | Invite/remove workspace members |

### Generation flow

```
1. User clicks "Generate API key" in UI
2. UI calls POST /api/v1/api-keys with name + scopes selected
3. Backend:
   a. Generate cryptographic random 32-byte → format as 'aipulse_<32_url_safe_chars>'
   b. Compute bcrypt hash of full key
   c. Store keyPrefix (first 8 chars) + keyHash + scopes
   d. Return FULL KEY to user (only time it's shown)
4. UI shows key in modal "Copy now, won't show again"
5. logAudit('api_key.created', { name, scopes })
```

### Verification middleware

```ts
// src/lib/api-key-auth.ts
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/services/audit-log'

export interface ApiKeyContext {
  organizationId: string
  apiKeyId: string
  scopes: string[]
}

export async function verifyApiKey(
  authHeader: string | undefined,
  requiredScope: string,
): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  
  const fullKey = authHeader.slice(7)
  if (!fullKey.startsWith('aipulse_')) return null
  
  const keyPrefix = fullKey.slice(0, 16) // 'aipulse_' + 8 chars
  
  const db = createServerClient()
  if (!db) return null
  
  // Query by prefix (indexed) — narrowing set before bcrypt compare
  const { data: candidates } = await db
    .from('api_keys')
    .select('id, organization_id, key_hash, scopes, revoked_at, expires_at')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)
  
  if (!candidates?.length) return null
  
  for (const candidate of candidates) {
    if (candidate.expires_at && new Date(candidate.expires_at) < new Date()) continue
    if (await bcrypt.compare(fullKey, candidate.key_hash)) {
      // Verified
      if (!candidate.scopes.includes(requiredScope)) {
        logger.warn('API key valid but missing scope', { 
          apiKeyId: candidate.id, requiredScope, scopes: candidate.scopes,
        })
        return null
      }
      
      // Async audit + last_used update
      void db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', candidate.id)
      void logAudit({
        organizationId: candidate.organization_id,
        actorId: candidate.id, // actor IS the api key
        actorType: 'api_key',
        actorApiKeyId: candidate.id,
        action: 'api_key.used',
        resourceType: 'api',
        metadata: { requiredScope },
      })
      
      return {
        organizationId: candidate.organization_id,
        apiKeyId: candidate.id,
        scopes: candidate.scopes,
      }
    }
  }
  
  return null
}
```

### UI

- `/dashboard/org/api-keys` — list keys (prefix only, never full)
- Modal "Generate new key": name input + scope checkboxes
- Modal "Copy key once": full key shown, then never again
- "Revoke" action per key (soft revoke via `revoked_at`)

### Acceptance criteria T09

- [ ] Prisma-schema `ApiKey` model uppdaterad med `scopes`, `keyPrefix`, `keyHash`, `organizationId`, `revokedAt`, `revokedBy`
- [ ] Migration: backfill befintliga `api_keys` med `scopes = ['read:brands', 'write:brands', ...]` (all permissions — backward compat) + `organizationId` derived
- [ ] `src/lib/api-key-auth.ts` med `verifyApiKey()` helper
- [ ] Alla public API-endpoints (`/api/v1/`) använder `verifyApiKey()` med lämplig scope
- [ ] UI `/dashboard/org/api-keys` fungerar
- [ ] Test: genererad nyckel kan nå endpoint med auktoriserad scope
- [ ] Test: nyckel utan begärd scope → 403
- [ ] Test: revoked nyckel → 401
- [ ] Test: expired nyckel → 401
- [ ] Audit log entry för varje key created/revoked
- [ ] API-dokumentation: scopes-lista publicerad i `/docs/api`

### Files

- `prisma/schema.prisma` (update ApiKey)
- `prisma/migrations/<timestamp>_scoped_api_keys/`
- `src/lib/api-key-auth.ts` (ny)
- `src/app/api/v1/api-keys/route.ts` (CRUD)
- `src/app/dashboard/org/api-keys/page.tsx`
- `src/components/api-keys/ApiKeyList.tsx`
- `src/components/api-keys/GenerateKeyModal.tsx`
- Alla `/api/v1/*` endpoints uppdaterade för scope-verifiering

---

## ✅ Definition of Done Fase 1

- [ ] T07, T08, T09 alla merged i `main`
- [ ] Migration körd på prod utan data loss
- [ ] Smoke test prod: 5 riktiga användare bekräftar funktion
- [ ] AGENTS.md uppdaterad för att återspegla multi-tenant (exempel: hur man hämtar current workspace context i route)
- [ ] Arkitekturdokumentation uppdaterad: `docs/architecture/multi-tenancy.md`, `docs/architecture/audit-log.md`, `docs/architecture/api-keys.md`
- [ ] CODE_REVIEW.md kan stängas (S1/S2 lösta i Fas 0, HIGH risk-arkitektur stängd i Fas 1)
- [ ] SECURITY.md uppdaterad: 2 HIGH risk (broad API key) → CLOSED
- [ ] task-tracker.md uppdaterad till Done för T07-T09

## 🚀 När man går vidare till Fas 2/3

Fas 2 och Fas 3 kan startas **parallellt** efter att Fas 1 är slutförd. Idealiskt split med 2 dev: en på Fas 2, den andra på Fas 3.

---

**Tillbaka till kartan**: [README.md](README.md).
**Nästa faser**: [03-fase-2-trust-gdpr.md](03-fase-2-trust-gdpr.md) | [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md)
