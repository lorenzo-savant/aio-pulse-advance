# AIO Pulse — Quick Troubleshooting Reference

## Common Errors & Fixes

### ❌ Error: `GET /api/scans 500 (Internal Server Error)`

| Step | Action |
|------|--------|
| 1 | Check Vercel env vars: https://vercel.com/dashboard → Settings → Environment Variables |
| 2 | Verify these exist: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| 3 | Redeploy: Deployments → Latest → Redeploy |
| 4 | Wait 2-3 minutes and refresh browser |

**Root Cause:** Missing Supabase credentials in production

---

### ❌ Error: `POST /api/prompts 500 (Internal Server Error)`

Same fix as above. Both endpoints require database access.

**Root Cause:** Missing Supabase credentials

---

### ⚠️ Warning: `Error with Permissions-Policy header: Unrecognized feature: 'browsing-topics'`

| Step | Action |
|------|--------|
| 1 | Update `next.config.ts` with proper headers (see provided file) |
| 2 | Commit: `git add next.config.ts && git commit -m "fix: permissions policy"` |
| 3 | Push: `git push origin main` |
| 4 | Wait for Vercel deployment |
| 5 | Clear cache and hard refresh: `Ctrl+Shift+R` |

**Root Cause:** Browser rejecting unrecognized Permissions-Policy features

---

### ⚠️ Warning: `[Vercel Web Analytics] Failed to load script`

| Step | Action |
|------|--------|
| 1 | Go to Vercel Project Settings |
| 2 | Enable Web Analytics (if you want it) |
| 3 | Or remove the analytics integration if you don't need it |

**Root Cause:** Analytics script blocked by browser/extension or not enabled in Vercel

---

### ❌ Error: `SUPABASE_SERVICE_KEY not set - database features disabled`

| Step | Action |
|------|--------|
| 1 | Check that `SUPABASE_SERVICE_KEY` is in Vercel environment variables |
| 2 | It should NOT be in your `.env.local` on your computer (keep it secret) |
| 3 | Go to Supabase Settings → API → Copy "service_role secret" |
| 4 | Add to Vercel (Settings → Environment Variables) |

**Root Cause:** Service key not configured in production

---

### 🔴 Error: `Supabase not configured - missing environment variables`

**This is an IMPROVEMENT**, not a bug! It means:
- Your app detected missing Supabase config
- It's returning 503 (Service Unavailable) instead of 500 (Internal Error)
- Add the env vars from Step 1 of Implementation Guide

---

## Quick Verification Commands

### Test if Supabase is Connected

```bash
# This should fail with 401 (auth required), not 500
curl https://aio-pulse.vercel.app/api/scans

# Expected: {"success":false,"message":"Missing or invalid authentication"}
# Bad: 500 error
```

### Check Vercel Logs

```bash
vercel logs aio-pulse
```

### Test Database Connection Locally

```bash
# Create .env.local with Supabase credentials
npm run dev

# Then test
curl http://localhost:3000/api/scans
```

---

## Environment Variables Checklist

```
NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc... (long string)
SUPABASE_SERVICE_KEY = eyJhbGc... (long string, KEEP SECRET)
```

**Location:** https://vercel.com/dashboard → Your Project → Settings → Environment Variables

**All three must be:**
- Present ✓
- Non-empty ✓
- Correct values ✓
- Deployed ✓

---

## Console Errors Priority

### 🔴 CRITICAL (Fix Now)
- `GET /api/scans 500`
- `POST /api/prompts 500`
- `SUPABASE_SERVICE_KEY not set`

**Action:** Add Supabase env vars to Vercel and redeploy

### 🟡 MEDIUM (Fix Soon)
- `Error with Permissions-Policy header`

**Action:** Update `next.config.ts` with proper headers

### 🟢 LOW (Optional)
- `[Vercel Web Analytics] Failed to load`
- `SES Removing unpermitted intrinsics`
- `[Violation] setTimeout handler took XXms`

**Action:** Can ignore or improve separately

---

## Deployment Verification Steps

After making changes:

1. **Commit & Push**
   ```bash
   git add .
   git commit -m "fix: add supabase env vars and improve error handling"
   git push origin main
   ```

2. **Wait for Deployment**
   - Go to https://vercel.com/dashboard
   - Check your project's Deployments tab
   - Wait for "Ready" status

3. **Test Production**
   - Go to https://aio-pulse.vercel.app
   - Open DevTools (F12)
   - Go to Console tab
   - Refresh page (Ctrl+R)
   - Check for critical errors

4. **Test API Endpoint**
   ```bash
   curl https://aio-pulse.vercel.app/api/scans
   # Should return 401 (auth required), not 500
   ```

---

## When Stuck

1. **Clear Everything**
   ```bash
   # Browser cache
   Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
   
   # Hard refresh
   Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   ```

2. **Check Recent Changes**
   ```bash
   git log --oneline -5
   git diff HEAD~1
   ```

3. **View Vercel Logs**
   ```bash
   vercel logs aio-pulse --follow
   ```

4. **Verify Supabase Status**
   - Go to https://status.supabase.com
   - Check if your region is up

---

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/supabase.ts` | DB client config | ⚠️ Needs improvement (optional) |
| `next.config.ts` | App config & headers | ⚠️ Needs Permissions-Policy |
| `.env.local` | Local dev secrets | ✓ Use for testing |
| Vercel Env Vars | Production secrets | ❌ Missing (FIX NOW) |

---

**Last Updated:** March 12, 2026  
**Status:** 🔴 Critical issues identified | 🟡 Fixable with env vars | ✅ Verification ready
