# AIO Pulse — Bug Analysis & Fix Guide

## Executive Summary

Your AIO Pulse application has **critical 500 errors** on two main API endpoints (`/api/scans` and `/api/prompts`). The root cause is **missing Supabase configuration** in your Vercel deployment.

### Key Issues Found

1. **500 Error on GET `/api/scans`** — Database initialization failure
2. **500 Error on POST `/api/prompts`** — Database initialization failure
3. **Permissions-Policy header warnings** — Unrecognized browser features
4. **Vercel Web Analytics failure** — Analytics script blocked (non-critical)
5. **SES Intrinsics removal** — Likely from browser security sandbox (non-critical)

---

## Root Cause Analysis

### Primary Issue: Missing Environment Variables

The `createServerClient()` function in `/src/lib/supabase.ts` (line 27-35) returns `null` when `SUPABASE_SERVICE_KEY` is not set:

```typescript
export function createServerClient(): ReturnType<typeof createClient> | null {
  if (!supabaseServiceKey || !supabaseUrl) {
    console.warn('⚠️ SUPABASE_SERVICE_KEY not set - database features disabled')
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey, { ... })
}
```

**In your API routes**, when the database is not configured, the code returns a 503 status:

```typescript
const db = createServerClient()
if (!db) return err('Database not configured', 503)
```

However, **the error logs show 500 errors, not 503**, which suggests the error is happening *before* this check — likely in the `getCurrentUserId()` function during authentication.

### Secondary Issue: Authentication Failure

The `getCurrentUserId()` function (line 50-101) throws an `AuthError` when:
1. Supabase URL or anon key is missing
2. The Bearer token is invalid
3. No valid authentication method is available

If this throws and isn't caught properly in an edge case, it could bubble up as a 500 error.

---

## Detailed Error Breakdown

### Error 1 & 2: API 500 Errors

```
GET https://aio-pulse.vercel.app/api/scans 500 (Internal Server Error)
POST https://aio-pulse.vercel.app/api/prompts 500 (Internal Server Error)
```

**Why it happens:**
- Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) are not set in Vercel
- When the app tries to initialize the database client, it fails
- The API routes crash before returning a proper error response

**Impact:** Dashboard cannot load scan history or manage prompts.

### Error 3: Permissions-Policy Warnings

```
Error with Permissions-Policy header: Unrecognized feature: 'browsing-topics'
Error with Permissions-Policy header: Origin trial controlled feature: 'join-ad-interest-group'
Error with Permissions-Policy header: Unrecognized feature: 'private-state-token-issuance'
...
```

**Why it happens:**
- These are browser-level warnings about Permissions-Policy HTTP headers
- They indicate your app (or a dependency) is trying to set policies for experimental browser features
- Modern browsers are stricter about unrecognized features

**Impact:** Non-critical — just console noise. No functional impact.

### Error 4: Vercel Web Analytics

```
GET https://aio-pulse.vercel.app/_vercel/insights/script.js net::ERR_BLOCKED_BY_CLIENT
[Vercel Web Analytics] Failed to load script from /_vercel/insights/script.js
```

**Why it happens:**
- User's browser (or extension) is blocking the analytics script
- Vercel Web Analytics not enabled in your Vercel project settings

**Impact:** Non-critical — just analytics won't load.

### Error 5: SES Intrinsics Warning

```
lockdown-install.js:1 SES Removing unpermitted intrinsics
```

**Why it happens:**
- SES (Secure ECMAScript) is a JavaScript sandbox that removes certain built-in functions
- Some dependency is using this sandboxing (possibly for security)

**Impact:** Non-critical — JavaScript still works fine.

---

## Solutions & Fixes

### ✅ FIX #1: Add Supabase Environment Variables to Vercel (CRITICAL)

1. **Go to your Vercel project settings:**
   - https://vercel.com/dashboard/projects
   - Select your `aio-pulse` project
   - Go to Settings → Environment Variables

2. **Add these variables:**

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxx.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key from project settings |
   | `SUPABASE_SERVICE_KEY` | Your Supabase service role key (keep this secret!) |

3. **Get these values from Supabase:**
   - Log into https://supabase.com
   - Select your project
   - Go to Settings → API
   - Copy: Project URL, Anon Key, Service Role Key

4. **Redeploy:**
   - Go to Deployments in Vercel
   - Click "Redeploy" on your latest commit
   - Or just push a new commit to trigger auto-deploy

### ✅ FIX #2: Fix Permissions-Policy Header

The warnings come from overly permissive Permissions-Policy headers. Create a `vercel.json` with stricter headers:

**File: `/vercel.json`**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=(), payment=()"
        }
      ]
    }
  ]
}
```

Or add to your `next.config.ts`:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source": "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=(), payment=()"
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

### ✅ FIX #3: Verify Database Connection in Development

Test locally before pushing to production:

```bash
# Install dependencies
npm install

# Set up local .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
EOF

# Test the API
npm run dev

# In another terminal:
curl http://localhost:3000/api/scans \
  -H "Authorization: Bearer $(your_test_token_here)"
```

---

## Verification Checklist

After applying fixes, verify:

- [ ] Supabase credentials are set in Vercel environment variables
- [ ] All three env vars are present (URL, anon key, service key)
- [ ] Project is redeployed after adding env vars
- [ ] GET `/api/scans` returns 200 (not 500)
- [ ] POST `/api/prompts` returns 201 (not 500)
- [ ] Dashboard loads scan history without errors
- [ ] Permissions-Policy warnings are gone from console

---

## Additional Notes

### Why 500 Instead of 503?

The error logs show **500** instead of **503** because:
- The error likely happens in `getCurrentUserId()` before reaching the `createServerClient()` check
- The `getCurrentUserId()` function calls `supabase.auth.getUser()` which requires `supabase` to be initialized
- If Supabase isn't configured, `supabase` is `null` and calling methods on it crashes

**The fix:** When Supabase isn't configured, both `getCurrentUserId()` and `createServerClient()` should return early with proper error responses.

### Suggested Code Improvement

In `/src/lib/supabase.ts`, add a guard:

```typescript
export async function getCurrentUserId(
  authHeader?: string | null,
  cookieHeader?: string | null,
  request?: NextRequest | null,
): Promise<string> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase not configured - missing env vars')
    throw new AuthError('Supabase environment variables not set', 503)
  }
  // ... rest of function
}
```

This way, the error will properly bubble up as a 503 from the API routes.

---

## Next Steps

1. **Immediate:** Add Supabase env vars to Vercel
2. **Short-term:** Add Permissions-Policy header fix
3. **Optional:** Monitor Vercel Web Analytics setup
4. **Code Quality:** Consider the suggested error handling improvements

Your AIO Pulse should be fully operational after these fixes! 🚀
