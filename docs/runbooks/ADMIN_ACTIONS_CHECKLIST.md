# Admin Actions Checklist — go-live readiness

> Code changes alone can't make AIO Pulse production-ready. These five
> tasks need a human (you) to click around in vendor dashboards.
> Estimated total time: 90 minutes. Estimated cost: $25/month
> (Supabase Pro) — everything else is free tier.

Tick each box and add the date when done. Re-tick on quarterly review.

## 🚨 Priority 1 — bloccanti per "produzione vera"

### 1. Enable MFA / 2FA on Supabase
- [ ] Done on YYYY-MM-DD

**Why:** the Supabase project dashboard controls the database that owns
all customer data. Anyone with the project owner's password owns
everything.

**How:**
1. Supabase Dashboard → click your avatar (top right) → Account Settings → Security
2. Set up TOTP (Google Authenticator / 1Password / Authy)
3. Save backup codes to 1Password
4. Bonus: do the same for **every team member** with admin access

### 2. External uptime monitor on `/api/health`
- [ ] Done on YYYY-MM-DD

**Why:** internal health checks can't measure their own downtime. If
Vercel goes down, your alerts go with it.

**How (BetterStack free tier, ~10 min):**
1. Sign up at https://betterstack.com/uptime (free for 10 monitors)
2. Create monitor:
   - URL: `https://aio-pulse.com/api/health`
   - Method: GET
   - Check interval: 60s
   - Request timeout: 10s
   - Expected status: `200-299`
   - Expected body contains: `"status":"healthy"` OR `"status":"degraded"`
3. Set up incident notification → your email + phone (SMS free for 1 monitor)
4. Optional: add monitor for `https://aio-pulse.com/` (homepage HTTP)
5. Test by temporarily setting `STRIPE_SECRET_KEY=` (empty) in Vercel preview —
   `/api/health` should return `degraded` → BetterStack should NOT alert
   (degraded is acceptable). Then break the DB and confirm it DOES alert.

### 3. Status page public URL
- [ ] Done on YYYY-MM-DD

**Why:** the footer links to "Status" but the URL is `#`. Without a real
status page, every incident becomes a tidal wave of support tickets
asking "is it down?".

**How (BetterStack Status, included in free tier):**
1. BetterStack → Status Pages → "Create Status Page"
2. Subdomain: `status.aio-pulse.com`
3. Add your monitors from step 2 above to the page
4. DNS: add CNAME `status` → `status.betterstack.com`
5. Update footer link in [HomeContent.tsx](src/app/HomeContent.tsx) when ready

### 4. Customer-facing emails route somewhere
- [ ] `support@aio-pulse.com` configured
- [ ] `security@aio-pulse.com` configured
- [ ] `dpo@aio-pulse.com` configured
- [ ] `legal@aio-pulse.com` configured

**Why:** Trust Center pages publish these addresses. If they bounce or
sit in a dead inbox, you fail compliance audits.

**How (Google Workspace / Zoho Mail):**
1. Create group aliases that forward to your real address (no extra cost
   on most plans)
2. Set up auto-responders saying "we'll reply within 24/72 hours"
3. Add them to your inbox app and actually check them

## ⚠️ Priorità 2 — entro 30 giorni post-go-live

### 5. Upgrade Supabase to Pro tier
- [ ] Done on YYYY-MM-DD

**Why:** Pro tier unlocks **Point-in-Time Recovery** (2-min RPO instead
of 24 h), **30 days backup retention** instead of 7 d, larger connection
pool (200 vs 60). Without it, the SLA tiers in
[SLA_TARGETS.md](./SLA_TARGETS.md) for Business/Agency are not deliverable.

**Cost:** $25/month base + small usage fees.

**How:** Supabase Dashboard → Project Settings → Billing → Upgrade.

### 6. Vercel Log Drain → long-term log retention
- [ ] Done on YYYY-MM-DD

**Why:** Vercel keeps logs for 24 h on free tier, 3-7 d on Pro. For
incident forensics and compliance you need 30-90 d.

**How (BetterStack Logs OR Axiom — free tiers generous):**
- **BetterStack Logs**: 30 d retention, 1 GB/month free. Recommended if
  you already signed up for BetterStack in step 2.
- **Axiom**: 30 d retention, 500 GB/month free (highest free tier).

1. Sign up + create a log source
2. Vercel Dashboard → Settings → Log Drains → Add Drain
3. Paste the destination URL from BetterStack/Axiom
4. Filter: `level=error OR level=warn` (or send everything if quota allows)
5. Save + verify events show up in BetterStack within 5 min

### 7. Configure scoped Supabase service keys (optional, hardening)
- [ ] Done on YYYY-MM-DD

**Why:** The single `SUPABASE_SERVICE_KEY` has full DB access. If a
single API route leaks it, attacker reads/writes anything.

**How:** Supabase doesn't (yet) support per-route scoped service keys.
Workaround: implement a thin "admin-DB-gateway" Edge function with hard-
coded allowed operations, give that function the service key, and call
it from your routes instead of giving every route the raw key. Defer
unless you're targeting SOC 2.

## 💡 Priorità 3 — nice-to-have

### 8. Run an `npm run check:all` baseline
- [ ] Run on YYYY-MM-DD, results saved in `docs/audits/`

**Why:** the new audit scripts (zod coverage, RLS coverage, npm audit)
give you a baseline number. Aim to move it up every sprint.

```bash
npm run check:all > docs/audits/baseline-$(date +%Y-%m-%d).log
```

### 9. Quarterly drill — schedule the first one
- [ ] Q1 drill (backup restore) scheduled for YYYY-MM-DD

**Why:** see [DRILL_LOG.md](./DRILL_LOG.md). A backup not tested is
not a backup.

### 10. Add a load test to CI (informational)
- [ ] Done on YYYY-MM-DD

**Why:** you don't know what concurrent user count Supabase free tier
holds before pool exhaustion. A 5-min k6 test once a week catches
regressions before customers do.

**How:** `k6 run scripts/load-test.js` against staging. Smoke target:
50 RPS for 5 min, no 5xx.

---

## Final pre-launch checklist

- [ ] All Priority 1 done
- [ ] `npm run check:all` returns no fatal errors
- [ ] Backup restore drill completed at least once (you trust the
      runbook because you tested it)
- [ ] On-call rotation set up (or "founder is always on-call" documented
      explicitly in [CONTACTS.md](./CONTACTS.md))
- [ ] [SLA_TARGETS.md](./SLA_TARGETS.md) numbers feel achievable given
      your team size

When all boxes are ticked you can sign a Business-tier SLA with a
straight face.
