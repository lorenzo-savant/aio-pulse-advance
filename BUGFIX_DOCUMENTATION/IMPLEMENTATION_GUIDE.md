# AIO Pulse — Step-by-Step Implementation Guide

## Overview

This guide walks you through fixing the 500 API errors and console warnings in your AIO Pulse application. Follow these steps in order.

---

## STEP 1: Get Your Supabase Credentials (5 minutes)

### 1.1 Log into Supabase

1. Go to https://supabase.com
2. Log in with your account
3. Select your AIO Pulse project

### 1.2 Find Your Project URL

1. Click **Settings** (bottom left)
2. Click **API**
3. Copy the **Project URL** (looks like `https://xxx.supabase.co`)
4. **Save this** — you'll need it in Step 2

### 1.3 Find Your Anon Key

1. Still in Settings → API
2. Under "Project API keys", find **"anon public"** key
3. Copy the long string below it
4. **Save this** — you'll need it in Step 2

### 1.4 Find Your Service Role Key

⚠️ **IMPORTANT:** This key is sensitive. Never commit it to Git or share it publicly.

1. Still in Settings → API
2. Under "Project API keys", find **"service_role secret"** key
3. Copy the long string below it
4. **Save this** — you'll need it in Step 2

---

## STEP 2: Add Environment Variables to Vercel (5 minutes)

### 2.1 Go to Vercel Project Settings

1. Go to https://vercel.com/dashboard
2. Click on your **aio-pulse** project
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)

### 2.2 Add Environment Variables

Click **Add New** and fill in each variable:

#### Variable 1: Supabase URL
```
Name:  NEXT_PUBLIC_SUPABASE_URL
Value: (paste your Project URL from Step 1.2)
```
- Select: **Production** checkbox
- Click **Add**

#### Variable 2: Supabase Anon Key
```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: (paste your Anon Key from Step 1.3)
```
- Select: **Production** checkbox
- Click **Add**

#### Variable 3: Supabase Service Key
```
Name:  SUPABASE_SERVICE_KEY
Value: (paste your Service Role Key from Step 1.4)
```
- Select: **Production** checkbox
- **Important:** Do NOT check any preview/development boxes—this is secret!
- Click **Add**

### 2.3 Verify All Variables Are Added

You should see three new variables in the list:
- ✓ `NEXT_PUBLIC_SUPABASE_URL`
- ✓ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✓ `SUPABASE_SERVICE_KEY`

---

## STEP 3: Test Locally (Optional but Recommended) (10 minutes)

### 3.1 Clone or Update Your Local Repository

```bash
cd ~/path/to/aio-pulse
git pull origin main
```

### 3.2 Create Local Environment File

Create a `.env.local` file in the project root:

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=paste_your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key_here
SUPABASE_SERVICE_KEY=paste_your_service_key_here
EOF
```

Replace the values with the credentials from Step 1.

### 3.3 Install Dependencies

```bash
npm install
```

### 3.4 Start Dev Server

```bash
npm run dev
```

The app should start at `http://localhost:3000`

### 3.5 Test the Scans API

In another terminal:

```bash
curl -X GET http://localhost:3000/api/scans \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": false,
  "message": "Missing or invalid authentication"
}
```

This is correct! It means the API is running, just needs a valid auth token.

---

## STEP 4: Apply Code Improvements (Optional) (5 minutes)

### 4.1 Update `src/lib/supabase.ts`

Replace your current `/src/lib/supabase.ts` with the improved version:

**File:** `/src/lib/supabase.ts`

Copy the entire contents from `supabase-improved.ts` (provided in outputs).

**Changes made:**
- Better error logging when Supabase isn't configured
- Returns 503 (Service Unavailable) instead of 500 on config errors
- Clearer error messages in server logs

### 4.2 Update `next.config.ts`

Replace your current `/next.config.ts` with the improved version:

**File:** `/next.config.ts`

Copy the entire contents from `next.config-improved.ts` (provided in outputs).

**Changes made:**
- Adds proper `Permissions-Policy` header to fix console warnings
- Adds optional `Content-Security-Policy` for extra security
- Better TypeScript and ESLint configuration

---

## STEP 5: Redeploy to Vercel (5 minutes)

### 5.1 Commit Your Changes (if you made code updates)

```bash
git add src/lib/supabase.ts next.config.ts
git commit -m "fix: improve error handling for Supabase configuration"
git push origin main
```

