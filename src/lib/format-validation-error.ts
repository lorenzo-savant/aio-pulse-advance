import type { ZodError } from 'zod'

/**
 * Returns a human-readable validation message that any UI can show directly.
 * Example output: "description: max 2000 chars · color: invalid hex format"
 */
export function formatValidationError(error: ZodError): string {
  const issues = error.issues.slice(0, 5)
  const parts = issues.map((iss) => {
    const path = iss.path.join('.') || 'field'
    const msg = humanize(iss.message)
    return `${path}: ${msg}`
  })
  const more = error.issues.length - issues.length
  return parts.join(' · ') + (more > 0 ? ` (+${more} more)` : '')
}

function humanize(zodMessage: string): string {
  return zodMessage
    .replace(/String must contain at least (\d+) character\(s\)/i, 'min $1 chars')
    .replace(/String must contain at most (\d+) character\(s\)/i, 'max $1 chars')
    .replace(/Number must be greater than or equal to (\d+)/i, 'min $1')
    .replace(/Number must be less than or equal to (\d+)/i, 'max $1')
    .replace(/Array must contain at most (\d+) element\(s\)/i, 'max $1 items')
    .replace(/Required/i, 'required')
    .replace(/Invalid email/i, 'invalid email')
    .replace(/Invalid url/i, 'invalid URL')
    .replace(/Invalid enum value\. Expected ([^,]+).*/i, 'must be one of: $1')
}
