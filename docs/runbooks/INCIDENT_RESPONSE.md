# Incident Response — AIO Pulse

> Production is broken. This document gets you from "alert fires" to
> "incident resolved + post-mortem written" without thinking. Don't deviate
> on Sev 1. **Communication first, then mitigation, then root cause.**

## Decision tree (Sev 1)

```
Alert fires
   ↓
ACKNOWLEDGE in monitoring tool (BetterStack / Sentry)  ← within 5 min
   ↓
Open #incident-aio-pulse Slack channel  ← creates audit trail
   ↓
Post status-page incident: "Investigating"  ← within 5 min
   ↓
Triage: is the cause obvious?
   ├─ Yes → Mitigate (rollback, kill switch, scale up)
   └─ No  → Investigate via dashboards (see "Triage playbook" below)
   ↓
Apply mitigation
   ↓
Verify service restored via /api/health + customer spot-check
   ↓
Update status page: "Identified" → "Monitoring" → "Resolved"
   ↓
Schedule post-mortem within 48 h (template at bottom)
```

## Triage playbook — common symptoms

### "Everything is down" (502/503 across the board)

1. Check Vercel status: https://www.vercel-status.com
2. Check Supabase status: https://status.supabase.com
3. `/api/health` → which service is unhealthy?
4. Sentry → recent error spike?
5. If Vercel deployment in last 2 h → consider rollback (see below)

### "Slow but not down"

1. Sentry Performance → which transaction regressed?
2. Vercel Analytics → traffic spike?
3. `/api/health` → `database.latencyMs` > 1000? → Supabase connection
   pool exhaustion (see "Mitigations" below)

### "Specific feature broken"

1. Sentry → filter by transaction name → look for new errors
2. Check the last deploy → was that feature touched? → rollback or
   forward-fix

### "AI engine returns empty/wrong"

1. Check provider status pages (OpenAI, Anthropic, Google, Perplexity)
2. `/api/health` → `ai_providers.configured`
3. `/api/api-costs` → has rate limit / quota been hit?
4. Switch to alternative engine in `src/lib/services/monitoring.ts`
   `ENGINE_PRIORITY` and ship as hotfix

### "Stripe webhooks failing"

1. Stripe Dashboard → Developers → Webhooks → check signing secret matches
   `STRIPE_WEBHOOK_SECRET`
2. Recent secret rotation? → see [SECRETS_ROTATION.md](./SECRETS_ROTATION.md)
3. Vercel logs → `/api/billing/webhook` → 4xx/5xx pattern

## Mitigations (quick wins)

### Vercel rollback

```bash
# Find the previous good deployment
vercel ls aio-pulse-advance --prod

# Promote it
vercel promote <DEPLOYMENT_URL> --scope=<team>
```

Rollback completes in ~30 seconds. Always rollback before deep debug on
Sev 1.

### Supabase connection pool exhaustion

Symptom: `database.latencyMs > 5000` and "remaining connection slots are
reserved for non-replication superuser connections" in logs.

1. Supabase Dashboard → Project Settings → Database → Connection Pooling
2. Confirm pool mode = `transaction`
3. If still saturated: scale up pool size (Pro+ allows up to 200 connections)
4. Forward fix: audit long-running queries via `pg_stat_activity`

### Kill switch — disable a runaway cron

```bash
# Vercel dashboard → Settings → Cron Jobs → toggle off
# Or: remove the cron from vercel.json and redeploy
```

### Rate limit (one customer hammering)

```bash
# Get the offending IP from Vercel logs
# In Upstash console: SET aio-pulse:rl:<IP> 999999 EX 86400
# Or block via Vercel Firewall (Pro+)
```

## Post-mortem template

File as `docs/post-mortems/YYYY-MM-DD-<short-name>.md`:

```markdown
# Incident: <Title>

**Date:** 2026-XX-XX
**Duration:** XX min
**Severity:** Sev N
**Customer impact:** <users affected, revenue lost, complaints filed>

## Timeline (all times UTC)

- XX:XX — Alert fired (<source>)
- XX:XX — Engineer acknowledged
- XX:XX — Cause identified
- XX:XX — Mitigation applied
- XX:XX — Service restored
- XX:XX — Status page resolved

## Root cause

<Why did this happen — 2-3 paragraphs, no blame>

## What worked

<What in our incident response went right>

## What didn't

<What slowed us down or made the impact worse>

## Action items

- [ ] <Bug fix> — owner: <name>, by: <date>
- [ ] <Process improvement> — owner: <name>, by: <date>
- [ ] <Tooling improvement> — owner: <name>, by: <date>
- [ ] <Runbook update> — owner: <name>, by: <date>
```

Post-mortems are **blameless**. The goal is to make the system more
resilient, never to find the person who "caused" it.
