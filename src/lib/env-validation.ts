const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
] as const

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'NEXT_PUBLIC_SENTRY_DSN',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'AEO_SUPABASE_URL',
  'AEO_SUPABASE_KEY',
  'NEXT_PUBLIC_AEO_SUPABASE_URL',
  'NEXT_PUBLIC_AEO_SUPABASE_ANON_KEY',
] as const

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number]
type OptionalEnvVar = (typeof OPTIONAL_ENV_VARS)[number]
type EnvVar = RequiredEnvVar | OptionalEnvVar

interface EnvValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = []
  const warnings: string[] = []

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar]

    if (!value || value.trim() === '') {
      missing.push(envVar)
      continue
    }

    if (envVar === 'NEXT_PUBLIC_SUPABASE_URL' && !isValidUrl(value)) {
      warnings.push(`${envVar} should be a valid HTTPS URL`)
    }

    if (envVar === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && value.length < 30) {
      warnings.push(`${envVar} appears to be invalid (too short)`)
    }

    if (envVar === 'SUPABASE_SERVICE_KEY' && value.length < 30) {
      warnings.push(`${envVar} appears to be invalid (too short)`)
    }
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar]

    if (value && value.trim() !== '') {
      if (envVar === 'NEXT_PUBLIC_APP_URL' && !isValidUrl(value)) {
        warnings.push(`${envVar} should be a valid URL`)
      }

      if (
        (envVar === 'SENTRY_DSN' || envVar === 'NEXT_PUBLIC_SENTRY_DSN') &&
        !value.startsWith('https://')
      ) {
        warnings.push(`${envVar} should use HTTPS`)
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

export function getRequiredEnvVars(): string[] {
  return [...REQUIRED_ENV_VARS]
}

export function getOptionalEnvVars(): string[] {
  return [...OPTIONAL_ENV_VARS]
}

export function checkEnvVar(name: EnvVar): string | undefined {
  return process.env[name]
}

export function requireEnvVar(name: RequiredEnvVar): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

if (process.env.NODE_ENV === 'development') {
  const result = validateEnvironment()
  if (!result.valid) {
    console.error('❌ Missing required environment variables:', result.missing.join(', '))
  }
  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment variable warnings:', result.warnings.join(', '))
  }
  if (result.valid && result.warnings.length === 0) {
    console.log('✅ Environment variables validated')
  }
}
