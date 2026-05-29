-- PATH: supabase/schema.sql
-- ─── AEO Pulse — Supabase Schema (v2 — Security Fix) ──────────────────────────
--
-- CHANGES FROM v1:
--   • Removed `service_all_brands` policy that bypassed all RLS rules.
--     The service role (SUPABASE_SERVICE_KEY) already bypasses RLS automatically
--     on the server side — no permissive "allow all" policy is needed.
--   • All other policies are unchanged.
--
-- Run this in your Supabase SQL editor:
--   https://app.supabase.com → your project → SQL Editor → New query
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy text search

-- ─── PROFILES (extends auth.users) ───────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── USER API KEYS ───────────────────────────────────────────────────────────────
create table if not exists user_api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  provider text not null check (provider in ('openai', 'gemini', 'perplexity', 'anthropic')),
  encrypted_key text not null,
  label text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

create index if not exists user_api_keys_user_id_idx on user_api_keys(user_id);

-- ─── SCAN HISTORY ────────────────────────────────────────────────────────────────
create table if not exists scan_history (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  brand_id uuid references brands(id) on delete cascade,
  source text not null,
  type text not null,
  summary text,
  visibility_score int default 0,
  engine text not null,
  model text,
  intent text,
  intent_confidence int,
  content_type text,
  tone text,
  reading_level text,
  created_at timestamptz default now()
);

create index if not exists scan_history_user_id_idx on scan_history(user_id);
create index if not exists scan_history_brand_id_idx on scan_history(brand_id);
create index if not exists scan_history_created_at_idx on scan_history(created_at desc);

-- ─── BRANDS ───────────────────────────────────────────────────────────────────
create table if not exists brands (
  id           uuid primary key default uuid_generate_v4(),
  user_id      text not null,                          -- Supabase auth user id
  name         text not null,
  slug         text not null,
  description  text,
  domain       text,                                   -- primary domain
  aliases      text[] default '{}',                   -- brand name variants
  domains      text[] default '{}',                   -- all domains/subdomains
  competitors  text[] default '{}',                   -- competitor brand names
  industry     text,
  color        text default '#636f6f1',                -- ui accent color
  logo_url     text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  -- Primary market language for localized prompt generation (en/it/sv)
  language     text not null default 'en' check (language in ('en', 'it', 'sv')),
  -- White-label report settings
  report_logo_url     text,
  report_brand_name   text,
  report_primary_color text,
  unique(user_id, slug)
);

create index if not exists brands_user_id_idx on brands(user_id);
create index if not exists brands_slug_idx on brands(slug);

