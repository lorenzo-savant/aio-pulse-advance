# AIO Pulse — Deployment & Environment Setup Guide

## 🎯 Quick Start

This guide shows you how to deploy AIO Pulse to Vercel with all required environment variables.

---

## 📋 Prerequisites

- Vercel account: https://vercel.com
- Supabase account: https://supabase.com
- Your AIO Pulse project connected to GitHub

---

## 🚀 Deployment Steps

### Step 1: Get Supabase Credentials

1. Go to https://supabase.com
2. Log in and select your project
3. Click **Settings** (bottom left)
4. Click **API**
5. Copy these three values:

| Variable | From Supabase |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g., `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_KEY` | "service_role secret" key |

**⚠️ IMPORTANT:** The service role key is sensitive. Never commit it to git or share it publicly.

---

### Step 2: Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Click your **AIO Pulse** project
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)

#### Add Variable 1: Supabase URL
```
Name:  NEXT_PUBLIC_SUPABASE_URL
Value: (paste your Project URL from Step 1)
```
- Select: **Production** checkbox
- Click **Save**

#### Add Variable 2: Supabase Anon Key
```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: (paste your Anon Key from Step 1)
```
- Select: **Production** checkbox
- Click **Save**

#### Add Variable 3: Supabase Service Key
```
Name:  SUPABASE_SERVICE_KEY
Value: (paste your Service Role Key from Step 1)
```
- Select: **Production** checkbox
- Click **Save**

#### Add Other Variables (Optional)

Add any other variables your app needs:
- `STRIPE_SECRET_KEY` (if using billing)
- `GEMINI_API_KEY` (if using Gemini)
- `OPENROUTER_API_KEY` (if using OpenRouter)
- `GROQ_API_KEY` (if using Groq)
- `CEREBRAS_API_KEY` (if using Cerebras)
- `RESEND_API_KEY` (if using email)
- `ENCRYPTION_KEY` (for exports)
- `CRON_SECRET_TOKEN` (for scheduled jobs)

See `.env.example` for all available variables.

---

### Step 3: Redeploy Your Application

**Option A: Auto-Deploy (Recommended)**
1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "feat: bugfix deployment"
   git push origin main
   ```
2. Vercel automatically deploys when you push to main

**Option B: Manual Redeploy**
1. Go to Vercel dashboard
2. Select your project
3. Go to **Deployments**
4. Find the latest deployment
5. Click the menu (⋮) → **Redeploy**

**Option C: Redeploy from Vercel CLI**
```bash
vercel --prod
```

---

### Step 4: Wait for Deployment

1. Go to **Deployments** tab in Vercel
2. Watch for "Ready" status (usually 1-2 minutes)
3. Deployment complete when status is green ✅

---

### Step 5: Verify the Fix

1. Open your deployed app URL
2. Open DevTools: **F12** or **Cmd+Option+I** (Mac)
3. Go to **Console** tab
4. Refresh the page: **Ctrl+R** or **Cmd+R**

**Check for:**
- ❌ No `GET /api/scans 500` errors
- ❌ No `GET /api/prompts 500` errors
- ❌ No Permissions-Policy warnings
- ✅ Dashboard loads successfully
- ✅ Scan history displays

---

## 🛠️ Local Testing (Before Production)

### Setup Local Environment

1. Create `.env.local` file in project root:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start dev server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

6. Test API endpoints:
   ```bash
   curl http://localhost:3000/api/scans
   ```

---

## 📊 Vercel Project Settings

### Recommended Settings

**Framework:** Next.js  
**Build Command:** `next build`  
**Output Directory:** `.next`  
**Install Command:** `npm install`  

These should be auto-detected by Vercel.

### Optional Vercel Features

**Web Analytics:**
- Go to Settings → Analytics
- Enable Web Analytics (optional, for insights)

**Monitoring:**
- Vercel automatically monitors your deployments
- Check Deployments tab for status

---

## 🔒 Security Best Practices

### Environment Variables

✅ **DO:**
- Set `SUPABASE_SERVICE_KEY` only in Vercel Production
- Use Vercel's environment variables for all secrets
- Review what's visible in Preview vs Production

❌ **DON'T:**
- Commit `.env.local` to git
- Share service keys in chat or email
- Use placeholder values in production
- Mix test and production credentials

### Code Deployments

✅ **DO:**
- Test locally before pushing
- Review git diffs before deploying
- Use descriptive commit messages
- Deploy during business hours (easier to troubleshoot)

❌ **DON'T:**
- Push secrets to git
- Deploy unreviewed code
- Mix multiple changes in one deploy
- Deploy without testing

---

## 🚨 Troubleshooting

### Problem: Still Getting 500 Errors After Deployment

**Solutions:**
1. Verify all 3 Vercel env vars are set
2. Check they match your Supabase credentials
3. Wait 2-3 minutes for Vercel to propagate changes
4. Clear browser cache: **Ctrl+Shift+Delete**
5. Hard refresh: **Ctrl+Shift+R**

### Problem: Environment Variables Not Taking Effect

**Solutions:**
1. Make sure you saved them in Vercel (look for ✅ checkmark)
2. Redeploy: Deployments → Latest → Redeploy
3. Don't use Preview deployments for testing (they might use different env vars)
4. Check Vercel logs: https://vercel.com/dashboard → Logs

### Problem: Database Connection Fails

**Solutions:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Check `SUPABASE_SERVICE_KEY` is valid
3. Go to Supabase dashboard and verify project is running
4. Check Supabase status: https://status.supabase.com

---

## 📈 Monitoring Your Deployment

### Check Deployment Status
1. Go to Vercel dashboard
2. Select your project
3. Check "Deployments" tab
4. Look for green ✅ checkmark

### View Deployment Logs
1. Click on a deployment
2. Scroll down to see build logs
3. Look for errors (red text)

### Test API Health
```bash
# Test scans endpoint
curl https://your-app.vercel.app/api/scans

