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
| `SUPABASE_PROJECT_ID`           | -              | -           | ✓ (for type regen)    |
| `NEXT_PUBLIC_APP_URL`           | Production URL | Preview URL | http://localhost:3000 |
| `SENTRY_DSN`                    | ✓              | -           | -                     |
| `SENTRY_ORG`                    | ✓              | -           | -                     |
| `SENTRY_PROJECT`                | ✓              | -           | -                     |
| `LOG_LEVEL`                     | `info`         | `info`      | `debug` (optional)    |

### Optional Variables

These enable opt-in search enhancements. **None are required**: without them every
feature degrades gracefully to the previous behavior (no crash, no data loss).

| Variable              | Used by                                        | Purpose                                                        |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `JINA_API_KEY`        | `src/lib/services/reranker.ts` (primary)       | Reranking delle citazioni in `citation-grounding.ts` (Jina Reranker v3) |
| `COHERE_API_KEY`      | `src/lib/services/reranker.ts` (fallback)      | Reranking fallback (Cohere `rerank-multilingual-v3.0`)         |
| `MEILISEARCH_HOST`    | `src/lib/services/search-index.ts`             | Host del server Meilisearch per la ricerca interna di brand/prompts (serve anche la chiave) |
| `MEILISEARCH_API_KEY` | `src/lib/services/search-index.ts`             | Chiave API Meilisearch; senza host non ha effetto               |

Note:

- **Reranker**: attivo solo se `JINA_API_KEY` **o** `COHERE_API_KEY` è configurata. Disattivato → le citazioni restano nell'ordine originale.
- **Meilisearch**: richiede `MEILISEARCH_HOST` **e** `MEILISEARCH_API_KEY`. L'indice (`uid = "search"`) deve essere popolato con documenti `{ id, type: "brand"|"prompt", name, brand_id }` e `filterableAttributes: ["brand_id"]`; finché l'indice è vuoto `/api/search` degrada all'ILIKE attuale.

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

## Supabase Type Regeneration (T02 — Fase 0)

`src/types/database.ts` is generated from the live Supabase schema. **Regenerate every time the database schema changes** (new table, column, enum). Drift between schema and types causes silent type bypass and creates the same class of bugs CODE_REVIEW.md flagged in March 2026.

### When to regenerate

- After any `prisma migrate dev` or manual SQL migration applied to Supabase
- After pulling main with migration files you don't have locally
- Anytime `npm run type-check` complains about missing columns/tables that exist in DB

### How to regenerate

```bash
# One-time setup: install Supabase CLI (already in devDeps)
npm install

# Set project ref in .env.local (one-time):
echo 'SUPABASE_PROJECT_ID=<your_ref>' >> .env.local
# Project ref = last segment of NEXT_PUBLIC_SUPABASE_URL
# e.g. "https://abcd1234.supabase.co" → ref is "abcd1234"

# Then on every schema change:
npm run db:gen-types

# Verify:
npm run type-check
```

The generated file is **committed to git** (it IS code — the type contract with the database). PR that adds a migration must include the regenerated `database.ts` in the same commit.

### Sentry + Logger Configuration (T04 — Fase 0)

Production Sentry observability requires three environment variables:

- `SENTRY_DSN` — get from https://sentry.io/settings/[org]/projects/[project]/keys/
- `SENTRY_ORG` — your Sentry org slug
- `SENTRY_PROJECT` — your Sentry project slug

The structured logger (`src/lib/logger.ts`) auto-masks PII in production. Log level defaults to `info` in production, `debug` in development. Override with `LOG_LEVEL` env var.

**Never log raw**: `email`, `password`, `apiKey`, `token`, `authorization` headers, `creditCard`. The logger redacts these automatically — but only if you pass them as named fields, not interpolated into the message string.

✅ Good: `logger.info('user login', { email: user.email })` → `{ email: '[REDACTED]' }`
❌ Bad: `logger.info(\`user login: ${user.email}\`)` → email logged in plaintext
