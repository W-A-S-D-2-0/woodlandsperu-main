import { describe, expect, it, vi } from 'vitest'
import type { ChatData, PaymentTarget } from '../data/chat-data'
import { createReceiptReader } from '../integrations/receipt-reader'
import { handlePaymentProof } from './payment-proof'
import { judgeReceipt, mentionsOrder, parseReceiptReading, type ReceiptReading } from './payment-receipt'

/** Constancias de Yape y de Plin (datos ficticios). */

const yape: ReceiptReading = { isReceipt: true, app: 'yape', amount: 26.7, recipientTail: '725', operationCode: '20000001', message: 'PED-000012' }
const plin: ReceiptReading = { isReceipt: true, app: 'plin', amount: 40, recipientTail: '725', operationCode: '50000002', message: 'PED-000012' }
const business = '965 402 725'
const order = 'PED-000012'

describe('parseReceiptReading', () => {
  it('lee el JSON de la IA, aunque venga con texto alrededor', () => {
    const text = 'Aquí va: {"is_receipt": true, "app": "yape", "amount": "26.70", "recipient_tail": "*** *** 725", "operation_code": "2000 0001", "message": " PED-000012 "}'
    expect(parseReceiptReading(text)).toEqual({ isReceipt: true, app: 'yape', amount: 26.7, recipientTail: '725', operationCode: '20000001', message: 'PED-000012' })
  })

  it('una imagen que no es Yape ni Plin no es constancia, aunque la IA diga que sí', () => {
    expect(parseReceiptReading('{"is_receipt": true, "app": "other", "amount": 10}')?.isReceipt).toBe(false)
  })

  it('devuelve null si no hay JSON', () => {
    expect(parseReceiptReading('No pude leer la imagen')).toBeNull()
    expect(parseReceiptReading('{roto')).toBeNull()
  })
})

describe('mentionsOrder', () => {
  it('acepta el código del pedido escrito de varias formas', () => {
    for (const message of ['PED-000012', 'ped000012', 'Pedido ped 000012 gracias', '000012']) expect(mentionsOrder(message, order)).toBe(true)
  })

  it('rechaza un mensaje vacío, sin código o con el de otro pedido', () => {
    for (const message of [null, '', 'Pago de la tabla', 'PED-000013', 'PED-12']) expect(mentionsOrder(message, order)).toBe(false)
  })
})

describe('judgeReceipt', () => {
  const expected = (total: number) => ({ total, businessNumber: business, orderCode: order })

  it('acepta Yape y Plin con el monto exacto, el pedido en el mensaje y el destino de Woodland', () => {
    expect(judgeReceipt(yape, expected(26.7))).toBe('ok')
    expect(judgeReceipt(plin, expected(40))).toBe('ok')
  })

  it('si no se alcanza a leer el destino, decide por lo demás', () => {
    expect(judgeReceipt({ ...yape, recipientTail: null }, expected(26.7))).toBe('ok')
  })

  it('rechaza lo que no es constancia, lo ilegible, otro monto y otro destino', () => {
    expect(judgeReceipt({ ...plin, isReceipt: false }, expected(40))).toBe('not_receipt')
    expect(judgeReceipt({ ...plin, amount: null }, expected(40))).toBe('unreadable')
    expect(judgeReceipt(yape, expected(40))).toBe('wrong_amount')
    expect(judgeReceipt({ ...plin, recipientTail: '938' }, expected(40))).toBe('wrong_recipient')
  })

  it('exige el número del pedido en el mensaje del pago y un número de operación legible', () => {
    expect(judgeReceipt({ ...plin, message: null }, expected(40))).toBe('wrong_message')
    expect(judgeReceipt({ ...plin, message: 'PED-000099' }, expected(40))).toBe('wrong_message')
    expect(judgeReceipt({ ...plin, operationCode: null }, expected(40))).toBe('no_operation')
  })
})