# Should return: {"success":false,"message":"Missing or invalid authentication"}
# NOT: 500 error
```

---

## 🔄 Updating Environment Variables

If you need to change environment variables later:

1. Go to Vercel dashboard
2. Select your project → Settings → Environment Variables
3. Click the variable to edit
4. Update the value
5. Click Save
6. **Redeploy** the project (automatic on next push, or manual redeploy)

---

## 🎯 Post-Deployment Checklist

- [ ] All 3 Supabase env vars are set in Vercel
- [ ] Vercel deployment shows "Ready" status
- [ ] App loads without 500 errors
- [ ] Dashboard displays correctly
- [ ] API endpoints return proper responses
- [ ] No Permissions-Policy warnings in console
- [ ] Local testing works before production
- [ ] Team members know about the deployment

---

## 📞 Getting Help

### If Something Goes Wrong

1. **Check Logs:** Vercel Deployments tab
2. **Check Status:** https://status.supabase.com
3. **Check Console:** Browser DevTools (F12)
4. **Check Docs:** See `BUGFIX_DOCUMENTATION/` folder

### Relevant Documentation

- `BUGFIX_DOCUMENTATION/IMPLEMENTATION_GUIDE.md` — Step-by-step setup
- `BUGFIX_DOCUMENTATION/TROUBLESHOOTING_REFERENCE.md` — Common errors
- `BUGFIX_DOCUMENTATION/AIO_PULSE_BUG_ANALYSIS.md` — Technical details

---

## 📝 Environment Variables Quick Reference

### Required for Core Functionality
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
```

### Optional Features
```
STRIPE_SECRET_KEY              # Billing
GEMINI_API_KEY                # AI
OPENROUTER_API_KEY            # AI
GROQ_API_KEY                  # AI
CEREBRAS_API_KEY              # AI
RESEND_API_KEY                # Email
ENCRYPTION_KEY                # Export security
CRON_SECRET_TOKEN             # Scheduled jobs
```

See `.env.example` for all options.

---

## ✅ Success Criteria

You'll know the deployment is successful when:

✅ Your app loads without 500 errors  
✅ Dashboard displays scan history  
✅ You can create/edit prompts  
✅ No critical errors in browser console  
✅ API endpoints return proper responses  

---

## 🎉 You're Done!

Your AIO Pulse is now deployed to production with all fixes applied.

For detailed information, see the documentation in `BUGFIX_DOCUMENTATION/` folder.

---

**Need help?** See `DEPLOYMENT_GUIDE.md` or `BUGFIX_DOCUMENTATION/00_START_HERE_INDEX.txt`
