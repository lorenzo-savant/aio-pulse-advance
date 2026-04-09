# Rate Limiting Warning

## Problem: In-Memory Rate Limit on Vercel

The current rate limiting implementation in `src/lib/ratelimit.ts` uses an in-memory `Map()` for rate limiting when Redis is not configured.

### Impact

On Vercel (serverless deployment), each function instance has its own separate in-memory Map:

- Rate limits are NOT shared across instances
- A user can bypass rate limits by hitting different instances
- Under load, the rate limit is largely ineffective

### Current State

- Middleware: Global 100 req/min limit (per instance)
- API routes: Individual rate limits where implemented (IP-based or user-based)
- Redis: Not configured in environment (falls back to in-memory)

### Recommended Solution

Configure Upstash Redis for distributed rate limiting:

1. Create a free Upstash Redis account
2. Add to Vercel environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. The existing code in `src/lib/ratelimit.ts` will automatically use Redis when available

### Priority: MEDIUM

The middleware still provides some protection at 100 req/min globally, but sophisticated attackers can bypass it. For production, Redis-based rate limiting is recommended.
