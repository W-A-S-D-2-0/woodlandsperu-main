import type { ChatMessage, ChatStatus } from '../../shared/api/chat'
import type { ChatChannel, ChatData, ProofImage } from '../data/chat-data'

/** Tamaño máximo de la captura. Una captura de pantalla de celular pesa mucho menos. */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024

/** Reconoce JPEG, PNG y WebP por sus primeros bytes (el tipo que declara el navegador no se toma por cierto). */
export function sniffImage(bytes: Uint8Array): Pick<ProofImage, 'contentType' | 'ext'> | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: 'image/png', ext: 'png' }
  const tag = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4))
  if (tag(0) === 'RIFF' && tag(8) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' }
  return null
}

const money = (value: number) => `S/ ${value.toFixed(2)}`
const now = () => new Date().toISOString()

export interface ProofResult {
  status: ChatStatus
  messages: ChatMessage[]
}

/**
 * Procesa la captura del pago que sube el cliente: la guarda, deja el pedido pagado y en producción en el panel,
 * y le responde en el chat. No depende de la IA. Nunca promete algo que no pasó: si no hay un pedido esperando
 * pago, lo dice.
 */
export async function handlePaymentProof(
  services: { chat: ChatData },
  input: { channel: ChatChannel; ref: string; image: ProofImage },
): Promise<ProofResult> {
  const { chat } = services
  const sent = await chat.record({ channel: input.channel, ref: input.ref, role: 'customer', body: '📎 Subí la captura de mi pago.' })
  const result: ProofResult = {
    status: sent.status,
    messages: [{ id: sent.messageId, role: 'customer', body: '📎 Subí la captura de mi pago.', createdAt: now() }],
  }
  const reply = async (body: string) => {
    const saved = await chat.record({ channel: input.channel, ref: input.ref, role: 'assistant', body })
    result.messages.push({ id: saved.messageId, role: 'assistant', body, createdAt: now() })
  }

  const target = await chat.findPaymentTarget(input.channel, input.ref)
  if (!target) {
    await reply('Todavía no tengo un pedido tuyo pendiente de pago. Cuando hagas tu pedido aquí en el chat, te paso los datos de Yape y ahí subes la captura. Escribe «quiero hacer un pedido» para empezar.')
    return result
  }
  if (target.paymentStatus === 'paid') {
    await reply(`Tu pedido ${target.code} ya figura como pagado. ¡Gracias! Te avisamos cuando esté listo.`)
    return result
  }

  try {
    const paid = await chat.recordPayment({ orderId: target.orderId, conversationId: target.conversationId, image: input.image })
    if (paid.status === 'in_production') {
      await reply(`¡Listo, recibimos tu pago de ${money(target.total)}! Tu pedido ${paid.code} ya está en producción. Te avisamos cuando esté listo para la entrega. ¡Gracias por elegir Woodland!`)
    } else {
      await reply(`¡Listo, recibimos tu pago de ${money(target.total)}! Tu pedido ${paid.code} quedó pagado; el equipo termina de confirmarlo y te escribe con la fecha de entrega. ¡Gracias por elegir Woodland!`)
      await chat.handoff(target.conversationId, `Pedido ${paid.code} pagado por Yape, pero no se pudo confirmar solo (revisar stock).`)
      result.status = 'needs_human'
    }
  } catch (err) {
    console.error(`[pago] ${(err as Error).message}`)
    await reply('Recibí tu captura, pero tuve un problema para registrar el pago en este momento. Ya dejé el aviso al equipo para que lo revise; no necesitas pagar de nuevo.')
    await chat.handoff(target.conversationId, `No se pudo registrar el pago del pedido ${target.code}: revisar la captura.`)
    result.status = 'needs_human'
  }
  return result
}
