import { createServerClient } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import type { Json } from '@/types/database'

export interface ConversationMessage {
  id: string
  conversationId: string
  role: string
  content: string
  providerUsed?: string
  latencyMs?: number
  tokensUsed?: number
  costEstimate?: number
  contextData?: Json
  createdAt: string
}

export interface Conversation {
  id: string
  userId: string
  brandId?: string
  agentType: string
  title?: string
  messages: ConversationMessage[]
  createdAt: string
  updatedAt: string
}

export async function createConversation(
  userId: string,
  brandId: string | null,
  agentType: string,
  title?: string,
): Promise<string | null> {
  const supabase = createServerClient()
  if (!supabase) return null

  const { data, error } = await (supabase as any)
    .from('ai_conversations')
    .insert({
      user_id: userId,
      brand_id: brandId,
      agent_type: agentType,
      title: title || `Conversation with ${agentType}`,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create conversation:', error)
    return null
  }

  return data?.id || null
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  metadata?: {
    providerUsed?: string
    latencyMs?: number
    tokensUsed?: number
    costEstimate?: number
    contextData?: Json
  },
): Promise<ConversationMessage | null> {
  const supabase = createServerClient()
  if (!supabase) return null

  const { data, error } = await (supabase as any)
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      provider_used: metadata?.providerUsed,
      latency_ms: metadata?.latencyMs,
      tokens_used: metadata?.tokensUsed,
      cost_estimate: metadata?.costEstimate,
      context_data: metadata?.contextData || {},
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add message:', error)
    return null
  }

  await (supabase as any)
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data as unknown as ConversationMessage
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const supabase = createServerClient()
  if (!supabase) return null

  const { data: conversation, error: convError } = await (supabase as any)
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (convError || !conversation) return null

  const { data: messages, error: msgError } = await (supabase as any)
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) return null

  return {
    ...conversation,
    messages: (messages || []) as unknown as ConversationMessage[],
  } as unknown as Conversation
}

/**
 * Load a conversation only if the caller may see it. Returns null when they may
 * not, so a refused conversation and a missing one share one path and neither
 * confirms that the row exists.
 *
 * The client here is the service-role client, which bypasses RLS, so access
 * cannot be left to the database — it must be decided in code (H1, review of
 * 2026-08-05: an unverified conversation id would otherwise let a caller read
 * someone else's history into the LLM context and append messages to it).
 *
 * Which rule applies depends on whether the conversation is attached to a brand:
 *
 *  - **with a brand** — brand data is shared, so access follows the brand
 *    rather than the author: any member of that brand may read it. Locking it
 *    to its creator would make it the only part of the product a teammate
 *    cannot see.
 *  - **without a brand** — there is no brand to share it inside, so it stays
 *    with its author. This is the case that keeps H1 intact: relaxing it too
 *    would leave brand-less conversations with no guard at all.
 *
 * When the caller names a brand, a conversation belonging to a different one is
 * refused outright, so an id can never be used to hop between brands.
 */
export async function getAccessibleConversation(
  conversationId: string,
  userId: string,
  brandId?: string,
): Promise<Conversation | null> {
  const raw = await getConversation(conversationId)
  if (!raw) return null

  // getConversation spreads the stored row, so the raw snake_case columns are
  // what is actually present (the camelCase fields on Conversation are
  // declared for convenience and not materialised by the storage layer).
  const row = raw as unknown as { user_id?: string; brand_id?: string | null }
  const ownerId = String(row.user_id)
  const conversationBrandId = row.brand_id ? String(row.brand_id) : null

  if (!conversationBrandId) return ownerId === userId ? raw : null

  if (brandId && conversationBrandId !== brandId) return null

  const access = await verifyBrandAccess(conversationBrandId, userId)
  return access ? raw : null
}

export async function getRecentConversations(
  userId: string,
  brandId?: string,
  limit = 10,
): Promise<Conversation[]> {
  const supabase = createServerClient()
  if (!supabase) return []

  let query = (supabase as any)
    .from('ai_conversations')
    .select('*, messages(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query

  if (error) return []

  return (data || []) as unknown as Conversation[]
}

export async function getConversationHistory(
  conversationId: string,
  maxMessages = 10,
): Promise<Array<{ role: string; content: string }>> {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data, error } = await (supabase as any)
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(maxMessages)

  if (error) return []

  return (data || []).map((m: any) => ({ role: m.role, content: m.content }))
}
