# SLA Targets — AIO Pulse

> These targets are the contract for what "production" means on AIO Pulse.
> Customers see commercial SLAs derived from these; engineering uses them
> as the threshold for alerts, escalation, and incident severity.

## Definitions

- **Uptime** — `/api/health` returns `status: healthy` or `degraded`. A
  `503 unhealthy` response counts as downtime.
- **RPO (Recovery Point Objective)** — maximum acceptable data loss
  measured in time, in the event of catastrophic failure.
- **RTO (Recovery Time Objective)** — maximum acceptable time to restore
  service after detection of an outage.

## Targets

| Tier             | Uptime SLA  | RPO     | RTO  | Notes                                                        |
| ---------------- | ----------- | ------- | ---- | ------------------------------------------------------------ |
| **Free**         | best effort | 24 h    | 24 h | No commercial SLA. Daily Supabase backup.                    |
| **Pro** ($49/mo) | 99.5%       | 2 min ✓ | 4 h  | **PITR active (Supabase Pro tier)**, on-call business hours. |
| **Business**     | 99.9%       | 2 min ✓ | 2 h  | Same backup tier, 24/7 on-call, dedicated alert routes.      |
| **Agency**       | 99.95%      | 2 min ✓ | 1 h  | Same backup tier + cross-region read replica (future).       |

> ✓ = Supabase Point-in-Time Recovery is active on the project as of
> May 2026 (Pro tier). RPO is bounded by the 2-minute WAL granularity,
> not by daily snapshots. RTO targets above reflect the team's realistic
> response time for a full restore (clone + verify + cut-over).

99.9% = no more than 43 minutes of downtime per month.
99.95% = no more than 22 minutes of downtime per month.

## Where each number comes from

- **Uptime measurement**: external probe (BetterStack/UptimeRobot) hitting
  `/api/health` every minute. Internal `/api/health` checks are
  informational only — they can't measure their own downtime.
- **RPO 2 min**: Supabase PITR allows restore to any point in the last
  7 days at 2-minute WAL granularity. Active on this project since the
  Pro-tier upgrade. The practical floor on RPO is detection time, not
  the backup granularity.
- **RTO 8 h / 2 h / 1 h**: realistic for our team size + Supabase restore
  procedure (see [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)). Faster RTO
  requires hot-standby — not yet implemented.

## Severity definitions (used by alerts + incident response)

| Sev | Examples                                                  | Page on-call?       | Target response |
| --- | --------------------------------------------------------- | ------------------- | --------------- |
| 1   | Full outage, data corruption, security breach             | Yes, 24/7           | 15 min          |
| 2   | Degraded service (one engine down, slow DB), revenue loss | Yes, business hours | 1 h             |
| 3   | Single feature broken, no revenue impact                  | No (ticket)         | 1 business day  |
| 4   | Cosmetic, minor bug                                       | No (backlog)        | Next sprint     |

## Customer communication thresholds

- Sev 1 — status page banner within 5 minutes, all-hands email within 30 minutes
- Sev 2 — status page incident within 15 minutes
- Sev 3 — no proactive comms unless customer asks
- Sev 4 — no comms

## Status page

Public status page: `https://status.aio-pulse.com` (set up in
[ONCALL_ONBOARDING.md](./ONCALL_ONBOARDING.md)).