describe('createReceiptReader', () => {
  it('sin clave no hay lector', () => {
    expect(createReceiptReader({ apiKey: '' })).toBeNull()
  })

  it('manda la imagen a Gemini y entiende su respuesta; si falla, devuelve null', async () => {
    const answer = { candidates: [{ content: { parts: [{ text: '{"is_receipt": true, "app": "plin", "amount": 40, "recipient_tail": "725", "operation_code": "1", "message": "PED-000012"}' }] } }] }
    const ok = vi.fn(async () => Response.json(answer))
    const read = createReceiptReader({ apiKey: 'k', fetchImpl: ok as unknown as typeof fetch })!
    expect(await read({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' })).toMatchObject({ app: 'plin', amount: 40, message: 'PED-000012' })
    const body = JSON.parse((ok.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/png')

    const broken = createReceiptReader({ apiKey: 'k', fetchImpl: (async () => new Response('x', { status: 503 })) as unknown as typeof fetch, retryDelayMs: 0 })!
    expect(await broken({ bytes: new Uint8Array([1]), contentType: 'image/png' })).toBeNull()
  })
})

describe('handlePaymentProof: solo se acepta una constancia válida', () => {
  const target: PaymentTarget = { conversationId: 'c-1', orderId: 'o-1', code: order, total: 40, status: 'pending', paymentStatus: 'pending' }
  const image = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), contentType: 'image/png', ext: 'png' }
  const fakeChat = () => {
    let id = 0
    return {
      record: vi.fn(async () => ({ conversationId: 'c-1', messageId: (id += 1), status: 'open', duplicate: false })),
      findPaymentTarget: vi.fn(async () => target),
      operationUsed: vi.fn(async () => false),
      recordPayment: vi.fn(async () => ({ code: order, status: 'in_production', paymentStatus: 'paid', alreadyPaid: false })),
      handoff: vi.fn(async () => {}),
    } as unknown as ChatData & { recordPayment: ReturnType<typeof vi.fn>; handoff: ReturnType<typeof vi.fn>; operationUsed: ReturnType<typeof vi.fn> }
  }
  const run = (chat: ChatData, reading: ReceiptReading | null) => handlePaymentProof({ chat, read: async () => reading }, { channel: 'web_chat', ref: 'r', image })
  const lastReply = (r: Awaited<ReturnType<typeof run>>) => r.messages.at(-1)?.body ?? ''

  it('una constancia correcta deja el pedido pagado y guarda su número de operación', async () => {
    const chat = fakeChat()
    const result = await run(chat, plin)
    expect(chat.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ operation: { provider: 'plin', code: '50000002' } }))
    expect(lastReply(result)).toMatch(/recibimos tu pago de S\/ 40\.00/)
    expect(result.status).toBe('open')
  })

  it('una imagen que no es de Yape o Plin se rechaza, sin pago y con el botón para reintentar', async () => {
    const chat = fakeChat()
    const result = await run(chat, { ...plin, isReceipt: false, app: 'other' })
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/constancia de Yape o Plin/)
    expect(lastReply(result)).toContain(order)
    expect(lastReply(result)).toContain('Subir captura de pago')
    expect(chat.handoff).not.toHaveBeenCalled()
  })

  it('un monto distinto se rechaza y avisa al equipo', async () => {
    const chat = fakeChat()
    const result = await run(chat, yape)
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/S\/ 26\.70, pero tu pedido PED-000012 es de S\/ 40\.00/)
    expect(chat.handoff).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('needs_human')
  })

  it('un mensaje del pago sin el número del pedido no se acepta y el equipo lo revisa', async () => {
    const chat = fakeChat()
    const result = await run(chat, { ...plin, message: 'Pago de la tabla' })
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/mensaje del pago no tiene el número de tu pedido \(PED-000012\)/)
    expect(chat.handoff).toHaveBeenCalledWith('c-1', expect.stringMatching(/no nombra el pedido PED-000012/))
    expect(result.status).toBe('needs_human')
  })

  it('sin número de operación legible no se acepta (no se podría evitar que se reuse)', async () => {
    const chat = fakeChat()
    const result = await run(chat, { ...plin, operationCode: null })
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/número de operación/)
  })

  it('una constancia con un número de operación ya usado se rechaza y avisa al equipo', async () => {
    const chat = fakeChat()
    chat.operationUsed.mockResolvedValue(true)
    const result = await run(chat, plin)
    expect(chat.operationUsed).toHaveBeenCalledWith('plin', '50000002')
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/ya se usó en otro pedido/)
    expect(result.status).toBe('needs_human')
  })

  it('si la IA no puede leer la captura, el pago NO se acepta: se pide reintentar', async () => {
    const chat = fakeChat()
    const result = await run(chat, null)
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/No pude revisar tu captura/)
    expect(lastReply(result)).toContain('Subir captura de pago')
    expect(lastReply(result)).toContain(order)
  })

  it('sin lector de IA tampoco se acepta el pago', async () => {
    const chat = fakeChat()
    const result = await handlePaymentProof({ chat, read: null }, { channel: 'web_chat', ref: 'r', image })
    expect(chat.recordPayment).not.toHaveBeenCalled()
    expect(lastReply(result)).toMatch(/No pude revisar tu captura/)
  })
})
