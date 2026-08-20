// PATH: scripts/verify-gemini-model.mjs
//
// Why this exists
// ---------------
// engine=gemini rows keep landing with response_provider=openai:gpt-4o-mini —
// meaning every Gemini attempt fails and the cross-provider fallback answers.
// The prime suspect is the model id: gemini-2.5-flash was retired (404), and the
// replacement default `gemini-3.6-flash` may not be a real, callable id for THIS
// account either — in which case every call 404s and falls straight to
// gpt-4o-mini, exactly reproducing the symptom.
//
// This settles it with two live calls and prints the exact reason:
//   1. GET /models                 → is the configured id actually offered?
//   2. POST /{model}:generateContent (1 token) → 200 ok | 404 not-found |
//                                    403 api-not-enabled | 429 quota — each has
//                                    a DIFFERENT fix, so the status code matters.
//
// Read-only: one tiny generate call, no DB, no writes. Nothing here can touch
// the Supabase data.
//
// Run (PowerShell):   $env:GEMINI_API_KEY="..."; node scripts/verify-gemini-model.mjs
// Run (bash):         GEMINI_API_KEY=... node scripts/verify-gemini-model.mjs

const API_KEY = process.env.GEMINI_API_KEY
// Mirror geminiEngineModel(): env override wins, else the router default.
const MODEL = process.env.GEMINI_ENGINE_MODEL || 'gemini-3.6-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

if (!API_KEY) {
  console.error('✗ GEMINI_API_KEY is not set. Set it and re-run.')
  process.exit(2)
}

const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY }

function short(id) {
  return id.replace(/^models\//, '')
}

async function listModels() {
  const out = []
  let pageToken = ''
  // The list is paginated; walk every page so a model on page 2 isn't missed.
  for (let i = 0; i < 20; i++) {
    const url = `${BASE}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`GET /models → ${res.status} ${res.statusText}: ${await res.text()}`)
    }
    const json = await res.json()
    for (const m of json.models ?? []) out.push(m)
    if (!json.nextPageToken) break
    pageToken = json.nextPageToken
  }
  return out
}

async function tryGenerate() {
  const url = `${BASE}/models/${MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  })
  const text = await res.text()
  return { status: res.status, statusText: res.statusText, body: text }
}

console.log(`\nConfigured model: ${MODEL}\n`)

let models
try {
  models = await listModels()
} catch (e) {
  console.error(`✗ Could not list models: ${e.message}`)
  console.error('  A 403 here usually means the Generative Language API is not enabled for this key/project.')
  process.exit(1)
}

const genCapable = models.filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
const ids = new Set(models.map((m) => short(m.name)))

console.log(`Models offered to this key: ${models.length} (${genCapable.length} support generateContent)`)

const present = ids.has(MODEL)
console.log(`Is "${MODEL}" in the list? ${present ? '✓ yes' : '✗ NO — this is very likely the root cause'}`)

if (!present) {
  // Surface the closest available flash models so the fix is obvious.
  const flash = genCapable
    .map((m) => short(m.name))
    .filter((id) => /gemini/.test(id) && /flash/.test(id))
    .sort()
  console.log('\nAvailable Gemini *flash* models that DO support generateContent:')
  for (const id of flash) console.log(`  • ${id}`)
  console.log('\n→ Fix: set GEMINI_DEFAULT_ENGINE_MODEL (src/lib/services/ai-router.ts) to one of the above,')
  console.log('  or set the GEMINI_ENGINE_MODEL env var to override without a code change.')
}

console.log('\nLive generateContent probe:')
const probe = await tryGenerate()
if (probe.status === 200) {
  console.log('  ✓ 200 OK — the model answers. Gemini failures are NOT the model id; look at the')
  console.log('    grounding path (Interactions API) or quota (429) in the monitoring fallback log.')
} else {
  const hint =
    probe.status === 404
      ? 'model id not found for this account → change the id (see list above)'
      : probe.status === 403
        ? 'API not enabled / key lacks access → enable Generative Language API for the project'
        : probe.status === 429
          ? 'quota exhausted → billing/quota, not the id'
          : 'unexpected — read the body below'
  console.log(`  ✗ ${probe.status} ${probe.statusText} — ${hint}`)
  console.log(`    ${probe.body.slice(0, 400)}`)
}
console.log('')
