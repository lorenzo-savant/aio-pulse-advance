# Drill Log — AIO Pulse Production

> Every quarter, run one disaster drill end-to-end. Document what
> happened here. Update the relevant runbook with anything that didn't
> go to script.

## Schedule

- Q1 (Jan-Mar) — Backup restore drill ([BACKUP_RESTORE.md](./BACKUP_RESTORE.md))
- Q2 (Apr-Jun) — Secret rotation drill ([SECRETS_ROTATION.md](./SECRETS_ROTATION.md))
- Q3 (Jul-Sep) — Region failover drill ([DR_PLAN.md](./DR_PLAN.md))
- Q4 (Oct-Dec) — Incident response drill ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md))

## Drill template

Copy this block at the top of the log for each drill.

```markdown
## YYYY-Qn — <Drill type>

**Date:** YYYY-MM-DD
**Duration:** Xh Ym (start → end)
**Participants:** <names>
**Runbook tested:** <path/to/runbook.md>

### What we did

<3-5 bullets describing the scenario and the steps>

### What worked

<What the runbook got right>

### What broke (gaps in the runbook)

<Where the runbook was vague, outdated, or just wrong>

### Action items

- [ ] <fix> — owner: <name>, by: <date>

### Runbook updates committed

- Commit: <SHA> — <one-line summary>
```

---

## Drill history

### 2026-Qn — <pending>

(no drills run yet — first one scheduled for Q1 2027)
