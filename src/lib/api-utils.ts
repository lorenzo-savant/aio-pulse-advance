import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { SsrfError } from '@/lib/utils/safe-fetch'

/**
 * The standard error envelope: `{ success: false, message }`.
 * Every handler should produce errors through this (or withApiHandler)
 * so clients can parse failures uniformly.
 */
export function apiError(message: string, status = 500): NextResponse {
  return NextResponse.json({ success: false, message }, { status })
}

/**
 * Wrap a route handler with a last-resort try/catch.
 *
 * Without it, an unhandled throw becomes a raw Next.js 500 with an
 * HTML-ish body and no log line — invisible in Sentry triage and
 * unparseable by API clients. With it, the failure is logged with its
 * source and answered with the standard envelope.
 *
 *   export const GET = withApiHandler('glossary', async (req) => { … })
 *
 * Handlers that already try/catch keep working — this only catches what
 * escapes them. Never swallow a caught error inside a handler just
 * because this wrapper exists; log the context you have.
 */
export function withApiHandler<TArgs extends unknown[], TReq>(
  source: string,
  handler: (req: TReq, ...args: TArgs) => Promise<NextResponse>,
): (req: TReq, ...args: TArgs) => Promise<NextResponse> {
  return async (req: TReq, ...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      // A user-supplied URL that resolves somewhere it must not is a client
      // error, not a server fault — and its message is deliberately generic
      // so it can't be used to probe the internal network.
      if (error instanceof SsrfError) {
        logger.warn('Blocked SSRF attempt', { source, err: error.message })
        return apiError('The provided URL is not allowed', 400)
      }
      logger.error('Unhandled route error', {
        source,
        err: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return apiError('Internal server error', 500)
    }
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  maxLimit?: number
  defaultLimit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationParams = {},
): { page: number; limit: number; offset: number } {
  const maxLimit = options.maxLimit ?? 100
  const defaultLimit = options.defaultLimit ?? 20

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit))),
  )
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

export function paginatedResponse<T>(
  data: T[],
  total: number | null,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalCount = total ?? data.length
  const totalPages = Math.ceil(totalCount / limit)

  return {
    data,
    pagination: {
      page,
      perPage: limit,
      total: totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

export function getPaginationHeaders(
  total: number | null,
  page: number,
  limit: number,
): Record<string, string> {
  const totalCount = total ?? 0
  const totalPages = Math.ceil(totalCount / limit)

  return {
    'X-Pagination-Page': String(page),
    'X-Pagination-Per-Page': String(limit),
    'X-Pagination-Total': String(totalCount),
    'X-Pagination-Total-Pages': String(totalPages),
  }
}
