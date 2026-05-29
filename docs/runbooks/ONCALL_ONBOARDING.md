# On-Call Onboarding — AEO Pulse

> First day on-call? Spend 1 hour going through this. It will save you
> 5 hours during your first incident.

## Access checklist

Before you start a rotation, verify you have:

- [ ] GitHub access to `Looziolooz/aio-pulse-advance` (read + push to non-main)
- [ ] Vercel team membership (deployments + env vars read)
- [ ] Supabase project access (read-only is enough for triage)
- [ ] Stripe Dashboard read access (Developers section in particular)
- [ ] Sentry org membership (project: aio-pulse)
- [ ] Upstash console access
- [ ] BetterStack alert notification routes you to your phone
- [ ] 1Password / Bitwarden vault shared with you
- [ ] You can post to `#incident-aio-pulse` Slack channel

If any box is unchecked, **fix it before going on-call**, not during an incident.

## Dashboards to bookmark

| What                               | URL                                             |
| ---------------------------------- | ----------------------------------------------- |
| Vercel deployments                 | https://vercel.com/<team>/aio-pulse-advance      |
| Vercel logs (live)                 | https://vercel.com/<team>/aio-pulse-advance/logs |
| Vercel status                      | https://www.vercel-status.com                   |
| Supabase project                   | https://supabase.com/dashboard/project/<ref>     |
| Supabase status                    | https://status.supabase.com                     |
| Sentry — aio-pulse Issues          | https://sentry.io/organizations/<org>/issues/?project=<id> |
| Sentry — Performance               | https://sentry.io/organizations/<org>/performance/         |
| Stripe Dashboard                   | https://dashboard.stripe.com                    |
| Upstash console                    | https://console.upstash.com                     |
| BetterStack (uptime + alerts)      | https://uptime.betterstack.com/team/<team>      |
| Internal `/api/health`             | https://aio-pulse.com/api/health (or /health)   |
| Status page (public)               | https://status.aio-pulse.com                    |

## First-hour drill (do this once)

1. Open `/api/health` in browser — read the JSON, understand each
   service probe.
2. Open Sentry — read the last 10 issues. Get a feel for what's normal noise.
3. Open Vercel logs — tail for 5 minutes during business hours.
4. Read [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) and
   [SLA_TARGETS.md](./SLA_TARGETS.md) end-to-end.
5. Run a Vercel rollback (in dev / preview environment, not prod).
6. Open Supabase Dashboard → Database → Backups. Find the latest
   automatic backup. Don't restore — just locate it.

## When to wake someone up

| What you see                                    | Page primary | Page backup |
| ----------------------------------------------- | ------------ | ----------- |
| `/api/health` returns 503 for > 5 min            | Yes          | If no ack in 15 min |
| Sentry error rate > 10x baseline for > 5 min    | Yes          | If no ack in 15 min |
| Stripe webhook failure rate > 50% for > 30 min  | Yes          | No          |
| Single feature broken, no revenue impact        | No (Slack)   | No          |
| Cosmetic bug, customer complaint via support    | No (Linear)  | No          |
| You're not sure                                 | Yes — better to false-alarm than miss | — |

## Status page protocol

The status page (https://status.aio-pulse.com) is the public communication
channel. Use it.

| Stage         | What you post                                         |
| ------------- | ----------------------------------------------------- |
| Investigating | "We're investigating elevated error rates on X" (within 5 min of incident) |
| Identified    | "We've identified the cause and are working on a fix" |
| Monitoring    | "A fix has been deployed. We're monitoring."          |
| Resolved      | Brief explanation + apology if user-facing.           |

Don't speculate. Don't promise fix times. Don't blame providers by name
unless their public status page has confirmed an incident.

## Handoff between on-call rotations

End of your rotation: post a 3-line summary to `#incident-aio-pulse`:

```
On-call handoff (week of 2026-XX-XX)
- Incidents this week: N (links to post-mortems if any)
- Open issues to watch: ...
- Anything weird that didn't fire an alert: ...
```

Beginning of new rotation: read the previous handoff.
