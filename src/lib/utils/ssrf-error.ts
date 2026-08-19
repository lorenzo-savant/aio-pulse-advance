export type SsrfErrorCode =
  | 'BLOCKED_PROTOCOL'
  | 'BLOCKED_IP'
  | 'BLOCKED_HOST'
  | 'BLOCKED_PORT'
  | 'TIMEOUT'
  | 'REDIRECT_LOOP'
  | 'RESPONSE_TOO_LARGE'

export class SsrfError extends Error {
  constructor(
    public readonly code: SsrfErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SsrfError'
  }
}
