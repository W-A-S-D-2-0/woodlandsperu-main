import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage, ChatRole, ChatStatus } from '../../shared/api/chat'
import { readSupabaseConfig } from '../auth/supabase-auth'
import { ChatDataError, type ChatData, type ChatDataFactory } from './chat-data'

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

interface MessageRow {
  id: number
  role: ChatRole
  body: string
  created_at: string
}

/** Los errores lanzados a propósito por las funciones traen mensajes en español aptos para el cliente. */
function rethrow(error: { code?: string; message: string }): never {
  if (error.code === '54000') throw new ChatDataError('rate_limited', error.message)
  if (error.code === '22023' || error.code === 'P0002') throw new ChatDataError('invalid_request', error.message)
  throw new Error(`chat: ${error.code ?? 'error'}`)
}

export const toChatMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  role: row.role,
  body: row.body,
  createdAt: row.created_at,
})

/** Conversaciones con la clave de servicio: las funciones de registro solo las acepta el backend. */
export const createSupabaseChatData: ChatDataFactory = (env) => {
  const config = readSupabaseConfig(env)
  const secretKey = env.SUPABASE_SECRET_KEY?.trim()
  if (!config || !secretKey) return null
  const db = (): SupabaseClient => createClient(config.url, secretKey, clientOptions)

  const provider: ChatData = {
    async record(input) {
      const { data, error } = await db().rpc('record_conversation_message', {
        p_request: {
          channel: input.channel,
          external_ref: input.ref,
          role: input.role,
          body: input.body,
          contact_name: input.contactName ?? null,
          contact_phone: input.contactPhone ?? null,
          external_id: input.externalId ?? null,
        },
      })
      if (error) rethrow(error)
      const r = data as { conversation_id: string; message_id: number; status: ChatStatus; duplicate: boolean }
      return { conversationId: r.conversation_id, messageId: r.message_id, status: r.status, duplicate: r.duplicate }
    },

    async history(conversationId, limit) {
      const { data, error } = await db()
        .from('conversation_messages')
        .select('role, body')
        .eq('conversation_id', conversationId)
        .in('role', ['customer', 'assistant', 'staff'])
        .order('id', { ascending: false })
        .limit(limit)
      if (error) throw new Error(`chat: ${error.code ?? 'error'}`)
      return (data as { role: 'customer' | 'assistant' | 'staff'; body: string }[]).reverse()
    },

    async info(conversationId) {
      const { data, error } = await db()
        .from('conversations')
        .select('id, channel, status, quote_id, contact_phone')
        .eq('id', conversationId)
        .maybeSingle()
      if (error) throw new Error(`chat: ${error.code ?? 'error'}`)
      if (!data) return null
      return { id: data.id, channel: data.channel, status: data.status, quoteId: data.quote_id, contactPhone: data.contact_phone }
    },

    async handoff(conversationId, reason) {
      const { error } = await db().rpc('request_handoff', { p_conversation_id: conversationId, p_reason: reason })
      if (error) rethrow(error)
    },

    async linkQuote(conversationId, quoteId) {
      const { error } = await db().rpc('link_conversation_quote', { p_conversation_id: conversationId, p_quote_id: quoteId })
      if (error) rethrow(error)
    },

    async messagesAfter(channel, ref, afterId) {
      const { data: conversation, error } = await db()
        .from('conversations')
        .select('id, status')
        .eq('channel', channel)
        .eq('external_ref', ref)
        .maybeSingle()
      if (error) throw new Error(`chat: ${error.code ?? 'error'}`)
      if (!conversation) return null
      const { data, error: messagesError } = await db()
        .from('conversation_messages')
        .select('id, role, body, created_at')
        .eq('conversation_id', conversation.id)
        .gt('id', afterId)
        .order('id')
        .limit(100)
      if (messagesError) throw new Error(`chat: ${messagesError.code ?? 'error'}`)
      return { status: conversation.status as ChatStatus, messages: (data as MessageRow[]).map(toChatMessage) }
    },
  }
  return provider
}
