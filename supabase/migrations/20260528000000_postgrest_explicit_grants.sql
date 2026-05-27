-- PostgREST/Data API explicit grants (Supabase Oct 2026 enforcement)
--
-- BACKGROUND
-- From Oct 30, 2026, Supabase stops auto-exposing new tables in the
-- "public" schema to the Data API (PostgREST/GraphQL/supabase-js).
-- Tables created by Prisma migrations must have explicit GRANTs or
-- they return 404/401 from supabase-js.
--
-- WHAT THIS MIGRATION DOES
-- 1. One-time catch-up: grants on ALL existing tables/sequences/functions
--    in the public schema (defense in depth for any table that lacks them)
-- 2. Forward-looking: sets ALTER DEFAULT PRIVILEGES so any future table
--    created by the migration role (postgres) inherits grants automatically
--
-- See: https://supabase.com/changelog/ (May 2026 — Data API grant enforcement)

-- Catch-up: grant on all existing objects
grant all on all tables in schema public to postgres, anon, authenticated;
grant all on all sequences in schema public to postgres, anon, authenticated;
grant all on all functions in schema public to postgres, anon, authenticated;

-- Forward-looking: default privileges for future objects created by postgres
alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on functions to postgres, anon, authenticated;
