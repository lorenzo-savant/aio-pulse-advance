-- Migration: add workflow_executions.prompt_id
--
-- BUG FIX: the workflow_executions table was created (BOOTSTRAP.sql +
-- 20260412000100_fix_schema_types.sql) WITHOUT a prompt_id column, but the
-- application inserts prompt_id on every monitoring run (src/app/api/monitoring/
-- route.ts) and in createWorkflow (src/app/api/workflows/route.ts). Every insert
-- therefore failed with "column prompt_id does not exist", so no rows were ever
-- written and the Workflows page stayed permanently empty. The Re-run action
-- (which requires prompt_id) was broken for the same reason.
--
-- Idempotent + nullable so it's safe to re-run and on existing rows.

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workflow_executions_prompt_id_idx ON workflow_executions(prompt_id);

COMMENT ON COLUMN workflow_executions.prompt_id IS 'Prompt this workflow ran against (for monitoring_run workflows); enables Re-run.';
