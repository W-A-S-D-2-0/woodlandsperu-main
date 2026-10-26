import { describe, expect, it, vi } from 'vitest'
import type { ChatData, PaymentTarget } from '../data/chat-data'
import { createReceiptReader } from '../integrations/receipt-reader'
import { handlePaymentProof } from './payment-proof'
import { judgeReceipt, parseReceiptReading, type ReceiptReading } from './payment-receipt'

/** Constancias de Yape y de Plin (datos ficticios). */

const yape: ReceiptReading = { isReceipt: true, app: 'yape', amount: 26.7, recipientTail: '725', operationCode: '20000001' }
const plin: ReceiptReading = { isReceipt: true, app: 'plin', amount: 40, recipientTail: '725', operationCode: '50000002' }
const business = '965 402 725'

describe('parseReceiptReading', () => {
  it('lee el JSON de la IA, aunque venga con texto alrededor', () => {
    const text = 'Aquí va: {"is_receipt": true, "app": "yape", "amount": "26.70", "recipient_tail": "*** *** 725", "operation_code": "2000 0001"}'
    expect(parseReceiptReading(text)).toEqual({ isReceipt: true, app: 'yape', amount: 26.7, recipientTail: '725', operationCode: '20000001' })
  })

  it('una imagen que no es Yape ni Plin no es constancia, aunque la IA diga que sí', () => {
    expect(parseReceiptReading('{"is_receipt": true, "app": "other", "amount": 10}')?.isReceipt).toBe(false)
  })

  it('devuelve null si no hay JSON', () => {
    expect(parseReceiptReading('No pude leer la imagen')).toBeNull()
    expect(parseReceiptReading('{roto')).toBeNull()
  })
})

describe('judgeReceipt', () => {
  it('acepta Yape y Plin con el monto exacto y el destino de Woodland', () => {
    expect(judgeReceipt(yape, { total: 26.7, businessNumber: business })).toBe('ok')
    expect(judgeReceipt(plin, { total: 40, businessNumber: business })).toBe('ok')
  })

  it('si no se alcanza a leer el destino, decide por el monto', () => {
    expect(judgeReceipt({ ...yape, recipientTail: null }, { total: 26.7, businessNumber: business })).toBe('ok')
  })

  it('rechaza lo que no es constancia, lo ilegible, otro monto y otro destino', () => {
    const expected = { total: 40, businessNumber: business }
    expect(judgeReceipt({ ...plin, isReceipt: false }, expected)).toBe('not_receipt')
    expect(judgeReceipt({ ...plin, amount: null }, expected)).toBe('unreadable')
    expect(judgeReceipt(yape, expected)).toBe('wrong_amount')
    expect(judgeReceipt({ ...plin, recipientTail: '938' }, expected)).toBe('wrong_recipient')
  })
})

describe('createReceiptReader', () => {
  it('sin clave no hay lector (el pago queda para revisión)', () => {
    expect(createReceiptReader({ apiKey: '' })).toBeNull()
  })

  it('manda la imagen a Gemini y entiende su respuesta; si falla, devuelve null', async () => {
    const answer = { candidates: [{ content: { parts: [{ text: '{"is_receipt": true, "app": "plin", "amount": 40, "recipient_tail": "725", "operation_code": "1"}' }] } }] }
    const ok = vi.fn(async () => Response.json(answer))
    const read = createReceiptReader({ apiKey: 'k', fetchImpl: ok as unknown as typeof fetch })!
    expect(await read({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' })).toMatchObject({ app: 'plin', amount: 40 })
    const body = JSON.parse((ok.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/png')

    const broken = createReceiptReader({ apiKey: 'k', fetchImpl: (async () => new Response('x', { status: 503 })) as unknown as typeof fetch, retryDelayMs: 0 })!
    expect(await broken({ bytes: new Uint8Array([1]), contentType: 'image/png' })).toBeNull()
  })
})

describe('handlePaymentProof con lector de capturas', () => {
  const target: PaymentTarget = { conversationId: 'c-1', orderId: 'o-1', code: 'PED-000012', total: 40, status: 'pending', paymentStatus: 'pending' }
  const image = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), contentType: 'image/png', ext: 'png' }
  const fakeChat = () => {
    let id = 0
    return {
      record: vi.fn(async () => ({ conversationId: 'c-1', messageId: (id += 1), status: 'open', duplicate: false })),
      findPaymentTarget: vi.fn(async () => target),
      recordPayment: vi.fn(async () => ({ code: 'PED-000012', status: 'in_production', paymentStatus: 'paid', alreadyPaid: false })),
      handoff: vi.fn(async () => {}),
    } as unknown as ChatData & { recordPayment: ReturnType<typeof vi.fn>; handoff: ReturnType<typeof vi.fn> }
  }
  const run = (chat: ChatData, reading: ReceiptReading | null) =>
    handlePaymentProof({ chat, read: async () => reading }, { channel: 'web_chat', ref: 'r', image })

  it('una constancia correcta deja el pedido pagado', async () => {
    const chat = fakeChat()
    const result = await run(chat, plin)
    expect(chat.recordPayment).toHaveBeenCalledTimes(1)
    expect(result.messages.at(-1)?.body).toMatch(/recibimos tu pago de S\/ 40\.00/)
    expect(result.status).toBe('open')
  })

  it('una imagen que no es de Yape o Plin se rechaza, sin pago y con el botón para reintentar', async () => {
    const chat = fakeChat()
    const result = await run(chat, { ...plin, isReceipt: false, app: 'other' })
    expect(chat.recordPayment).not.toHaveBeenCalled()
    const reply = result.messages.at(-1)?.body ?? ''
    expect(reply).toMatch(/constancia de Yape o Plin/)
    expect(reply).toContain('PED-000012')
    expect(reply).toContain('Subir captura de pago')
    expect(chat.handoff).not.toHaveBeenCalled()
  })

  it('un monto distinto se rechaza y avisa al equipo', async () => {
    const chat = fakeChat()
    const result = await run(chat, yape)
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(result.messages.at(-1)?.body).toMatch(/S\/ 26\.70, pero tu pedido PED-000012 es de S\/ 40\.00/)
    expect(chat.handoff).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('needs_human')
  })

  it('si la IA no pudo leer la captura, el pago se registra y el equipo la revisa en el panel', async () => {
    const chat = fakeChat()
    const result = await run(chat, null)
    expect(chat.recordPayment).toHaveBeenCalledTimes(1)
    expect(chat.handoff).toHaveBeenCalledWith('c-1', expect.stringMatching(/revisarla en el panel/))
    expect(result.status).toBe('needs_human')
  })
})
