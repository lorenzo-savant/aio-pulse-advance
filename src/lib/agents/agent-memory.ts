import { createServerClient } from '@/lib/supabase'
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
