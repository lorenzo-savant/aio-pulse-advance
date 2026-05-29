# Contacts — AEO Pulse Production

> The single source of truth for "who do I call". Update before you go
> on vacation. Update when team membership changes. Update when a vendor
> changes account managers.

## On-call rotation

Currently: **<NAME>** (primary), **<NAME>** (backup).

Rotation schedule: weekly, swapping Mondays 09:00 UTC.

| Week of      | Primary | Backup |
| ------------ | ------- | ------ |
| 2026-MM-DD   | TBD     | TBD    |

Maintained in a Google Sheet for ease of editing:
`<URL>`

## Internal team

| Role                  | Name        | Slack         | Phone (emergencies) |
| --------------------- | ----------- | ------------- | ------------------- |
| Founder / DRI         | TBD         | @TBD          | TBD                 |
| Engineering lead      | TBD         | @TBD          | TBD                 |
| DPO (GDPR queries)    | TBD         | @TBD          | dpo@aio-pulse.com   |
| Security contact      | TBD         | @TBD          | security@aio-pulse.com |

## External vendors

### Supabase
- Account: <project-ref>
- Support tier: <Free / Pro / Team / Enterprise>
- Support email: support@supabase.com
- Emergency: security@supabase.com (Pro+ only)
- Status: https://status.supabase.com
- Account owner email: <YOUR_EMAIL>

### Vercel
- Team: <team-slug>
- Plan: <Hobby / Pro / Enterprise>
- Support: support.vercel.com
- Status: https://www.vercel-status.com
- Account owner email: <YOUR_EMAIL>

### Stripe
- Account ID: acct_<id>
- Support: support.stripe.com (chat 24/7 for live accounts)
- Account owner email: <YOUR_EMAIL>

### Upstash (Redis)
- Region: eu-west-1
- Support: support@upstash.com
- Status: https://status.upstash.com

### Sentry
- Org slug: <org-slug>
- Plan: <Developer / Team / Business>
- Account owner email: <YOUR_EMAIL>

### Resend (email)
- Team: <team>
- Support: support@resend.com

### BetterStack (uptime + logs)
- Team: <team>
- Status: https://status.betterstack.com

### Domain registrar
- Provider: <Cloudflare Registrar / Namecheap / etc.>
- Domain: aio-pulse.com
- Renewal date: YYYY-MM-DD
- 2FA: enabled (TOTP backup codes in 1Password)

## AI providers

| Provider     | Account email | Quota                    | Status URL                     |
| ------------ | ------------- | ------------------------ | ------------------------------ |
| OpenAI       | <YOUR_EMAIL>  | Tier <X>                 | https://status.openai.com      |
| Anthropic    | <YOUR_EMAIL>  | Tier <X>                 | https://status.anthropic.com   |
| Google AI    | <YOUR_EMAIL>  | <project>                | https://status.cloud.google.com |
| Perplexity   | <YOUR_EMAIL>  | Sonar API                | https://status.perplexity.ai   |

## Customer-facing emails

- `support@aio-pulse.com` — general questions, billing, account
- `security@aio-pulse.com` — vulnerability disclosure
- `dpo@aio-pulse.com` — GDPR rights requests
- `legal@aio-pulse.com` — DPA, contracts

These should be group aliases routing to multiple humans. If they're not,
fix that this week.
