# Secrets Rotation — AEO Pulse

> Rotate proactively, not reactively. Every rotation costs ~10 minutes
> when planned and a multi-hour incident when forced.

## Inventory — every production secret

Maintained as the source of truth. **If you add a secret, add a row here
in the same PR.**

| Secret                           | Where stored                       | Used by                          | Last rotated | Next rotation |
| -------------------------------- | ---------------------------------- | -------------------------------- | ------------ | ------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Vercel env / GitHub Actions secret | Browser + middleware             | YYYY-MM-DD   | N/A (public)  |
| `SUPABASE_SERVICE_KEY`           | Vercel env / GitHub Actions secret | API routes (admin DB ops)        | YYYY-MM-DD   | + 90 d        |
| `STRIPE_SECRET_KEY`              | Vercel env                         | API routes (billing)             | YYYY-MM-DD   | + 180 d       |
| `STRIPE_WEBHOOK_SECRET`          | Vercel env                         | `/api/billing/webhook`           | YYYY-MM-DD   | + 180 d       |
| `OPENAI_API_KEY`                 | Vercel env                         | Monitoring engine                | YYYY-MM-DD   | + 180 d       |
| `ANTHROPIC_API_KEY`              | Vercel env                         | Monitoring engine                | YYYY-MM-DD   | + 180 d       |
| `GEMINI_API_KEY`                 | Vercel env                         | Monitoring engine                | YYYY-MM-DD   | + 180 d       |
| `PERPLEXITY_API_KEY`             | Vercel env                         | Monitoring engine                | YYYY-MM-DD   | + 180 d       |
| `BRAVE_API_KEY`                  | Vercel env                         | SERP / KG enrichment             | YYYY-MM-DD   | + 180 d       |
| `DATAFORSEO_LOGIN` + `_PASSWORD` | Vercel env                         | Google AI Overview detection     | YYYY-MM-DD   | + 180 d       |
| `RESEND_API_KEY`                 | Vercel env                         | Transactional email              | YYYY-MM-DD   | + 365 d       |
| `UPSTASH_REDIS_REST_URL`         | Vercel env                         | Rate limit + cache               | YYYY-MM-DD   | N/A (URL)     |
| `UPSTASH_REDIS_REST_TOKEN`       | Vercel env                         | Rate limit + cache               | YYYY-MM-DD   | + 180 d       |
| `CRON_SECRET` (+ legacy `_TOKEN`) | Vercel env                       | `/api/cron/*` auth               | YYYY-MM-DD   | + 90 d        |
| `SENTRY_AUTH_TOKEN`              | Vercel env (build only)            | Source map upload                | YYYY-MM-DD   | + 365 d       |
| `GSC_CLIENT_ID` + `_SECRET`      | Vercel env                         | Google Search Console OAuth      | YYYY-MM-DD   | + 365 d       |

> Fill in dates the first time each secret is rotated. Until then, write
> `unknown` and rotate within 30 days.

## Routine rotation (no incident)

Cadence: every 90/180/365 days as per inventory above.

### Per-secret procedure (generic)

1. Generate the new value at the provider (Stripe Dashboard, Supabase Dashboard,
   OpenAI Console, etc.).
2. Add the new value to Vercel **as a NEW env var** with suffix `_NEW`:
   - e.g. `STRIPE_SECRET_KEY_NEW`
3. Optional but recommended: hot-deploy code to read either value:

   ```ts
   const key = process.env.STRIPE_SECRET_KEY_NEW || process.env.STRIPE_SECRET_KEY
   ```

4. Promote: rename `STRIPE_SECRET_KEY_NEW` → `STRIPE_SECRET_KEY` (Vercel
   has a "promote" UI), removing the old one.
5. Redeploy.
6. Verify `/api/health` returns `healthy` and run one smoke test per
   affected feature.
7. Revoke the OLD value at the provider.
8. Update the "Last rotated" column above in the **same PR** as removing
   the dual-read code (if added).

### Emergency rotation (suspected leak)

1. Stop the bleeding first — revoke the leaked value at the provider
   **before** generating a replacement. The window of compromise matters
   more than the user-facing downtime.
2. Generate the new value.
3. Push it directly to `STRIPE_SECRET_KEY` (no `_NEW` dual-read — there's
   no graceful transition during an emergency).
4. Redeploy.
5. Run a post-mortem within 24 h — leaked secrets are always preventable.

## Per-provider specifics

### Supabase service key

The service key bypasses RLS. **Anything that has it owns the database.**
Treat as the most sensitive secret.

```bash
# Supabase Dashboard → Project Settings → API → "Reveal" → copy
# Old key is auto-revoked when you rotate via UI.
```

After rotation: every cron job and every API route that uses
`createServerClient()` will pick up the new value on next cold start.
Warm Vercel functions may take 5 min to roll over.

### Stripe webhook secret

This one is tricky because Stripe will continue sending events signed
with the OLD secret until you remove that secret from the webhook
endpoint config.

```
# Stripe Dashboard → Developers → Webhooks → <endpoint>
#   → Click "Reveal" → Roll secret
#   → Copy new secret BEFORE confirming the roll (it's shown once)
#   → Deploy new STRIPE_WEBHOOK_SECRET to Vercel
#   → Confirm the roll (this revokes the old secret)
```

If you confirm the roll before deploying the new secret to Vercel,
expect 5-15 min of webhook 400s. Stripe will auto-retry, so no data is
lost, but billing UX will lag.

### CRON_SECRET / CRON_SECRET_TOKEN

Generate with `openssl rand -base64 32`. Vercel automatically injects
`Authorization: Bearer <CRON_SECRET>` into cron invocations **only when the
env var is named exactly `CRON_SECRET`** — the literal name is what triggers
the auto-injection. `verifyCronAuth` (`src/lib/cron-auth.ts`) accepts EITHER
`CRON_SECRET` or the legacy `CRON_SECRET_TOKEN`.

To rotate, the simplest correct path is to set **`CRON_SECRET`** in Vercel and
leave it as the single source of truth — no second var to keep in sync. If you
must keep `CRON_SECRET_TOKEN` (e.g. external schedulers that call
`/api/cron/*` directly with that value), then **both vars must hold the same
value**: Vercel still only auto-injects the one named `CRON_SECRET`, so
rotating `CRON_SECRET_TOKEN` alone will silently 401 every Vercel cron.

### GitHub Actions secrets

Rotate via GitHub UI → Settings → Secrets and variables → Actions →
"Update value". CI jobs pick up new values on next run; no redeploy
needed.

## Vault discipline

- All secrets live in Vercel env + 1Password / Bitwarden vault. Nowhere
  else. Specifically NOT in:
  - `.env.local` committed to git
  - Screenshots / Loom recordings
  - Slack DMs
- The `.env.example` file documents which secrets exist but never their
  values.
- Pre-commit hook prevents accidental commits of `.env*` (check
  `.gitignore`).
