# AIO Pulse Error Flow Diagram

## Current State (❌ BROKEN)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Dashboard Component                                     │   │
│  │  calls: loadScanHistory()                                │   │
│  │           ↓                                              │   │
│  │  GET /api/scans (no Bearer token, just cookies)         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │ HTTP Request
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Edge/Function                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  src/app/api/scans/route.ts                              │   │
│  │  export async function GET(req) {                        │   │
│  │    const userId = await getCurrentUserId(...)  ← ERROR! │   │
│  │                                                          │   │
│  │    // Line 13 in getCurrentUserId():                     │   │
│  │    if (!supabaseUrl || !supabaseAnonKey)                 │   │
│  │      throw AuthError('...not configured', 503)           │   │
│  │                                                          │   │
│  │    // But supabase client is null, so:                  │   │
│  │    const { data } = await supabase.auth.getUser()       │   │
│  │    // ↑ CRASH: Cannot read property of null!            │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │ Unhandled Exception
                             ↓
                      500 Internal Server Error
                             │
                             ↓ Browser Console
                   ❌ GET /api/scans 500


THE ROOT CAUSE CHAIN:
═══════════════════════════════════════════════════════════════

1. Vercel Deployment is missing environment variables:
   ├─ NEXT_PUBLIC_SUPABASE_URL           ✗ NOT SET
   ├─ NEXT_PUBLIC_SUPABASE_ANON_KEY      ✗ NOT SET
   └─ SUPABASE_SERVICE_KEY               ✗ NOT SET

2. In src/lib/supabase.ts line 15-19:
   const supabase = isConfigured 
     ? createClient(...)
     : null                              ← supabase becomes NULL

3. When getCurrentUserId() runs:
   - Checks if supabaseUrl && supabaseAnonKey exist (they don't)
   - But then tries to use supabase.auth.getUser()
   - ❌ Cannot call method on null!
   - ❌ Unhandled exception
   - ❌ Returns 500 instead of 503

4. Frontend receives 500 error:
   - Dashboard fails to load
   - Scan history shows as error
   - User sees broken app
```

---

## After Fix (✅ WORKING)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Dashboard Component                                     │   │
│  │  calls: loadScanHistory()                                │   │
│  │           ↓                                              │   │
│  │  GET /api/scans (with valid auth)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │ HTTP Request
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Edge/Function                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  src/app/api/scans/route.ts                              │   │
│  │  export async function GET(req) {                        │   │
│  │                                                          │   │
│  │    ✓ getCurrentUserId() succeeds                         │   │
│  │        ↓                                                 │   │
│  │    ✓ userId = "user-uuid-123"                           │   │
│  │        ↓                                                 │   │
│  │    ✓ createServerClient() returns working DB            │   │
│  │        ↓                                                 │   │
│  │    ✓ db.from('scan_history').select(...)                │   │
│  │        ↓                                                 │   │
│  │    ✓ return NextResponse.json({success: true, data})     │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │ Successful Response
                             ↓
              200 OK with scan history data
                             │
                             ↓ Browser Console
                   ✅ GET /api/scans 200


WHAT CHANGED:
═════════════════════════════════════════════════════════════════

1. Added environment variables to Vercel:
   ├─ NEXT_PUBLIC_SUPABASE_URL           ✓ SET
   ├─ NEXT_PUBLIC_SUPABASE_ANON_KEY      ✓ SET
   └─ SUPABASE_SERVICE_KEY               ✓ SET

2. In src/lib/supabase.ts:
   const supabase = isConfigured 
     ? createClient(...)                 ✓ supabase initialized
     : null

3. getCurrentUserId() works because:
   - supabaseUrl && supabaseAnonKey exist
   - supabase client is valid
   - Can call supabase.auth.getUser()
   - Returns proper userId

4. createServerClient() works because:
   - supabaseServiceKey exists
   - Returns valid database client

5. API returns 200:
   - Query executes successfully
   - Data returned to frontend
   - Dashboard loads scan history
   - User sees working app ✓
```

---

## Error Handling Improvement

```
BEFORE (Current Code):
═════════════════════════════════════════════════════════════════

getCurrentUserId()
  ├─ If no Supabase config...
  ├─ Calls supabase.auth.getUser()  ← supabase is null, CRASH
  └─ Exception bubbles up as 500 error


AFTER (Improved Code):
═════════════════════════════════════════════════════════════════

getCurrentUserId()
  ├─ Check if Supabase config exists
  │  └─ If not: throw AuthError('...not configured', 503)
  │     Returns 503 (Service Unavailable) ✓
  │
  ├─ Supabase config exists
  │  └─ Safe to call supabase.auth.getUser()
  │     No crash ✓
  │
  └─ Either way: proper HTTP status code ✓
```

---

## Browser Console Before vs After

### BEFORE (Current) 🔴
```
Errors:
  GET https://aio-pulse.vercel.app/api/scans 500 (Internal Server Error)
  GET https://aio-pulse.vercel.app/api/prompts 500 (Internal Server Error)
  
Warnings:
  Error with Permissions-Policy header: Unrecognized feature: 'browsing-topics'
  Error with Permissions-Policy header: Unrecognized feature: 'join-ad-interest-group'
  ... (4 more)
  
  [Vercel Web Analytics] Failed to load script

Status: ❌ App is broken
```

### AFTER (Fixed) ✅
```
Errors:
  (none - or just auth 401 which is expected)
  
Warnings:
  (none - or non-critical browser sandbox messages)
  
Status: ✅ App is working!
```

---

## Configuration Checklist

```
Current State:                    After Fix:
═══════════════════════════════════════════════════════════════

Vercel Environment Variables:
├─ NEXT_PUBLIC_SUPABASE_URL
│  Before: ❌ NOT SET              After: ✅ SET
│  Value: (empty)                  Value: https://xxx.supabase.co
│
├─ NEXT_PUBLIC_SUPABASE_ANON_KEY
│  Before: ❌ NOT SET              After: ✅ SET
│  Value: (empty)                  Value: eyJhbGc...
│
└─ SUPABASE_SERVICE_KEY
   Before: ❌ NOT SET              After: ✅ SET
   Value: (empty)                  Value: eyJhbGc... (secret)


Code Changes:
├─ src/lib/supabase.ts
│  Before: Basic error handling    After: Improved error logging
│                                         Early config checks
│                                         Proper status codes
│
└─ next.config.ts
   Before: Missing Permissions-Policy  After: Proper security headers


Result:
Before: 500 errors, broken app ❌
After:  Working app, proper status codes ✅
```

---

## Data Flow Diagram

```
USER INTERACTION:
═════════════════════════════════════════════════════════════════

User clicks "Dashboard"
         ↓
Dashboard component mounts
         ↓
useEffect(() => { loadScanHistory() })
         ↓
fetch('/api/scans')    ← HTTP GET request
         ↓
Server receives request at src/app/api/scans/route.ts
         ↓
GET function executes:
  ├─ getCurrentUserId()
  │  ├─ (BROKEN: returns null if no env vars)
  │  └─ (FIXED: throws proper error if no env vars)
  │
  ├─ createServerClient()
  │  ├─ (BROKEN: returns null if no SUPABASE_SERVICE_KEY)
  │  └─ (FIXED: works if SUPABASE_SERVICE_KEY set)
  │
  └─ db.from('scan_history').select()
     ├─ (BROKEN: skipped because db was null)
     └─ (FIXED: executes query successfully)
         ↓
         Returns JSON response
         ↓
Browser receives response
         ↓
Dashboard updates with scan history
         ↓
User sees data ✅
```

---

## Quick Visual Summary

```
┌──────────────────────────────────────────────────────────┐
│                  THE 500 ERROR PROBLEM                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Missing Env Vars in Vercel                           │
│          ↓                                               │
│   Supabase client initialization fails                 │
│          ↓                                               │
│   getCurrentUserId() tries to use null client          │
│          ↓                                               │
│   Unhandled exception                                  │
│          ↓                                               │
│   500 Internal Server Error                            │
│          ↓                                               │
│   Dashboard can't load scan history ❌                  │
│                                                          │
└──────────────────────────────────────────────────────────┘

                    THE SOLUTION
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   1. Get Supabase credentials                          │
│   2. Add them to Vercel Environment Variables          │
│   3. Redeploy                                          │
│   4. Check console - no more 500 errors! ✅            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

**Visual Guide Complete!** Use this to understand the problem and solution at a glance.