-- ─── PROMPTS ──────────────────────────────────────────────────────────────────
create table if not exists prompts (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid not null references brands(id) on delete cascade,
  user_id       text not null,
  text          text not null,                         -- the prompt/query to monitor
  language      text default 'en',
  market        text default 'global',
  category      text,                                  -- 'awareness'|'comparison'|'alternative'|'custom'
  engines       text[] default '{chatgpt,gemini,perplexity}',
  is_active     boolean default true,
  run_frequency text default 'daily',                 -- 'hourly'|'daily'|'weekly'
  last_run_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists prompts_brand_id_idx on prompts(brand_id);
create index if not exists prompts_user_id_idx on prompts(user_id);

-- ─── MONITORING RESULTS ───────────────────────────────────────────────────────
create table if not exists monitoring_results (
  id                uuid primary key default uuid_generate_v4(),
  prompt_id         uuid not null references prompts(id) on delete cascade,
  brand_id          uuid not null references brands(id) on delete cascade,
  user_id           text not null,
  engine            text not null,                    -- 'chatgpt'|'gemini'|'perplexity'
  prompt_text       text not null,                   -- snapshot of prompt at run time
  response_text     text not null,                   -- AI response (truncated at 5000 chars)
  brand_mentioned   boolean default false,
  mention_position  int,                             -- 1 = first mention, null = not mentioned
  mention_count     int default 0,
  mention_type      text,                            -- 'direct'|'indirect'|'none'
  visibility_score  int default 0,                  -- 0-100
  sentiment         text,                            -- 'positive'|'negative'|'neutral'
  sentiment_score   float,                          -- -1.0 to 1.0
  cited_urls        text[] default '{}',
  competitor_mentions jsonb default '[]',            -- [{name, position, count}]
  has_hallucination boolean default false,
  hallucination_flags jsonb default '[]',            -- [{text, severity, type}]
  raw_response      jsonb,                          -- full API response for debugging
  created_at        timestamptz default now()
);

create index if not exists monitoring_results_brand_id_idx on monitoring_results(brand_id);
create index if not exists monitoring_results_prompt_id_idx on monitoring_results(prompt_id);
create index if not exists monitoring_results_engine_idx on monitoring_results(engine);
create index if not exists monitoring_results_created_at_idx on monitoring_results(created_at desc);
create index if not exists monitoring_results_user_id_idx on monitoring_results(user_id);

-- ─── ALERT RULES ──────────────────────────────────────────────────────────────
create table if not exists alert_rules (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid not null references brands(id) on delete cascade,
  user_id       text not null,
  name          text not null,
  type          text not null,    -- see AlertType enum
  condition     jsonb not null,   -- {threshold, operator, engine, competitor, etc.}
  channels      text[] default '{email}',
  email         text,
  webhook_url   text,
  is_active     boolean default true,
  last_fired_at timestamptz,
  created_at    timestamptz default now()
);

create index if not exists alert_rules_brand_id_idx on alert_rules(brand_id);
create index if not exists alert_rules_user_id_idx on alert_rules(user_id);

-- ─── ALERT EVENTS ─────────────────────────────────────────────────────────────
create table if not exists alert_events (
  id             uuid primary key default uuid_generate_v4(),
  alert_rule_id  uuid references alert_rules(id) on delete set null,
  brand_id       uuid not null references brands(id) on delete cascade,
  user_id        text not null,
  type           text not null,
  title          text not null,
  message        text not null,
  data           jsonb default '{}',
  channels_sent  text[] default '{}',
  is_read        boolean default false,
  created_at     timestamptz default now()
);

create index if not exists alert_events_brand_id_idx on alert_events(brand_id);
create index if not exists alert_events_user_id_idx on alert_events(user_id);
create index if not exists alert_events_is_read_idx on alert_events(is_read);
create index if not exists alert_events_created_at_idx on alert_events(created_at desc);
create index if not exists alert_events_alert_rule_id_idx on alert_events(alert_rule_id);

-- ─── BRAND HEALTH SCORES ──────────────────────────────────────────────────────
create table if not exists brand_health_scores (
  id                uuid primary key default uuid_generate_v4(),
  brand_id          uuid not null references brands(id) on delete cascade,
  user_id           text not null,
  date              date not null,
  visibility_score  float default 0,
  sentiment_score   float default 0,
  hallucination_rate float default 0,
  mention_count     int default 0,
  citation_count    int default 0,
  health_score      float default 0,
  domain_authority  float default 0,
  engine_breakdown  jsonb default '{}',
  created_at        timestamptz default now(),
  unique(brand_id, date)
);

create index if not exists brand_health_scores_brand_id_idx on brand_health_scores(brand_id);
create index if not exists brand_health_scores_date_idx on brand_health_scores(date desc);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Users can only read/write their own data.
-- The service key (SUPABASE_SERVICE_KEY) used by API routes bypasses RLS
-- automatically — no "allow all" policy is needed for that.

alter table profiles enable row level security;
alter table user_api_keys enable row level security;
alter table scan_history enable row level security;
alter table brands enable row level security;
alter table prompts enable row level security;
alter table monitoring_results enable row level security;
alter table alert_rules enable row level security;
alter table alert_events enable row level security;
alter table brand_health_scores enable row level security;

-- ── profiles ───────────────────────────────────────────────────────────────────
create policy "users_own_profile" on profiles
  for select using (id::text = (select auth.uid())::text);

create policy "users_update_profile" on profiles for update
  using (id::text = (select auth.uid())::text);

create policy "users_insert_profile" on profiles for insert
  with check (id::text = (select auth.uid())::text);

-- ── user_api_keys ─────────────────────────────────────────────────────────────
create policy "users_own_api_keys" on user_api_keys
  for all using (user_id = (select auth.uid())::text);

-- ── scan_history ───────────────────────────────────────────────────────────────
create policy "users_own_scan_history" on scan_history
  for all using (user_id = (select auth.uid())::text);

-- ── brands ────────────────────────────────────────────────────────────────────
create policy "users_own_brands" on brands
  for select using (user_id = (select auth.uid())::text);

create policy "users_insert_brands" on brands for insert
  with check (user_id = (select auth.uid())::text);

create policy "users_update_brands" on brands for update
  using (user_id = (select auth.uid())::text);

create policy "users_delete_brands" on brands for delete
  using (user_id = (select auth.uid())::text);

-- ── prompts ───────────────────────────────────────────────────────────────────
create policy "users_own_prompts" on prompts
  for select using (user_id = (select auth.uid())::text);

create policy "users_insert_prompts" on prompts for insert
  with check (user_id = (select auth.uid())::text);

create policy "users_update_prompts" on prompts for update
  using (user_id = (select auth.uid())::text);

create policy "users_delete_prompts" on prompts for delete
  using (user_id = (select auth.uid())::text);

-- ── monitoring_results ────────────────────────────────────────────────────────
create policy "users_own_monitoring" on monitoring_results
  for select using (user_id = (select auth.uid())::text);

create policy "users_insert_monitoring" on monitoring_results for insert
  with check (user_id = (select auth.uid())::text);

-- ── alert_rules ───────────────────────────────────────────────────────────────
create policy "users_own_alerts" on alert_rules
  for select using (user_id = (select auth.uid())::text);

create policy "users_insert_alerts" on alert_rules for insert
  with check (user_id = (select auth.uid())::text);

create policy "users_update_alerts" on alert_rules for update
  using (user_id = (select auth.uid())::text);

create policy "users_delete_alerts" on alert_rules for delete
  using (user_id = (select auth.uid())::text);

-- ── alert_events ──────────────────────────────────────────────────────────────
create policy "users_own_alert_events" on alert_events
  for select using (user_id = (select auth.uid())::text);

create policy "users_update_alert_events" on alert_events for update
  using (user_id = (select auth.uid())::text);

create policy "users_delete_alert_events" on alert_events for delete
  using (user_id = (select auth.uid())::text);

-- ── brand_health_scores ───────────────────────────────────────────────────────
create policy "users_own_health_scores" on brand_health_scores
  for select using (user_id = (select auth.uid())::text);

create policy "users_insert_health_scores" on brand_health_scores for insert
  with check (user_id = (select auth.uid())::text);

create policy "users_update_health_scores" on brand_health_scores for update
  using (user_id = (select auth.uid())::text);

-- ─── CITATION SNAPSHOTS ─────────────────────────────────────────────────────────
create table if not exists citation_snapshots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references brands(id) on delete cascade,
  scan_date date not null,
  engine text not null default 'all',
  category text not null default 'all',
  language text not null default 'all',
  total_prompts int default 0,
  brand_citations int default 0,
  citation_rate float default 0,
  avg_position float,
  avg_visibility float default 0,
  avg_sentiment float default 0,
  competitor_rates jsonb default '{}',
  created_at timestamptz default now(),
  unique(project_id, scan_date, engine, category, language)
);

