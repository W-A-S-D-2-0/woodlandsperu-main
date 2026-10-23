import type { ChatMessage, ChatRole, ChatStatus } from '../../shared/api/chat'
import type { HistoryMessage } from '../services/assistant'

export type ChatChannel = 'web_chat' | 'whatsapp'

/** Error de negocio de la base apto para mostrar (límite de mensajes, datos no válidos). */
export class ChatDataError extends Error {
  readonly code: 'rate_limited' | 'invalid_request'

  constructor(code: 'rate_limited' | 'invalid_request', message: string) {
    super(message)
    this.code = code
  }
}

export interface RecordInput {
  channel: ChatChannel
  /** Web: hash del token de sesión. WhatsApp: teléfono del cliente. */
  ref: string
  role: 'customer' | 'assistant' | 'system'
  body: string
  contactName?: string
  contactPhone?: string
  /** Id del mensaje en el proveedor: un reintento con el mismo id no se duplica. */
  externalId?: string
}

export interface RecordedMessage {
  conversationId: string
  messageId: number
  status: ChatStatus
  duplicate: boolean
}

export interface ConversationInfo {
  id: string
  channel: ChatChannel
  status: ChatStatus
  quoteId: string | null
  contactPhone: string | null
}

/** Persistencia de las conversaciones. Se inyecta para probar sin red; la real usa la clave de servicio. */
export interface ChatData {
  record(input: RecordInput): Promise<RecordedMessage>
  /** Últimos mensajes, del más antiguo al más reciente. */
  history(conversationId: string, limit: number): Promise<HistoryMessage[]>
  info(conversationId: string): Promise<ConversationInfo | null>
  handoff(conversationId: string, reason: string): Promise<void>
  linkQuote(conversationId: string, quoteId: string): Promise<void>
  /** Mensajes visibles para el cliente posteriores a `afterId`. Null si la conversación no existe. */
  messagesAfter(channel: ChatChannel, ref: string, afterId: number): Promise<{ status: ChatStatus; messages: ChatMessage[] } | null>
}

export type ChatDataFactory = (env: Env) => ChatData | null

export type { ChatRole }
