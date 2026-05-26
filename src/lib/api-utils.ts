import { NextResponse } from 'next/server'

export function apiError(message: string, status = 500): NextResponse {
  return NextResponse.json({ success: false, message }, { status })
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
