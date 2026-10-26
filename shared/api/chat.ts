/**
 * Contratos del chat web público (/api/chat/*). El navegador guarda un token aleatorio; el
 * servidor solo guarda su hash, así que quien no tiene el token no puede leer la conversación.
 */
import { z } from 'zod'

export const CHAT_MESSAGE_MAX = 1000

export const chatToken = z.string().regex(/^[A-Za-z0-9_-]{24,100}$/, 'Sesión de chat no válida.')

export const chatSendBody = z.object({
  token: chatToken,
  message: z.string().trim().min(1, 'Escribe un mensaje.').max(CHAT_MESSAGE_MAX, `El mensaje admite hasta ${CHAT_MESSAGE_MAX} caracteres.`),
  /** El chat ya mostró el saludo de Teca: si la conversación es nueva, el servidor lo guarda como primer mensaje. */
  greeted: z.boolean().optional(),
  /** Mensajes agresivos seguidos que el chat ya recibió: con el primero Teca pide repetir; si insiste, reconoce la agresión. */
  warnings: z.number().int().min(0).max(20).optional(),
})

export const chatPollQuery = z.object({
  token: chatToken,
  after: z.coerce.number().int().min(0).default(0),
})

export type ChatSendInput = z.infer<typeof chatSendBody>

export type ChatRole = 'customer' | 'assistant' | 'staff' | 'system'
export type ChatStatus = 'open' | 'needs_human' | 'with_human' | 'closed'

export interface ChatMessage {
  id: number
  role: ChatRole
  body: string
  createdAt: string
}

/** Respuesta de POST y GET /api/chat/messages. */
export interface ChatResponse {
  /** Estado de la conversación: el widget avisa cuando espera a una persona. */
  status: ChatStatus
  messages: ChatMessage[]
  /**
   * Agresión verbal: el mensaje del cliente no se guardó (no aparece en el panel) y esta es la respuesta de Teca, solo para
   * mostrarla ahora en el chat. `messages` viene vacío.
   */
  transient?: { reply: string; aggression: boolean }
}
