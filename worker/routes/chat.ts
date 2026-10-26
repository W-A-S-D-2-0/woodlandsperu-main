import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { chatPollQuery, chatSendBody, chatToken, type ChatResponse } from '../../shared/api/chat'
import { ChatDataError, type ChatDataFactory } from '../data/chat-data'
import type { PublicDataFactory } from '../data/public-data'
import { handleCustomerMessage, type AssistantModelFactory } from '../services/chat'
import { createReceiptReader } from '../integrations/receipt-reader'
import { handlePaymentProof, PROOF_MAX_BYTES, sniffImage } from '../services/payment-proof'
import type { AppBindings } from '../types'
import { clientKey } from './client-key'
import { fail, parseBody, validate } from './http'

/** Hash del token del navegador: la base solo guarda esto, nunca el token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`woodland-chat:${token}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Límite por IP del chat (más holgado que el de cotizaciones, porque el widget consulta seguido). */
const rateLimit: MiddlewareHandler<AppBindings> = async (c, next) => {
  const limiter = c.env.CHAT_RATE_LIMITER as RateLimit | undefined
  if (limiter) {
    const { success } = await limiter.limit({ key: clientKey(c) })
    if (!success) {
      c.header('Retry-After', '30')
      return fail(c, 429, 'rate_limited', 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.')
    }
  }
  await next()
}

/** Chat web público: el cliente conversa con el asistente y recibe las respuestas del equipo. Sin sesión. */
export function chatRoutes(chatData: ChatDataFactory, publicData: PublicDataFactory, modelFor: AssistantModelFactory) {
  const unavailable = (c: Context<AppBindings>) => fail(c, 503, 'data_not_configured', 'El chat no está disponible por ahora.')

  return new Hono<AppBindings>()
    .post(
      '/chat/messages',
      rateLimit,
      bodyLimit({ maxSize: 8 * 1024, onError: (c) => fail(c as Context<AppBindings>, 413, 'payload_too_large', 'El mensaje es demasiado grande.') }),
      async (c) => {
        const body = await parseBody(c, chatSendBody)
        if ('response' in body) return body.response
        const chat = chatData(c.env)
        const pub = publicData(c.env)
        if (!chat || !pub) return unavailable(c)
        try {
          const turn = await handleCustomerMessage(
            { env: c.env, chat, publicData: pub, modelFor },
            { channel: 'web_chat', ref: await hashToken(body.data.token), text: body.data.message, greeted: body.data.greeted, warnings: body.data.warnings },
          )
          return c.json<ChatResponse>({ status: turn.status, messages: turn.messages, ...(turn.transient ? { transient: turn.transient } : {}) })
        } catch (err) {
          if (err instanceof ChatDataError) {
            return err.code === 'rate_limited' ? fail(c, 429, 'rate_limited', err.message) : fail(c, 422, 'invalid_request', err.message)
          }
          throw err
        }
      },
    )

    // Captura del pago por Yape: deja el pedido pagado y en producción. Sin sesión; el token del navegador identifica la conversación.
    .post(
      '/chat/payment-proof',
      rateLimit,
      bodyLimit({ maxSize: PROOF_MAX_BYTES + 64 * 1024, onError: (c) => fail(c as Context<AppBindings>, 413, 'payload_too_large', 'La imagen es muy pesada (máximo 5 MB).') }),
      async (c) => {
        const chat = chatData(c.env)
        if (!chat) return unavailable(c)
        const form = await c.req.formData().catch(() => null)
        const token = chatToken.safeParse(form?.get('token'))
        const file = form?.get('file')
        if (!token.success || !(file instanceof File)) return fail(c, 400, 'invalid_request', 'Adjunta la imagen de tu pago.')
        if (file.size > PROOF_MAX_BYTES) return fail(c, 413, 'payload_too_large', 'La imagen es muy pesada (máximo 5 MB).')
        const bytes = new Uint8Array(await file.arrayBuffer())
        const kind = sniffImage(bytes)
        if (!kind) return fail(c, 400, 'invalid_request', 'Sube la captura como imagen (JPG, PNG o WebP).')
        try {
          const done = await handlePaymentProof({ chat, read: createReceiptReader({ apiKey: c.env.GEMINI_API_KEY }) }, { channel: 'web_chat', ref: await hashToken(token.data), image: { bytes, ...kind } })
          return c.json<ChatResponse>(done)
        } catch (err) {
          if (err instanceof ChatDataError) return fail(c, err.code === 'rate_limited' ? 429 : 422, err.code, err.message)
          throw err
        }
      },
    )

    .get('/chat/messages', rateLimit, async (c) => {
      const query = validate(c, chatPollQuery, c.req.query())
      if ('response' in query) return query.response
      const chat = chatData(c.env)
      if (!chat) return unavailable(c)
      const found = await chat.messagesAfter('web_chat', await hashToken(query.data.token), query.data.after)
      return c.json<ChatResponse>(found ?? { status: 'open', messages: [] })
    })
}
