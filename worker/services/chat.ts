import type { ChatMessage, ChatStatus } from '../../shared/api/chat'
import type { CatalogResponse } from '../../shared/api/contracts'
import { chatGreeting } from '../../src/content/chat-greeting'
import { createGeminiModel } from '../integrations/gemini'
import type { ChatChannel, ChatData } from '../data/chat-data'
import type { PublicData } from '../data/public-data'
import { alliesReply, engravingFirst, greetingNameReply, guidedFlowFirst, createGuidedModel, historyHasOrder, quickInfoReply, runAssistant, smallTalkReply, wantsHuman, type AssistantModel } from './assistant'

/** Cuántos mensajes previos ve el asistente: lo bastante para recordar nombre, productos y grabado de toda la charla. */
const HISTORY_LIMIT = 40

/** Crea el modelo del turno. Sin clave de IA se usa el modo guiado. */
export type AssistantModelFactory = (env: Env, catalog: CatalogResponse) => AssistantModel

/** Gemini si hay clave; si falla (red, cuota), ese turno se responde en modo guiado. */
export const createAssistantModel: AssistantModelFactory = (env, catalog) => {
  const guided = createGuidedModel(catalog)
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) return guided
  const gemini = createGeminiModel({ apiKey, model: env.GEMINI_MODEL })
  return {
    async generate(input) {
      // Pedir o cotizar va por el flujo guiado: es instantáneo, no depende de la IA y no se cruza con ella.
      const flow = guidedFlowFirst(input.history, catalog)
      if (flow) return flow
      // Saludos y agradecimientos: respuesta inmediata, sin gastar una consulta a la IA.
      const talk = smallTalkReply(input.history.findLast((m) => m.role === 'customer')?.body ?? '')
      if (talk) return { text: talk }
      // Respuesta al «¿cómo te llamas?» del saludo.
      const welcome = greetingNameReply(input.history)
      if (welcome) return { text: welcome }
      // Dudas de personalización: imágenes de la tabla con el nombre en otras posiciones y WhatsApp de Brigitte.
      const engraving = engravingFirst(input.history, catalog)
      if (engraving) return { text: engraving }
      // Los aliados salen de la misma lista que la web: respuesta inmediata y sin que la IA invente nada.
      const allies = alliesReply(input.history.findLast((m) => m.role === 'customer')?.body ?? '')
      if (allies) return { text: allies }
      // Consultas simples (precios, productos, plazos): respuesta inmediata, sin esperar a la IA.
      const quick = quickInfoReply(input.history.findLast((m) => m.role === 'customer')?.body ?? '', catalog)
      if (quick) return { text: quick }
      try {
        return await gemini.generate(input)
      } catch (err) {
        console.error(`[assistant] ${(err as Error).message}; se usa el modo guiado`)
        return guided.generate(input)
      }
    },
  }
}

export interface ChatServices {
  env: Env
  chat: ChatData
  publicData: PublicData
  modelFor: AssistantModelFactory
}

export interface CustomerMessage {
  channel: ChatChannel
  ref: string
  text: string
  contactName?: string
  contactPhone?: string
  externalId?: string
  /** El chat web ya mostró el saludo de Teca (que pide el nombre). */
  greeted?: boolean
}

export interface TurnResult {
  conversationId: string
  status: ChatStatus
  /** El mensaje del cliente y las respuestas nuevas, en orden. */
  messages: ChatMessage[]
  /** Textos que el asistente respondió en este turno (para enviarlos por WhatsApp). */
  assistantReplies: string[]
  duplicate: boolean
}

const now = () => new Date().toISOString()

/**
 * Procesa un mensaje del cliente: lo registra y el asistente responde siempre. Si el cliente pide una
 * persona, presenta un reclamo o el asistente no puede resolver algo, la conversación se anota para
 * seguimiento del equipo ("needs_human") pero el asistente sigue atendiendo: el equipo no chatea con
 * el cliente desde el panel.
 */
export async function handleCustomerMessage(services: ChatServices, message: CustomerMessage): Promise<TurnResult> {
  const { chat, publicData } = services
  // El saludo que vio el cliente (donde Teca pide su nombre) se guarda primero, para que la respuesta se entienda en contexto.
  if (message.greeted && (await chat.messagesAfter(message.channel, message.ref, 0)) === null) {
    await chat.record({ channel: message.channel, ref: message.ref, role: 'assistant', body: chatGreeting })
  }
  const recorded = await chat.record({
    channel: message.channel,
    ref: message.ref,
    role: 'customer',
    body: message.text,
    contactName: message.contactName,
    contactPhone: message.contactPhone,
    externalId: message.externalId,
  })

  const result: TurnResult = {
    conversationId: recorded.conversationId,
    status: recorded.status,
    messages: [{ id: recorded.messageId, role: 'customer', body: message.text, createdAt: now() }],
    assistantReplies: [],
    duplicate: recorded.duplicate,
  }
  // Reintento del proveedor: ya se respondió la primera vez.
  if (recorded.duplicate) return result

  const reply = async (body: string) => {
    const saved = await chat.record({ channel: message.channel, ref: message.ref, role: 'assistant', body })
    result.messages.push({ id: saved.messageId, role: 'assistant', body, createdAt: now() })
    result.assistantReplies.push(body)
  }
  const handoff = async (reason: string) => {
    await chat.handoff(recorded.conversationId, reason)
    result.status = 'needs_human'
  }
  // Pedir una persona o reclamar se anota siempre, aunque el modelo no lo haga; el asistente igual responde.
  if (wantsHuman(message.text)) await handoff('El cliente pidió una persona o presentó un reclamo.')

  try {
    const [catalog, history, info] = await Promise.all([
      publicData.listCatalog(),
      chat.history(recorded.conversationId, HISTORY_LIMIT),
      chat.info(recorded.conversationId),
    ])
    const turn = await runAssistant({
      model: services.modelFor(services.env, catalog),
      catalog,
      history,
      hasQuote: info?.quoteId != null,
      hasOrder: historyHasOrder(history),
      submitQuote: (request) =>
        publicData.submitQuote(request, message.channel),
      submitOrder: (request) => publicData.submitOrder(request, message.channel),
    })
    await reply(turn.reply)
    if (turn.quote) await chat.linkQuote(recorded.conversationId, turn.quote.quoteId)
    if (turn.handoffReason && result.status !== 'needs_human') await handoff(turn.handoffReason)
  } catch (err) {
    // Nunca dejar al cliente sin respuesta: se disculpa, se anota para el equipo y puede reintentar.
    console.error(`[chat] ${(err as Error).message}`)
    await reply('Tuve un problema para responderte en este momento. Dejé tu consulta anotada para el equipo; intenta escribirme de nuevo en un momento o escribe «quiero hacer un pedido».')
    if (result.status !== 'needs_human') await handoff('Falló el asistente al responder.')
  }
  return result
}
