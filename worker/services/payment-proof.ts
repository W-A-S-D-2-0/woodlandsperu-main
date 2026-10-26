import type { ChatMessage, ChatStatus } from '../../shared/api/chat'
import type { ChatChannel, ChatData, PaymentTarget, ProofImage } from '../data/chat-data'
import type { ReceiptReader } from '../integrations/receipt-reader'
import { PROOF_BUTTON_LABEL, yapePlin } from '../../src/content/payment'
import { judgeReceipt, type ReceiptReading, type ReceiptVerdict } from './payment-receipt'

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

/** Qué le dice Teca al cliente cuando la captura no sirve para el pedido. Siempre lleva el código y el botón para reintentar. */
function rejectionText(verdict: Exclude<ReceiptVerdict, 'ok'>, target: PaymentTarget, reading: ReceiptReading): string {
  const retry = `Toca «${PROOF_BUTTON_LABEL}» (el clip junto al mensaje) para subir la captura correcta de tu pedido ${target.code}.`
  switch (verdict) {
    case 'not_receipt':
      return `No pude reconocer esa imagen como una constancia de Yape o Plin. Sube la captura que te muestra la app después de pagar, con el monto y el número de operación.

${retry}`
    case 'unreadable':
      return `Reconocí tu constancia, pero no pude leer el monto. Sube una captura completa y nítida.

${retry}`
    case 'wrong_amount':
      return `La captura muestra ${money(reading.amount ?? 0)}, pero tu pedido ${target.code} es de ${money(target.total)}. Revisa el monto y vuelve a subir la captura correcta. Si pagaste otro monto, ya avisé al equipo para que lo revise.

${retry}`
    case 'wrong_recipient':
      return `El pago de la captura no parece ir al número de Woodland (${yapePlin.number?.trim() ?? ''}). Revisa el destino y vuelve a subir la captura correcta. Ya avisé al equipo para que lo revise.

${retry}`
  }
}

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
  /** `read`: lector de capturas (IA). Sin él, la captura no se verifica y el pedido pasa a pagado como antes. */
  services: { chat: ChatData; read?: ReceiptReader | null },
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

  // La captura debe ser una constancia de Yape o Plin por el monto del pedido; si no, no se registra el pago.
  let unverified = false
  let operation: { provider: 'yape' | 'plin'; code: string } | undefined
  if (services.read) {
    const reading = await services.read(input.image)
    if (reading) {
      const verdict = judgeReceipt(reading, { total: target.total, businessNumber: yapePlin.number })
      if (verdict !== 'ok') {
        await reply(rejectionText(verdict, target, reading))
        if (verdict === 'wrong_amount' || verdict === 'wrong_recipient') {
          await chat.handoff(target.conversationId, `Captura de pago del pedido ${target.code} no coincide (${verdict === 'wrong_amount' ? `monto S/ ${reading.amount ?? '?'} en vez de ${money(target.total)}` : 'destino distinto al número de Woodland'}).`)
          result.status = 'needs_human'
        }
        return result
      }
      // La misma constancia no sirve para dos pedidos.
      if (reading.operationCode && (reading.app === 'yape' || reading.app === 'plin')) {
        operation = { provider: reading.app, code: reading.operationCode }
        if (await chat.operationUsed(operation.provider, operation.code)) {
          await reply(`Esa constancia de pago ya se usó en otro pedido. Sube la captura del pago de tu pedido ${target.code}.

Toca «${PROOF_BUTTON_LABEL}» (el clip junto al mensaje) para intentarlo de nuevo.`)
          await chat.handoff(target.conversationId, `Pedido ${target.code}: la captura repite un número de operación ya usado (${operation.provider} ${operation.code}).`)
          result.status = 'needs_human'
          return result
        }
      }
    } else unverified = true
  }

  try {
    const paid = await chat.recordPayment({ orderId: target.orderId, conversationId: target.conversationId, image: input.image, ...(operation ? { operation } : {}) })
    if (paid.status === 'in_production') {
      await reply(`¡Listo, recibimos tu pago de ${money(target.total)}! Tu pedido ${paid.code} ya está en producción. Te avisamos cuando esté listo para la entrega. ¡Gracias por elegir Woodland!`)
    } else {
      await reply(`¡Listo, recibimos tu pago de ${money(target.total)}! Tu pedido ${paid.code} quedó pagado; el equipo termina de confirmarlo y te escribe con la fecha de entrega. ¡Gracias por elegir Woodland!`)
      await chat.handoff(target.conversationId, `Pedido ${paid.code} pagado por Yape, pero no se pudo confirmar solo (revisar stock).`)
      result.status = 'needs_human'
    }
    // La IA no pudo leer la captura: el pago quedó registrado, pero el equipo debe revisarla en el panel.
    if (unverified && result.status !== 'needs_human') {
      await chat.handoff(target.conversationId, `Pedido ${paid.code}: no se pudo leer la captura de pago automáticamente; revisarla en el panel.`)
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