### 5.2 Option A: Auto-Deploy (Recommended)

If you have GitHub connected:
- Just pushing to `main` should trigger auto-deployment
- Check https://vercel.com/dashboard → your project → Deployments
- Wait for deployment to complete (usually 1-2 minutes)

### 5.3 Option B: Manual Redeploy

If auto-deploy doesn't work:
1. Go to https://vercel.com/dashboard
2. Click your **aio-pulse** project
3. Go to **Deployments**
4. Find your latest deployment
5. Click the three dots → **Redeploy**

---

## STEP 6: Verify the Fix (5 minutes)

### 6.1 Wait for Deployment

Check https://vercel.com/dashboard and wait for the "Ready" status.

### 6.2 Open Your App

Go to https://aio-pulse.vercel.app (or your custom domain)

### 6.3 Check Browser Console

1. Open DevTools: **F12** or **Cmd+Option+I** (Mac)
2. Go to **Console** tab
3. Refresh the page: **Ctrl+R** or **Cmd+R**
4. Look for these errors:

#### ✓ Should be GONE:
- `GET https://aio-pulse.vercel.app/api/scans 500`
- `POST https://aio-pulse.vercel.app/api/prompts 500`
- `Error with Permissions-Policy header: Unrecognized feature`

#### ✓ May still appear (non-critical):
- `[Vercel Web Analytics] Failed to load script` — enable analytics in Vercel
- `SES Removing unpermitted intrinsics` — internal security sandbox, harmless

### 6.4 Check Dashboard Functionality

1. Navigate to the **Dashboard** or main page
2. Does the scan history load?
3. Can you create/edit prompts?
4. No 500 errors when clicking around?

**If YES to all → You're done! 🎉**

---

## STEP 7: Troubleshooting (If Issues Persist)

### Issue: Still Getting 500 Errors

**Diagnosis:**
```bash
# Check Vercel function logs
vercel logs aio-pulse
```

**Solutions:**
1. Verify env vars are set (go back to Step 2)
2. Check that you waited for deployment to complete
3. Try clearing browser cache: **Ctrl+Shift+Delete**
4. Wait 1-2 minutes for Vercel to update CDN

### Issue: Permissions-Policy Warnings Still Appear

**Solutions:**
1. Make sure you updated `next.config.ts` (Step 4.2)
2. Commit and redeploy (Step 5)
3. Clear browser cache and do hard refresh: **Ctrl+Shift+R**

### Issue: API Returns 503 Instead of 401

This is an improvement! It means:
- Supabase is configured ✓
- You're just not authenticated (which is normal for unauthenticated requests)

---

## Quick Checklist

Before considering this done, verify:

- [ ] All three Supabase env vars added to Vercel
- [ ] Vercel deployment completed successfully
- [ ] `GET /api/scans` no longer returns 500
- [ ] `POST /api/prompts` no longer returns 500
- [ ] Dashboard loads without API errors
- [ ] Scan history appears (if you have any scans)
- [ ] Permissions-Policy warnings gone from console
- [ ] No 500 errors in browser console on page load

---

## Final Notes

### Environment Variables Reference

| Variable | Where to Get It | Security Level |
|----------|-----------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | Public (safe to show) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API | Semi-public (normal) |
| `SUPABASE_SERVICE_KEY` | Supabase Settings → API | **SECRET** (never share) |

### Why These Variables?

- **URL** — tells your app where the database is
- **Anon Key** — allows browser clients to authenticate
- **Service Key** — allows your server to do admin operations (bypass RLS)

Without all three, your API routes can't access the database.

### Optional: Automate Future Deployments

Add to your `.github/workflows/deploy.yml`:
```yaml
- name: Verify Supabase Connection
  run: |
    curl -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
      https://${{ secrets.SUPABASE_URL }}/rest/v1/
```

---

## Support

If you still have issues:

1. **Check Vercel logs:**
   ```bash
   vercel logs aio-pulse --follow
   ```

2. **Check Supabase status:**
   - Go to https://status.supabase.com
   - Verify your region isn't down

3. **Test database connectivity:**
   - Go to Supabase Dashboard
   - Click **SQL Editor**
   - Run: `SELECT 1`
   - Should return `1` if DB is working

---

**That's it! Your AIO Pulse should be fully operational now.** 🚀
