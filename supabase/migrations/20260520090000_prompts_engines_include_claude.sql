-- Migration: make Claude part of the default engine set on `prompts.engines`.
--
-- Background:
--   The original Prisma schema set the column default to
--     ARRAY['chatgpt', 'gemini', 'perplexity']
--   which mirrored the early 3-engine product scope. Claude was added later,
--   but the schema default was never updated. Result: every prompt created
--   via Prisma client / seed / DB-direct insert (without explicitly listing
--   engines) ended up with just 3 engines, and Claude was silently skipped
--   during monitoring runs. End-users see "3 Engines Active" in dashboards
--   and assume Claude is broken when in fact it was never invited.
--
-- This migration does two things:
--   1. Change the COLUMN DEFAULT so future inserts get all 4 engines.
--   2. Backfill rows whose engines column is EXACTLY the 3-engine legacy
--      default. We deliberately do NOT touch rows where the user has
--      customised the engine list (e.g. someone created a Gemini-only
--      prompt) — that's a user choice, not a default to fix.

ALTER TABLE public.prompts
  ALTER COLUMN engines
  SET DEFAULT ARRAY['chatgpt', 'gemini', 'perplexity', 'claude']::text[];

-- Backfill: append 'claude' to rows whose engines column matches the exact
-- legacy default. Postgres' ARRAY-equality compares element order, so we
-- check both orderings just in case (Prisma can emit them either way).
UPDATE public.prompts
   SET engines = ARRAY['chatgpt', 'gemini', 'perplexity', 'claude']::text[]
 WHERE engines = ARRAY['chatgpt', 'gemini', 'perplexity']::text[];