create index idx_citation_snapshots_project on citation_snapshots(project_id);
create index idx_citation_snapshots_date on citation_snapshots(scan_date desc);
create index idx_citation_snapshots_engine on citation_snapshots(engine);

alter table citation_snapshots enable row level security;

create policy "users_own_citation_snapshots" on citation_snapshots
  for select using (project_id in (select id from brands where user_id = (select auth.uid())::text));

create policy "users_insert_citation_snapshots" on citation_snapshots for insert
  with check (project_id in (select id from brands where user_id = (select auth.uid())::text));

-- ─── KEYWORD TRACKING ──────────────────────────────────────────────────────────
create table if not exists keyword_tracking (
  id uuid primary key default uuid_generate_v4(),
  brand_id text not null,
  keyword text not null,
  frequency int default 0,
  mention_correlation float default 0,
  engines text[] default '{}',
  first_seen date,
  last_seen date,
  created_at timestamptz default now(),
  unique(brand_id, keyword)
);

create index idx_keyword_brand on keyword_tracking(brand_id);
create index idx_keyword_freq on keyword_tracking(frequency desc);

alter table keyword_tracking enable row level security;

create policy "users_own_keywords" on keyword_tracking
  for select using (brand_id in (select id from brands where user_id = (select auth.uid())::text));

-- ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  user_id text not null,                              -- invited user's id (null until accepted)
  email text not null,                                 -- invited email
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by text not null,                           -- who sent the invite
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(brand_id, email)
);

create index idx_team_members_brand on team_members(brand_id);
create index idx_team_members_user on team_members(user_id);
create index idx_team_members_email on team_members(email);

alter table team_members enable row level security;

-- RLS for team_members: owner can manage, team members can view
create policy "team_owner_manage" on team_members for all
  using (
    brand_id in (
      select id from brands where user_id = (select auth.uid())
      or id in (select brand_id from team_members where user_id::uuid = (select auth.uid()) and role = 'owner')
    )
  );

create policy "team_members_select" on team_members for select
  using (
    brand_id in (
      select id from brands where user_id = (select auth.uid())
      or id in (select brand_id from team_members where user_id::uuid = (select auth.uid()))
    )
  );

-- ─── INVITATIONS (for email-based invites) ──────────────────────────────────
create table if not exists brand_invitations (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by text not null,
  token text not null unique default uuid_generate_v4(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now(),
  unique(brand_id, email)
);

create index idx_invitations_token on brand_invitations(token);
create index idx_invitations_email on brand_invitations(email);

alter table brand_invitations enable row level security;

-- Allow anyone with token to accept/decline (no RLS for token verification)
-- Service role handles the actual accept/decline logic

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger brands_updated_at before update on brands
  for each row execute function update_updated_at();

create trigger prompts_updated_at before update on prompts
  for each row execute function update_updated_at();

-- ─── REMOVE OLD BROKEN POLICY (run if upgrading from v1) ─────────────────────
-- If you already ran the v1 schema, execute these two lines to remove the
-- dangerous "service_all_brands" policy that bypasses RLS for everyone:
--
--   drop policy if exists "service_all_brands" on brands;
--
-- That's all — no other changes needed.

-- ─── SUBSCRIPTIONS (Stripe billing) ─────────────────────────────────────────
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null unique,
  stripe_customer_id text,
  stripe_sub_id text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user on subscriptions(user_id);
create index idx_subscriptions_stripe on subscriptions(stripe_customer_id);

alter table subscriptions enable row level security;

create policy "users_own_subscription" on subscriptions for all
  using (user_id = (select auth.uid())::text);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();
