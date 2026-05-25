// PATH: src/lib/supabase-untyped.ts
//
// Bypass helper for Supabase tables that aren't in the generated Database
// type yet (aeo_*, brand_facts, brand_annotations, response_embeddings, …).
//
// Centralises the cast so the rest of the codebase doesn't sprinkle
// `(db as any)` everywhere — one isolated `any` here, no per-file
// eslint-disable noise.

import type { createServerClient } from '@/lib/supabase'

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>

// One `any` here is the price of admission for hitting tables that
// haven't been threaded into the generated Database type. Use sparingly.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type UntypedSupabaseClient = Omit<ServerClient, 'from'> & {
  from: (table: string) => any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Cast a typed Supabase client to its untyped equivalent. Use ONLY when
 * the target table is not in the generated Database schema — otherwise
 * stick with the typed client so query/result inference works.
 *
 *   const db = createServerClient()
 *   const dbX = asUntyped(db)
 *   const { data } = await dbX.from('aeo_runs').select('id').eq(...)
 */
export function asUntyped(db: ServerClient): UntypedSupabaseClient {
  return db as unknown as UntypedSupabaseClient
}
