# Environment-Specific Deployments

## Vercel Environments

This project supports multiple environments:

- **Production**: `main` branch → Production URL
- **Preview**: All PRs → Preview URLs
- **Development**: Local development

## Environment Variables

### Required Variables

| Variable                        | Production     | Preview     | Development           |
| ------------------------------- | -------------- | ----------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✓              | ✓           | ✓                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓              | ✓           | ✓                     |
| `SUPABASE_SERVICE_KEY`          | ✓              | ✓           | ✓                     |
| `NEXT_PUBLIC_APP_URL`           | Production URL | Preview URL | http://localhost:3000 |
| `SENTRY_DSN`                    | ✓              | -           | -                     |
| `SENTRY_ORG`                    | ✓              | -           | -                     |
| `SENTRY_PROJECT`                | ✓              | -           | -                     |

### How to Set Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable with appropriate scope:
   - `Production` - Only production
   - `Preview` - Only preview deployments
   - `Development` - Local development
   - `All Environments` - All

### Using .env files

```bash
# .env.local - Local development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# .env.production - Production (do not commit)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_KEY=your-prod-service-key
NEXT_PUBLIC_APP_URL=https://aio-pulse.com
```

## Branch-Based Deployments

- `main` branch → Auto-deploys to production
- `develop` branch → Can be set to staging environment
- PRs → Auto-deploy to preview URLs

## Health Check Endpoint

A `/health` endpoint is available for monitoring:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "environment": "production"
}
```
