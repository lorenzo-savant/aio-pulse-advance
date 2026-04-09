import { createServerClient } from '@/lib/supabase'

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'signup'
  | 'password_change'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'brand_created'
  | 'brand_deleted'
  | 'team_member_invited'
  | 'team_member_removed'
  | 'prompt_created'
  | 'prompt_deleted'
  | 'monitoring_run'
  | 'alert_triggered'
  | 'export_request'
  | 'suspicious_activity'

export type SecuritySeverity = 'info' | 'warning' | 'critical'

interface SecurityLogEntry {
  event_type: SecurityEventType
  user_id?: string
  brand_id?: string
  ip_address?: string
  user_agent?: string
  event_data?: Record<string, unknown>
  severity: SecuritySeverity
  timestamp?: string
}

class SecurityLogger {
  private db = createServerClient()
  private logs: SecurityLogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof setInterval !== 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), 5000)
    }
  }

  async log(entry: SecurityLogEntry): Promise<void> {
    const logEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    this.logs.push(logEntry)

    console.log(`[SECURITY] ${entry.severity.toUpperCase()} ${entry.event_type}`, {
      userId: entry.user_id,
      brandId: entry.brand_id,
      ...entry.event_data,
    })

    if (this.logs.length >= 10) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.logs.length === 0) return

    const logsToFlush = [...this.logs]
    this.logs = []

    if (!this.db) {
      console.warn('[Security] No database connection, logs not persisted')
      return
    }

    try {
      await (this.db as any).from('security_logs').insert(
        logsToFlush.map((log) => ({
          event_type: log.event_type,
          user_id: log.user_id,
          brand_id: log.brand_id,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          event_data: log.event_data ? JSON.stringify(log.event_data) : null,
          severity: log.severity,
          created_at: log.timestamp,
        })),
      )
    } catch (error) {
      console.error('[Security] Failed to persist logs:', error)
      this.logs.push(...logsToFlush)
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

export const securityLogger = new SecurityLogger()

export async function logSecurityEvent(
  type: SecurityEventType,
  options: {
    userId?: string
    brandId?: string
    ip?: string
    userAgent?: string
    data?: Record<string, unknown>
    severity?: SecuritySeverity
  },
): Promise<void> {
  const severity = options.severity ?? getSeverityForEvent(type)

  await securityLogger.log({
    event_type: type,
    user_id: options.userId,
    brand_id: options.brandId,
    ip_address: options.ip,
    user_agent: options.userAgent,
    event_data: options.data,
    severity,
  })
}

function getSeverityForEvent(type: SecurityEventType): SecuritySeverity {
  const criticalEvents: SecurityEventType[] = [
    'login_failure',
    'suspicious_activity',
    'password_change',
  ]
  const warningEvents: SecurityEventType[] = [
    'api_key_created',
    'api_key_revoked',
    'brand_deleted',
    'team_member_removed',
  ]

  if (criticalEvents.includes(type)) return 'critical'
  if (warningEvents.includes(type)) return 'warning'
  return 'info'
}

export function createSecurityMiddleware() {
  return async function securityAudit(
    userId: string | undefined,
    brandId: string | undefined,
    req: { headers: { get: (key: string) => string | null } },
  ): Promise<void> {
    await logSecurityEvent('api_key_created', {
      userId,
      brandId,
      ip: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })
  }
}
