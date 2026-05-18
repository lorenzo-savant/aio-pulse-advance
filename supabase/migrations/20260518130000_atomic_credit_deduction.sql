-- Atomic credit deduction + atomic free-tier daily counter.
-- Fixes H-4: the previous check-then-act read balance then inserted a
-- separate ledger row, allowing concurrent requests to double-spend.

-- ── Free-tier daily counter (atomic via INSERT ... ON CONFLICT) ──────────────
CREATE TABLE IF NOT EXISTS free_query_counters (
  user_id uuid NOT NULL,
  day     date NOT NULL DEFAULT current_date,
  used    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Returns the post-increment used count if the request is within the daily
-- free limit, or NULL if the limit is already reached. Atomic: the conditional
-- UPDATE on conflict makes concurrent calls serialize on the row lock.
CREATE OR REPLACE FUNCTION consume_free_query(p_user_id uuid, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_used integer;
BEGIN
  INSERT INTO free_query_counters (user_id, day, used)
  VALUES (p_user_id, current_date, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET used = free_query_counters.used + 1
  WHERE free_query_counters.used < p_limit
  RETURNING used INTO v_used;

  RETURN v_used; -- NULL when the conditional upsert affected no row
END;
$$;

-- ── Atomic paid-credit deduction ────────────────────────────────────────────
-- Serializes per user with a transaction-scoped advisory lock, recomputes the
-- ledger balance, and only inserts the debit row if the balance is sufficient.
-- Returns the new balance, or NULL if there were insufficient credits.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credits
  WHERE user_id = p_user_id;

  IF v_balance < p_amount THEN
    RETURN NULL;
  END IF;

  INSERT INTO credits (user_id, amount, source, description)
  VALUES (p_user_id, -p_amount, 'query_usage', p_description);

  RETURN v_balance - p_amount;
END;
$$;
