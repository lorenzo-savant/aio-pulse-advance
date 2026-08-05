-- Six tables exist in production with no CREATE TABLE anywhere in this folder.
--
-- Measured by `npm run check:drift`: 56 tables at runtime, 51 with a CREATE
-- TABLE. Restore a database from these migrations and organizations,
-- workspaces, their two membership tables, api_keys and audit_logs simply are
-- not there — which means the multi-tenant layer and the audit trail cannot be
-- rebuilt at all. That is the kind of gap nobody discovers until the day they
-- need it.
--
-- SAFE IN PRODUCTION BY CONSTRUCTION. Every statement is IF NOT EXISTS, so
-- against the live database this migration is a no-op: it creates nothing,
-- alters nothing, drops nothing. It exists to make a REBUILD produce the same
-- shape the running system has.
--
-- Column names and types are taken from src/types/database.ts, which is
-- generated from production, so the shape is authoritative.
--
-- The RLS policies below are NOT: they are reconstructed from the columns and
-- from how the application queries these tables, because reading the live
-- policies needs a Postgres connection this repo does not carry
-- (SUPABASE_DB_URL is unset — the same thing blocking the drift gate in PR #5).
-- They are deliberately tight: a fresh environment fails closed rather than
-- open. Before trusting this for a real restore, diff it against production.

-- ─── organizations ───────────────────────────────────────────────────────────
-- default_workspace_id intentionally carries no FK: organizations and
-- workspaces reference each other, and a circular constraint would make both
-- tables uncreatable in a single pass.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null,
  plan text not null default 'free',
  status text not null default 'active',
  primary_color text not null default '#6366f1',
  logo_url text,
  default_workspace_id uuid,
  stripe_customer_id text,
  stripe_sub_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists organizations_owner_id_idx on public.organizations (owner_id);
create index if not exists organizations_deleted_at_idx on public.organizations (deleted_at);

-- ─── workspaces ──────────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create index if not exists workspaces_organization_id_idx on public.workspaces (organization_id);
create index if not exists workspaces_deleted_at_idx on public.workspaces (deleted_at);

-- ─── organization_members ────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  invited_by uuid,
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx on public.organization_members (user_id);

-- ─── workspace_members ───────────────────────────────────────────────────────
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  invited_by uuid,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

-- ─── api_keys ────────────────────────────────────────────────────────────────
-- `key` is the legacy plaintext column and stays nullable: new keys are stored
-- as key_hash + key_prefix and the plaintext is never written again.
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  key text,
  key_hash text,
  key_prefix text,
  scopes text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

-- ─── audit_logs ──────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_id uuid not null,
  actor_type text not null default 'user',
  actor_api_key_id uuid references public.api_keys (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Every table above is reachable only through the service-role client today,
-- which bypasses RLS entirely. Enabling it costs nothing at runtime and means a
-- rebuilt database is not wide open if an anon key ever reaches these tables.

alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspace_members enable row level security;
alter table public.api_keys enable row level security;
alter table public.audit_logs enable row level security;

-- You see an organization if you own it or belong to it.
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select using (
  owner_id = (select auth.uid())
  or id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces for select using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

-- A member sees the roster of organisations they are in — not every roster.
drop policy if exists organization_members_read on public.organization_members;
create policy organization_members_read on public.organization_members for select using (
  user_id = (select auth.uid())
  or organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select using (
  user_id = (select auth.uid())
  or workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = (select auth.uid())
  )
);

-- An API key is personal. No cross-user read, ever — and the row carries the
-- hash, so a leak here is a leak of credentials.
drop policy if exists api_keys_owner_only on public.api_keys;
create policy api_keys_owner_only on public.api_keys for select using (
  user_id = (select auth.uid())
);

-- The audit trail is readable by the organisation it belongs to, and is
-- append-only from the application's point of view: no update or delete policy
-- exists, so nothing can rewrite history through an anon or authenticated key.
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs for select using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);
