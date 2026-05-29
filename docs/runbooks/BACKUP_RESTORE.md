# Backup & Restore — AEO Pulse

> Supabase is the only stateful store we own. **If this document is wrong
> when you need it, the company has a bad day.** Test it quarterly.

## What is backed up

| What                          | By whom    | Frequency    | Retention                                |
| ----------------------------- | ---------- | ------------ | ---------------------------------------- |
| Postgres (all `public.*`)     | Supabase   | Daily        | Free: 7 d. Pro: 7 d daily + PITR 7 d 2-min granularity |
| Storage buckets               | Supabase   | Daily        | Same as Postgres                         |
| Auth users                    | Supabase   | Daily        | Same as Postgres                         |
| Edge function code            | Git        | Per commit   | Indefinite                               |
| Env vars / secrets            | Vercel     | Manual export | Indefinite (see [SECRETS_ROTATION.md](./SECRETS_ROTATION.md)) |
| Migration SQL files           | Git        | Per commit   | Indefinite (`supabase/migrations/`)      |

## What is NOT backed up

- Vercel build artifacts (rebuilt from git in ~3 min — fine)
- Upstash Redis (cache + rate limit state — by design ephemeral)
- Sentry events (90 d retention on Sentry side — accept loss)
- Vercel logs (24 h free / 3-7 d paid — set up log drain for longer)

## Restore — full database wipe / corruption

**RTO target: see [SLA_TARGETS.md](./SLA_TARGETS.md). RPO: 24 h on Free,
2 min on Pro+ with PITR.**

### Pre-flight (do this BEFORE you need it)

1. Document your project ref: `<project-ref>` (Supabase Dashboard URL has it)
2. Document your DB password: stored in 1Password / secret manager
3. Confirm `supabase` CLI is installed locally: `supabase --version` (>= 1.150)
4. Confirm you have admin access to the Supabase project

### Step-by-step (Pro tier — PITR)

```bash
# 1. Open the Supabase Dashboard → Database → Backups
# 2. Click "Point in Time Recovery"
# 3. Choose the target timestamp (UTC) — usually just before the bad event
# 4. Confirm — Supabase clones to a NEW project (does NOT overwrite current)
# 5. Wait — clone takes 5-30 min depending on DB size

# 6. Once clone is up, get the new connection string from the new project
# 7. Verify data integrity with spot checks:
psql <NEW_CONNECTION_STRING> -c "SELECT COUNT(*) FROM brands"
psql <NEW_CONNECTION_STRING> -c "SELECT MAX(created_at) FROM monitoring_results"

# 8. If clone looks good, switch traffic:
#    a. In Vercel: update NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY env vars
#       to point to the new project
#    b. Trigger a fresh deploy (env var changes need a redeploy)
#    c. Update DNS if you've custom-mapped the Supabase URL (you probably haven't)

# 9. Verify production with `/api/health` and a real user login
# 10. Decommission the old project AFTER 7 days of clean runtime (just in case)
```

### Step-by-step (Free tier — daily backup only)

Same flow, but step 3 picks from the daily snapshots dropdown instead of
a PITR timestamp. RPO is bounded by the snapshot age (up to 24 hours).

### Sanity checks during restore

- Row counts on critical tables: `brands`, `prompts`, `monitoring_results`,
  `user_workspaces`, `organizations`, `subscriptions`
- A known user can log in
- `/api/health` returns `healthy`
- Stripe webhook signature still works (no env var changes? then yes)

## Restore — single table or row (logical)

If only one table is corrupted, full DB restore is overkill. Use logical
backup:

```bash
# Take a logical dump of the affected table from a PITR clone:
pg_dump <PITR_CLONE_URL> -t public.<table_name> --data-only > restore.sql

# Apply to production after manual review:
psql <PROD_URL> -c "TRUNCATE public.<table_name>"  # destructive — double-check!
psql <PROD_URL> < restore.sql
```

**Important:** RLS policies are applied during INSERT. Use `SET LOCAL
session_replication_role = replica` if you need to bypass policies during
restore (only as admin via the `postgres` role).

## Restore — soft-delete recovery

We use soft-delete (`deleted_at` column) on brands, prompts, workspaces.
If a user "deletes" something by mistake, no backup is needed:

```sql
UPDATE brands SET deleted_at = NULL WHERE id = '<uuid>' AND deleted_at > now() - interval '30 days';
```

## Drill checklist (run quarterly)

Document each drill in [DRILL_LOG.md](./DRILL_LOG.md):

- [ ] Initiated PITR clone successfully
- [ ] Clone reached "ready" status within RTO target
- [ ] Spot-check queries returned expected data
- [ ] Could switch Vercel env vars and redeploy
- [ ] `/api/health` returned healthy against the restored DB
- [ ] Cleanup: tore down the test clone (don't pay for two projects)
- [ ] Updated this runbook with anything that didn't go to script
