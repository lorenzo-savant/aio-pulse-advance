# AEO Pulse — Operations Runbooks

This directory is the **single source of truth** for production operations.
If you are responding to an incident, restoring a backup, or rotating a
secret: every step you need is here, in plain language, with copy-pasteable
commands. Documents are versioned in git so changes are reviewed and
auditable.

## When to use what

| Situation                                       | Runbook                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Production is down or degraded right now        | [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)             |
| Database needs to be restored from a backup     | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)                   |
| Disaster scenario (region outage, data loss)    | [DR_PLAN.md](./DR_PLAN.md)                                 |
| A key/secret was leaked or rotated proactively  | [SECRETS_ROTATION.md](./SECRETS_ROTATION.md)               |
| Supabase security advisor finding (or accepted) | [SECURITY_ADVISORS.md](./SECURITY_ADVISORS.md)             |
| SLA / RPO / RTO question from a customer        | [SLA_TARGETS.md](./SLA_TARGETS.md)                         |
| Onboarding a new on-call engineer               | [ONCALL_ONBOARDING.md](./ONCALL_ONBOARDING.md)             |
| Pending admin tasks (MFA, monitor, status page) | [ADMIN_ACTIONS_CHECKLIST.md](./ADMIN_ACTIONS_CHECKLIST.md) |

## Contacts (single point of truth)

Maintained in [CONTACTS.md](./CONTACTS.md). Update before going on vacation.

## Quarterly drills

Every quarter, run **one** of these scenarios end-to-end and update the
relevant runbook with anything that didn't go as documented:

- Q1 — Backup restore drill (BACKUP_RESTORE.md)
- Q2 — Secret rotation drill (SECRETS_ROTATION.md)
- Q3 — Region failover drill (DR_PLAN.md)
- Q4 — Incident response drill (INCIDENT_RESPONSE.md)

Log each drill in [DRILL_LOG.md](./DRILL_LOG.md).
