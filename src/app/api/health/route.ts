import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET() {
  const start = Date.now()

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    runtime: 'edge',
    services: {
      database: 'unknown',
      ai_providers: 'unknown',
    },
    responseTime: Date.now() - start,
  }

  try {
    const { createServerClient } = await import('@/lib/supabase')
    const db = createServerClient()

    if (db) {
      const { data, error } = await db.from('brands').select('id').limit(1)
      health.services.database = error ? 'error' : 'connected'
    } else {
      health.services.database = 'not_configured'
    }
  } catch (e) {
    health.services.database = 'error'
  }

  try {
    const aiKeys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY']
    const configured = aiKeys.filter((k) => !!process.env[k]).length
    health.services.ai_providers = `${configured}/4 configured`
  } catch (e) {
    health.services.ai_providers = 'error'
  }

  const status = health.status === 'healthy' ? 200 : 503
  return NextResponse.json(health, { status })
}
