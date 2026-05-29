# Disaster Recovery Plan — AEO Pulse

> "Disaster" = a failure mode that single-component runbooks
> ([BACKUP_RESTORE.md](./BACKUP_RESTORE.md),
> [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)) don't cover.
> Examples: Vercel region outage, Supabase project deleted, key custodian
> hit by a bus, ransomware.

## Disaster scenarios — playbook by failure class

### 1. Vercel region (arn1 / Stockholm) outage

**Impact:** all production traffic returns 5xx. EU customers most affected.

**Detection:** BetterStack external probe fails on `/api/health`. Vercel
status page (https://www.vercel-status.com) confirms region incident.

**Response:**

1. Acknowledge in #incident-aio-pulse and on status page (Sev 1).
2. Wait — Vercel auto-recovers from region incidents in 90% of cases
   within 30 min.
3. If incident persists > 1 h, manually re-deploy to a different region:

   ```bash
   # Edit vercel.json — change regions: ["arn1"] → ["fra1"] (Frankfurt) or ["iad1"] (US east)
   git commit -am "ops: failover to fra1 for region outage"
   git push origin main   # triggers redeploy
   ```

4. Once Vercel arn1 is restored, revert the change and redeploy.

**RTO target:** 30 min (wait) to 2 h (manual failover). To get below this,
move to multi-region Vercel Enterprise.

### 2. Supabase project deleted / corrupted beyond restore

**Impact:** total data loss potential. This is the worst-case scenario.

**Detection:** Supabase Dashboard shows project missing or in `DESTROYED`
state. Read/write attempts return permission errors despite valid creds.

**Response:**

1. **Do not panic.** Backups are off-project — they survive even if the
   project is deleted (Supabase keeps backups for 7 d after deletion).
2. Open a Supabase support ticket immediately. Pro plan = 1-business-day
   response; for true emergencies escalate via security@supabase.com.
3. While waiting, create a NEW Supabase project in the same region.
4. From git, run all migrations on the new project:

   ```bash
   supabase link --project-ref <NEW_PROJECT_REF>
   supabase db push   # applies every migration in supabase/migrations/
   ```

5. Once Supabase support restores the data (or you load from your own
   pg_dump if you have one), follow [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
   to switch Vercel env vars.

**RTO target:** 24-48 h (Supabase support response is the bottleneck).

**Mitigation:** weekly off-project `pg_dump` to an S3 bucket reduces
recovery to RPO of 1 week + RTO of 4 h. Not yet implemented — open issue.

### 3. Stripe account compromised / locked

**Impact:** billing operations fail. No new subscriptions; existing ones
keep running on their last successful payment.

**Detection:** webhook delivery dashboard shows failures; users report
"payment declined".

**Response:**

1. Lock down the Stripe account (rotate API keys via Stripe Dashboard).
2. Apply new keys to Vercel env: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
3. Redeploy.
4. For affected users, manually credit accounts using the Stripe Dashboard
   credit-note feature. No retroactive automation needed.

### 4. Domain hijacked (DNS takeover)

**Impact:** customers see attacker's site at aio-pulse.com.

**Response:**

1. Lock the domain at the registrar (Cloudflare, Namecheap, etc.) —
   "registrar lock" + "transfer lock".
2. Reset registrar credentials. Enable 2FA if not already.
3. Verify DNS records match expected Vercel pointers:
   - `aio-pulse.com` → A 76.76.21.21 (Vercel)
   - `*.aio-pulse.com` → CNAME cname.vercel-dns.com
4. Email security@aio-pulse.com customers within 2 h (mass-mail compose).

### 5. Repo / GitHub access compromised

**Impact:** attacker can push malicious code, which Vercel auto-deploys.

**Response:**

1. Revoke all SSH keys + Personal Access Tokens on github.com/settings/keys
2. Force-rotate all GitHub Actions secrets:
   - `SUPABASE_DB_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
3. Audit recent commits on main + protected branches. Revert any unknown.
4. Pause Vercel auto-deploys until rotation complete.
5. See [SECRETS_ROTATION.md](./SECRETS_ROTATION.md).

### 6. Solo founder unavailable (bus factor 1)

**Impact:** nobody knows the system well enough to respond.

**Mitigation (pre-disaster, do now):**

1. A second engineer has read access to:
   - GitHub org (Looziolooz + lorenzo-savant)
   - Vercel team
   - Supabase project
   - Stripe account
   - Upstash
   - Sentry
2. 1Password / Bitwarden vault shared with second engineer.
3. This runbook directory is the single source of truth — keep it
   current.

## Cross-cutting principles

- **Always communicate first.** Status page > technical fix.
- **Restore first, root-cause later.** A 5-minute rollback beats a
  1-hour debug session that customers see.
- **Document while you fix.** Even a 3-line scratch note will save the
  next responder 30 minutes.
- **Drill quarterly.** A runbook that hasn't been tested doesn't exist.
