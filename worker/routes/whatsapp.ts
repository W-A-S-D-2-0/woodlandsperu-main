import type { Context } from 'hono'
import { Hono } from 'hono'
import type { ChatDataFactory } from '../data/chat-data'
import type { PublicDataFactory } from '../data/public-data'
import { parseWebhook, readWhatsAppConfig, sendWhatsAppText, verifySignature } from '../integrations/whatsapp'
import { handleCustomerMessage, type AssistantModelFactory } from '../services/chat'
import type { AppBindings } from '../types'
import { fail } from './http'

const MAX_BODY = 256 * 1024

const ATTACHMENT_REPLY = 'Recibí tu mensaje. Por ahora solo entiendo texto: ¿me lo puedes escribir? Dejé anotado el archivo para que el equipo lo revise.'

/**
 * Webhook de WhatsApp Cloud API. Responde 503 mientras no estén los secretos de Meta.
 * Cada evento se verifica con la firma HMAC antes de procesarse y es idempotente por id de mensaje.
 */
export function whatsappRoutes(chatData: ChatDataFactory, publicData: PublicDataFactory, modelFor: AssistantModelFactory, fetchImpl?: typeof fetch) {
  const notConfigured = (c: Context<AppBindings>) => fail(c, 503, 'whatsapp_not_configured', 'WhatsApp no está configurado.')

  return new Hono<AppBindings>()
    // Meta valida la URL con un desafío al registrar el webhook.
    .get('/whatsapp/webhook', (c) => {
      const expected = c.env.WHATSAPP_VERIFY_TOKEN?.trim()
      if (!expected) return notConfigured(c)
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = c.req.query()
      if (mode === 'subscribe' && token === expected && challenge) return c.text(challenge)
      return fail(c, 403, 'forbidden', 'Verificación no válida.')
    })

    .post('/whatsapp/webhook', async (c) => {
      const secret = c.env.WHATSAPP_APP_SECRET?.trim()
      if (!secret) return notConfigured(c)

      const raw = await c.req.text()
      if (raw.length > MAX_BODY) return fail(c, 413, 'payload_too_large', 'Evento demasiado grande.')
      if (!(await verifySignature(secret, raw, c.req.header('X-Hub-Signature-256')))) {
        return fail(c, 401, 'invalid_signature', 'Firma no válida.')
      }

      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch {
        return fail(c, 400, 'invalid_json', 'El cuerpo debe ser JSON válido.')
      }

      const chat = chatData(c.env)
      const pub = publicData(c.env)
      if (!chat || !pub) return fail(c, 503, 'data_not_configured', 'El servicio no está disponible por ahora.')
      const config = readWhatsAppConfig(c.env)
      const send = async (to: string, text: string) => {
        if (!config) return
        try {
          await sendWhatsAppText(config, to, text, fetchImpl)
        } catch (err) {
          // El mensaje ya quedó registrado; el equipo lo ve en el panel aunque no se haya podido enviar.
          console.error(`[whatsapp] envío fallido → ${(err as Error).message}`)
        }
      }

      for (const message of parseWebhook(payload)) {
        if (message.text === null) {
          // Imagen, audio, documento…: el asistente no los entiende. Se registran y los ve una persona.
          const saved = await chat.record({
            channel: 'whatsapp',
            ref: message.from,
            role: 'customer',
            body: `[El cliente envió un archivo: ${message.type}]`,
            contactName: message.name,
            contactPhone: message.from,
            externalId: message.id,
          })
          if (!saved.duplicate) {
            await chat.record({ channel: 'whatsapp', ref: message.from, role: 'assistant', body: ATTACHMENT_REPLY })
            await chat.handoff(saved.conversationId, `Envió un archivo (${message.type}).`)
            await send(message.from, ATTACHMENT_REPLY)
          }
          continue
        }

        const turn = await handleCustomerMessage(
          { env: c.env, chat, publicData: pub, modelFor },
          {
            channel: 'whatsapp',
            ref: message.from,
            text: message.text,
            contactName: message.name,
            contactPhone: message.from,
            externalId: message.id,
          },
        )
        for (const reply of turn.assistantReplies) await send(message.from, reply)
      }
      // 200 siempre que el evento sea auténtico: Meta reintenta si no.
      return c.json({ ok: true })
    })
}
