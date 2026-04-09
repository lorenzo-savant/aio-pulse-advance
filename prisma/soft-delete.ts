// PATH: prisma/soft-delete.ts
//
// ─── Soft Delete Middleware ───────────────────────────────────────────────────
//
// Automatically filters out soft-deleted records from all queries.
//
// Usage:
// 1. Add deletedAt field to models in schema.prisma
// 2. Run: npx prisma migrate dev --name add_soft_delete
// 3. Apply middleware in your Prisma client
//

import { Prisma } from '@prisma/client'

const softDeleteModels = ['Brand', 'Prompt', 'AlertRule', 'AnalysisResult']

export const softDeleteMiddleware = async (
  params: Prisma.MiddlewareParams,
  next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
): Promise<unknown> => {
  if (!softDeleteModels.includes(params.model || '')) {
    return next(params)
  }

  if (params.action === 'findUnique') {
    params.action = 'findFirst'
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    }
  }

  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (!params.args) {
      params.args = {}
    }
    if (!params.args.where) {
      params.args.where = {}
    }
    if (!('deletedAt' in params.args.where)) {
      ;(params.args.where as Record<string, unknown>).deletedAt = null
    }
  }

  if (params.action === 'delete') {
    params.action = 'update'
    params.args = {
      ...params.args,
      data: {
        ...(params.args.data as Record<string, unknown>),
        deletedAt: new Date(),
      },
    }
  }

  if (params.action === 'deleteMany') {
    params.action = 'updateMany'
    if (!params.args.where) {
      params.args.where = {}
    }
    if (!('deletedAt' in params.args.where)) {
      ;(params.args.where as Record<string, unknown>).deletedAt = null
    }
    params.args.data = {
      ...(params.args.data as Record<string, unknown>),
      deletedAt: new Date(),
    }
  }

  return next(params)
}
